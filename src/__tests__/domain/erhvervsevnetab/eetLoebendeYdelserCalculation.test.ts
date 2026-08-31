import type { AmountValue } from '../../../schemas/amountExpressionSchema';
import type { AslAfgoerelseRow } from '../../../schemas/formSchemas';
import { ERHVERVSEVNETAB_INITIAL_VALUES } from '../../../domain/erhvervsevnetab/erhvervsevnetabInitialValues';
import { aarsloenAslMax } from '../../../data/lovbestemteRates';
import { roundByMethod } from '../../../utils/rounding';
import {
  buildLoebendeAarsydelseReguleringSteps,
  computeEetLoebendeYdelser,
  computeEetLoebendeYdelserForEoImport,
  firstOfMonthAfter,
  hasOverlapPeriod,
  resolveLoebendeAfgoerelseRestVisning,
  shouldShowLoebende2024ConversionBlock,
  toAfgoerelseTypeLabel,
  type EetLoebendeAfgoerelseComputation,
  type EetLoebendePeriodeRow,
} from '../../../domain/erhvervsevnetab/eetLoebendeYdelserCalculation';
import { isAslAfgoerelseRowEmpty, isAslAfgoerelseRowPersistenceEmpty } from '../../../domain/erhvervsevnetab/eetAslAfgoerelser';
import { toISODateString, type ISODateString } from '../../../types/branded';
import { fromKroner, toKroner } from '../../../domain/money/money';
import { formatAsAmount } from '../../../utils/formatUtils';

const asAmount = (value: number): AmountValue => ({ kind: 'number', value });

const testRow = (
  row: Pick<AslAfgoerelseRow, 'id' | 'afgoerelsesDato' | 'virkningsDato' | 'eetPct' | 'afgoerelseType'> &
    Partial<AslAfgoerelseRow>
): AslAfgoerelseRow => ({
  kapDato: undefined,
  kapPct: undefined,
  tidlKapDato: undefined,
  fsTilbageholdtEet: 'Nej',
  ...row,
});

const computeTestRows = (
  rows: readonly AslAfgoerelseRow[],
  options: Partial<{
    beregningsdato: ISODateString;
    aslAarsloen: number;
    skadedato: ISODateString;
    skadelidteFodselsdato: ISODateString;
  }> = {}
) => computeEetLoebendeYdelser({
  erhvervsevnetab: {
    ...ERHVERVSEVNETAB_INITIAL_VALUES,
    beregningsdato: options.beregningsdato ?? toISODateString('2025-12-31'),
    aslAarsloen: asAmount(options.aslAarsloen ?? 401000),
    aslAfgoerelser: [...rows],
  },
  skadedato: options.skadedato ?? toISODateString('2019-04-01'),
  skadelidteFodselsdato: options.skadelidteFodselsdato ?? toISODateString('1980-01-01'),
});

describe('firstOfMonthAfter', () => {
  it('returnerer den første dag i måneden efter datoens måned', () => {
    expect(firstOfMonthAfter(toISODateString('2024-03-15'))).toBe(toISODateString('2024-04-01'));
    expect(firstOfMonthAfter(toISODateString('2024-03-01'))).toBe(toISODateString('2024-04-01'));
    expect(firstOfMonthAfter(toISODateString('2024-03-31'))).toBe(toISODateString('2024-04-01'));
    expect(firstOfMonthAfter(toISODateString('2024-12-15'))).toBe(toISODateString('2025-01-01'));
    expect(firstOfMonthAfter(toISODateString('2024-12-01'))).toBe(toISODateString('2025-01-01'));
  });
});

describe('hasOverlapPeriod', () => {
  it('returnerer kun true når virkningsdato ligger før skæringsdatoen', () => {
    expect(hasOverlapPeriod(toISODateString('2024-03-01'), toISODateString('2024-03-15'))).toBe(true);
    expect(hasOverlapPeriod(toISODateString('2024-04-01'), toISODateString('2024-03-15'))).toBe(false);
    expect(hasOverlapPeriod(toISODateString('2024-05-01'), toISODateString('2024-04-15'))).toBe(false);
    expect(hasOverlapPeriod(toISODateString('2024-05-01'), toISODateString('2024-03-15'))).toBe(false);
    expect(hasOverlapPeriod(toISODateString('2024-04-01'), toISODateString('2024-04-01'))).toBe(true);
    expect(hasOverlapPeriod(toISODateString('2023-11-01'), toISODateString('2024-03-15'))).toBe(true);
  });
});

describe('computeEetLoebendeYdelser', () => {
  it('blokerer en canonical negativ årsløn som afledt domæneissue', () => {
    const result = computeTestRows([], { aslAarsloen: -1000 });

    expect(result.computation).toBeNull();
    expect(result.issues).toContainEqual({
      id: 'aarsloen-zero',
      severity: 'error',
      message: 'Skadelidtes årsløn (efter ASL) skal være større end 0 kr',
    });
  });

  it('afviser ikke-positive ASL-årslønsmaksimum før grundlønsdivision', () => {
    const original = aarsloenAslMax[2019];
    aarsloenAslMax[2019] = 0;

    try {
      const result = computeTestRows([
        testRow({
          id: 'a1',
          fsTilbageholdtEet: 'Nej',
          afgoerelsesDato: toISODateString('2023-01-01'),
          virkningsDato: toISODateString('2023-01-01'),
          eetPct: 25,
          afgoerelseType: 'Midlertidig',
        }),
      ], {
        skadedato: toISODateString('2019-04-01'),
      });

      expect(result.computation).toBeNull();
      expect(result.issues).toContainEqual({
        id: 'aarsloen-max-missing',
        severity: 'error',
        message: 'ASL-maks-sats mangler for år 2019 (satser findes kun for 2005–2026).',
      });
    } finally {
      aarsloenAslMax[2019] = original;
    }
  });

  it('beregner enkelt overlap som difference frem til skæringsdatoen og fuld ydelse derefter', () => {
    const result = computeEetLoebendeYdelser({
      erhvervsevnetab: {
        ...ERHVERVSEVNETAB_INITIAL_VALUES,
        beregningsdato: toISODateString('2024-12-31'),
        aslAarsloen: asAmount(401000),
        aslAfgoerelser: [
          {
            id: 'a1',
            fsTilbageholdtEet: 'Nej',
            afgoerelsesDato: toISODateString('2023-01-01'),
            virkningsDato: toISODateString('2023-01-01'),
            eetPct: 25,
            kapDato: undefined,
            kapPct: undefined,
            afgoerelseType: 'Midlertidig',
            tidlKapDato: undefined,
          },
          {
            id: 'a2',
            fsTilbageholdtEet: 'Nej',
            afgoerelsesDato: toISODateString('2024-03-15'),
            virkningsDato: toISODateString('2024-02-01'),
            eetPct: 40,
            kapDato: undefined,
            kapPct: undefined,
            afgoerelseType: 'Midlertidig',
            tidlKapDato: undefined,
          },
        ],
      },
      skadedato: toISODateString('2019-04-01'),
      skadelidteFodselsdato: toISODateString('1980-01-01'),
    });

    expect(result.issues.some((issue) => issue.severity === 'error')).toBe(false);
    const [first, second] = result.computation?.afgoerelser ?? [];
    if (!result.computation || !first || !second) throw new Error('expected two decisions');

    expect(first.ophoerDato).toBe(toISODateString('2024-03-31'));
    expect(second.harOverlap).toBe(true);
    expect(second.skaeringsDato).toBe(toISODateString('2024-04-01'));
    expect(second.perioder[0]?.fra).toBe(toISODateString('2024-02-01'));
    expect(second.perioder[0]?.til).toBe(toISODateString('2024-03-31'));
    expect(second.perioder[1]?.fra).toBe(toISODateString('2024-04-01'));
    expect(toKroner(second.perioder[0]!.grundydelseAfrundetOre)).toBe(
      roundByMethod(toKroner(second.perioder[1]!.grundydelseAfrundetOre) * (15 / 40), 2, 'halfAwayFromZero')
    );
  });

  it('bruger eksisterende afløsningsregel når virkningsdato er lig skæringsdatoen', () => {
    const result = computeEetLoebendeYdelser({
      erhvervsevnetab: {
        ...ERHVERVSEVNETAB_INITIAL_VALUES,
        beregningsdato: toISODateString('2024-12-31'),
        aslAarsloen: asAmount(401000),
        aslAfgoerelser: [
          {
            id: 'a1',
            fsTilbageholdtEet: 'Nej',
            afgoerelsesDato: toISODateString('2023-01-01'),
            virkningsDato: toISODateString('2023-01-01'),
            eetPct: 25,
            kapDato: undefined,
            kapPct: undefined,
            afgoerelseType: 'Midlertidig',
            tidlKapDato: undefined,
          },
          {
            id: 'a2',
            fsTilbageholdtEet: 'Nej',
            afgoerelsesDato: toISODateString('2024-03-15'),
            virkningsDato: toISODateString('2024-04-01'),
            eetPct: 40,
            kapDato: undefined,
            kapPct: undefined,
            afgoerelseType: 'Midlertidig',
            tidlKapDato: undefined,
          },
        ],
      },
      skadedato: toISODateString('2019-04-01'),
      skadelidteFodselsdato: toISODateString('1980-01-01'),
    });

    const [first, second] = result.computation?.afgoerelser ?? [];
    if (!first || !second) throw new Error('expected two decisions');

    expect(first.ophoerDato).toBe(toISODateString('2024-03-31'));
    expect(second.harOverlap).toBe(false);
    expect(second.skaeringsDato).toBeNull();
    expect(second.perioder[0]?.fra).toBe(toISODateString('2024-04-01'));
  });

  it('bruger eksisterende afløsningsregel når virkningsdato ligger efter skæringsdatoen', () => {
    const result = computeTestRows([
      testRow({
        id: 'a1',
        fsTilbageholdtEet: 'Nej',
        afgoerelsesDato: toISODateString('2023-01-01'),
        virkningsDato: toISODateString('2023-01-01'),
        eetPct: 25,
        afgoerelseType: 'Midlertidig',
      }),
      testRow({
        id: 'a2',
        fsTilbageholdtEet: 'Nej',
        afgoerelsesDato: toISODateString('2024-03-15'),
        virkningsDato: toISODateString('2024-05-01'),
        eetPct: 40,
        afgoerelseType: 'Midlertidig',
      }),
    ]);

    const [first, second] = result.computation?.afgoerelser ?? [];
    if (!first || !second) throw new Error('expected two decisions');

    expect(first.ophoerDato).toBe(toISODateString('2024-04-30'));
    expect(second.harOverlap).toBe(false);
    expect(second.skaeringsDato).toBeNull();
    expect(second.perioder[0]?.fra).toBe(toISODateString('2024-05-01'));
  });

  it('giver 0 procent overlap-bidrag ved fald når FS tilbageholdt EET er Nej', () => {
    const result = computeTestRows([
      testRow({
        id: 'a1',
        fsTilbageholdtEet: 'Nej',
        afgoerelsesDato: toISODateString('2023-01-01'),
        virkningsDato: toISODateString('2023-01-01'),
        eetPct: 40,
        afgoerelseType: 'Midlertidig',
      }),
      testRow({
        id: 'a2',
        fsTilbageholdtEet: 'Nej',
        afgoerelsesDato: toISODateString('2024-03-15'),
        virkningsDato: toISODateString('2024-02-01'),
        eetPct: 25,
        afgoerelseType: 'Midlertidig',
      }),
    ]);

    const [first, second] = result.computation?.afgoerelser ?? [];
    if (!first || !second) throw new Error('expected two decisions');

    expect(first.ophoerDato).toBe(toISODateString('2024-03-31'));
    expect(second.harOverlap).toBe(true);
    expect(second.perioder[0]?.fra).toBe(toISODateString('2024-04-01'));
    expect(toKroner(second.perioder[0]!.grundydelseAfrundetOre)).toBeGreaterThan(0);
    expect(second.perioder.some((row) => row.fra < toISODateString('2024-04-01'))).toBe(false);
    expect(second.perioder.every((row) => toKroner(row.beregnetEetOre) !== 0)).toBe(true);
  });

  it('giver 0 procent overlap-bidrag ved identisk procent når FS tilbageholdt EET er Nej', () => {
    const result = computeTestRows([
      testRow({
        id: 'a1',
        fsTilbageholdtEet: 'Nej',
        afgoerelsesDato: toISODateString('2023-01-01'),
        virkningsDato: toISODateString('2023-01-01'),
        eetPct: 40,
        afgoerelseType: 'Midlertidig',
      }),
      testRow({
        id: 'a2',
        fsTilbageholdtEet: 'Nej',
        afgoerelsesDato: toISODateString('2024-03-15'),
        virkningsDato: toISODateString('2024-02-01'),
        eetPct: 40,
        afgoerelseType: 'Midlertidig',
      }),
    ]);

    const [first, second] = result.computation?.afgoerelser ?? [];
    if (!first || !second) throw new Error('expected two decisions');

    expect(first.ophoerDato).toBe(toISODateString('2024-03-31'));
    expect(second.harOverlap).toBe(true);
    expect(second.perioder[0]?.fra).toBe(toISODateString('2024-04-01'));
    expect(toKroner(second.perioder[0]!.grundydelseAfrundetOre)).toBeGreaterThan(0);
    expect(second.perioder.some((row) => row.fra < toISODateString('2024-04-01'))).toBe(false);
    expect(second.perioder.every((row) => toKroner(row.beregnetEetOre) !== 0)).toBe(true);
  });

  it('bruger faktisk virkningsdato ved identisk procent når forgængeren har FS tilbageholdt EET', () => {
    const result = computeTestRows([
      testRow({
        id: 'a1',        afgoerelsesDato: toISODateString('2023-01-01'),
        virkningsDato: toISODateString('2023-01-01'),
        eetPct: 40,
        afgoerelseType: 'Midlertidig',
        fsTilbageholdtEet: 'Ja',
      }),
      testRow({
        id: 'a2',
        fsTilbageholdtEet: 'Nej',
        afgoerelsesDato: toISODateString('2024-03-15'),
        virkningsDato: toISODateString('2024-02-01'),
        eetPct: 40,
        afgoerelseType: 'Midlertidig',
      }),
    ]);

    const [first, second] = result.computation?.afgoerelser ?? [];
    if (!first || !second) throw new Error('expected two decisions');

    expect(first.ophoerDato).toBe(toISODateString('2024-01-31'));
    expect(second.harOverlap).toBe(false);
    expect(second.skaeringsDato).toBeNull();
    expect(second.perioder[0]?.fra).toBe(toISODateString('2024-02-01'));
  });

  it('splitter overlapperioden ved kalenderårsskifte når skæringsdatoen ligger i det nye år', () => {
    const result = computeTestRows([
      testRow({
        id: 'a1',
        fsTilbageholdtEet: 'Nej',
        afgoerelsesDato: toISODateString('2024-01-01'),
        virkningsDato: toISODateString('2024-01-01'),
        eetPct: 25,
        afgoerelseType: 'Midlertidig',
      }),
      testRow({
        id: 'a2',
        fsTilbageholdtEet: 'Nej',
        afgoerelsesDato: toISODateString('2025-01-15'),
        virkningsDato: toISODateString('2024-11-01'),
        eetPct: 40,
        afgoerelseType: 'Midlertidig',
      }),
    ]);

    const second = result.computation?.afgoerelser[1];
    if (!second) throw new Error('expected second decision');

    expect(second.harOverlap).toBe(true);
    expect(second.skaeringsDato).toBe(toISODateString('2025-02-01'));
    expect(second.perioder[0]?.fra).toBe(toISODateString('2024-11-01'));
    expect(second.perioder[0]?.til).toBe(toISODateString('2024-12-31'));
    expect(second.perioder[0]?.satsAar).toBe(2024);
    expect(second.perioder[1]?.fra).toBe(toISODateString('2025-01-01'));
    expect(second.perioder[1]?.til).toBe(toISODateString('2025-01-31'));
    expect(second.perioder[1]?.satsAar).toBe(2025);
    expect(second.perioder[2]?.fra).toBe(toISODateString('2025-02-01'));
  });

  it('beregner delvise måneder i overlapperioden med præcis dagbrøk', () => {
    const partial = computeTestRows([
      testRow({
        id: 'a1',
        fsTilbageholdtEet: 'Nej',
        afgoerelsesDato: toISODateString('2024-01-01'),
        virkningsDato: toISODateString('2024-01-01'),
        eetPct: 25,
        afgoerelseType: 'Midlertidig',
      }),
      testRow({
        id: 'a2',
        fsTilbageholdtEet: 'Nej',
        afgoerelsesDato: toISODateString('2024-03-15'),
        virkningsDato: toISODateString('2024-03-10'),
        eetPct: 40,
        afgoerelseType: 'Midlertidig',
      }),
    ]);
    const full = computeTestRows([
      testRow({
        id: 'a1',
        fsTilbageholdtEet: 'Nej',
        afgoerelsesDato: toISODateString('2024-01-01'),
        virkningsDato: toISODateString('2024-01-01'),
        eetPct: 25,
        afgoerelseType: 'Midlertidig',
      }),
      testRow({
        id: 'a2',
        fsTilbageholdtEet: 'Nej',
        afgoerelsesDato: toISODateString('2024-03-31'),
        virkningsDato: toISODateString('2024-03-01'),
        eetPct: 40,
        afgoerelseType: 'Midlertidig',
      }),
    ]);

    const partialOverlap = partial.computation?.afgoerelser[1]?.perioder[0];
    const fullOverlap = full.computation?.afgoerelser[1]?.perioder[0];
    if (!partialOverlap || !fullOverlap) throw new Error('expected overlap periods');

    expect(partialOverlap.fra).toBe(toISODateString('2024-03-10'));
    expect(partialOverlap.til).toBe(toISODateString('2024-03-31'));
    expect(partialOverlap.maanederPraecis).toBeCloseTo(22 / 31, 10);
    expect(fullOverlap.fra).toBe(toISODateString('2024-03-01'));
    expect(fullOverlap.til).toBe(toISODateString('2024-03-31'));
    expect(fullOverlap.maanederPraecis).toBe(1);
  });

  it('afløser efter virkningsdato ved samme afgørelsesdato, også før afgørelsesdatoen', () => {
    const result = computeTestRows([
      testRow({
        id: 'a1',
        fsTilbageholdtEet: 'Nej',
        afgoerelsesDato: toISODateString('2024-03-01'),
        virkningsDato: toISODateString('2024-01-01'),
        eetPct: 25,
        afgoerelseType: 'Midlertidig',
      }),
      testRow({
        id: 'a2',
        fsTilbageholdtEet: 'Nej',
        afgoerelsesDato: toISODateString('2024-03-01'),
        virkningsDato: toISODateString('2024-02-01'),
        eetPct: 40,
        afgoerelseType: 'Midlertidig',
      }),
    ]);

    const [first, second] = result.computation?.afgoerelser ?? [];
    if (!first || !second) throw new Error('expected two decisions');

    expect(first.ophoerDato).toBe(toISODateString('2024-01-31'));
    expect(second.harOverlap).toBe(false);
    expect(second.skaeringsDato).toBeNull();
    expect(second.perioder[0]?.fra).toBe(toISODateString('2024-02-01'));
    expect(second.perioder[0]?.til).toBe(toISODateString('2024-12-31'));
    expect(toKroner(second.perioder[0]!.grundydelseAfrundetOre)).toBeGreaterThan(0);
  });

  it('beregner senere tilbagevirkende afgørelse mod de faktisk udbetalte samme-dato-afgørelser', () => {
    const scenarios = [
      { label: 'ingen tilbageholdelse', aFs: 'Nej', bFs: 'Nej', aOphoer: '2024-02-29', bHasPeriods: true, cHasMarchPeriod: false, cHasSeptemberPeriod: true },
      { label: 'kun A tilbageholdt', aFs: 'Ja', bFs: 'Nej', aOphoer: '2024-01-31', bHasPeriods: true, cHasMarchPeriod: false, cHasSeptemberPeriod: true },
      { label: 'kun B tilbageholdt', aFs: 'Nej', bFs: 'Ja', aOphoer: '2024-02-29', bHasPeriods: false, cHasMarchPeriod: true, cHasSeptemberPeriod: true },
      { label: 'A og B tilbageholdt', aFs: 'Ja', bFs: 'Ja', aOphoer: '2024-01-31', bHasPeriods: false, cHasMarchPeriod: false, cHasSeptemberPeriod: false },
    ] as const;

    for (const scenario of scenarios) {
      const result = computeTestRows([
        testRow({
          id: 'a',
          afgoerelsesDato: toISODateString('2024-05-01'),
          virkningsDato: toISODateString('2024-01-01'),
          eetPct: 20,
          afgoerelseType: 'Midlertidig',
          fsTilbageholdtEet: scenario.aFs,
        }),
        testRow({
          id: 'b',
          afgoerelsesDato: toISODateString('2024-05-01'),
          virkningsDato: toISODateString('2024-03-01'),
          eetPct: 30,
          afgoerelseType: 'Midlertidig',
          fsTilbageholdtEet: scenario.bFs,
        }),
        testRow({
          id: 'c',
          afgoerelsesDato: toISODateString('2024-08-15'),
          virkningsDato: toISODateString('2024-02-01'),
          eetPct: 25,
          afgoerelseType: 'Midlertidig',
        }),
      ], { beregningsdato: toISODateString('2024-12-31') });

      const [a, b, c] = result.computation?.afgoerelser ?? [];
      if (!a || !b || !c) throw new Error('expected three decisions');

      expect(a.ophoerDato).toBe(toISODateString(scenario.aOphoer));
      expect(b.perioder.length > 0).toBe(scenario.bHasPeriods);
      expect(c.perioder[0]?.fra).toBe(toISODateString('2024-02-01'));
      const cPeriodStarts = c.perioder.map((period) => period.fra);
      if (scenario.cHasMarchPeriod) {
        expect(cPeriodStarts, scenario.label).toContain(toISODateString('2024-03-01'));
      } else {
        expect(cPeriodStarts, scenario.label).not.toContain(toISODateString('2024-03-01'));
      }
      expect(c.perioder.some((period) => period.fra === toISODateString('2024-09-01'))).toBe(scenario.cHasSeptemberPeriod);
    }
  });

  it('lader delvist endelig afgørelse afløse på virkningsdato før kapitalisering', () => {
    const result = computeTestRows([
      testRow({
        id: 'a',
        afgoerelsesDato: toISODateString('2024-05-01'),
        virkningsDato: toISODateString('2024-01-01'),
        eetPct: 30,
        afgoerelseType: 'Midlertidig',
      }),
      testRow({
        id: 'b',
        afgoerelsesDato: toISODateString('2024-05-01'),
        virkningsDato: toISODateString('2024-03-01'),
        eetPct: 50,
        afgoerelseType: 'Delvist endelig',
        kapDato: toISODateString('2024-05-01'),
        kapPct: 20,
      }),
    ], { beregningsdato: toISODateString('2024-12-31') });

    const [a, b] = result.computation?.afgoerelser ?? [];
    if (!a || !b) throw new Error('expected two decisions');

    expect(a.ophoerDato).toBe(toISODateString('2024-02-29'));
    expect(b.eetPct).toBe(50);
    expect(b.restEetPct).toBe(30);
    expect(b.perioder[0]?.fra).toBe(toISODateString('2024-03-01'));
    expect(b.perioder[0]?.til).toBe(toISODateString('2024-04-30'));
    expect(b.perioder[1]?.fra).toBe(toISODateString('2024-05-01'));
  });

  it('fordeler kædet overlap mellem seneste referenceafgørelser når procenterne stiger trinvist', () => {
    const result = computeTestRows([
      testRow({
        id: 'a',
        fsTilbageholdtEet: 'Nej',
        afgoerelsesDato: toISODateString('2023-01-01'),
        virkningsDato: toISODateString('2023-01-01'),
        eetPct: 25,
        afgoerelseType: 'Midlertidig',
      }),
      testRow({
        id: 'c',
        fsTilbageholdtEet: 'Nej',
        afgoerelsesDato: toISODateString('2024-04-10'),
        virkningsDato: toISODateString('2024-03-01'),
        eetPct: 30,
        afgoerelseType: 'Midlertidig',
      }),
      testRow({
        id: 'b',
        fsTilbageholdtEet: 'Nej',
        afgoerelsesDato: toISODateString('2024-04-15'),
        virkningsDato: toISODateString('2024-03-01'),
        eetPct: 35,
        afgoerelseType: 'Midlertidig',
      }),
    ]);

    const [, second, third] = result.computation?.afgoerelser ?? [];
    if (!second || !third) throw new Error('expected chained decisions');

    expect(second.rowId).toBe('c');
    expect(third.rowId).toBe('b');
    expect(second.perioder[0]?.fra).toBe(toISODateString('2024-03-01'));
    expect(second.perioder[0]?.til).toBe(toISODateString('2024-04-30'));
    expect(third.perioder[0]?.fra).toBe(toISODateString('2024-03-01'));
    expect(third.perioder[0]?.til).toBe(toISODateString('2024-04-30'));
    expect(toKroner(second.perioder[0]!.grundydelseAfrundetOre)).toBe(
      toKroner(third.perioder[0]!.grundydelseAfrundetOre)
    );
    expect(third.perioder[1]?.fra).toBe(toISODateString('2024-05-01'));
  });

  it('aktiverer FS-undtagelsen i kædet overlap når den seneste referenceafgørelse falder', () => {
    const result = computeTestRows([
      testRow({
        id: 'a',
        fsTilbageholdtEet: 'Nej',
        afgoerelsesDato: toISODateString('2023-01-01'),
        virkningsDato: toISODateString('2023-01-01'),
        eetPct: 25,
        afgoerelseType: 'Midlertidig',
      }),
      testRow({
        id: 'c',        afgoerelsesDato: toISODateString('2024-04-10'),
        virkningsDato: toISODateString('2024-03-01'),
        eetPct: 50,
        afgoerelseType: 'Midlertidig',
        fsTilbageholdtEet: 'Ja',
      }),
      testRow({
        id: 'b',
        fsTilbageholdtEet: 'Nej',
        afgoerelsesDato: toISODateString('2024-04-15'),
        virkningsDato: toISODateString('2024-03-01'),
        eetPct: 35,
        afgoerelseType: 'Midlertidig',
      }),
    ]);

    const [first, second, third] = result.computation?.afgoerelser ?? [];
    if (!first || !second || !third) throw new Error('expected chained decisions');

    expect(first.ophoerDato).toBe(toISODateString('2024-04-30'));
    expect(second.ophoerDato).toBe(toISODateString('2024-02-29'));
    expect(second.perioder).toEqual([]);
    expect(third.harOverlap).toBe(false);
    expect(third.perioder[0]?.fra).toBe(toISODateString('2024-03-01'));
  });

  it('fradrager tidligere kapitalisering i overlapperiodens difference og efter skæringsdatoen', () => {
    const result = computeTestRows([
      testRow({
        id: 'a1',
        fsTilbageholdtEet: 'Nej',
        afgoerelsesDato: toISODateString('2024-01-01'),
        virkningsDato: toISODateString('2024-01-01'),
        eetPct: 40,
        kapDato: toISODateString('2024-01-01'),
        kapPct: 20,
        afgoerelseType: 'Delvist endelig',
      }),
      testRow({
        id: 'a2',
        fsTilbageholdtEet: 'Nej',
        afgoerelsesDato: toISODateString('2024-03-15'),
        virkningsDato: toISODateString('2024-03-01'),
        eetPct: 50,
        afgoerelseType: 'Midlertidig',
      }),
    ]);

    const [first, second] = result.computation?.afgoerelser ?? [];
    if (!first || !second) throw new Error('expected two decisions');

    expect(first.restEetPct).toBe(20);
    expect(second.priorKapPct).toBe(20);
    expect(second.perioder[0]?.fra).toBe(toISODateString('2024-03-01'));
    expect(second.perioder[0]?.til).toBe(toISODateString('2024-03-31'));
    expect(second.perioder[1]?.fra).toBe(toISODateString('2024-04-01'));
    expect(toKroner(second.perioder[0]!.grundydelseAfrundetOre)).toBeCloseTo(
      toKroner(second.perioder[1]!.grundydelseAfrundetOre) * (10 / 30),
      1
    );
  });

  it('splitter ikke overlapperioden ved kapitaliseringsdatoer uden for overlapperioden', () => {
    const result = computeTestRows([
      testRow({
        id: 'a1',
        fsTilbageholdtEet: 'Nej',
        afgoerelsesDato: toISODateString('2024-01-01'),
        virkningsDato: toISODateString('2024-01-01'),
        eetPct: 30,
        afgoerelseType: 'Midlertidig',
      }),
      testRow({
        id: 'a2',
        fsTilbageholdtEet: 'Nej',
        afgoerelsesDato: toISODateString('2024-03-15'),
        virkningsDato: toISODateString('2024-03-01'),
        eetPct: 50,
        kapDato: toISODateString('2024-10-01'),
        kapPct: 20,
        afgoerelseType: 'Delvist endelig',
      }),
    ]);

    const second = result.computation?.afgoerelser[1];
    if (!second) throw new Error('expected second decision');

    const overlapRows = second.perioder.filter((row) => row.til <= toISODateString('2024-03-31'));
    expect(overlapRows).toHaveLength(1);
    expect(overlapRows[0]?.fra).toBe(toISODateString('2024-03-01'));
    expect(overlapRows[0]?.til).toBe(toISODateString('2024-03-31'));
    expect(second.perioder.some((row) => row.fra === toISODateString('2024-10-01'))).toBe(true);
  });

  it('bruger faktisk virkningsdato ved stigning når forgængeren har FS tilbageholdt EET', () => {
    const increase = computeEetLoebendeYdelser({
      erhvervsevnetab: {
        ...ERHVERVSEVNETAB_INITIAL_VALUES,
        beregningsdato: toISODateString('2024-12-31'),
        aslAarsloen: asAmount(401000),
        aslAfgoerelser: [
          {
            id: 'a1',            afgoerelsesDato: toISODateString('2023-01-01'),
            virkningsDato: toISODateString('2023-01-01'),
            eetPct: 25,
            kapDato: undefined,
            kapPct: undefined,
            afgoerelseType: 'Midlertidig',
            tidlKapDato: undefined,
            fsTilbageholdtEet: 'Ja',
          },
          {
            id: 'a2',
            fsTilbageholdtEet: 'Nej',
            afgoerelsesDato: toISODateString('2024-03-15'),
            virkningsDato: toISODateString('2024-02-01'),
            eetPct: 40,
            kapDato: undefined,
            kapPct: undefined,
            afgoerelseType: 'Midlertidig',
            tidlKapDato: undefined,
          },
        ],
      },
      skadedato: toISODateString('2019-04-01'),
      skadelidteFodselsdato: toISODateString('1980-01-01'),
    });

    expect(increase.computation?.afgoerelser[1]?.harOverlap).toBe(false);
    expect(increase.computation?.afgoerelser[1]?.skaeringsDato).toBeNull();
    expect(increase.computation?.afgoerelser[0]?.ophoerDato).toBe(toISODateString('2024-01-31'));
    expect(increase.computation?.afgoerelser[1]?.perioder[0]?.fra).toBe(toISODateString('2024-02-01'));
  });

  it('bruger faktisk virkningsdato ved fald når forgængeren har FS tilbageholdt EET', () => {
    const decrease = computeEetLoebendeYdelser({
      erhvervsevnetab: {
        ...ERHVERVSEVNETAB_INITIAL_VALUES,
        beregningsdato: toISODateString('2024-12-31'),
        aslAarsloen: asAmount(401000),
        aslAfgoerelser: [
          {
            id: 'a1',            afgoerelsesDato: toISODateString('2023-01-01'),
            virkningsDato: toISODateString('2023-01-01'),
            eetPct: 40,
            kapDato: undefined,
            kapPct: undefined,
            afgoerelseType: 'Midlertidig',
            tidlKapDato: undefined,
            fsTilbageholdtEet: 'Ja',
          },
          {
            id: 'a2',
            fsTilbageholdtEet: 'Nej',
            afgoerelsesDato: toISODateString('2024-03-15'),
            virkningsDato: toISODateString('2024-02-01'),
            eetPct: 25,
            kapDato: undefined,
            kapPct: undefined,
            afgoerelseType: 'Midlertidig',
            tidlKapDato: undefined,
          },
        ],
      },
      skadedato: toISODateString('2019-04-01'),
      skadelidteFodselsdato: toISODateString('1980-01-01'),
    });

    expect(decrease.computation?.afgoerelser[1]?.harOverlap).toBe(false);
    expect(decrease.computation?.afgoerelser[1]?.skaeringsDato).toBeNull();
    expect(decrease.computation?.afgoerelser[0]?.ophoerDato).toBe(toISODateString('2024-01-31'));
    expect(decrease.computation?.afgoerelser[1]?.perioder[0]?.fra).toBe(toISODateString('2024-02-01'));
  });

  it('lader FS tilbageholdt EET på forgængeren afløse på næste afgørelses faktiske virkningsdato', () => {
    const result = computeEetLoebendeYdelser({
      erhvervsevnetab: {
        ...ERHVERVSEVNETAB_INITIAL_VALUES,
        beregningsdato: toISODateString('2021-12-31'),
        aslAarsloen: asAmount(500000),
        aslAfgoerelser: [
          {
            id: 'a1',            afgoerelsesDato: toISODateString('2019-10-01'),
            virkningsDato: toISODateString('2019-02-01'),
            eetPct: 55,
            kapDato: undefined,
            kapPct: undefined,
            afgoerelseType: 'Endelig',
            tidlKapDato: undefined,
            fsTilbageholdtEet: 'Ja',
          },
          {
            id: 'a2',
            fsTilbageholdtEet: 'Nej',
            afgoerelsesDato: toISODateString('2021-02-15'),
            virkningsDato: toISODateString('2021-02-01'),
            eetPct: 65,
            kapDato: undefined,
            kapPct: undefined,
            afgoerelseType: 'Endelig',
            tidlKapDato: undefined,
          },
        ],
      },
      skadedato: toISODateString('2019-01-01'),
      skadelidteFodselsdato: toISODateString('1980-01-01'),
    });

    const [first, second] = result.computation?.afgoerelser ?? [];
    if (!first || !second) throw new Error('expected two decisions');

    expect(first.ophoerDato).toBe(toISODateString('2021-01-31'));
    expect(second.harOverlap).toBe(false);
    expect(second.skaeringsDato).toBeNull();
    expect(second.perioder[0]?.fra).toBe(toISODateString('2021-02-01'));
  });

  it('lader kapitalisering midt i overlap reducere både forgænger og ny afgørelse', () => {
    const result = computeEetLoebendeYdelser({
      erhvervsevnetab: {
        ...ERHVERVSEVNETAB_INITIAL_VALUES,
        beregningsdato: toISODateString('2024-12-31'),
        aslAarsloen: asAmount(401000),
        aslAfgoerelser: [
          {
            id: 'a1',
            fsTilbageholdtEet: 'Nej',
            afgoerelsesDato: toISODateString('2024-01-01'),
            virkningsDato: toISODateString('2024-01-01'),
            eetPct: 40,
            kapDato: undefined,
            kapPct: undefined,
            afgoerelseType: 'Midlertidig',
            tidlKapDato: undefined,
          },
          {
            id: 'a2',
            fsTilbageholdtEet: 'Nej',
            afgoerelsesDato: toISODateString('2024-03-15'),
            virkningsDato: toISODateString('2024-03-01'),
            eetPct: 50,
            kapDato: toISODateString('2024-03-20'),
            kapPct: 20,
            afgoerelseType: 'Delvist endelig',
            tidlKapDato: undefined,
          },
        ],
      },
      skadedato: toISODateString('2019-04-01'),
      skadelidteFodselsdato: toISODateString('1980-01-01'),
    });

    const [first, second] = result.computation?.afgoerelser ?? [];
    if (!first || !second) throw new Error('expected two decisions');

    expect(first.perioder.some((row) => row.til === toISODateString('2024-03-19'))).toBe(true);
    expect(first.perioder.some((row) => row.fra === toISODateString('2024-03-20'))).toBe(true);

    const beforeKapOverlap = second.perioder.find((row) => row.fra === toISODateString('2024-03-01') && row.til === toISODateString('2024-03-19'));
    const afterKapOverlap = second.perioder.find((row) => row.fra === toISODateString('2024-03-20') && row.til === toISODateString('2024-03-31'));
    if (!beforeKapOverlap || !afterKapOverlap) throw new Error('expected overlap split around kapitalisering');

    expect(toKroner(beforeKapOverlap.grundydelseAfrundetOre)).toBe(
      toKroner(afterKapOverlap.grundydelseAfrundetOre)
    );
  });

  it('beregner tilbagevirkende afgørelse fuldt før forgængeren virker og som difference derefter', () => {
    const result = computeEetLoebendeYdelser({
      erhvervsevnetab: {
        ...ERHVERVSEVNETAB_INITIAL_VALUES,
        beregningsdato: toISODateString('2024-12-31'),
        aslAarsloen: asAmount(401000),
        aslAfgoerelser: [
          {
            id: 'a1',
            fsTilbageholdtEet: 'Nej',
            afgoerelsesDato: toISODateString('2024-01-01'),
            virkningsDato: toISODateString('2024-01-01'),
            eetPct: 25,
            kapDato: undefined,
            kapPct: undefined,
            afgoerelseType: 'Midlertidig',
            tidlKapDato: undefined,
          },
          {
            id: 'a2',
            fsTilbageholdtEet: 'Nej',
            afgoerelsesDato: toISODateString('2024-06-01'),
            virkningsDato: toISODateString('2023-11-01'),
            eetPct: 40,
            kapDato: undefined,
            kapPct: undefined,
            afgoerelseType: 'Midlertidig',
            tidlKapDato: undefined,
          },
        ],
      },
      skadedato: toISODateString('2019-04-01'),
      skadelidteFodselsdato: toISODateString('1980-01-01'),
    });

    const second = result.computation?.afgoerelser[1];
    if (!second) throw new Error('expected second decision');

    expect(second.harOverlap).toBe(true);
    expect(second.skaeringsDato).toBe(toISODateString('2024-07-01'));
    expect(second.perioder[0]?.fra).toBe(toISODateString('2023-11-01'));
    expect(second.perioder[0]?.til).toBe(toISODateString('2023-12-31'));
    expect(second.perioder[1]?.fra).toBe(toISODateString('2024-01-01'));
    expect(second.perioder[1]?.til).toBe(toISODateString('2024-06-30'));
    expect(second.perioder[2]?.fra).toBe(toISODateString('2024-07-01'));
    expect(toKroner(second.perioder[1]!.grundydelseAfrundetOre)).toBe(
      roundByMethod(toKroner(second.perioder[2]!.grundydelseAfrundetOre) * (15 / 40), 2, 'halfAwayFromZero')
    );
    expect(toKroner(second.perioder[0]!.grundydelseAfrundetOre)).toBeGreaterThan(
      toKroner(second.perioder[1]!.grundydelseAfrundetOre)
    );
    expect(toKroner(second.perioder[2]!.grundydelseAfrundetOre)).toBeGreaterThan(
      toKroner(second.perioder[1]!.grundydelseAfrundetOre)
    );
  });

  it('bruger seneste afgørelse i afgørelsesrækkefølgen som reference ved kædet overlap', () => {
    const result = computeEetLoebendeYdelser({
      erhvervsevnetab: {
        ...ERHVERVSEVNETAB_INITIAL_VALUES,
        beregningsdato: toISODateString('2024-12-31'),
        aslAarsloen: asAmount(401000),
        aslAfgoerelser: [
          {
            id: 'a1',
            fsTilbageholdtEet: 'Nej',
            afgoerelsesDato: toISODateString('2023-01-01'),
            virkningsDato: toISODateString('2023-01-01'),
            eetPct: 25,
            kapDato: undefined,
            kapPct: undefined,
            afgoerelseType: 'Midlertidig',
            tidlKapDato: undefined,
          },
          {
            id: 'c',
            fsTilbageholdtEet: 'Nej',
            afgoerelsesDato: toISODateString('2024-04-10'),
            virkningsDato: toISODateString('2024-03-01'),
            eetPct: 50,
            kapDato: undefined,
            kapPct: undefined,
            afgoerelseType: 'Midlertidig',
            tidlKapDato: undefined,
          },
          {
            id: 'b',
            fsTilbageholdtEet: 'Nej',
            afgoerelsesDato: toISODateString('2024-04-15'),
            virkningsDato: toISODateString('2024-03-01'),
            eetPct: 35,
            kapDato: undefined,
            kapPct: undefined,
            afgoerelseType: 'Midlertidig',
            tidlKapDato: undefined,
          },
        ],
      },
      skadedato: toISODateString('2019-04-01'),
      skadelidteFodselsdato: toISODateString('1980-01-01'),
    });

    const [first, second, third] = result.computation?.afgoerelser ?? [];
    if (!first || !second || !third) throw new Error('expected three decisions');

    expect(first.rowId).toBe('a1');
    expect(second.rowId).toBe('c');
    expect(third.rowId).toBe('b');
    expect(first.ophoerDato).toBe(toISODateString('2024-04-30'));
    expect(second.ophoerDato).toBe(toISODateString('2024-04-30'));
    expect(toKroner(second.perioder[0]!.grundydelseAfrundetOre)).toBeGreaterThan(0);
    expect(third.perioder).toHaveLength(1);
    expect(third.perioder[0]?.fra).toBe(toISODateString('2024-05-01'));
    expect(toKroner(third.perioder[0]!.grundydelseAfrundetOre)).toBeGreaterThan(0);
    expect(third.perioder.every((row) => toKroner(row.beregnetEetOre) !== 0)).toBe(true);
  });

  it('beregner løbende ydelser for verificeret eksempel A', () => {
    const result = computeEetLoebendeYdelser({
      erhvervsevnetab: {
        ...ERHVERVSEVNETAB_INITIAL_VALUES,
        beregningsdato: toISODateString('2026-02-27'),
        aslAarsloen: asAmount(489000),
        aslAfgoerelser: [
          {
            id: 'a1',
            fsTilbageholdtEet: 'Nej',
            afgoerelsesDato: toISODateString('2023-07-01'),
            virkningsDato: toISODateString('2023-02-01'),
            eetPct: 45,
            kapDato: undefined,
            kapPct: undefined,
            afgoerelseType: 'Midlertidig',
            tidlKapDato: undefined,
          },
          {
            id: 'a2',
            fsTilbageholdtEet: 'Nej',
            afgoerelsesDato: toISODateString('2025-11-01'),
            virkningsDato: toISODateString('2025-10-01'),
            eetPct: 75,
            kapDato: toISODateString('2026-01-15'),
            kapPct: 50,
            afgoerelseType: 'Delvist endelig',
            tidlKapDato: undefined,
          },
        ],
      },
      skadedato: toISODateString('2019-04-01'),
      skadelidteFodselsdato: toISODateString('1980-01-01'),
    });

    expect(result.issues.some((issue) => issue.severity === 'error')).toBe(false);
    expect(result.computation).not.toBeNull();

    const computation = result.computation;
    if (!computation) throw new Error('expected computation');

    expect(toKroner(computation.grundloenOre)).toBe(332955);
    expect(computation.afgoerelser).toHaveLength(2);

    const first = computation.afgoerelser[0];
    expect(first.tilbagevirkendeKraft).toBe(true);
    expect(first.perioder).toHaveLength(3);
    expect(toKroner(first.perioder[0]!.maanedligYdelseOre)).toBe(15265);
    expect(toKroner(first.perioder[1]!.maanedligYdelseOre)).toBe(15799);
    expect(toKroner(first.perioder[2]!.maanedligYdelseOre)).toBe(16415);
    expect(toKroner(first.iAltBeregnetEetOre)).toBe(538068);

    const second = computation.afgoerelser[1];
    expect(second.restEetPct).toBe(25);
    expect(second.harOverlap).toBe(true);
    expect(second.skaeringsDato).toBe(toISODateString('2025-12-01'));
    expect(second.perioder).toHaveLength(4);
    expect(second.perioder[0]?.fra).toBe(toISODateString('2025-10-01'));
    expect(second.perioder[0]?.til).toBe(toISODateString('2025-11-30'));
    expect(second.perioder[1]?.fra).toBe(toISODateString('2025-12-01'));
    expect(second.perioder[2]?.fra).toBe(toISODateString('2026-01-01'));
    expect(second.perioder[3]?.fra).toBe(toISODateString('2026-01-15'));
    expect(toKroner(second.perioder[0]!.maanedligYdelseOre)).toBeLessThan(
      toKroner(second.perioder[1]!.maanedligYdelseOre)
    );
    expect(toKroner(second.perioder[3]!.maanedligYdelseOre)).toBe(9558);
  });

  it('giver fejl når kapitaliseringsdato er udfyldt uden kapitaliseringsprocent', () => {
    const result = computeEetLoebendeYdelser({
      erhvervsevnetab: {
        ...ERHVERVSEVNETAB_INITIAL_VALUES,
        beregningsdato: toISODateString('2026-02-27'),
        aslAarsloen: asAmount(400000),
        aslAfgoerelser: [
          {
            id: 'a1',
            fsTilbageholdtEet: 'Nej',
            afgoerelsesDato: toISODateString('2025-11-01'),
            virkningsDato: toISODateString('2025-10-01'),
            eetPct: 40,
            kapDato: toISODateString('2026-01-15'),
            kapPct: undefined,
            afgoerelseType: 'Endelig',
            tidlKapDato: undefined,
          },
        ],
      },
      skadedato: toISODateString('2019-04-01'),
      skadelidteFodselsdato: toISODateString('1980-01-01'),
    });

    expect(result.computation).toBeNull();
    expect(result.issues.some((issue) => issue.message === 'Der er indtastet kapitaliseringsdato men ikke -procent')).toBe(true);
  });

  it('fortsætter løbende beregning når endelig afgørelse under 50 % ikke kapitaliseres', () => {
    const result = computeEetLoebendeYdelser({
      erhvervsevnetab: {
        ...ERHVERVSEVNETAB_INITIAL_VALUES,
        beregningsdato: toISODateString('2026-02-27'),
        aslAarsloen: asAmount(400000),
        aslAfgoerelser: [
          {
            id: 'a1',
            fsTilbageholdtEet: 'Nej',
            afgoerelsesDato: toISODateString('2025-11-01'),
            virkningsDato: toISODateString('2025-10-01'),
            eetPct: 40,
            kapDato: undefined,
            kapPct: undefined,
            afgoerelseType: 'Endelig',
            tidlKapDato: undefined,
          },
        ],
      },
      skadedato: toISODateString('2019-04-01'),
      skadelidteFodselsdato: toISODateString('1980-01-01'),
    });

    expect(result.computation).not.toBeNull();
    expect(result.issues.some((issue) => issue.id === 'endelig-under-50-missing-kapitalisering')).toBe(false);
  });

  it('giver advarsel ved ugyldig EET-procent for regler fra 1. juli 2024', () => {
    const result = computeEetLoebendeYdelser({
      erhvervsevnetab: {
        ...ERHVERVSEVNETAB_INITIAL_VALUES,
        beregningsdato: toISODateString('2026-02-27'),
        aslAarsloen: asAmount(401000),
        aslAfgoerelser: [
          {
            id: 'a1',
            fsTilbageholdtEet: 'Nej',
            afgoerelsesDato: toISODateString('2025-08-01'),
            virkningsDato: toISODateString('2025-08-01'),
            eetPct: 55,
            kapDato: undefined,
            kapPct: undefined,
            afgoerelseType: 'Midlertidig',
            tidlKapDato: undefined,
          },
        ],
      },
      skadedato: toISODateString('2024-07-01'),
      skadelidteFodselsdato: toISODateString('1980-01-01'),
    });

    expect(result.computation).not.toBeNull();
    expect(
      result.issues.some(
        (issue) =>
          issue.severity === 'warning' &&
          issue.message === 'Der er indtastet en ugyldig EET-procent (55 %) for skader fra 1. juli 2024.'
      )
    ).toBe(true);
  });

  it('giver fortsat advarsel når en dato faktisk ligger efter beregningsdatoen i løbende-beregningen', () => {
    const result = computeEetLoebendeYdelser({
      erhvervsevnetab: {
        ...ERHVERVSEVNETAB_INITIAL_VALUES,
        beregningsdato: toISODateString('2026-01-14'),
        aslAarsloen: asAmount(339000),
        aslAfgoerelser: [
          {
            id: 'a1',
            fsTilbageholdtEet: 'Nej',
            afgoerelsesDato: toISODateString('2026-01-15'),
            virkningsDato: toISODateString('2026-01-15'),
            eetPct: 15,
            kapDato: toISODateString('2026-01-15'),
            kapPct: 15,
            afgoerelseType: 'Endelig',
            tidlKapDato: undefined,
          },
        ],
      },
      skadedato: toISODateString('2022-09-17'),
      skadelidteFodselsdato: toISODateString('1980-01-01'),
    });

    expect(result.issues.some((issue) => issue.id === 'warn-afgoerelsesdato-after-beregningsdato')).toBe(true);
    expect(result.issues.some((issue) => issue.id === 'warn-virkningsdato-after-beregningsdato')).toBe(true);
    expect(result.issues.some((issue) => issue.id === 'warn-kap-dato-after-beregningsdato')).toBe(true);
  });

  it('beregner rest-grundydelse proportionalt fra fuld grundydelse', () => {
    const result = computeEetLoebendeYdelser({
      erhvervsevnetab: {
        ...ERHVERVSEVNETAB_INITIAL_VALUES,
        beregningsdato: toISODateString('2026-02-27'),
        aslAarsloen: asAmount(489000),
        aslAfgoerelser: [
          {
            id: 'a1',
            fsTilbageholdtEet: 'Nej',
            afgoerelsesDato: toISODateString('2025-11-01'),
            virkningsDato: toISODateString('2025-10-01'),
            eetPct: 75,
            kapDato: toISODateString('2026-01-15'),
            kapPct: 50,
            afgoerelseType: 'Delvist endelig',
            tidlKapDato: undefined,
          },
        ],
      },
      skadedato: toISODateString('2019-04-01'),
      skadelidteFodselsdato: toISODateString('1980-01-01'),
    });

    expect(result.computation).not.toBeNull();
    const computation = result.computation;
    if (!computation) throw new Error('expected computation');

    const afgoerelse = computation.afgoerelser[0];
    if (!afgoerelse) throw new Error('expected first decision');
    expect(afgoerelse.grundydelseRestOre).not.toBeNull();

    const expectedRest = roundByMethod(
      toKroner(afgoerelse.grundydelseFuldOre) * (afgoerelse.restEetPct / afgoerelse.eetPctFoerAktuelKap),
      2,
      'halfAwayFromZero'
    );
    expect(toKroner(afgoerelse.grundydelseRestOre!)).toBe(expectedRest);
  });

  it('fradrager tidligere kapitalisering i efterfølgende afgørelse og reducerer igen ved ny kapitalisering', () => {
    const result = computeEetLoebendeYdelser({
      erhvervsevnetab: {
        ...ERHVERVSEVNETAB_INITIAL_VALUES,
        beregningsdato: toISODateString('2026-12-31'),
        aslAarsloen: asAmount(489000),
        aslAfgoerelser: [
          {
            id: 'a1',
            fsTilbageholdtEet: 'Nej',
            afgoerelsesDato: toISODateString('2023-07-01'),
            virkningsDato: toISODateString('2023-02-01'),
            eetPct: 60,
            kapDato: toISODateString('2023-10-01'),
            kapPct: 25,
            afgoerelseType: 'Delvist endelig',
            tidlKapDato: undefined,
          },
          {
            id: 'a2',
            fsTilbageholdtEet: 'Nej',
            afgoerelsesDato: toISODateString('2025-11-01'),
            virkningsDato: toISODateString('2025-10-01'),
            eetPct: 75,
            kapDato: toISODateString('2026-07-15'),
            kapPct: 25,
            afgoerelseType: 'Delvist endelig',
            tidlKapDato: undefined,
          },
        ],
      },
      skadedato: toISODateString('2019-04-01'),
      skadelidteFodselsdato: toISODateString('1980-01-01'),
    });

    expect(result.computation).not.toBeNull();
    const computation = result.computation;
    if (!computation) throw new Error('expected computation');

    const second = computation.afgoerelser[1];
    if (!second) throw new Error('expected second decision');

    expect(second.priorKapPct).toBe(25);
    expect(second.eetPctFoerAktuelKap).toBe(50);
    expect(second.restEetPct).toBe(25);
    expect(second.harRestSektion).toBe(true);
    expect(toKroner(second.grundydelseFuldOre)).toBe(
      roundByMethod(toKroner(computation.grundloenOre) * 0.5 * 0.83 * 0.92, 2, 'halfAwayFromZero')
    );

    const beforeKapRow = second.perioder.find((row) => row.til === toISODateString('2026-07-14'));
    const afterKapRow = second.perioder.find((row) => row.fra === toISODateString('2026-07-15'));
    if (!beforeKapRow || !afterKapRow) throw new Error('expected split rows around kapitaliseringsdato');

    expect(toKroner(afterKapRow.maanedligYdelseOre)).toBeLessThan(
      toKroner(beforeKapRow.maanedligYdelseOre)
    );
  });

  it('giver advarsel når midlertidig/delvist endelig ligger efter en endelig afgørelse', () => {
    const result = computeEetLoebendeYdelser({
      erhvervsevnetab: {
        ...ERHVERVSEVNETAB_INITIAL_VALUES,
        beregningsdato: toISODateString('2026-02-27'),
        aslAarsloen: asAmount(450000),
        aslAfgoerelser: [
          {
            id: 'a1',
            fsTilbageholdtEet: 'Nej',
            afgoerelsesDato: toISODateString('2024-01-01'),
            virkningsDato: toISODateString('2024-01-01'),
            eetPct: 60,
            kapDato: undefined,
            kapPct: undefined,
            afgoerelseType: 'Endelig',
            tidlKapDato: undefined,
          },
          {
            id: 'a2',
            fsTilbageholdtEet: 'Nej',
            afgoerelsesDato: toISODateString('2024-06-01'),
            virkningsDato: toISODateString('2024-06-01'),
            eetPct: 45,
            kapDato: undefined,
            kapPct: undefined,
            afgoerelseType: 'Midlertidig',
            tidlKapDato: undefined,
          },
        ],
      },
      skadedato: toISODateString('2019-04-01'),
      skadelidteFodselsdato: toISODateString('1980-01-01'),
    });

    expect(result.issues).toContainEqual({
      id: 'warn-non-endelig-after-endelig',
      severity: 'warning',
      message: 'Der er angivet en midlertidig afgørelse efter en endelig afgørelse.',
    });
  });

  it('giver advarsel når midlertidig afgørelse fra samme dag virker efter endelig afgørelse', () => {
    const result = computeTestRows([
      testRow({
        id: 'endelig',
        afgoerelsesDato: toISODateString('2024-05-01'),
        virkningsDato: toISODateString('2024-01-01'),
        eetPct: 50,
        afgoerelseType: 'Endelig',
      }),
      testRow({
        id: 'midlertidig',
        afgoerelsesDato: toISODateString('2024-05-01'),
        virkningsDato: toISODateString('2024-03-01'),
        eetPct: 40,
        afgoerelseType: 'Midlertidig',
      }),
    ], { beregningsdato: toISODateString('2024-12-31') });

    expect(result.computation).not.toBeNull();
    expect(result.issues).toContainEqual({
      id: 'warn-non-endelig-after-endelig',
      severity: 'warning',
      message: 'Der er angivet en midlertidig afgørelse efter en endelig afgørelse.',
    });
  });

  it('navngiver begge afgørelsestyper i advarslen når begge ligger efter en endelig afgørelse', () => {
    const result = computeTestRows([
      testRow({
        id: 'endelig',
        afgoerelsesDato: toISODateString('2024-01-01'),
        virkningsDato: toISODateString('2024-01-01'),
        eetPct: 50,
        afgoerelseType: 'Endelig',
      }),
      testRow({
        id: 'midlertidig',
        afgoerelsesDato: toISODateString('2024-02-01'),
        virkningsDato: toISODateString('2024-02-01'),
        eetPct: 40,
        afgoerelseType: 'Midlertidig',
      }),
      testRow({
        id: 'delvist-endelig',
        afgoerelsesDato: toISODateString('2024-03-01'),
        virkningsDato: toISODateString('2024-03-01'),
        eetPct: 45,
        afgoerelseType: 'Delvist endelig',
        kapDato: toISODateString('2024-03-01'),
        kapPct: 20,
      }),
    ], { beregningsdato: toISODateString('2024-12-31') });

    expect(result.issues).toContainEqual({
      id: 'warn-non-endelig-after-endelig',
      severity: 'warning',
      message: 'Der er angivet en midlertidig og delvist endelig afgørelse efter en endelig afgørelse.',
    });
  });

  it('stopper fail-closed når reguleringssats mangler for et nødvendigt år', () => {
    const result = computeEetLoebendeYdelser({
      erhvervsevnetab: {
        ...ERHVERVSEVNETAB_INITIAL_VALUES,
        beregningsdato: toISODateString('2027-12-31'),
        aslAarsloen: asAmount(500000),
        aslAfgoerelser: [
          {
            id: 'a1',
            fsTilbageholdtEet: 'Nej',
            afgoerelsesDato: toISODateString('2027-01-01'),
            virkningsDato: toISODateString('2027-01-01'),
            eetPct: 40,
            kapDato: undefined,
            kapPct: undefined,
            afgoerelseType: 'Midlertidig',
            tidlKapDato: undefined,
          },
        ],
      },
      skadedato: toISODateString('2024-07-01'),
      skadelidteFodselsdato: toISODateString('1980-01-01'),
    });

    expect(result.computation).toBeNull();
    expect(result.issues.some((issue) => issue.id === 'reguleringssats-missing-2027')).toBe(true);
  });

  it('samler tilbagevirkende perioder over flere år under afgørelsesårets sats', () => {
    const result = computeEetLoebendeYdelser({
      erhvervsevnetab: {
        ...ERHVERVSEVNETAB_INITIAL_VALUES,
        beregningsdato: toISODateString('2026-02-01'),
        aslAarsloen: asAmount(489000),
        aslAfgoerelser: [
          {
            id: 'a1',
            fsTilbageholdtEet: 'Nej',
            afgoerelsesDato: toISODateString('2024-06-01'),
            virkningsDato: toISODateString('2022-03-01'),
            eetPct: 40,
            kapDato: undefined,
            kapPct: undefined,
            afgoerelseType: 'Midlertidig',
            tidlKapDato: undefined,
          },
        ],
      },
      skadedato: toISODateString('2019-04-01'),
      skadelidteFodselsdato: toISODateString('1980-01-01'),
    });

    expect(result.computation).not.toBeNull();
    const computation = result.computation;
    if (!computation) throw new Error('expected computation');
    const afgoerelse = computation.afgoerelser[0];
    if (!afgoerelse) throw new Error('expected first decision');

    expect(afgoerelse.tilbagevirkendeKraft).toBe(true);
    expect(afgoerelse.perioder).toHaveLength(3);
    expect(afgoerelse.perioder[0]?.fra).toBe(toISODateString('2022-03-01'));
    expect(afgoerelse.perioder[0]?.til).toBe(toISODateString('2024-12-31'));
    expect(afgoerelse.perioder[0]?.satsAar).toBe(2024);
    expect(afgoerelse.perioder[1]?.fra).toBe(toISODateString('2025-01-01'));
    expect(afgoerelse.perioder[1]?.satsAar).toBe(2025);
    expect(afgoerelse.perioder[2]?.fra).toBe(toISODateString('2026-01-01'));
    expect(afgoerelse.perioder[2]?.til).toBe(toISODateString('2026-02-01'));
    expect(afgoerelse.perioder[2]?.satsAar).toBe(2026);
  });

  it('anvender 2024-niveau grundløn for skade fra 1. juli 2024', () => {
    const result = computeEetLoebendeYdelser({
      erhvervsevnetab: {
        ...ERHVERVSEVNETAB_INITIAL_VALUES,
        beregningsdato: toISODateString('2026-12-31'),
        aslAarsloen: asAmount(401000),
        aslAfgoerelser: [
          {
            id: 'a1',
            fsTilbageholdtEet: 'Nej',
            afgoerelsesDato: toISODateString('2026-01-01'),
            virkningsDato: toISODateString('2026-01-01'),
            eetPct: 40,
            kapDato: undefined,
            kapPct: undefined,
            afgoerelseType: 'Midlertidig',
            tidlKapDato: undefined,
          },
        ],
      },
      skadedato: toISODateString('2024-07-01'),
      skadelidteFodselsdato: toISODateString('1980-01-01'),
    });

    expect(result.computation).not.toBeNull();
    const computation = result.computation;
    if (!computation) throw new Error('expected computation');
    const afgoerelse = computation.afgoerelser[0];
    if (!afgoerelse) throw new Error('expected first decision');

    expect(computation.grundloenNiveau).toBe('2024');
    expect(toKroner(computation.grundloenOre)).toBe(401000);
    expect(toKroner(afgoerelse.grundydelseFuldOre)).toBe(
      roundByMethod(401000 * 0.4 * 0.83 * 0.92, 2, 'halfAwayFromZero')
    );
    expect(toKroner(afgoerelse.perioder[0]!.maanedligYdelseOre)).toBe(11116);
  });

  it('anvender 80 % uden AM-bidrag for skade før 2011', () => {
    const result = computeEetLoebendeYdelser({
      erhvervsevnetab: {
        ...ERHVERVSEVNETAB_INITIAL_VALUES,
        beregningsdato: toISODateString('2026-12-31'),
        aslAarsloen: asAmount(401000),
        aslAfgoerelser: [
          {
            id: 'a1',
            fsTilbageholdtEet: 'Nej',
            afgoerelsesDato: toISODateString('2026-01-01'),
            virkningsDato: toISODateString('2026-01-01'),
            eetPct: 40,
            kapDato: undefined,
            kapPct: undefined,
            afgoerelseType: 'Midlertidig',
            tidlKapDato: undefined,
          },
        ],
      },
      skadedato: toISODateString('2009-01-01'),
      skadelidteFodselsdato: toISODateString('1980-01-01'),
    });

    expect(result.computation).not.toBeNull();
    const computation = result.computation;
    if (!computation) throw new Error('expected computation');
    const afgoerelse = computation.afgoerelser[0];
    if (!afgoerelse) throw new Error('expected first decision');

    expect(computation.erstatningsniveauPct).toBe(80);
    expect(computation.amBidragPct).toBe(0);
    expect(toKroner(computation.grundloenOre)).toBe(339094);
    expect(toKroner(afgoerelse.grundydelseFuldOre)).toBe(
      roundByMethod(339094 * 0.4 * 0.8, 2, 'halfAwayFromZero')
    );
  });

  it('opregulerer præ-2024-skade til 2024-niveau uden ekstra 2024-sats i periodefaktoren', () => {
    const result = computeEetLoebendeYdelser({
      erhvervsevnetab: {
        ...ERHVERVSEVNETAB_INITIAL_VALUES,
        beregningsdato: toISODateString('2024-12-31'),
        aslAarsloen: asAmount(489000),
        aslAfgoerelser: [
          {
            id: 'a1',
            fsTilbageholdtEet: 'Nej',
            afgoerelsesDato: toISODateString('2024-01-01'),
            virkningsDato: toISODateString('2024-01-01'),
            eetPct: 40,
            kapDato: undefined,
            kapPct: undefined,
            afgoerelseType: 'Midlertidig',
            tidlKapDato: undefined,
          },
        ],
      },
      skadedato: toISODateString('2019-04-01'),
      skadelidteFodselsdato: toISODateString('1980-01-01'),
    });

    expect(result.issues.some((issue) => issue.severity === 'error')).toBe(false);
    const periode = result.computation?.afgoerelser[0]?.perioder[0];
    expect(periode?.satsAar).toBe(2024);
    expect(periode?.reguleringPct).toBe(0);
    expect(toKroner(periode!.grundydelseAfrundetOre)).toBe(168513.22);
    expect(toKroner(periode!.maanedligYdelseOre)).toBe(14043);
  });

  it('udelader reguleringstrin med 0 % fra den udvidede specifikation', () => {
    const result = computeEetLoebendeYdelser({
      erhvervsevnetab: {
        ...ERHVERVSEVNETAB_INITIAL_VALUES,
        beregningsdato: toISODateString('2026-01-15'),
        aslAarsloen: asAmount(339000),
        aslAfgoerelser: [
          {
            id: 'a1',
            fsTilbageholdtEet: 'Nej',
            afgoerelsesDato: toISODateString('2026-01-15'),
            virkningsDato: toISODateString('2026-01-15'),
            eetPct: 15,
            kapDato: toISODateString('2026-01-15'),
            kapPct: 15,
            afgoerelseType: 'Endelig',
            tidlKapDato: undefined,
          },
        ],
      },
      skadedato: toISODateString('2022-09-17'),
      skadelidteFodselsdato: toISODateString('1980-01-01'),
    });

    expect(result.issues.some((issue) => issue.severity === 'error')).toBe(false);
    const afgoerelse = result.computation?.afgoerelser[0];
    if (!afgoerelse) throw new Error('expected first decision');

    const steps = buildLoebendeAarsydelseReguleringSteps(afgoerelse);
    expect(steps).toEqual([]);
    // Afgørelsen ophører dagen inden virkningsdatoen (kapitaliseringsdato = virkningsdato),
    // så perioder er tomme – 2024-konverteringsblokken skal IKKE vises.
    expect(shouldShowLoebende2024ConversionBlock(afgoerelse)).toBe(false);
  });

  it('stopper løbende ydelse ved folkepensionsdato når endelig afgørelse er mere end 2 år før FP', () => {
    // Skadedato 2019-04-01, fødselsdato 1955-07-01.
    // Bekendtgørelsen giver FP = 67 år → folkepensionsdato = 2022-07-01.
    // Afgørelsesdato 2019-06-01: 37 måneder til FP – klart > 2 år.
    // folkepensionsDagFoer = 2022-06-30.
    // Beregningsdato 2023-12-31 (efter FP).
    // Ingen tvungen kapitalisering gælder i dette scenarie; ophørskandidaten er folkepensionsdagen før.
    const result = computeEetLoebendeYdelser({
      erhvervsevnetab: {
        ...ERHVERVSEVNETAB_INITIAL_VALUES,
        beregningsdato: toISODateString('2023-12-31'),
        aslAarsloen: asAmount(401000),
        aslAfgoerelser: [
          {
            id: 'a1',
            fsTilbageholdtEet: 'Nej',
            afgoerelsesDato: toISODateString('2019-06-01'),
            virkningsDato: toISODateString('2019-06-01'),
            eetPct: 60,
            kapDato: undefined,
            kapPct: undefined,
            afgoerelseType: 'Endelig',
            tidlKapDato: undefined,
          },
        ],
      },
      skadedato: toISODateString('2019-04-01'),
      skadelidteFodselsdato: toISODateString('1955-07-01'),
    });

    expect(result.computation).not.toBeNull();
    const computation = result.computation;
    if (!computation) throw new Error('expected computation');
    const afgoerelse = computation.afgoerelser[0];
    if (!afgoerelse) throw new Error('expected first decision');

    expect(afgoerelse.ophoerAarsag).toBe('folkepensionsdato');
    expect(afgoerelse.ophoerDato).toBe(toISODateString('2022-06-30'));
  });

  it('lader to afgørelser med samme afgørelsesdato afløse hinanden efter virkningsdato', () => {
    const result = computeEetLoebendeYdelser({
      erhvervsevnetab: {
        ...ERHVERVSEVNETAB_INITIAL_VALUES,
        beregningsdato: toISODateString('2024-12-31'),
        aslAarsloen: asAmount(401000),
        aslAfgoerelser: [
          {
            id: 'a1',
            fsTilbageholdtEet: 'Nej',
            afgoerelsesDato: toISODateString('2024-05-01'),
            virkningsDato: toISODateString('2024-01-01'),
            eetPct: 50,
            kapDato: undefined,
            kapPct: undefined,
            afgoerelseType: 'Midlertidig',
            tidlKapDato: undefined,
          },
          {
            id: 'a2',
            fsTilbageholdtEet: 'Nej',
            afgoerelsesDato: toISODateString('2024-05-01'),
            virkningsDato: toISODateString('2024-07-01'),
            eetPct: 30,
            kapDato: undefined,
            kapPct: undefined,
            afgoerelseType: 'Midlertidig',
            tidlKapDato: undefined,
          },
        ],
      },
      skadedato: toISODateString('2019-04-01'),
      skadelidteFodselsdato: toISODateString('1980-01-01'),
    });

    expect(result.issues.some((issue) => issue.severity === 'error')).toBe(false);
    expect(result.computation?.afgoerelser).toHaveLength(2);
    expect(result.computation?.afgoerelser[0]?.ophoerAarsag).toBe('senere-afgoerelse');
    expect(result.computation?.afgoerelser[0]?.ophoerDato).toBe(toISODateString('2024-06-30'));
    expect(result.computation?.afgoerelser[1]?.virkningsdato).toBe(toISODateString('2024-07-01'));
  });

  it('ender med kapitalisering på afgørelsesdatoen når endelig afgørelse er ≤ 2 år før FP', () => {
    const result = computeEetLoebendeYdelser({
      erhvervsevnetab: {
        ...ERHVERVSEVNETAB_INITIAL_VALUES,
        beregningsdato: toISODateString('2021-12-31'),
        aslAarsloen: asAmount(401000),
        aslAfgoerelser: [
          {
            id: 'a1',
            fsTilbageholdtEet: 'Nej',
            afgoerelsesDato: toISODateString('2021-08-01'),
            virkningsDato: toISODateString('2020-01-01'),
            eetPct: 60,
            kapDato: undefined,
            kapPct: undefined,
            afgoerelseType: 'Endelig',
            tidlKapDato: undefined,
          },
        ],
      },
      skadedato: toISODateString('2019-04-01'),
      skadelidteFodselsdato: toISODateString('1955-07-01'),
    });

    expect(result.computation).not.toBeNull();
    const computation = result.computation;
    if (!computation) throw new Error('expected computation');
    const afgoerelse = computation.afgoerelser[0];
    if (!afgoerelse) throw new Error('expected first decision');

    expect(afgoerelse.ophoerAarsag).toBe('kapitalisering');
    expect(afgoerelse.ophoerDato).toBe(toISODateString('2021-07-31'));
  });

  it('midlertidig afgoerelse faar ikke folkepensionsdato som ophoer før den faktisk indtraeder', () => {
    // Midlertidige afgørelser er ikke tvungent kapitaliserede.
    // Når beregningsdatoen ligger før folkepensionsdatoen, vinder beregningsdatoen som ophør.
    const result = computeEetLoebendeYdelser({
      erhvervsevnetab: {
        ...ERHVERVSEVNETAB_INITIAL_VALUES,
        beregningsdato: toISODateString('2021-06-30'),
        aslAarsloen: asAmount(401000),
        aslAfgoerelser: [{
          id: 'a1',
          fsTilbageholdtEet: 'Nej',
          afgoerelsesDato: toISODateString('2019-06-01'),
          virkningsDato: toISODateString('2019-06-01'),
          eetPct: 40,
          kapDato: undefined,
          kapPct: undefined,
          afgoerelseType: 'Midlertidig',
          tidlKapDato: undefined,
        }],
      },
      skadedato: toISODateString('2019-04-01'),
      skadelidteFodselsdato: toISODateString('1955-07-01'),
    });

    expect(result.computation).not.toBeNull();
    const computation = result.computation;
    if (!computation) throw new Error('expected computation');
    const afgoerelse = computation.afgoerelser[0];
    if (!afgoerelse) throw new Error('expected first decision');

    expect(afgoerelse.ophoerAarsag).toBe('beregningsdato');
    expect(afgoerelse.ophoerDato).toBe(toISODateString('2021-06-30'));
  });
});

describe('toAfgoerelseTypeLabel', () => {
  it('viser korrekt label for endelig afgørelse med og uden kapitalisering', () => {
    expect(toAfgoerelseTypeLabel('Midlertidig', false, false)).toBe('Midlertidig afgørelse');
    expect(toAfgoerelseTypeLabel('Delvist endelig', true, true)).toBe('Delvist endelig afgørelse');
    expect(toAfgoerelseTypeLabel('Endelig', false, false)).toBe('Endelig afgørelse');
    expect(toAfgoerelseTypeLabel('Endelig', false, true)).toBe('Endelig afgørelse (kapitaliseret)');
    expect(toAfgoerelseTypeLabel('Endelig', true, true)).toBe('Endelig afgørelse (delvist kap.)');
  });
});

describe('warn-asl-aarsloen-is-max', () => {
  it('viser ikke advarsel på Løbende ydelser, selv når ASL-årslønnen er lig maksimum', () => {
    const maxAarsloen2019 = aarsloenAslMax[2019];
    if (!Number.isFinite(maxAarsloen2019)) throw new Error('expected max salary for 2019');

    const result = computeEetLoebendeYdelser({
      erhvervsevnetab: {
        ...ERHVERVSEVNETAB_INITIAL_VALUES,
        beregningsdato: toISODateString('2026-02-27'),
        aslAarsloen: asAmount(maxAarsloen2019),
        aslAfgoerelser: [
          {
            id: 'a1',
            fsTilbageholdtEet: 'Nej',
            afgoerelsesDato: toISODateString('2023-07-01'),
            virkningsDato: toISODateString('2023-02-01'),
            eetPct: 20,
            kapDato: undefined,
            kapPct: undefined,
            afgoerelseType: 'Midlertidig',
            tidlKapDato: undefined,
          },
        ],
      },
      skadedato: toISODateString('2019-04-01'),
      skadelidteFodselsdato: toISODateString('1980-01-01'),
    });

    expect(result.issues.some((issue) => issue.id === 'warn-asl-aarsloen-is-max')).toBe(false);
  });

  it('blokerer direkte beregning når indtastet årsløn er højere end maksimum for skadesåret', () => {
    const maxAarsloen2019 = aarsloenAslMax[2019];
    if (!Number.isFinite(maxAarsloen2019)) throw new Error('expected max salary for 2019');

    const result = computeEetLoebendeYdelser({
      erhvervsevnetab: {
        ...ERHVERVSEVNETAB_INITIAL_VALUES,
        beregningsdato: toISODateString('2026-02-27'),
        aslAarsloen: asAmount(maxAarsloen2019 + 1),
        aslAfgoerelser: [
          {
            id: 'a1',
            fsTilbageholdtEet: 'Nej',
            afgoerelsesDato: toISODateString('2023-07-01'),
            virkningsDato: toISODateString('2023-02-01'),
            eetPct: 20,
            kapDato: undefined,
            kapPct: undefined,
            afgoerelseType: 'Midlertidig',
            tidlKapDato: undefined,
          },
        ],
      },
      skadedato: toISODateString('2019-04-01'),
      skadelidteFodselsdato: toISODateString('1980-01-01'),
    });

    expect(result.computation).toBeNull();
    expect(result.issues).toContainEqual({
      id: 'aarsloen-over-max',
      severity: 'error',
      message: `Skadelidtes årsløn (efter ASL) kan ikke overstige maks årslønnen i skadesåret (${formatAsAmount(maxAarsloen2019, 0)} kr.)`,
    });
  });
});

describe('isAslAfgoerelseRowEmpty', () => {
  it('behandler FS tilbageholdt EET som beregningsneutral tom-række-værdi', () => {
    expect(isAslAfgoerelseRowEmpty({
      id: 'empty-nej',
      fsTilbageholdtEet: 'Nej',
      afgoerelsesDato: undefined,
      virkningsDato: undefined,
      eetPct: undefined,
      kapDato: undefined,
      kapPct: undefined,
      afgoerelseType: undefined,
      tidlKapDato: undefined,
    })).toBe(true);

    expect(isAslAfgoerelseRowEmpty({
      id: 'empty-ja',      afgoerelsesDato: undefined,
      virkningsDato: undefined,
      eetPct: undefined,
      kapDato: undefined,
      kapPct: undefined,
      afgoerelseType: undefined,
      tidlKapDato: undefined,
      fsTilbageholdtEet: 'Ja',
    })).toBe(true);
  });

  it('behandler FS tilbageholdt EET som tomt uden øvrigt rækkeindhold i persistens-tomhedsreglen', () => {
    expect(isAslAfgoerelseRowPersistenceEmpty({
      id: 'empty-nej',
      fsTilbageholdtEet: 'Nej',
      afgoerelsesDato: undefined,
      virkningsDato: undefined,
      eetPct: undefined,
      kapDato: undefined,
      kapPct: undefined,
      afgoerelseType: undefined,
      tidlKapDato: undefined,
    })).toBe(true);

    expect(isAslAfgoerelseRowPersistenceEmpty({
      id: 'empty-ja',      afgoerelsesDato: undefined,
      virkningsDato: undefined,
      eetPct: undefined,
      kapDato: undefined,
      kapPct: undefined,
      afgoerelseType: undefined,
      tidlKapDato: undefined,
      fsTilbageholdtEet: 'Ja',
    })).toBe(true);
  });
});

describe('resolveLoebendeAfgoerelseRestVisning', () => {
  const periode = (satsAar: number): EetLoebendePeriodeRow => ({
    fra: toISODateString(`${satsAar}-01-01`),
    til: toISODateString(`${satsAar}-12-31`),
    satsAar,
    maanederPraecis: 12,
    grundydelseAfrundetOre: fromKroner(0),
    reguleringPct: 0,
    maanedligYdelseOre: fromKroner(0),
    beregnetEetOre: fromKroner(0),
  });

  const afgoerelse = (
    patch: Partial<EetLoebendeAfgoerelseComputation> & Pick<EetLoebendeAfgoerelseComputation, 'kapitaliseringsdato' | 'harRestSektion' | 'perioder'>
  ): EetLoebendeAfgoerelseComputation => ({
    rowId: 'r1',
    afgoerelsesdato: toISODateString('2020-01-01'),
    virkningsdato: toISODateString('2020-01-01'),
    skaeringsDato: null,
    harOverlap: false,
    afgoerelseType: 'Endelig',
    eetPct: 50,
    priorKapPct: 0,
    eetPctFoerAktuelKap: 50,
    kapPctAktuel: 0,
    kapPctKumulativ: 0,
    restEetPct: 50,
    harKapitalisering: true,
    tilbagevirkendeKraft: false,
    ophoerDato: toISODateString('2030-01-01'),
    ophoerAarsag: 'kapitalisering',
    grundydelseFuldOre: fromKroner(0),
    grundydelseRestOre: null,
    grundydelse2024FuldOre: fromKroner(0),
    grundydelse2024RestOre: null,
    iAltBeregnetEetOre: fromKroner(0),
    ...patch,
  });

  it('grundloenNiveau 2024 → ingen 2024-konverteringsblok uanset perioder', () => {
    const vis = resolveLoebendeAfgoerelseRestVisning(
      afgoerelse({ kapitaliseringsdato: toISODateString('2025-01-01'), harRestSektion: true, perioder: [periode(2025)] }),
      '2024'
    );
    expect(vis.show2024ConversionBlock).toBe(false);
  });

  it('2003-niveau med sats-år ≥ 2024 → 2024-konverteringsblok vises', () => {
    const vis = resolveLoebendeAfgoerelseRestVisning(
      afgoerelse({ kapitaliseringsdato: toISODateString('2025-01-01'), harRestSektion: true, perioder: [periode(2023), periode(2025)] }),
      '2003'
    );
    expect(vis.show2024ConversionBlock).toBe(true);
    expect(vis.kapitaliseringFra2024).toBe(true);
    expect(vis.showRest2024).toBe(true);
    expect(vis.showRest2003).toBe(false);
  });

  it('rest-sektion med kapitalisering før 2024-01-01 → rest i 2003-niveau', () => {
    const vis = resolveLoebendeAfgoerelseRestVisning(
      afgoerelse({ kapitaliseringsdato: toISODateString('2022-06-01'), harRestSektion: true, perioder: [periode(2023), periode(2025)] }),
      '2003'
    );
    expect(vis.hasRestAfterKapBefore2024).toBe(true);
    expect(vis.showRest2003).toBe(true);
    expect(vis.showRest2024).toBe(false);
  });

  it('uden rest-sektion → ingen rest-visning', () => {
    const vis = resolveLoebendeAfgoerelseRestVisning(
      afgoerelse({ kapitaliseringsdato: null, harRestSektion: false, perioder: [periode(2025)] }),
      '2003'
    );
    expect(vis.hasRestSection).toBe(false);
    expect(vis.showRest2003).toBe(false);
    expect(vis.showRest2024).toBe(false);
  });
});

describe('computeEetLoebendeYdelserForEoImport', () => {
  const midlertidigRow = testRow({
    id: 'a1',
    afgoerelsesDato: toISODateString('2024-02-01'),
    virkningsDato: toISODateString('2024-01-01'),
    eetPct: 20,
    afgoerelseType: 'Midlertidig',
  });

  it('blokerer med beregningsdato-missing når beregningsdato mangler på erhvervsevnetab-siden', () => {
    const result = computeEetLoebendeYdelser({
      erhvervsevnetab: {
        ...ERHVERVSEVNETAB_INITIAL_VALUES,
        beregningsdato: undefined,
        aslAarsloen: asAmount(300000),
        aslAfgoerelser: [midlertidigRow],
      },
      skadedato: toISODateString('2024-01-01'),
      skadelidteFodselsdato: toISODateString('1980-01-01'),
    });

    expect(result.computation).toBeNull();
    expect(result.issues).toContainEqual({
      id: 'beregningsdato-missing',
      severity: 'error',
      message: 'Beregningsdato er ikke udfyldt',
    });
  });

  it('bruger EO-importens slutdato som beregningsdato når feltet mangler', () => {
    const result = computeEetLoebendeYdelserForEoImport({
      erhvervsevnetab: {
        ...ERHVERVSEVNETAB_INITIAL_VALUES,
        beregningsdato: undefined,
        aslAarsloen: asAmount(300000),
        aslAfgoerelser: [midlertidigRow],
      },
      skadedato: toISODateString('2024-01-01'),
      skadelidteFodselsdato: toISODateString('1980-01-01'),
      slutdato: toISODateString('2024-04-30'),
    });

    expect(result.issues.some((issue) => issue.id === 'beregningsdato-missing')).toBe(false);
    expect(result.computation).not.toBeNull();
    expect(result.computation?.beregningsdato).toBe(toISODateString('2024-04-30'));
    expect(result.computation?.afgoerelser.flatMap((a) => a.perioder).at(-1)?.til).toBe(toISODateString('2024-04-30'));
  });

  it('lader EO-importens slutdato afgrænse perioden, mens en udfyldt beregningsdato bevares', () => {
    const result = computeEetLoebendeYdelserForEoImport({
      erhvervsevnetab: {
        ...ERHVERVSEVNETAB_INITIAL_VALUES,
        beregningsdato: toISODateString('2024-12-31'),
        aslAarsloen: asAmount(300000),
        aslAfgoerelser: [midlertidigRow],
      },
      skadedato: toISODateString('2024-01-01'),
      skadelidteFodselsdato: toISODateString('1980-01-01'),
      slutdato: toISODateString('2024-04-30'),
    });

    // Udfyldt beregningsdato bevares i computation, men importens slutdato afgrænser perioden.
    expect(result.computation?.beregningsdato).toBe(toISODateString('2024-12-31'));
    expect(result.computation?.afgoerelser.flatMap((a) => a.perioder).at(-1)?.til).toBe(toISODateString('2024-04-30'));
  });

  it('viser ikke ASL-maksimumadvarslen i EO-importkonteksten', () => {
    const maxAarsloen2019 = aarsloenAslMax[2019];
    if (!Number.isFinite(maxAarsloen2019)) throw new Error('expected max salary for 2019');

    const result = computeEetLoebendeYdelserForEoImport({
      erhvervsevnetab: {
        ...ERHVERVSEVNETAB_INITIAL_VALUES,
        beregningsdato: toISODateString('2026-02-27'),
        aslAarsloen: asAmount(maxAarsloen2019),
        aslAfgoerelser: [
          {
            ...midlertidigRow,
            afgoerelsesDato: toISODateString('2023-07-01'),
            virkningsDato: toISODateString('2023-02-01'),
          },
        ],
      },
      skadedato: toISODateString('2019-04-01'),
      skadelidteFodselsdato: toISODateString('1980-01-01'),
      slutdato: toISODateString('2026-02-27'),
    });

    expect(result.issues.some((issue) => issue.id === 'warn-asl-aarsloen-is-max')).toBe(false);
  });
});
