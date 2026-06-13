import { computeVarigeMenEngine } from '../../../domain/varigemen/varigeMenEngine';
import { beregnVarigeMenGodtgoerelseWithRates } from '../../../domain/varigemen/varigeMenCalculations';
import { toISODateString } from '../../../types/branded';
import type { YearlyRate } from '../../../data/lovbestemteRates';

const buildRates = (year: number, satsPerMengrad: number): YearlyRate => ({
  [year]: satsPerMengrad,
});

describe('varigeMenEngine', () => {
  it('computes compensation without age reduction when age <= 39', () => {
    const rates = buildRates(2024, 1000);
    const output = computeVarigeMenEngine({
      varigemen: {
        mengrad: 10,
        beregningsdato: toISODateString('2024-06-01'),
      },
      fodselsdato: toISODateString('1990-01-01'),
      skadestidspunkt: toISODateString('2020-01-01'),
      rates,
    });

    expect(output.result).toEqual({
      beregnetGodtgoerelse: 10000,
      grundbeloeb: 100000,
      satsPerMengrad: 1000,
      aldersreduktionPct: 0,
      grundbeloebUdenReduktion: 10000,
      aldersreduktionBeloeb: 0,
      beregningsaar: 2024,
      alderVedSkade: 30,
    });
  });

  it('rounds up to nearest krone for fractional amounts', () => {
    const rates = buildRates(2024, 333.33);
    const output = computeVarigeMenEngine({
      varigemen: {
        mengrad: 33,
        beregningsdato: toISODateString('2024-06-01'),
      },
      fodselsdato: toISODateString('1990-01-01'),
      skadestidspunkt: toISODateString('2020-01-01'),
      rates,
    });

    expect(output.result?.beregnetGodtgoerelse).toBe(11000);
  });

  it('returns null when required inputs are missing', () => {
    const rates = buildRates(2024, 1000);
    const output = computeVarigeMenEngine({
      varigemen: {
        mengrad: undefined,
        beregningsdato: toISODateString('2024-06-01'),
      },
      fodselsdato: toISODateString('1990-01-01'),
      skadestidspunkt: toISODateString('2020-01-01'),
      rates,
    });

    expect(output.result).toBeNull();
  });

  it('returns null when skadestidspunkt is missing', () => {
    const rates = buildRates(2024, 1000);
    const output = computeVarigeMenEngine({
      varigemen: {
        mengrad: 10,
        beregningsdato: toISODateString('2024-06-01'),
      },
      fodselsdato: toISODateString('1990-01-01'),
      skadestidspunkt: undefined,
      rates,
    });

    expect(output.result).toBeNull();
  });

  it('returns null when rate for year is missing', () => {
    const rates = buildRates(2023, 1000);
    const output = computeVarigeMenEngine({
      varigemen: {
        mengrad: 10,
        beregningsdato: toISODateString('2024-06-01'),
      },
      fodselsdato: toISODateString('1990-01-01'),
      skadestidspunkt: toISODateString('2020-01-01'),
      rates,
    });

    expect(output.result).toBeNull();
  });

  it('applies age reduction boundaries', () => {
    const rates = buildRates(2024, 1000);
    const build = (fodselsdato: string) =>
      computeVarigeMenEngine({
        varigemen: {
          mengrad: 10,
          beregningsdato: toISODateString('2024-06-01'),
        },
        fodselsdato: toISODateString(fodselsdato),
        skadestidspunkt: toISODateString('2024-01-01'),
        rates,
      }).result;

    expect(build(toISODateString('1985-01-01'))?.beregnetGodtgoerelse).toBe(10000); // 39 years -> 0%
    expect(build(toISODateString('1984-01-01'))?.beregnetGodtgoerelse).toBe(9900);  // 40 years -> 1%
    expect(build(toISODateString('1964-01-01'))?.beregnetGodtgoerelse).toBe(7800);  // 60 years -> 22%
    expect(build(toISODateString('1955-01-01'))?.beregnetGodtgoerelse).toBe(6000);  // 69 years -> 40% cap
    expect(build(toISODateString('1954-01-01'))?.beregnetGodtgoerelse).toBe(6000);  // 70 years -> 40% cap
  });

  it('giver output identisk med et direkte kald til beregningsfunktionen (engine er rent gennemløb)', () => {
    // Værn mod, at engine-laget nogensinde skulle indføre afvigende logik:
    // det er kontraktligt et rent gennemløb (varigemen-contract §1), og UI/PDF
    // går nu udelukkende via engine. Beviser tal-identitet på tværs af et bredt
    // udsnit af inputkombinationer (alder, méngrad, satser, afrunding).
    const rates = buildRates(2024, 1001.23);
    const cases = [
      { mengrad: 10, fodselsdato: '1990-01-01', skade: '2020-01-01' }, // ingen reduktion
      { mengrad: 10, fodselsdato: '1984-01-01', skade: '2024-01-01' }, // 40 år -> 1%
      { mengrad: 33, fodselsdato: '1955-01-01', skade: '2024-01-01' }, // 69 år -> 40% cap
      { mengrad: 100, fodselsdato: '1964-01-01', skade: '2024-01-01' }, // 60 år -> 22%
      { mengrad: 1, fodselsdato: '1985-01-01', skade: '2024-01-01' }, // 39 år, grænse
    ] as const;

    for (const c of cases) {
      const values = {
        mengrad: c.mengrad,
        beregningsdato: toISODateString('2024-06-01'),
      };
      const direct = beregnVarigeMenGodtgoerelseWithRates(
        values,
        toISODateString(c.skade),
        rates,
        toISODateString(c.fodselsdato)
      );
      const viaEngine = computeVarigeMenEngine({
        varigemen: values,
        fodselsdato: toISODateString(c.fodselsdato),
        skadestidspunkt: toISODateString(c.skade),
        rates,
      }).result;

      expect(viaEngine).toEqual(direct);
    }
  });

  it('is deterministic for identical input snapshots', () => {
    const rates = buildRates(2024, 1000);
    const snapshot = {
      varigemen: {
        mengrad: 10,
        beregningsdato: toISODateString('2024-06-01'),
      },
      fodselsdato: toISODateString('1990-01-01'),
      skadestidspunkt: toISODateString('2020-01-01'),
      rates,
    };

    const cloned = JSON.parse(JSON.stringify(snapshot)) as typeof snapshot;
    const first = computeVarigeMenEngine(snapshot);
    const second = computeVarigeMenEngine(cloned);

    expect(first).toEqual(second);
  });
});
