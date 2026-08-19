import { toISODateString } from '../../../types/branded';
import { moneyOre } from '../../../domain/money/money';
import type {
  TafPerYearResult,
  TafYearEntry,
} from '../../../domain/erstatningsopgoerelse/engines/tafPerYearDerived';
import {
  buildTafPerYearOpreguleretBuildOutcome,
  TAF_OPREGULERET_DELTA_PCT_DECIMALS,
} from '../../../domain/erstatningsopgoerelse/engines/tafPerYearOpreguleretDerived';
import { reguleringssats } from '../../../data/lovbestemteRates';
import { opregulerMedAkkumuleretReguleringssats } from '../../../domain/satser/opreguleringsmotorer';
import { roundByMethod } from '../../../utils/rounding';

const iso = (value: string) => toISODateString(value);

const makeYear = (year: number, yearTafOre: number): TafYearEntry => ({
  year,
  segments: [],
  deductions: [],
  yearIncomeOre: moneyOre(yearTafOre),
  yearDeductionsOre: moneyOre(0),
  yearTidligereModtagetTafOre: moneyOre(0),
  yearTafFoerForligOre: moneyOre(yearTafOre),
  yearTafOre: moneyOre(yearTafOre),
});

const makeResult = (years: TafYearEntry[]): TafPerYearResult => {
  const sum = years.reduce((acc, y) => acc + y.yearTafOre, 0);
  return {
    years,
    sumYearTafOre: moneyOre(sum),
    afrundingOre: moneyOre(0),
    samletTafKravOre: moneyOre(sum),
  };
};

// Forventet opregulering svarende til engine-logikken (akkumuleret reguleringssats):
// deltaPct = round(motor.deltaPct, 4); opreguleret = fromKroner(roundKroner(baseKroner * (1 + deltaPct/100)))
const expectedOpregulering = (yearTafOre: number, year: number, beregningsAar: number): { deltaPct: number; opreguleretOre: number } => {
  const motor = opregulerMedAkkumuleretReguleringssats({ kildeAar: year, maalAar: beregningsAar });
  const deltaPct = roundByMethod(motor.deltaPct, TAF_OPREGULERET_DELTA_PCT_DECIMALS, 'halfAwayFromZero');
  const opreguleretKroner = roundByMethod((yearTafOre / 100) * (1 + deltaPct / 100), 2, 'halfAwayFromZero');
  return { deltaPct, opreguleretOre: Math.round(opreguleretKroner * 100) };
};

describe('buildTafPerYearOpreguleretBuildOutcome', () => {
  it('returnerer not_applicable når der ikke er per-år-resultat', () => {
    expect(buildTafPerYearOpreguleretBuildOutcome(null, iso('2024-05-01')).kind).toBe('not_applicable');
    expect(buildTafPerYearOpreguleretBuildOutcome(makeResult([]), iso('2024-05-01')).kind).toBe('not_applicable');
  });

  it('opregulerer hvert år til beregningsåret med akkumuleret reguleringssats', () => {
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

  it('bruger den akkumulerede reguleringssats-metode (ikke ASL-årslønsmaksimum)', () => {
    // 2021 → 2024: ∏(1 + sats/100) for 2022,2023,2024 = 1.012 * 1.03 * 1.035
    const result = makeResult([makeYear(2021, 100_000_00)]);
    const outcome = buildTafPerYearOpreguleretBuildOutcome(result, iso('2024-06-01'));
    expect(outcome.kind).toBe('ok');
    if (outcome.kind !== 'ok') return;
    const forventetFaktor =
      (1 + reguleringssats[2022] / 100) * (1 + reguleringssats[2023] / 100) * (1 + reguleringssats[2024] / 100);
    const forventetDeltaPct = roundByMethod(
      (forventetFaktor - 1) * 100,
      TAF_OPREGULERET_DELTA_PCT_DECIMALS,
      'halfAwayFromZero'
    );
    expect(outcome.result.years[0].deltaPct).toBe(forventetDeltaPct);
  });

  it('beregner opreguleret beløb med deltaprocent afrundet til fire decimaler', () => {
    const result = makeResult([makeYear(2024, 287_763_00)]);
    const outcome = buildTafPerYearOpreguleretBuildOutcome(result, iso('2026-03-01'));
    expect(outcome.kind).toBe('ok');
    if (outcome.kind !== 'ok') return;

    const y2024 = outcome.result.years[0];
    expect(y2024.deltaPct).toBe(8.8872);
    expect(y2024.yearTafOpreguleretOre).toBe(313_337_07);
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

  it('fail-closer når et mellemliggende år mangler reguleringssats', () => {
    // 1999 → 2024 kræver satser for 2000..2024; 2000-2004 mangler i reguleringssats.
    const result = makeResult([makeYear(1999, 10_000_00)]);
    const outcome = buildTafPerYearOpreguleretBuildOutcome(result, iso('2024-03-03'));
    expect(outcome.kind).toBe('error');
    if (outcome.kind !== 'error') return;
    expect(outcome.reason).toBe('manglende_reguleringssats');
    expect(outcome.manglendeAar).toContain(2000);
  });

  it('ignorerer manglende reguleringssats for år med 0-beløb', () => {
    const result = makeResult([makeYear(1999, 0), makeYear(2020, 10_000_00)]);
    const outcome = buildTafPerYearOpreguleretBuildOutcome(result, iso('2024-03-03'));
    expect(outcome.kind).toBe('ok');
    if (outcome.kind !== 'ok') return;
    const y1999 = outcome.result.years.find((y) => y.year === 1999)!;
    expect(y1999.deltaPct).toBe(0);
    expect(y1999.yearTafOpreguleretOre).toBe(0);
  });

  it('fail-closer for et nær-nul (1 øre) beløbsår med manglende reguleringssats', () => {
    // 0-beløbs-undtagelsen er STRIKT === 0. Et nær-nul positivt beløb påvirker totalen
    // (om end minimalt) og skal derfor kræve fuld satsdækning frem for tavs under-regulering.
    const result = makeResult([makeYear(1999, 1)]);
    const outcome = buildTafPerYearOpreguleretBuildOutcome(result, iso('2024-03-03'));
    expect(outcome.kind).toBe('error');
    if (outcome.kind !== 'error') return;
    expect(outcome.reason).toBe('manglende_reguleringssats');
    expect(outcome.manglendeAar).toContain(2000);
  });

  it('fail-closer for et negativt beløbsår med manglende reguleringssats', () => {
    // Et negativt årsbeløb er ikke undtaget (≠ 0) og skal fail-close ved manglende sats,
    // ikke stiltiende videreføres uændret (som ville under-regulere et fradrag).
    const result = makeResult([makeYear(1999, -10_000_00)]);
    const outcome = buildTafPerYearOpreguleretBuildOutcome(result, iso('2024-03-03'));
    expect(outcome.kind).toBe('error');
    if (outcome.kind !== 'error') return;
    expect(outcome.reason).toBe('manglende_reguleringssats');
    expect(outcome.manglendeAar).toContain(2000);
  });

  it('opregulerer et nær-nul (1 øre) beløbsår normalt når satsdækningen findes', () => {
    // Med fuld dækning behandles nær-nul beløb som ethvert andet beløb (ingen undtagelse).
    const result = makeResult([makeYear(2020, 1)]);
    const outcome = buildTafPerYearOpreguleretBuildOutcome(result, iso('2024-06-01'));
    expect(outcome.kind).toBe('ok');
    if (outcome.kind !== 'ok') return;
    const exp = expectedOpregulering(1, 2020, 2024);
    expect(outcome.result.years[0].deltaPct).toBe(exp.deltaPct);
    expect(outcome.result.years[0].yearTafOpreguleretOre).toBe(exp.opreguleretOre);
  });

  it('blokerer et helt krav hvis ét ikke-nul år mangler sats, selv når et 0-beløbs-år er fint', () => {
    // Multi-år: 0-beløbs-året (1999) er undtaget, men det ikke-nul år (2000) mangler stadig
    // sats og skal fail-close hele opgørelsen – ingen delvis/tavs opregulering.
    const result = makeResult([makeYear(1999, 0), makeYear(2000, 5_000_00)]);
    const outcome = buildTafPerYearOpreguleretBuildOutcome(result, iso('2024-03-03'));
    expect(outcome.kind).toBe('error');
    if (outcome.kind !== 'error') return;
    expect(outcome.manglendeAar).toContain(2000);
  });
});
