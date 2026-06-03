import { toISODateString } from '../../../types/branded';
import type { MoneyOre } from '../../../domain/erstatningsopgoerelse/shared/eoTypes';
import type {
  TafPerYearResult,
  TafYearEntry,
} from '../../../domain/erstatningsopgoerelse/engines/tafPerYearDerived';
import { buildTafPerYearOpreguleretBuildOutcome } from '../../../domain/erstatningsopgoerelse/engines/tafPerYearOpreguleretDerived';
import { aarsloenAslMax } from '../../../data/lovbestemteRates';
import { roundByMethod } from '../../../utils/rounding';

const iso = (value: string) => toISODateString(value);

const makeYear = (year: number, yearTafOre: number): TafYearEntry => ({
  year,
  segments: [],
  deductions: [],
  yearIncomeOre: yearTafOre as MoneyOre,
  yearDeductionsOre: 0 as MoneyOre,
  yearTafFoerForligOre: yearTafOre as MoneyOre,
  yearTafOre: yearTafOre as MoneyOre,
});

const makeResult = (years: TafYearEntry[]): TafPerYearResult => {
  const sum = years.reduce((acc, y) => acc + y.yearTafOre, 0);
  return {
    years,
    sumYearTafOre: sum as MoneyOre,
    afrundingOre: 0 as MoneyOre,
    samletTafKravOre: sum as MoneyOre,
  };
};

// Forventet opregulering svarende til engine-logikken:
// deltaPct = round((idx[beregningsår]/idx[år] - 1) * 100, 2)
// opreguleret = toOre(roundKroner(baseKroner * (1 + deltaPct/100)))
const expectedOpregulering = (yearTafOre: number, year: number, beregningsAar: number): { deltaPct: number; opreguleretOre: number } => {
  const idxBase = aarsloenAslMax[beregningsAar as keyof typeof aarsloenAslMax] as number;
  const idxYear = aarsloenAslMax[year as keyof typeof aarsloenAslMax] as number;
  const deltaPct = roundByMethod((idxBase / idxYear - 1) * 100, 2, 'halfAwayFromZero');
  const opreguleretKroner = roundByMethod((yearTafOre / 100) * (1 + deltaPct / 100), 2, 'halfAwayFromZero');
  return { deltaPct, opreguleretOre: Math.round(opreguleretKroner * 100) };
};

describe('buildTafPerYearOpreguleretBuildOutcome', () => {
  it('returnerer not_applicable når der ikke er per-år-resultat', () => {
    expect(buildTafPerYearOpreguleretBuildOutcome(null, iso('2024-05-01')).kind).toBe('not_applicable');
    expect(buildTafPerYearOpreguleretBuildOutcome(makeResult([]), iso('2024-05-01')).kind).toBe('not_applicable');
  });

  it('opregulerer hvert år til beregningsåret med ASL-indeksforholdet', () => {
    const result = makeResult([
      makeYear(2020, 10_000_00),
      makeYear(2021, 20_000_00),
    ]);
    const outcome = buildTafPerYearOpreguleretBuildOutcome(result, iso('2024-11-30'));
    expect(outcome.kind).toBe('ok');
    if (outcome.kind !== 'ok') return;

    expect(outcome.result.beregningsAar).toBe(2024);
    const y2020 = outcome.result.years.find((y) => y.year === 2020)!;
    const y2021 = outcome.result.years.find((y) => y.year === 2021)!;

    const exp2020 = expectedOpregulering(10_000_00, 2020, 2024);
    const exp2021 = expectedOpregulering(20_000_00, 2021, 2024);

    expect(y2020.deltaPct).toBe(exp2020.deltaPct);
    expect(y2020.yearTafOpreguleretOre).toBe(exp2020.opreguleretOre);
    expect(y2021.deltaPct).toBe(exp2021.deltaPct);
    expect(y2021.yearTafOpreguleretOre).toBe(exp2021.opreguleretOre);

    expect(outcome.result.sumOpreguleretOre).toBe(exp2020.opreguleretOre + exp2021.opreguleretOre);
  });

  it('giver deltaPct 0 og uændret beløb når året er beregningsåret', () => {
    const result = makeResult([makeYear(2024, 50_000_00)]);
    const outcome = buildTafPerYearOpreguleretBuildOutcome(result, iso('2024-01-15'));
    expect(outcome.kind).toBe('ok');
    if (outcome.kind !== 'ok') return;
    const y = outcome.result.years[0];
    expect(y.deltaPct).toBe(0);
    expect(y.yearTafOpreguleretOre).toBe(50_000_00);
  });

  it('opregulerer korrekt for negative årsbeløb', () => {
    const result = makeResult([makeYear(2020, -10_000_00)]);
    const outcome = buildTafPerYearOpreguleretBuildOutcome(result, iso('2024-06-01'));
    expect(outcome.kind).toBe('ok');
    if (outcome.kind !== 'ok') return;
    const exp = expectedOpregulering(-10_000_00, 2020, 2024);
    expect(outcome.result.years[0].yearTafOpreguleretOre).toBe(exp.opreguleretOre);
    expect(outcome.result.years[0].yearTafOpreguleretOre).toBeLessThan(0);
  });

  it('fail-closer når beregningsåret mangler indeks', () => {
    const result = makeResult([makeYear(2020, 10_000_00)]);
    // 2099 findes ikke i aarsloenAslMax
    const outcome = buildTafPerYearOpreguleretBuildOutcome(result, iso('2099-03-03'));
    expect(outcome.kind).toBe('error');
    if (outcome.kind !== 'error') return;
    expect(outcome.reason).toBe('manglende_indeks');
    expect(outcome.manglendeAar).toContain(2099);
  });

  it('fail-closer når et år med beløb mangler indeks', () => {
    const result = makeResult([makeYear(1999, 10_000_00)]);
    const outcome = buildTafPerYearOpreguleretBuildOutcome(result, iso('2024-03-03'));
    expect(outcome.kind).toBe('error');
    if (outcome.kind !== 'error') return;
    expect(outcome.manglendeAar).toContain(1999);
  });

  it('ignorerer manglende indeks for år med 0-beløb', () => {
    const result = makeResult([makeYear(1999, 0), makeYear(2020, 10_000_00)]);
    const outcome = buildTafPerYearOpreguleretBuildOutcome(result, iso('2024-03-03'));
    expect(outcome.kind).toBe('ok');
    if (outcome.kind !== 'ok') return;
    const y1999 = outcome.result.years.find((y) => y.year === 1999)!;
    expect(y1999.deltaPct).toBe(0);
    expect(y1999.yearTafOpreguleretOre).toBe(0);
  });
});
