import type { ErstatningsopgoerelseValues, StamdataValues } from '../../schemas/formSchemas';
import { amountValueToNumber } from '../../utils/expressionAmount';
import { buildIncomeForRanges, buildTafRanges, type IsoRange } from './indtaegtPerioder';
import { computeTafBeregningsenhed } from './tafBeregningsenhed';
import { buildIndkomstSkadestidspunkt } from './eoPdfIndkomstSkadestidspunkt';
import { buildLoenudviklingModelV3 } from './eoPdfLoenudvikling';
import type {
  Calculable,
  IndkomstSkadestidspunktPdfModel,
  LoenudviklingPdfModel,
  MoneyOre,
  TafIndtaegterPdfModel,
} from './eoPdfModelTypes';
import { clampMoneyOreToZero, ensureMoneyOre, roundKroner, toOre } from './eoPdfMoneyUtils';

const asCalculable = <T>(value: T): Calculable<T> => ({ status: 'ok', value });
const notCalculable = <T>(reason: string): Calculable<T> => ({ status: 'not_calculable', reason });
const notCalculableMoney = (reason: string): Calculable<MoneyOre> => notCalculable<MoneyOre>(reason);

const buildTafIndtaegterModel = (
  values: ErstatningsopgoerelseValues,
  ranges: readonly IsoRange[]
): TafIndtaegterPdfModel => {
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
  indkomstSkadestidspunkt: IndkomstSkadestidspunktPdfModel | null;
  loenudvikling: LoenudviklingPdfModel | null;
  tafIndtaegter: TafIndtaegterPdfModel | null;
  tidligereModtagetTaf: Calculable<MoneyOre>;
  tabtArbejdsfortjenesteOre: MoneyOre;
}>;

export const computeTafNettoBeregning = (
  values: ErstatningsopgoerelseValues,
  stamdataValues: StamdataValues
): TafNettoBeregningResult => {
  const tafRanges = buildTafRanges(values);
  const harTafPerioder = tafRanges.length > 0;
  const tafBeregningsenhed = computeTafBeregningsenhed(values);

  const indkomstSkadestidspunkt = harTafPerioder
    ? buildIndkomstSkadestidspunkt(values, stamdataValues, tafBeregningsenhed)
    : null;
  const loenudvikling = harTafPerioder
    ? buildLoenudviklingModelV3(values, stamdataValues, tafBeregningsenhed, indkomstSkadestidspunkt)
    : null;
  const tafIndtaegter = harTafPerioder ? buildTafIndtaegterModel(values, tafRanges) : null;

  const tidligereModtagetTafKroner = amountValueToNumber(values.tidligereModtagetTaf);
  const tidligereModtagetTaf =
    tidligereModtagetTafKroner !== undefined
      ? asCalculable(toOre(tidligereModtagetTafKroner))
      : notCalculableMoney('Ikke angivet');

  let tabtArbejdsfortjenesteOre = ensureMoneyOre(0);
  if (harTafPerioder) {
    // Defensive invariant-guard: modellen skal være bygget når TAF-perioder findes.
    if (!loenudvikling) {
      throw new Error('Lønudvikling kunne ikke beregnes');
    }
    // Defensive invariant-guard: indtægtsmodel skal være bygget når TAF-perioder findes.
    if (!tafIndtaegter) {
      throw new Error('Indtægter i TAF-perioden kunne ikke beregnes');
    }
    if (loenudvikling.loenudviklingTotal.status !== 'ok') {
      throw new Error('Loenudvikling kan ikke beregnes');
    }
    if (tafIndtaegter.total.status !== 'ok') {
      throw new Error('Indtaegter i TAF-perioden kan ikke beregnes');
    }
    // Invariant: tidligere modtaget TAF er valgfrit input. Manglende værdi betyder 0 kr. fradrag.
    const tidligereModtagetTafOre = tidligereModtagetTaf.status === 'ok' ? tidligereModtagetTaf.value : ensureMoneyOre(0);
    tabtArbejdsfortjenesteOre = clampMoneyOreToZero(
      ensureMoneyOre(loenudvikling.loenudviklingTotal.value - tafIndtaegter.total.value - tidligereModtagetTafOre)
    );
  }

  return {
    harTafPerioder,
    tafBeregningsenhed,
    indkomstSkadestidspunkt,
    loenudvikling,
    tafIndtaegter,
    tidligereModtagetTaf,
    tabtArbejdsfortjenesteOre,
  };
};
