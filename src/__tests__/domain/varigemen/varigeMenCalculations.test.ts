import type { ISODateString } from '../../../types/branded';
import type { VarigeMenValues } from '../../../schemas/formSchemas';
import type { YearlyRate } from '../../../data/lovbestemteRates';
import { beregnVarigeMenGodtgoerelseWithRates } from '../../../domain/varigemen/varigeMenCalculations';
import { toISODateString } from '../../../types/branded';

// ─── Helpers ──────────────────────────────────────────────────────────────

const iso = (s: string): ISODateString => s as ISODateString;

const buildRates = (entries: Record<number, number>): YearlyRate => entries;

const DEFAULT_FODSELSDATO = iso('1990-01-01');

const baseValues = (patch: Partial<VarigeMenValues> = {}): VarigeMenValues => ({
  mengrad: 10,
  beregningsdato: iso('2024-06-01'),
  ...patch,
});

// ─── beregnAldersfradragPct (indirekte via beregnVarigeMenGodtgoerelseWithRates) ───

describe('beregnVarigeMenGodtgoerelseWithRates', () => {
  describe('null-cases (manglende input)', () => {
    it('returnerer null ved mengrad = undefined', () => {
      const result = beregnVarigeMenGodtgoerelseWithRates(
        baseValues({ mengrad: undefined }),
        iso('2024-01-01'),
        buildRates({ 2024: 1000 }),
        DEFAULT_FODSELSDATO
      );
      expect(result).toBeNull();
    });

    it('returnerer null ved mengrad = 0', () => {
      const result = beregnVarigeMenGodtgoerelseWithRates(
        baseValues({ mengrad: 0 }),
        iso('2024-01-01'),
        buildRates({ 2024: 1000 }),
        DEFAULT_FODSELSDATO
      );
      expect(result).toBeNull();
    });

    it('returnerer null ved mengrad = 101', () => {
      const result = beregnVarigeMenGodtgoerelseWithRates(
        baseValues({ mengrad: 101 }),
        iso('2024-01-01'),
        buildRates({ 2024: 1000 }),
        DEFAULT_FODSELSDATO
      );
      expect(result).toBeNull();
    });

    it('returnerer null ved mengrad = NaN', () => {
      const result = beregnVarigeMenGodtgoerelseWithRates(
        baseValues({ mengrad: NaN }),
        iso('2024-01-01'),
        buildRates({ 2024: 1000 }),
        DEFAULT_FODSELSDATO
      );
      expect(result).toBeNull();
    });

    it('returnerer null ved manglende beregningsdato', () => {
      const result = beregnVarigeMenGodtgoerelseWithRates(
        baseValues({ beregningsdato: undefined }),
        iso('2024-01-01'),
        buildRates({ 2024: 1000 }),
        DEFAULT_FODSELSDATO
      );
      expect(result).toBeNull();
    });

    it('returnerer null ved manglende fodselsdato', () => {
      const result = beregnVarigeMenGodtgoerelseWithRates(
        baseValues(),
        iso('2024-01-01'),
        buildRates({ 2024: 1000 }),
        undefined
      );
      expect(result).toBeNull();
    });

    it('returnerer null ved manglende skadestidspunkt', () => {
      const result = beregnVarigeMenGodtgoerelseWithRates(
        baseValues(),
        undefined,
        buildRates({ 2024: 1000 }),
        DEFAULT_FODSELSDATO
      );
      expect(result).toBeNull();
    });

    it('returnerer null ved manglende rate for beregningsår', () => {
      const result = beregnVarigeMenGodtgoerelseWithRates(
        baseValues(),
        iso('2024-01-01'),
        buildRates({ 2023: 1000 }), // 2024 mangler
        DEFAULT_FODSELSDATO
      );
      expect(result).toBeNull();
    });

    it('returnerer null ved rate = NaN', () => {
      const result = beregnVarigeMenGodtgoerelseWithRates(
        baseValues(),
        iso('2024-01-01'),
        buildRates({ 2024: NaN }),
        DEFAULT_FODSELSDATO
      );
      expect(result).toBeNull();
    });

    it('returnerer null ved rate = Infinity', () => {
      const result = beregnVarigeMenGodtgoerelseWithRates(
        baseValues(),
        iso('2024-01-01'),
        buildRates({ 2024: Infinity }),
        DEFAULT_FODSELSDATO
      );
      expect(result).toBeNull();
    });
  });

  describe('grundberegning uden aldersfradrag', () => {
    it('10% méngrad med sats 1000 kr/trin → godtgørelse = 10000', () => {
      const result = beregnVarigeMenGodtgoerelseWithRates(
        baseValues({ mengrad: 10 }),
        iso('2024-01-01'), // alder = 34 → ingen fradrag
        buildRates({ 2024: 1000 }),
        iso('1990-01-01')
      );
      expect(result).not.toBeNull();
      expect(result!.beregnetGodtgoerelse).toBe(10000);
      expect(result!.satsPerMengrad).toBe(1000);
      expect(result!.grundbeloeb).toBe(100000); // 1000 * 100
      expect(result!.aldersreduktionPct).toBe(0);
      expect(result!.grundbeloebUdenReduktion).toBe(10000);
    });

    it('100% méngrad med sats 500 kr/trin → godtgørelse = 50000', () => {
      const result = beregnVarigeMenGodtgoerelseWithRates(
        baseValues({ mengrad: 100 }),
        iso('2024-01-01'),
        buildRates({ 2024: 500 }),
        iso('1990-01-01')
      );
      expect(result).not.toBeNull();
      expect(result!.beregnetGodtgoerelse).toBe(50000);
      expect(result!.grundbeloeb).toBe(50000); // 500 * 100
    });

    it('1% méngrad er grænseværdi og giver korrekt resultat', () => {
      const result = beregnVarigeMenGodtgoerelseWithRates(
        baseValues({ mengrad: 1 }),
        iso('2024-01-01'),
        buildRates({ 2024: 1000 }),
        iso('1990-01-01')
      );
      expect(result).not.toBeNull();
      expect(result!.beregnetGodtgoerelse).toBe(1000);
    });

    it('bruger beregningsåret fra beregningsdato til rate-lookup', () => {
      // Rate 2023 = 900, rate 2024 = 1000; beregningsdato = 2023
      const result = beregnVarigeMenGodtgoerelseWithRates(
        baseValues({ beregningsdato: iso('2023-01-01'), mengrad: 10 }),
        iso('2023-01-01'),
        buildRates({ 2023: 900, 2024: 1000 }),
        DEFAULT_FODSELSDATO
      );
      expect(result).not.toBeNull();
      expect(result!.satsPerMengrad).toBe(900);
      expect(result!.beregnetGodtgoerelse).toBe(9000);
    });
  });

  describe('aldersfradrag (beregnAldersfradragPct)', () => {
    // Fødselsdato ift. skadestidspunkt 2024-01-01
    const skadesdag = iso('2024-01-01');
    const rates = buildRates({ 2024: 1000 });

    const beregn = (fodselsdato: string) =>
      beregnVarigeMenGodtgoerelseWithRates(
        baseValues({ mengrad: 10 }),
        skadesdag,
        rates,
        iso(fodselsdato)
      );

    it('alder 39 år: 0% fradrag', () => {
      // Født 1985-01-01, skade 2024-01-01 = 39 år
      const result = beregn(toISODateString('1985-01-01'));
      expect(result?.aldersreduktionPct).toBe(0);
      expect(result?.alderVedSkade).toBe(39);
      expect(result?.beregnetGodtgoerelse).toBe(10000);
    });

    it('alder 40 år: 1% fradrag', () => {
      // Født 1984-01-01, skade 2024-01-01 = 40 år
      const result = beregn(toISODateString('1984-01-01'));
      expect(result?.aldersreduktionPct).toBe(1);
      // 10000 * (1 - 0.01) = 9900 → ceil(9900) = 9900
      expect(result?.beregnetGodtgoerelse).toBe(9900);
    });

    it('alder 50 år: 11% fradrag (10 år over 39)', () => {
      const result = beregn(toISODateString('1974-01-01'));
      expect(result?.aldersreduktionPct).toBe(11);
      // 10000 * (1 - 0.11) = 8900
      expect(result?.beregnetGodtgoerelse).toBe(8900);
    });

    it('alder 59 år: 20% fradrag (20 år over 39)', () => {
      const result = beregn(toISODateString('1965-01-01'));
      expect(result?.aldersreduktionPct).toBe(20);
      // 10000 * (1 - 0.20) = 8000
      expect(result?.beregnetGodtgoerelse).toBe(8000);
    });

    it('alder 60 år: 22% fradrag (21 basis + 1 ekstra)', () => {
      // 60 > 39 → basis = min(30, 60-39) = 21
      // 60 > 59 → ekstra = min(10, 60-59) = 1
      // Total = 22%
      const result = beregn(toISODateString('1964-01-01'));
      expect(result?.aldersreduktionPct).toBe(22);
      // 10000 * (1 - 0.22) = 7800
      expect(result?.beregnetGodtgoerelse).toBe(7800);
    });

    it('alder 65 år: 32% fradrag (26 basis + 6 ekstra)', () => {
      // 65 > 39 → basis = min(30, 65-39) = 26
      // 65 > 59 → ekstra = min(10, 65-59) = 6
      // Total = 32%
      const result = beregn(toISODateString('1959-01-01'));
      expect(result?.aldersreduktionPct).toBe(32);
      // 10000 * (1 - 0.32) = 6800
      expect(result?.beregnetGodtgoerelse).toBe(6800);
    });

    it('alder 69 år: 40% fradrag (max) — 30 basis + 10 ekstra', () => {
      const result = beregn(toISODateString('1955-01-01'));
      expect(result?.aldersreduktionPct).toBe(40);
      // 10000 * (1 - 0.40) = 6000
      expect(result?.beregnetGodtgoerelse).toBe(6000);
    });

    it('alder 70 år: stadig 40% fradrag (cap ved 69)', () => {
      const result = beregn(toISODateString('1954-01-01'));
      expect(result?.aldersreduktionPct).toBe(40);
      expect(result?.beregnetGodtgoerelse).toBe(6000);
    });

    it('alder 80 år: stadig 40% fradrag (cap)', () => {
      const result = beregn(toISODateString('1944-01-01'));
      expect(result?.aldersreduktionPct).toBe(40);
      expect(result?.beregnetGodtgoerelse).toBe(6000);
    });
  });

  describe('aldersbegening ved fødselsdato efter skadesdag', () => {
    it('ikke-nået fødselsdag i skadesåret → alder - 1', () => {
      // Født 1984-07-01, skadesdag 2024-01-01 → endnu ikke 40 → alder = 39
      const result = beregnVarigeMenGodtgoerelseWithRates(
        baseValues({ mengrad: 10 }),
        iso('2024-01-01'),
        buildRates({ 2024: 1000 }),
        iso('1984-07-01')
      );
      expect(result?.alderVedSkade).toBe(39);
      expect(result?.aldersreduktionPct).toBe(0);
    });

    it('nøjagtigt fylder år på skadesdag → korrekt alder', () => {
      // Født 1984-01-01, skadesdag 2024-01-01 → alder = 40
      const result = beregnVarigeMenGodtgoerelseWithRates(
        baseValues({ mengrad: 10 }),
        iso('2024-01-01'),
        buildRates({ 2024: 1000 }),
        iso('1984-01-01')
      );
      expect(result?.alderVedSkade).toBe(40);
      expect(result?.aldersreduktionPct).toBe(1);
    });
  });

  describe('afrunding (altid op til nærmeste hele krone)', () => {
    it('ceil: 0.01 kr → 1 kr', () => {
      // sats = 0.1 kr/trin, 1% méngrad → grundbeloebUdenReduktion = 0.1
      // Ingen fradrag → godtgørelse = 0.1 → ceil → 1
      const result = beregnVarigeMenGodtgoerelseWithRates(
        baseValues({ mengrad: 1 }),
        iso('2024-01-01'),
        buildRates({ 2024: 0.1 }),
        iso('1990-01-01')
      );
      expect(result?.beregnetGodtgoerelse).toBe(1);
    });

    it('ceil efter fradrag: 9900.01 → 9901', () => {
      // sats = 1001 kr/trin, 10% méngrad, 1% fradrag (alder 40)
      // grundbeloebUdenReduktion = 10010
      // godtgørelse = 10010 * 0.99 = 9909.9 → ceil → 9910
      const result = beregnVarigeMenGodtgoerelseWithRates(
        baseValues({ mengrad: 10 }),
        iso('2024-01-01'),
        buildRates({ 2024: 1001 }),
        iso('1984-01-01')
      );
      expect(result).not.toBeNull();
      const expected = Math.ceil(10010 * 0.99);
      expect(result!.beregnetGodtgoerelse).toBe(expected);
    });

    it('hele kroner rundes ikke op (ingen decimal)', () => {
      const result = beregnVarigeMenGodtgoerelseWithRates(
        baseValues({ mengrad: 10 }),
        iso('2024-01-01'),
        buildRates({ 2024: 1000 }),
        iso('1990-01-01')
      );
      expect(result?.beregnetGodtgoerelse).toBe(10000);
    });
  });

  describe('returnerede felter', () => {
    it('returnerer alle forventede felter', () => {
      const result = beregnVarigeMenGodtgoerelseWithRates(
        baseValues({ mengrad: 10 }),
        iso('2024-01-01'),
        buildRates({ 2024: 1000 }),
        iso('1990-01-01')
      );
      expect(result).not.toBeNull();
      expect(typeof result!.beregnetGodtgoerelse).toBe('number');
      expect(typeof result!.grundbeloeb).toBe('number');
      expect(typeof result!.satsPerMengrad).toBe('number');
      expect(typeof result!.aldersreduktionPct).toBe('number');
      expect(typeof result!.grundbeloebUdenReduktion).toBe('number');
      expect(typeof result!.aldersreduktionBeloeb).toBe('number');
      expect(typeof result!.beregningsaar).toBe('number');
      expect(typeof result!.alderVedSkade).toBe('number');
    });

    it('beregningsaar = året fra beregningsdato', () => {
      const result = beregnVarigeMenGodtgoerelseWithRates(
        baseValues({ beregningsdato: iso('2023-05-01') }),
        iso('2023-05-01'),
        buildRates({ 2023: 1000 }),
        DEFAULT_FODSELSDATO
      );
      expect(result?.beregningsaar).toBe(2023);
    });

    it('grundbeloebUdenReduktion = satsPerMengrad * mengrad', () => {
      const result = beregnVarigeMenGodtgoerelseWithRates(
        baseValues({ mengrad: 15 }),
        iso('2024-01-01'),
        buildRates({ 2024: 800 }),
        DEFAULT_FODSELSDATO
      );
      expect(result?.grundbeloebUdenReduktion).toBe(15 * 800);
    });

    it('grundbeloeb = satsPerMengrad * 100', () => {
      const result = beregnVarigeMenGodtgoerelseWithRates(
        baseValues(),
        iso('2024-01-01'),
        buildRates({ 2024: 750 }),
        DEFAULT_FODSELSDATO
      );
      expect(result?.grundbeloeb).toBe(750 * 100);
    });
  });

  describe('aldersreduktionBeloeb (afstemning af viste linjer)', () => {
    it('er 0 når der ingen aldersreduktion er', () => {
      const result = beregnVarigeMenGodtgoerelseWithRates(
        baseValues({ mengrad: 10 }),
        iso('2024-01-01'), // alder 34 → ingen fradrag
        buildRates({ 2024: 1000 }),
        iso('1990-01-01')
      );
      expect(result?.aldersreduktionBeloeb).toBe(0);
    });

    it('grundbeløb − reduktion = oprundet godtgørelse går nøjagtigt op (også med decimaler)', () => {
      // sats 1001,23 kr/trin, 10% méngrad, 1% fradrag (alder 40):
      // grundbeloebUdenReduktion = 10012,30; godtgørelse = ceil(10012,30 * 0,99) = ceil(9912,177) = 9913
      // reduktion skal være 10012,30 − 9913 = 99,30 så linjerne afstemmer.
      const result = beregnVarigeMenGodtgoerelseWithRates(
        baseValues({ mengrad: 10 }),
        iso('2024-01-01'),
        buildRates({ 2024: 1001.23 }),
        iso('1984-01-01')
      );
      expect(result).not.toBeNull();
      expect(result!.grundbeloebUdenReduktion - result!.aldersreduktionBeloeb).toBe(result!.beregnetGodtgoerelse);
    });
  });

  describe('determinisme', () => {
    it('er deterministisk for identisk input', () => {
      const values = baseValues({ mengrad: 10 });
      const r1 = beregnVarigeMenGodtgoerelseWithRates(values, iso('2024-01-01'), buildRates({ 2024: 1000 }), DEFAULT_FODSELSDATO);
      const r2 = beregnVarigeMenGodtgoerelseWithRates(values, iso('2024-01-01'), buildRates({ 2024: 1000 }), DEFAULT_FODSELSDATO);
      expect(r1).toEqual(r2);
    });
  });
});
