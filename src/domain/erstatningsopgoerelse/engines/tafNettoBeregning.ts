import type { StamdataValues } from '../../../schemas/formSchemas';
import type { TafCalculationValues } from './tafCalculationInput';
import { amountValueToNumber } from '../../../utils/expressionAmount';
import {
  buildBeregningsperiodeRange,
  buildIncomeForRanges,
  type IncomePeriodResult,
  type IsoRange,
} from '../helpers/indtaegtPerioder';
import { computeTafBeregningsenhed, TAF_BEREGNES_SOM } from '../helpers/tafBeregningsenhed';
import { getAngivetLoenOpreguleresFraDato } from '../helpers/angivetLoenHelpers';
import { resolveAnvendtReguleringsdato } from '../helpers/eoSharedUtils';
import { isISODateString, type ISODateString } from '../../../types/branded';
import { buildIndkomstSkadestidspunkt } from './indkomstSkadestidspunktBeregning';
import { buildTafArbejdsdageSet, buildLoenudviklingBeregning, type LoenudviklingBeregning } from './loenudviklingBeregning';
import type { ReguleringOpslag } from './regulering/reguleringOpslag';
import { buildOffentligeYdelserUdviklingModel } from './offentligeYdelserUdviklingBeregning';
import { computeSygeferiegodtgoerelse } from './sfggEngine';
import type { SygeferiegodtgoerelseResult } from './sfggResult';
import type {
  Calculable,
  IndkomstSkadestidspunktModel,
  LoenudviklingModel,
  OffentligeYdelserUdviklingModel,
  TafIndtaegterModel,
} from '../shared/eoTypes';
import type { MoneyOre } from '../../money/money';
import {
  clampMoneyOreToZero,
  fromKroner,
  subtractMoneyOre,
  sumMoneyOre,
  zeroMoneyOre,
} from '../../money/money';
import { asCalculable } from '../shared/eoTypes';
import { buildTafIndtaegterBeregning } from './tafIndtaegterBeregning';
import type { MidlertidigtEetAfgoerelseGroup } from '../helpers/midlertidigtEetInsertRows';

const notCalculable = <T>(reason: string): Calculable<T> => ({ status: 'not_calculable', reason });
const notCalculableMoney = (reason: string): Calculable<MoneyOre> => notCalculable<MoneyOre>(reason);

/**
 * Reguleringsopslaget pr. ansættelsesforhold til sygeferiegodtgørelsen. Ved «Beregningsperiode» har hvert
 * ansættelsesforhold med lønudvikling sit eget opslag; ellers (angivet løn, eller ingen lønindkomst i
 * beregningsperioden) gælder det fælles opslag for alle ansættelsesforhold.
 *
 * Opslaget afhænger ikke af, om TAF-segmenterne har arbejdsdage: før byggede SFGG på de TAF-segmenter,
 * der overlevede frasorteringen af segmenter uden arbejdsdage, og fik da hverken segment eller regulering
 * (fund A4) – ved angivet løn kunne hele opslaget forsvinde.
 */
export const buildSfggReguleringOpslagMap = (
  values: TafCalculationValues,
  loenudvikling: LoenudviklingBeregning | null
): ReadonlyMap<string, ReguleringOpslag> | undefined => {
  if (!loenudvikling) return undefined;
  const { perAnsaettelse, faelles } = loenudvikling.reguleringOpslag;
  if (perAnsaettelse.size > 0) return perAnsaettelse;
  if (!faelles) return undefined;
  return new Map((values.loenindkomstAnsaettelsesforhold ?? []).map((employment) => [employment.id, faelles] as const));
};

const buildTafIndtaegterModel = (
  values: TafCalculationValues,
  ranges: readonly IsoRange[],
  midlertidigtEetGroups: readonly MidlertidigtEetAfgoerelseGroup[]
): TafIndtaegterModel => {
  const result = buildTafIndtaegterBeregning(values, ranges, { midlertidigtEetGroups });
  return {
    entries: result.entries.map(({ label, amountOre }) => ({ label, amountOre })),
    forbeholdYdelsestyper: result.forbeholdYdelsestyper,
    total: asCalculable(result.totalOre),
  };
};

const resolveOffentligeYdelserReguleringsBaseIso = (
  values: TafCalculationValues,
  stamdataValues: StamdataValues
): ISODateString | undefined => {
  if (values.beregnesUdFra !== 'Beregningsperiode') {
    return resolveAnvendtReguleringsdato({
      beregnesUdFra: values.beregnesUdFra,
      angivetLoenMetodeOpreguleresFraDato: getAngivetLoenOpreguleresFraDato(values),
      saerligFraDatoRegulering: undefined,
      beregningsperiodeTil: values.tafBeregningsperiodeTil,
      skadedato: stamdataValues.skadedato,
    });
  }

  // Ydelsens niveau følger beregningsperioden og må aldrig afhænge af jobkortenes rækkefølge.
  return isISODateString(values.tafBeregningsperiodeTil) ? values.tafBeregningsperiodeTil : undefined;
};

export type TafNettoBeregningResult = Readonly<{
  harTafPerioder: boolean;
  tafBeregningsenhed: ReturnType<typeof computeTafBeregningsenhed>;
  indkomstSkadestidspunkt: IndkomstSkadestidspunktModel | null;
  loenudvikling: LoenudviklingModel | null;
  offentligeYdelserUdvikling: OffentligeYdelserUdviklingModel | null;
  tafIndtaegter: TafIndtaegterModel | null;
  tidligereModtagetTaf: Calculable<MoneyOre>;
  sygeferiegodtgoerelse: SygeferiegodtgoerelseResult;
  /**
   * TAF før fradrag af `tidligereModtagetTaf`.
   * Fradraget foretages downstream i `buildEoComputedTotals` og `buildTafPerYearBuildOutcome`.
   * Forbrugere der anvender dette felt direkte skal selv håndtere fradraget.
   */
  tabtArbejdsfortjenesteOre: MoneyOre;
}>;

export const computeTafNettoBeregning = (
  values: TafCalculationValues,
  stamdataValues: StamdataValues,
  options: Readonly<{
    tafRanges: readonly IsoRange[];
    midlertidigtEetGroups?: readonly MidlertidigtEetAfgoerelseGroup[];
  }>
): TafNettoBeregningResult => {
  const tafRanges = options.tafRanges;
  const midlertidigtEetGroups = options.midlertidigtEetGroups ?? [];
  const beregnes = values.kravPaaTabtArbejdsfortjeneste === 'Ja';
  const harTafPerioder = beregnes && tafRanges.length > 0;
  const tafBeregningsenhed = computeTafBeregningsenhed(values);
  const beregningsperiodeRange = values.beregnesUdFra === 'Beregningsperiode'
    ? buildBeregningsperiodeRange(values)
    : undefined;
  const incomeForBeregningsperiode: IncomePeriodResult | null =
    harTafPerioder && beregningsperiodeRange
      ? buildIncomeForRanges(values, [beregningsperiodeRange], undefined, undefined)
      : null;

  const indkomstSkadestidspunkt = harTafPerioder
    ? buildIndkomstSkadestidspunkt(values, stamdataValues, tafBeregningsenhed, {
      incomeForBeregningsperiode,
    })
    : null;
  const loenudviklingBeregning = harTafPerioder
    ? buildLoenudviklingBeregning(values, stamdataValues, tafBeregningsenhed, indkomstSkadestidspunkt, {
      tafRanges,
      incomeForBeregningsperiode,
    })
    : null;
  const loenudvikling = loenudviklingBeregning?.model ?? null;
  const offentligeYdelserReguleringsBaseIso = resolveOffentligeYdelserReguleringsBaseIso(values, stamdataValues);
  const offentligeYdelserDivisor =
    tafBeregningsenhed === TAF_BEREGNES_SOM.MAANEDER
      ? indkomstSkadestidspunkt?.maaneder
      : indkomstSkadestidspunkt?.arbejdsdage;
  const offentligeYdelserUdvikling =
    harTafPerioder && incomeForBeregningsperiode
      ? buildOffentligeYdelserUdviklingModel({
        values,
        incomeForBeregningsperiode,
        divisor: offentligeYdelserDivisor,
        tafBeregningsenhed,
        tafRanges,
        tafArbejdsdageSet: tafBeregningsenhed === TAF_BEREGNES_SOM.ARBEJDSDAGE
          ? buildTafArbejdsdageSet(values, tafRanges)
          : null,
        reguler: values.regulerOffentligeYdelser === 'Ja',
        reguleringsBaseIso: offentligeYdelserReguleringsBaseIso,
      })
      : null;
  const tafIndtaegter = harTafPerioder ? buildTafIndtaegterModel(values, tafRanges, midlertidigtEetGroups) : null;
  const sygeferiegodtgoerelse = harTafPerioder
    ? computeSygeferiegodtgoerelse({
      values,
      stamdata: stamdataValues,
      tafRanges,
      reguleringOpslagPerAnsaettelse: buildSfggReguleringOpslagMap(values, loenudviklingBeregning),
    })
    : { totalOre: zeroMoneyOre(), perAnsaettelsesforhold: [], perYear: [], firstExcludedDate: null };

  const tidligereModtagetTafKroner = amountValueToNumber(values.tidligereModtagetTaf);
  const tidligereModtagetTaf =
    tidligereModtagetTafKroner !== undefined
      ? asCalculable(fromKroner(tidligereModtagetTafKroner))
      : notCalculableMoney('Ikke angivet');

  let tabtArbejdsfortjenesteOre = zeroMoneyOre();
  if (harTafPerioder) {
    // Invariant: loenudvikling og tafIndtaegter er altid sat når harTafPerioder er true,
    // da begge bygges betinget af harTafPerioder ovenfor. Disse guards er logisk umulige.
    if (!loenudvikling || !tafIndtaegter) {
      return {
        harTafPerioder,
        tafBeregningsenhed,
        indkomstSkadestidspunkt,
        loenudvikling,
        offentligeYdelserUdvikling,
        tafIndtaegter,
        tidligereModtagetTaf,
        sygeferiegodtgoerelse,
        tabtArbejdsfortjenesteOre,
      };
    }
    // Invariant: loenudviklingTotal og tafIndtaegter.total er altid asCalculable –
    // buildLoenudviklingBeregning, buildOffentligeYdelserUdviklingModel og buildTafIndtaegterModel
    // returnerer enten en model med status 'ok' eller kaster en fail-closed invariant-fejl.
    // Status-checks bevares som defensive narrowing, hvis en fremtidig motor introducerer
    // not_calculable uden samtidig at opdatere TAF-formlen.
    const loenTotal = loenudvikling.loenudviklingTotal;
    const offentligeYdelserTotal = offentligeYdelserUdvikling?.total;
    const indtaegterTotal = tafIndtaegter.total;
    if (
      loenTotal.status !== 'ok' ||
      indtaegterTotal.status !== 'ok' ||
      (offentligeYdelserTotal !== undefined && offentligeYdelserTotal.status !== 'ok')
    ) {
      return {
        harTafPerioder,
        tafBeregningsenhed,
        indkomstSkadestidspunkt,
        loenudvikling,
        offentligeYdelserUdvikling,
        tafIndtaegter,
        tidligereModtagetTaf,
        sygeferiegodtgoerelse,
        tabtArbejdsfortjenesteOre,
      };
    }
    const offentligeYdelserTotalOre = offentligeYdelserTotal?.value ?? zeroMoneyOre();
    tabtArbejdsfortjenesteOre = clampMoneyOreToZero(subtractMoneyOre(
      subtractMoneyOre(
        sumMoneyOre([loenTotal.value, offentligeYdelserTotalOre]),
        indtaegterTotal.value
      ),
      sygeferiegodtgoerelse.totalOre
    ));
  }

  return {
    harTafPerioder,
    tafBeregningsenhed,
    indkomstSkadestidspunkt,
    loenudvikling,
    offentligeYdelserUdvikling,
    tafIndtaegter,
    tidligereModtagetTaf,
    sygeferiegodtgoerelse,
    tabtArbejdsfortjenesteOre,
  };
};
