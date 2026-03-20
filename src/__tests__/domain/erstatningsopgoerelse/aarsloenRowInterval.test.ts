import type { StandardLoenTableRow } from '../../../schemas/formSchemas';
import { parseAarsloenRowInterval } from '../../../domain/erstatningsopgoerelse/aarsloenRowInterval';

// ─── Helpers ──────────────────────────────────────────────────────────────

const baseRow = (): StandardLoenTableRow => ({
  id: 'r1',
  col0_maaned: '',
  col1_maaned: '',
  col0_uge: '',
  col1_uge: '',
  col0_dag: '',
  col1_dag: '',
  col2: undefined,
  col3: undefined,
  col4: undefined,
  col5: undefined,
});

const maanedRow = (month: string, year: string): StandardLoenTableRow => ({
  ...baseRow(),
  col0_maaned: month,
  col1_maaned: year,
});

const ugeRow = (fraUge: string, tilUge: string): StandardLoenTableRow => ({
  ...baseRow(),
  col0_uge: fraUge,
  col1_uge: tilUge,
});

const dagRow = (fraDato: string, tilDato: string): StandardLoenTableRow => ({
  ...baseRow(),
  col0_dag: fraDato,
  col1_dag: tilDato,
});

// Hjælper: sammenlign to Date-objekter som UTC-datoer
const toUtcDateStr = (d: Date) =>
  `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;

// ─── Lønperiode: maaned ───────────────────────────────────────────────────

describe('parseAarsloenRowInterval — maaned', () => {
  it('returnerer null for tomme felter', () => {
    expect(parseAarsloenRowInterval(maanedRow('', ''), 'maaned')).toBeNull();
  });

  it('returnerer null for kun måned angivet', () => {
    expect(parseAarsloenRowInterval(maanedRow('6', ''), 'maaned')).toBeNull();
  });

  it('returnerer null for kun år angivet', () => {
    expect(parseAarsloenRowInterval(maanedRow('', '2024'), 'maaned')).toBeNull();
  });

  it('januar 2024: start = 2024-01-01, end = 2024-01-31', () => {
    const result = parseAarsloenRowInterval(maanedRow('1', '2024'), 'maaned');
    expect(result).not.toBeNull();
    expect(toUtcDateStr(result!.start)).toBe('2024-01-01');
    expect(toUtcDateStr(result!.end)).toBe('2024-01-31');
  });

  it('februar 2024 (skudår): start = 2024-02-01, end = 2024-02-29', () => {
    const result = parseAarsloenRowInterval(maanedRow('2', '2024'), 'maaned');
    expect(result).not.toBeNull();
    expect(toUtcDateStr(result!.start)).toBe('2024-02-01');
    expect(toUtcDateStr(result!.end)).toBe('2024-02-29');
  });

  it('februar 2023 (ikke-skudår): end = 2023-02-28', () => {
    const result = parseAarsloenRowInterval(maanedRow('2', '2023'), 'maaned');
    expect(result).not.toBeNull();
    expect(toUtcDateStr(result!.end)).toBe('2023-02-28');
  });

  it('december 2024: start = 2024-12-01, end = 2024-12-31', () => {
    const result = parseAarsloenRowInterval(maanedRow('12', '2024'), 'maaned');
    expect(result).not.toBeNull();
    expect(toUtcDateStr(result!.start)).toBe('2024-12-01');
    expect(toUtcDateStr(result!.end)).toBe('2024-12-31');
  });

  it('returnerer null for måned = 0', () => {
    expect(parseAarsloenRowInterval(maanedRow('0', '2024'), 'maaned')).toBeNull();
  });

  it('returnerer null for måned = 13', () => {
    expect(parseAarsloenRowInterval(maanedRow('13', '2024'), 'maaned')).toBeNull();
  });

  it('returnerer null for år < 1900', () => {
    expect(parseAarsloenRowInterval(maanedRow('6', '1899'), 'maaned')).toBeNull();
  });

  it('returnerer null for år > 2100', () => {
    expect(parseAarsloenRowInterval(maanedRow('6', '2101'), 'maaned')).toBeNull();
  });

  it('accepterer år = 1900 (grænseværdi)', () => {
    const result = parseAarsloenRowInterval(maanedRow('6', '1900'), 'maaned');
    expect(result).not.toBeNull();
  });

  it('accepterer år = 2100 (grænseværdi)', () => {
    const result = parseAarsloenRowInterval(maanedRow('6', '2100'), 'maaned');
    expect(result).not.toBeNull();
  });

  it('returnerer null for ikke-numerisk måned', () => {
    expect(parseAarsloenRowInterval(maanedRow('abc', '2024'), 'maaned')).toBeNull();
  });

  it('returnerer null for ikke-numerisk år', () => {
    expect(parseAarsloenRowInterval(maanedRow('6', 'yyyy'), 'maaned')).toBeNull();
  });

  it('håndterer whitespace korrekt (trimmer)', () => {
    const result = parseAarsloenRowInterval(maanedRow('  6  ', '  2024  '), 'maaned');
    expect(result).not.toBeNull();
    expect(toUtcDateStr(result!.start)).toBe('2024-06-01');
  });
});

// ─── Lønperiode: uge ──────────────────────────────────────────────────────

describe('parseAarsloenRowInterval — uge', () => {
  it('returnerer null for tomme felter', () => {
    expect(parseAarsloenRowInterval(ugeRow('', ''), 'uge')).toBeNull();
  });

  it('returnerer null for kun fraUge angivet', () => {
    expect(parseAarsloenRowInterval(ugeRow('1/2024', ''), 'uge')).toBeNull();
  });

  it('accepterer gyldig uge-periode', () => {
    const result = parseAarsloenRowInterval(ugeRow('1/2024', '4/2024'), 'uge');
    expect(result).not.toBeNull();
    // Uge 1 2024 starter 01-01-2024 (mandag)
    expect(toUtcDateStr(result!.start)).toBe('2024-01-01');
  });

  it('returnerer null for ugyldig uge-streng', () => {
    expect(parseAarsloenRowInterval(ugeRow('2024', '4/2024'), 'uge')).toBeNull();
  });

  it('returnerer null for fra > til (forkert rækkefølge)', () => {
    expect(parseAarsloenRowInterval(ugeRow('10/2024', '5/2024'), 'uge')).toBeNull();
  });

  it('accepterer tilstødende uger (fra = til)', () => {
    const result = parseAarsloenRowInterval(ugeRow('5/2024', '5/2024'), 'uge');
    expect(result).not.toBeNull();
  });

  it('håndterer ugeskift over nytår', () => {
    // Uge 52/2023 → uge 2/2024 er en gyldig periode
    const result = parseAarsloenRowInterval(ugeRow('52/2023', '2/2024'), 'uge');
    expect(result).not.toBeNull();
    expect(result!.start <= result!.end).toBe(true);
  });
});

// ─── Lønperiode: dag ──────────────────────────────────────────────────────

describe('parseAarsloenRowInterval — dag', () => {
  it('returnerer null for tomme felter', () => {
    expect(parseAarsloenRowInterval(dagRow('', ''), 'dag')).toBeNull();
  });

  it('accepterer gyldigt dansk datoformat', () => {
    const result = parseAarsloenRowInterval(dagRow('01-01-2024', '31-01-2024'), 'dag');
    expect(result).not.toBeNull();
    expect(toUtcDateStr(result!.start)).toBe('2024-01-01');
    expect(toUtcDateStr(result!.end)).toBe('2024-01-31');
  });

  it('returnerer null for ISO-format (ikke dansk)', () => {
    expect(parseAarsloenRowInterval(dagRow('2024-01-01', '2024-01-31'), 'dag')).toBeNull();
  });

  it('returnerer null for fra > til', () => {
    expect(parseAarsloenRowInterval(dagRow('31-01-2024', '01-01-2024'), 'dag')).toBeNull();
  });

  it('accepterer fra = til (samme dag)', () => {
    const result = parseAarsloenRowInterval(dagRow('15-06-2024', '15-06-2024'), 'dag');
    expect(result).not.toBeNull();
    expect(toUtcDateStr(result!.start)).toBe('2024-06-15');
    expect(toUtcDateStr(result!.end)).toBe('2024-06-15');
  });

  it('over månedsskift: korrekte datoer', () => {
    const result = parseAarsloenRowInterval(dagRow('29-01-2024', '02-02-2024'), 'dag');
    expect(result).not.toBeNull();
    expect(toUtcDateStr(result!.start)).toBe('2024-01-29');
    expect(toUtcDateStr(result!.end)).toBe('2024-02-02');
  });

  it('over DST-skift (marts→april 2024)', () => {
    const result = parseAarsloenRowInterval(dagRow('29-03-2024', '01-04-2024'), 'dag');
    expect(result).not.toBeNull();
    expect(toUtcDateStr(result!.start)).toBe('2024-03-29');
    expect(toUtcDateStr(result!.end)).toBe('2024-04-01');
  });

  it('over nytår: korrekte datoer', () => {
    const result = parseAarsloenRowInterval(dagRow('30-12-2023', '02-01-2024'), 'dag');
    expect(result).not.toBeNull();
    expect(toUtcDateStr(result!.start)).toBe('2023-12-30');
    expect(toUtcDateStr(result!.end)).toBe('2024-01-02');
  });

  it('ugyldig dato (31. februar): returnerer null', () => {
    expect(parseAarsloenRowInterval(dagRow('31-02-2024', '28-02-2024'), 'dag')).toBeNull();
  });

  it('håndterer whitespace', () => {
    const result = parseAarsloenRowInterval(dagRow('  01-01-2024  ', '  31-01-2024  '), 'dag');
    expect(result).not.toBeNull();
  });
});
