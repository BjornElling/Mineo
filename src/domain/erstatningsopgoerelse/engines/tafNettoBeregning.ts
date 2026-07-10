import type { ErstatningsopgoerelseValues, StamdataValues } from '../../../schemas/formSchemas';
import { amountValueToNumber } from '../../../utils/expressionAmount';
import {
  buildBeregningsperiodeRange,
  buildIncomeForRanges,
  resolveArbejdsstedDisplayName,
  roundIncomeBenefitAmountKroner,
  type IncomePeriodResult,
  type IsoRange,
} from '../helpers/indtaegtPerioder';
import { computeTafBeregningsenhed, TAF_BEREGNES_SOM } from '../helpers/tafBeregningsenhed';
import { getAngivetLoenOpreguleresFraDato, resolveAktivEllerFoersteLoenudviklingKilde } from '../helpers/angivetLoenHelpers';
import { resolveAnvendtReguleringsdato } from '../helpers/eoSharedUtils';
import { isISODateString, type ISODateString } from '../../../types/branded';
import { buildIndkomstSkadestidspunkt } from './indkomstSkadestidspunktBeregning';
import { buildTafArbejdsdageSet, buildLoenudviklingModel } from './loenudviklingBeregning';
import { buildOffentligeYdelserUdviklingModel } from './offentligeYdelserUdviklingBeregning';
import { computeSygeferiegodtgoerelse, type SygeferiegodtgoerelseResult } from './sygeferiegodtgoerelse';
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
  roundKroner,
  subtractMoneyOre,
  sumMoneyOre,
  zeroMoneyOre,
} from '../../money/money';
import { asCalculable } from '../shared/eoTypes';
import { sumMidlertidigtEetBeregnetEetKronerForTafRanges } from '../helpers/midlertidigtEetBilagGroups';
import type { MidlertidigtEetAfgoerelseGroup } from '../helpers/midlertidigtEetInsertRows';

const notCalculable = <T>(reason: string): Calculable<T> => ({ status: 'not_calculable', reason });
const notCalculableMoney = (reason: string): Calculable<MoneyOre> => notCalculable<MoneyOre>(reason);

export const buildSfggLoenudviklingMap = (
  values: ErstatningsopgoerelseValues,
  loenudvikling: LoenudviklingModel | null
): ReadonlyMap<string, LoenudviklingModel['perAnsaettelse'][number]> | undefined => {
  if (!loenudvikling) return undefined;

  if (loenudvikling.perAnsaettelse.length > 0) {
    return new Map(loenudvikling.perAnsaettelse.map((entry) => [entry.ansaettelsesforholdId, entry]));
  }

  const sharedSegments = loenudvikling.beregnedeSegmenter;
  if (sharedSegments.length === 0) return undefined;

  // Shared fallback bruges kun til globale modeller uden per-ansættelse-opdeling
  // (f.eks. angivet løn med fælles reguleringsforløb). Ved overenskomst-/KRL-/statistikspor
  // med reel per-ansættelse-beregning forventes buildLoenudviklingModel at udfylde perAnsaettelse.
  const entries = (values.loenindkomstAnsaettelsesforhold ?? []).map((employment, index) => [
    employment.id,
    {
      ansaettelsesforholdId: employment.id,
      ansaettelsesforholdNavn: resolveArbejdsstedDisplayName(employment.navnPaaArbejdssted, index),
      loenudviklingLabel: loenudvikling.loenudviklingLabel,
      loenudviklingTotal: loenudvikling.loenudviklingTotal,
      beregnedeSegmenter: sharedSegments,
    },
  ] as const);

  return new Map(entries);
};

const buildTafIndtaegterModel = (
  values: ErstatningsopgoerelseValues,
  ranges: readonly IsoRange[],
  midlertidigtEetGroups: readonly MidlertidigtEetAfgoerelseGroup[]
): TafIndtaegterModel => {
  const indtaegter = buildIncomeForRanges(values, ranges);
  const useWholeKronerForMidlertidigtEet = values.midlertidigtEetFraEetSiden === 'Ja';
  const employerEntries: Array<{ label: string; amountOre: MoneyOre }> = [];
  indtaegter.employers.forEach((entry) => {
    const label = entry.name !== '' ? entry.name : 'Arbejdssted';
    employerEntries.push({ label, amountOre: fromKroner(roundKroner(entry.amount)) });
  });
  const benefitEntries = indtaegter.benefits
    .map((entry) => ({
      label: entry.label,
      // Midlertidigt EET fra EET-siden: fradraget skal være identisk med "Midlertidig EET"-bilagets
      // sammentælling, som afrunder PR. PERIODE. Vi henter derfor det kanoniske pr.-periode-afrundede
      // beløb i stedet for at runde den urundede totalsum én gang (som ellers kan give 1 kr.'s afvigelse
      // fra bilaget). Se midlertidigtEetBilagGroups.ts.
      amountOre:
        entry.typeKey === 'midlertidigt_eet' && useWholeKronerForMidlertidigtEet
          ? fromKroner(sumMidlertidigtEetBeregnetEetKronerForTafRanges(midlertidigtEetGroups, ranges))
          : fromKroner(roundIncomeBenefitAmountKroner(entry.typeKey, entry.amount, useWholeKronerForMidlertidigtEet)),
    }))
    .sort((a, b) => a.label.localeCompare(b.label, 'da-DK', { sensitivity: 'base' }));
  const entries = [...employerEntries, ...benefitEntries];
  const oevrigeKravForbeholdYdelsestyper = Array.from(
    new Set(
      indtaegter.benefits
        .map((entry) => entry.typeKey)
        .filter((typeKey) => typeKey === 'kontanthjaelp' || typeKey === 'ressourceforloebsydelse')
    )
  );

  const totalOre = clampMoneyOreToZero(sumMoneyOre(entries.map((entry) => entry.amountOre)));
  return {
    entries,
    oevrigeKravForbeholdYdelsestyper,
    total: asCalculable(totalOre),
  };
};

const resolveOffentligeYdelserReguleringsBaseIso = (
  values: ErstatningsopgoerelseValues,
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

  const aktivKilde = resolveAktivEllerFoersteLoenudviklingKilde(values);
  return resolveAnvendtReguleringsdato({
    beregnesUdFra: values.beregnesUdFra,
    angivetLoenMetodeOpreguleresFraDato: getAngivetLoenOpreguleresFraDato(values),
    saerligFraDatoRegulering: isISODateString(aktivKilde?.saerligFraDatoRegulering)
      ? aktivKilde.saerligFraDatoRegulering
      : undefined,
    beregningsperiodeTil: values.tafBeregningsperiodeTil,
    skadedato: stamdataValues.skadedato,
  });
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
  values: ErstatningsopgoerelseValues,
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
  const loenudvikling = harTafPerioder
    ? buildLoenudviklingModel(values, stamdataValues, tafBeregningsenhed, indkomstSkadestidspunkt, {
      tafRanges,
      incomeForBeregningsperiode,
    })
    : null;
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
      loenudviklingPerAnsaettelse: buildSfggLoenudviklingMap(values, loenudvikling),
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
    // Invariant: loenudviklingTotal og tafIndtaegter.total er altid asCalculable —
    // buildLoenudviklingModel, buildOffentligeYdelserUdviklingModel og buildTafIndtaegterModel
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
