import type { AmountValue } from '../../../schemas/amountExpressionSchema';
import type { AslAfgoerelseRow } from '../../../schemas/formSchemas';
import { ERHVERVSEVNETAB_INITIAL_VALUES } from '../../../domain/erhvervsevnetab/erhvervsevnetabInitialValues';
import {
  computeEetLoebendeYdelser,
  type EetLoebendePeriodeRow,
} from '../../../domain/erhvervsevnetab/eetLoebendeYdelserCalculation';
import { getDayAfterIso } from '../../../utils/isoDateHelpers';
import { toISODateString } from '../../../types/branded';

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
  beregningsdato = toISODateString('2024-12-31')
) => computeEetLoebendeYdelser({
  erhvervsevnetab: {
    ...ERHVERVSEVNETAB_INITIAL_VALUES,
    beregningsdato,
    aslAarsloen: asAmount(401000),
    aslAfgoerelser: [...rows],
  },
  skadedato: toISODateString('2019-04-01'),
  skadelidteFodselsdato: toISODateString('1980-01-01'),
});

const expectContiguous = (perioder: readonly EetLoebendePeriodeRow[]): void => {
  expect(perioder.length).toBeGreaterThan(0);

  for (let index = 0; index < perioder.length; index += 1) {
    const current = perioder[index];
    if (!current) throw new Error('Forventede en periode');

    expect(current.fra <= current.til).toBe(true);
    if (index === 0) continue;

    const previous = perioder[index - 1];
    if (!previous) throw new Error('Forventede en foregående periode');
    expect(current.fra).toBe(getDayAfterIso(previous.til));
    expect(current.satsAar).toBeGreaterThanOrEqual(previous.satsAar);
  }
};

describe('EET løbende periodiseringsinvarianter', () => {
  it('fordeler samtidige afgørelser på virkningsperioder og fratrækker den ældre fortsatte ydelse i begge', () => {
    const result = computeTestRows([
      testRow({ id: 'a', afgoerelsesDato: toISODateString('2018-12-01'), virkningsDato: toISODateString('2019-01-01'), eetPct: 30, afgoerelseType: 'Midlertidig' }),
      testRow({ id: 'b', afgoerelsesDato: toISODateString('2020-06-01'), virkningsDato: toISODateString('2020-01-01'), eetPct: 40, afgoerelseType: 'Midlertidig' }),
      testRow({ id: 'c', afgoerelsesDato: toISODateString('2020-06-01'), virkningsDato: toISODateString('2020-04-01'), eetPct: 50, afgoerelseType: 'Midlertidig' }),
    ], toISODateString('2020-12-31'));
    const [first, second, third] = result.computation?.afgoerelser ?? [];
    if (!first || !second || !third) throw new Error('Forventede tre afgørelser');
    expect(first.ophoerDato).toBe('2020-06-30');
    expect(second.beregningsperioder.map(({ fra, til, eetPct }) => [fra, til, eetPct])).toEqual([
      ['2020-01-01', '2020-03-31', 10],
    ]);
    expect(third.beregningsperioder.map(({ fra, til, eetPct }) => [fra, til, eetPct])).toEqual([
      ['2020-04-01', '2020-06-30', 20], ['2020-07-01', '2020-12-31', 50],
    ]);
  });

  it.each(['2024-03-01', '2024-03-15', '2024-03-31'])('bevarer den tidligere ydelse marts ud ved afgørelse %s', (afgoerelsesdato) => {
    const result = computeTestRows([
      testRow({ id: 'a', afgoerelsesDato: toISODateString('2023-01-01'), virkningsDato: toISODateString('2023-01-01'), eetPct: 30, afgoerelseType: 'Midlertidig' }),
      testRow({ id: 'b', afgoerelsesDato: toISODateString(afgoerelsesdato), virkningsDato: toISODateString('2024-01-01'), eetPct: 40, afgoerelseType: 'Midlertidig' }),
    ]);
    const [first, second] = result.computation?.afgoerelser ?? [];
    if (!first || !second) throw new Error('Forventede to afgørelser');
    expect(first.ophoerDato).toBe('2024-03-31');
    expect(second.beregningsperioder.map(({ fra, til, eetPct }) => [fra, til, eetPct])).toEqual([
      ['2024-01-01', '2024-03-31', 10], ['2024-04-01', '2024-12-31', 40],
    ]);
  });

  it.each([
    ['2024-03-01', '2024-02-29'],
    ['2024-03-15', '2024-03-14'],
    ['2024-03-31', '2024-03-30'],
  ])('lader global kapitalisering %s afslutte en tidligere ydelse %s', (kapDato, ophoerDato) => {
    const result = computeTestRows([
      testRow({ id: 'a', afgoerelsesDato: toISODateString('2023-01-01'), virkningsDato: toISODateString('2023-01-01'), eetPct: 30, afgoerelseType: 'Midlertidig' }),
      testRow({ id: 'b', afgoerelsesDato: toISODateString('2024-03-01'), virkningsDato: toISODateString('2024-01-01'), eetPct: 50, afgoerelseType: 'Delvist endelig', kapDato: toISODateString(kapDato), kapPct: 35 }),
    ]);
    const first = result.computation?.afgoerelser[0];
    if (!first) throw new Error('Forventede første afgørelse');
    expect(first.ophoerDato).toBe(ophoerDato);
    expect(first.ophoerAarsag).toBe('kapitalisering');
    expect(first.perioder.at(-1)?.til).toBe(ophoerDato);
    expect(first.beregningsperioder.at(-1)?.eetPct).toBe(0);
  });

  it('bevarer faktisk dækning gennem flere forhøjelser og en kapitalisering midt i overlap', () => {
    const result = computeTestRows([
      testRow({ id: 'a', afgoerelsesDato: toISODateString('2023-01-01'), virkningsDato: toISODateString('2023-01-01'), eetPct: 30, afgoerelseType: 'Midlertidig' }),
      testRow({ id: 'b', afgoerelsesDato: toISODateString('2024-03-01'), virkningsDato: toISODateString('2024-01-01'), eetPct: 40, afgoerelseType: 'Midlertidig' }),
      testRow({ id: 'c', afgoerelsesDato: toISODateString('2024-03-15'), virkningsDato: toISODateString('2024-01-01'), eetPct: 50, afgoerelseType: 'Delvist endelig', kapDato: toISODateString('2024-03-20'), kapPct: 35 }),
    ]);
    const decisions = result.computation?.afgoerelser;
    if (!decisions) throw new Error('Forventede tre afgørelser');
    const contributions = (day: string) => decisions.map((decision) =>
      decision.beregningsperioder.find(({ fra, til }) => fra <= day && day <= til)?.eetPct ?? 0);
    expect(contributions('2024-03-19')).toEqual([30, 10, 10]);
    expect(contributions('2024-03-20')).toEqual([0, 5, 10]);
    expect(contributions('2024-04-01')).toEqual([0, 0, 15]);
  });

  it('dækker et flerårigt fuldt interval uden overlap eller hul', () => {
    const result = computeTestRows([
      testRow({
        id: 'a',
        afgoerelsesDato: toISODateString('2023-06-15'),
        virkningsDato: toISODateString('2023-06-15'),
        eetPct: 40,
        afgoerelseType: 'Midlertidig',
      }),
    ], toISODateString('2025-03-10'));

    const periods = result.computation?.afgoerelser[0]?.perioder;
    if (!periods) throw new Error('Forventede løbende perioder');

    expectContiguous(periods);
    expect(periods.map(({ fra, til }) => [fra, til])).toEqual([
      [toISODateString('2023-06-15'), toISODateString('2023-12-31')],
      [toISODateString('2024-01-01'), toISODateString('2024-12-31')],
      [toISODateString('2025-01-01'), toISODateString('2025-03-10')],
    ]);
  });

  it('holder dagen før og dagen efter en skæringsdato adskilt uden overlap', () => {
    const result = computeTestRows([
      testRow({
        id: 'a',
        afgoerelsesDato: toISODateString('2023-01-01'),
        virkningsDato: toISODateString('2023-01-01'),
        eetPct: 20,
        afgoerelseType: 'Midlertidig',
      }),
      testRow({
        id: 'b',
        afgoerelsesDato: toISODateString('2024-03-31'),
        virkningsDato: toISODateString('2024-04-01'),
        eetPct: 40,
        afgoerelseType: 'Midlertidig',
      }),
    ]);

    const [first, second] = result.computation?.afgoerelser ?? [];
    if (!first || !second) throw new Error('Forventede to afgørelser');

    expect(first.ophoerDato).toBe(toISODateString('2024-03-31'));
    expect(second.harOverlap).toBe(false);
    expect(second.perioder[0]?.fra).toBe(toISODateString('2024-04-01'));
    expectContiguous(first.perioder);
    expectContiguous(second.perioder);
  });

  it('periodiserer et positivt tilbagevirkende overlap sammenhængende frem til skæringen', () => {
    const result = computeTestRows([
      testRow({
        id: 'a',
        afgoerelsesDato: toISODateString('2023-01-01'),
        virkningsDato: toISODateString('2023-01-01'),
        eetPct: 20,
        afgoerelseType: 'Midlertidig',
      }),
      testRow({
        id: 'b',
        afgoerelsesDato: toISODateString('2024-03-15'),
        virkningsDato: toISODateString('2024-03-01'),
        eetPct: 40,
        afgoerelseType: 'Midlertidig',
      }),
    ]);

    const second = result.computation?.afgoerelser[1];
    if (!second) throw new Error('Forventede anden afgørelse');

    expect(second.harOverlap).toBe(true);
    expect(second.perioder[0]?.fra).toBe(toISODateString('2024-03-01'));
    expect(second.perioder[0]?.til).toBe(toISODateString('2024-03-31'));
    expect(second.perioder[1]?.fra).toBe(toISODateString('2024-04-01'));
    expectContiguous(second.perioder);
  });

  it('er uafhængig af inputrækkefølgen ved samtidige afgørelser', () => {
    const rows = [
      testRow({
        id: 'a',
        afgoerelsesDato: toISODateString('2024-05-01'),
        virkningsDato: toISODateString('2024-01-01'),
        eetPct: 20,
        afgoerelseType: 'Midlertidig',
        fsTilbageholdtEet: 'Ja',
      }),
      testRow({
        id: 'b',
        afgoerelsesDato: toISODateString('2024-05-01'),
        virkningsDato: toISODateString('2024-04-01'),
        eetPct: 40,
        afgoerelseType: 'Midlertidig',
      }),
    ];

    const forward = computeTestRows(rows);
    const reversed = computeTestRows([...rows].reverse());

    expect(reversed).toEqual(forward);
    const [first, second] = forward.computation?.afgoerelser ?? [];
    if (!first || !second) throw new Error('Forventede to afgørelser');

    expect(first.ophoerDato).toBe(toISODateString('2024-03-31'));
    expect(second.perioder[0]?.fra).toBe(toISODateString('2024-04-01'));
    expectContiguous(first.perioder);
    expectContiguous(second.perioder);
  });

  it('aktiverer delvis kapitalisering på kapitaliseringsdatoen og bevarer sammenhæng', () => {
    const result = computeTestRows([
      testRow({
        id: 'a',
        afgoerelsesDato: toISODateString('2024-03-15'),
        virkningsDato: toISODateString('2024-01-01'),
        eetPct: 60,
        kapDato: toISODateString('2024-04-01'),
        kapPct: 20,
        afgoerelseType: 'Delvist endelig',
      }),
    ]);

    const computation = result.computation?.afgoerelser[0];
    if (!computation) throw new Error('Forventede én afgørelse');

    expect(computation.kapitaliseringsdato).toBe(toISODateString('2024-04-01'));
    expect(computation.restEetPct).toBe(40);
    expect(computation.perioder[0]?.til).toBe(toISODateString('2024-03-31'));
    expect(computation.perioder[1]?.fra).toBe(toISODateString('2024-04-01'));
    expectContiguous(computation.perioder);
  });

  it('aktiverer kapitalisering på virkningsdatoen uden en kunstig dag før', () => {
    const result = computeTestRows([
      testRow({
        id: 'a',
        afgoerelsesDato: toISODateString('2024-01-15'),
        virkningsDato: toISODateString('2024-01-01'),
        eetPct: 60,
        kapDato: toISODateString('2024-01-01'),
        kapPct: 20,
        afgoerelseType: 'Delvist endelig',
      }),
    ]);

    const computation = result.computation?.afgoerelser[0];
    if (!computation) throw new Error('Forventede én afgørelse');

    expect(computation.perioder[0]?.fra).toBe(toISODateString('2024-01-01'));
    expect(computation.perioder[0]?.til).toBe(toISODateString('2024-12-31'));
    expect(computation.restEetPct).toBe(40);
    expectContiguous(computation.perioder);
  });

  it('stopper fuld kapitalisering dagen før kapitaliseringsdatoen', () => {
    const result = computeTestRows([
      testRow({
        id: 'a',
        afgoerelsesDato: toISODateString('2024-03-15'),
        virkningsDato: toISODateString('2024-01-01'),
        eetPct: 50,
        kapDato: toISODateString('2024-04-01'),
        kapPct: 50,
        afgoerelseType: 'Endelig',
      }),
    ]);

    const computation = result.computation?.afgoerelser[0];
    if (!computation) throw new Error('Forventede én afgørelse');

    expect(computation.ophoerDato).toBe(toISODateString('2024-03-31'));
    expect(computation.perioder.at(-1)?.til).toBe(toISODateString('2024-03-31'));
    expect(computation.perioder.some((period) => period.fra >= toISODateString('2024-04-01'))).toBe(false);
    expectContiguous(computation.perioder);
  });

  it('afviser en runtime-ukendt afgørelsestype fail-closed', () => {
    const result = computeTestRows([
      testRow({
        id: 'unknown',
        afgoerelsesDato: toISODateString('2024-01-01'),
        virkningsDato: toISODateString('2024-01-01'),
        eetPct: 40,
        afgoerelseType: 'Ukendt' as never,
      }),
    ]);

    expect(result.computation).toBeNull();
    expect(result.issues).toContainEqual({
      id: 'invalid-afgoerelse-type',
      severity: 'error',
      message: 'En afgørelse har en ukendt afgørelsestype og kan derfor ikke beregnes sikkert.',
    });
  });
});
