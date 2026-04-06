import type { ErstatningsopgoerelseValues, StamdataValues } from '../../../schemas/formSchemas';
import { amountValueToNumber } from '../../../utils/expressionAmount';
import { buildIncomeForRanges, type IsoRange } from '../helpers/indtaegtPerioder';
import { computeTafBeregningsenhed } from '../helpers/tafBeregningsenhed';
import { buildIndkomstSkadestidspunkt } from './indkomstSkadestidspunktBeregning';
import { buildLoenudviklingModel } from './loenudviklingBeregning';
import { computeSygeferiegodtgoerelse, type SygeferiegodtgoerelseResult } from './sygeferiegodtgoerelse';
import type {
  Calculable,
  IndkomstSkadestidspunktModel,
  LoenudviklingModel,
  MoneyOre,
  TafIndtaegterModel,
} from '../shared/eoTypes';
import { clampMoneyOreToZero, ensureMoneyOre, roundKroner, toOre } from '../shared/eoMoney';

const asCalculable = <T>(value: T): Calculable<T> => ({ status: 'ok', value });
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
      ansaettelsesforholdNavn: (employment.navnPaaArbejdssted?.trim() ?? '') || `Arbejdssted ${index + 1}`,
      loenudviklingLabel: loenudvikling.loenudviklingLabel,
      loenudviklingTotal: loenudvikling.loenudviklingTotal,
      beregnedeSegmenter: sharedSegments,
    },
  ] as const);

  return new Map(entries);
};

const buildTafIndtaegterModel = (
  values: ErstatningsopgoerelseValues,
  ranges: readonly IsoRange[]
): TafIndtaegterModel => {
  const indtaegter = buildIncomeForRanges(values, ranges);
  const employerEntries: Array<{ label: string; amountOre: MoneyOre }> = [];
  indtaegter.employers.forEach((entry) => {
    const label = entry.name !== '' ? entry.name : 'Arbejdssted';
    employerEntries.push({ label, amountOre: toOre(roundKroner(entry.amount)) });
  });
  const benefitEntries = indtaegter.benefits
    .map((entry) => ({ label: entry.label, amountOre: toOre(roundKroner(entry.amount)) }))
    .sort((a, b) => a.label.localeCompare(b.label, 'da-DK', { sensitivity: 'base' }));
  const entries = [...employerEntries, ...benefitEntries];
  const oevrigeKravForbeholdYdelsestyper = Array.from(
    new Set(
      indtaegter.benefits
        .map((entry) => entry.typeKey)
        .filter((typeKey) => typeKey === 'kontanthjaelp' || typeKey === 'ressourceforloebsydelse')
    )
  );

  const totalOre = clampMoneyOreToZero(ensureMoneyOre(entries.reduce((acc, entry) => acc + entry.amountOre, 0)));
  return {
    entries,
    oevrigeKravForbeholdYdelsestyper,
    total: asCalculable(totalOre),
  };
};

export type TafNettoBeregningResult = Readonly<{
  harTafPerioder: boolean;
  tafBeregningsenhed: ReturnType<typeof computeTafBeregningsenhed>;
  indkomstSkadestidspunkt: IndkomstSkadestidspunktModel | null;
  loenudvikling: LoenudviklingModel | null;
  tafIndtaegter: TafIndtaegterModel | null;
  tidligereModtagetTaf: Calculable<MoneyOre>;
  sygeferiegodtgoerelse: SygeferiegodtgoerelseResult;
  tabtArbejdsfortjenesteOre: MoneyOre;
}>;

export const computeTafNettoBeregning = (
  values: ErstatningsopgoerelseValues,
  stamdataValues: StamdataValues,
  options: Readonly<{ tafRanges: readonly IsoRange[] }>
): TafNettoBeregningResult => {
  const tafRanges = options.tafRanges;
  const beregnes = values.beregnesTabtArbejdsfortjeneste === 'Ja';
  const harTafPerioder = beregnes && tafRanges.length > 0;
  const tafBeregningsenhed = computeTafBeregningsenhed(values);

  const indkomstSkadestidspunkt = harTafPerioder
    ? buildIndkomstSkadestidspunkt(values, stamdataValues, tafBeregningsenhed)
    : null;
  const loenudvikling = harTafPerioder
    ? buildLoenudviklingModel(values, stamdataValues, tafBeregningsenhed, indkomstSkadestidspunkt, {
      tafRanges,
    })
    : null;
  const tafIndtaegter = harTafPerioder ? buildTafIndtaegterModel(values, tafRanges) : null;
  const sygeferiegodtgoerelse = harTafPerioder
    ? computeSygeferiegodtgoerelse({
      values,
      stamdata: stamdataValues,
      tafRanges,
      loenudviklingPerAnsaettelse: buildSfggLoenudviklingMap(values, loenudvikling),
    })
    : { totalOre: ensureMoneyOre(0), perAnsaettelsesforhold: [], perYear: [], firstExcludedDate: null };

  const tidligereModtagetTafKroner = amountValueToNumber(values.tidligereModtagetTaf);
  const tidligereModtagetTaf =
    tidligereModtagetTafKroner !== undefined
      ? asCalculable(toOre(tidligereModtagetTafKroner))
      : notCalculableMoney('Ikke angivet');

  let tabtArbejdsfortjenesteOre = ensureMoneyOre(0);
  if (harTafPerioder) {
    // Invariant: loenudvikling og tafIndtaegter er altid sat når harTafPerioder er true,
    // da begge bygges betinget af harTafPerioder ovenfor. Disse guards er logisk umulige.
    if (!loenudvikling || !tafIndtaegter) {
      return {
        harTafPerioder,
        tafBeregningsenhed,
        indkomstSkadestidspunkt,
        loenudvikling,
        tafIndtaegter,
        tidligereModtagetTaf,
        sygeferiegodtgoerelse,
        tabtArbejdsfortjenesteOre,
      };
    }
    // Invariant: loenudviklingTotal og tafIndtaegter.total er altid asCalculable —
    // buildLoenudviklingModel og buildTafIndtaegterModel returnerer altid status 'ok'.
    // Disse status-checks er logisk umulige men bevares som defensive narrowing.
    const loenTotal = loenudvikling.loenudviklingTotal;
    const indtaegterTotal = tafIndtaegter.total;
    if (loenTotal.status !== 'ok' || indtaegterTotal.status !== 'ok') {
      return {
        harTafPerioder,
        tafBeregningsenhed,
        indkomstSkadestidspunkt,
        loenudvikling,
        tafIndtaegter,
        tidligereModtagetTaf,
        sygeferiegodtgoerelse,
        tabtArbejdsfortjenesteOre,
      };
    }
    tabtArbejdsfortjenesteOre = clampMoneyOreToZero(
      ensureMoneyOre(loenTotal.value - indtaegterTotal.value - sygeferiegodtgoerelse.totalOre)
    );
  }

  return {
    harTafPerioder,
    tafBeregningsenhed,
    indkomstSkadestidspunkt,
    loenudvikling,
    tafIndtaegter,
    tidligereModtagetTaf,
    sygeferiegodtgoerelse,
    tabtArbejdsfortjenesteOre,
  };
};
