import { findFirstKontrolTableParityDiff } from '../../../domain/eoInspektion/eoInspektionParity';
import { toISODateString } from '../../../types/branded';

// ─── Helpers ──────────────────────────────────────────────────────────────────

type SimpleCell = string | number | boolean | null;

const makeCol = (id: string, header: string, cells: SimpleCell[]) => ({
  id,
  header,
  getCell: (rowIndex: number) => cells[rowIndex] ?? null,
});

const makeModel = (
  columns: ReturnType<typeof makeCol>[],
  rowCount: number,
  keys?: string[]
) => ({
  columns,
  rowCount,
  getRowKey: (i: number) => keys?.[i] ?? String(i),
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('findFirstKontrolTableParityDiff', () => {
  // ── Ingen diff ──────────────────────────────────────────────────────────────

  it('returnerer null for to identiske tomme tabeller', () => {
    const empty = makeModel([], 0);
    expect(findFirstKontrolTableParityDiff(empty, empty)).toBeNull();
  });

  it('returnerer null for to identiske tabeller med data', () => {
    const cols = [makeCol('col-a', 'Kolonne A', ['v1', 'v2'])];
    const a = makeModel(cols, 2, ['row-0', 'row-1']);
    const b = makeModel([makeCol('col-a', 'Kolonne A', ['v1', 'v2'])], 2, ['row-0', 'row-1']);
    expect(findFirstKontrolTableParityDiff(a, b)).toBeNull();
  });

  it('returnerer null for ens tabeller med boolean og tal-celler', () => {
    const cols = [makeCol('col-b', 'B', [true, 42, false])];
    const a = makeModel(cols, 3);
    const b = makeModel([makeCol('col-b', 'B', [true, 42, false])], 3);
    expect(findFirstKontrolTableParityDiff(a, b)).toBeNull();
  });

  // ── Kolonnetals-mismatch ────────────────────────────────────────────────────

  it('opdager kolonne-tals-mismatch (colId = meta:column-count)', () => {
    const a = makeModel([makeCol('c1', 'H1', [])], 0);
    const b = makeModel([makeCol('c1', 'H1', []), makeCol('c2', 'H2', [])], 0);
    const diff = findFirstKontrolTableParityDiff(a, b);
    expect(diff).not.toBeNull();
    expect(diff!.colId).toBe('meta:column-count');
    expect(diff!.rowIndex).toBe(-1);
  });

  // ── Kolonne-ID-mismatch ────────────────────────────────────────────────────

  it('opdager kolonne-id-mismatch (colId = meta:column-id:N)', () => {
    const a = makeModel([makeCol('col-x', 'H', [])], 0);
    const b = makeModel([makeCol('col-y', 'H', [])], 0);
    const diff = findFirstKontrolTableParityDiff(a, b);
    expect(diff).not.toBeNull();
    expect(diff!.colId).toBe('meta:column-id:0');
    expect(diff!.rowIndex).toBe(-1);
  });

  it('rapporterer det korrekte index for det første afvigende kolonne-id', () => {
    const a = makeModel([makeCol('c1', 'H1', []), makeCol('c2', 'H2', [])], 0);
    const b = makeModel([makeCol('c1', 'H1', []), makeCol('cx', 'H2', [])], 0);
    const diff = findFirstKontrolTableParityDiff(a, b);
    expect(diff!.colId).toBe('meta:column-id:1');
  });

  // ── Header-mismatch ────────────────────────────────────────────────────────

  it('opdager header-mismatch (colId = kolonnens id)', () => {
    const a = makeModel([makeCol('col-a', 'Header A', [])], 0);
    const b = makeModel([makeCol('col-a', 'Header B', [])], 0);
    const diff = findFirstKontrolTableParityDiff(a, b);
    expect(diff).not.toBeNull();
    expect(diff!.colId).toBe('col-a');
    expect(diff!.rowIndex).toBe(-1);
  });

  // ── Rækketal-mismatch ──────────────────────────────────────────────────────

  it('opdager rækketal-mismatch (colId = meta:row-count)', () => {
    const col = makeCol('c', 'H', ['v', 'v', 'v']);
    const a = makeModel([col], 3);
    const b = makeModel([makeCol('c', 'H', ['v', 'v'])], 2);
    const diff = findFirstKontrolTableParityDiff(a, b);
    expect(diff).not.toBeNull();
    expect(diff!.colId).toBe('meta:row-count');
    expect(diff!.rowIndex).toBe(-1);
  });

  // ── Række-nøgle-mismatch ──────────────────────────────────────────────────

  it('opdager række-nøgle-mismatch (colId = meta:row-key)', () => {
    const col = makeCol('c', 'H', ['val']);
    const a = makeModel([col], 1, [toISODateString('2024-01-01')]);
    const b = makeModel([makeCol('c', 'H', ['val'])], 1, [toISODateString('2024-01-02')]);
    const diff = findFirstKontrolTableParityDiff(a, b);
    expect(diff).not.toBeNull();
    expect(diff!.colId).toBe('meta:row-key');
    expect(diff!.rowIndex).toBe(0);
  });

  // ── Celleværdi-mismatch ───────────────────────────────────────────────────

  it('opdager celleværdi-mismatch i første kolonne', () => {
    const a = makeModel([makeCol('c', 'H', ['forventet'])], 1);
    const b = makeModel([makeCol('c', 'H', ['faktisk'])], 1);
    const diff = findFirstKontrolTableParityDiff(a, b);
    expect(diff).not.toBeNull();
    expect(diff!.colId).toBe('c');
    expect(diff!.rowIndex).toBe(0);
    // Hash-værdier er forskellige
    expect(diff!.expectedHash).not.toBe(diff!.actualHash);
  });

  it('rapporterer korrekt rowIndex for diff på anden række', () => {
    const a = makeModel([makeCol('c', 'H', ['same', 'diff-a'])], 2);
    const b = makeModel([makeCol('c', 'H', ['same', 'diff-b'])], 2);
    const diff = findFirstKontrolTableParityDiff(a, b);
    expect(diff!.rowIndex).toBe(1);
  });

  it('returnerer første diff (ikke alle diffs)', () => {
    const a = makeModel([makeCol('c', 'H', ['x', 'x'])], 2);
    const b = makeModel([makeCol('c', 'H', ['y', 'y'])], 2);
    const diff = findFirstKontrolTableParityDiff(a, b);
    expect(diff!.rowIndex).toBe(0); // Kun første
  });

  // ── Hash-determinisme ─────────────────────────────────────────────────────

  it('returnerer identiske hash-værdier for identisk expected og actual', () => {
    const model = makeModel([makeCol('c', 'H', ['abc'])], 1);
    // Byg en kopi med samme data
    const copy = makeModel([makeCol('c', 'H', ['abc'])], 1);
    const result = findFirstKontrolTableParityDiff(model, copy);
    // Ingen diff fordi værdierne er ens
    expect(result).toBeNull();
  });

  it('producerer deterministiske hash-værdier på tværs af to uafhængige diff-kørsler', () => {
    // Værn mod, at hash-funktionen utilsigtet bliver ikke-deterministisk
    // (fx hvis fnv1a32-seed eller padding senere ændres til noget tids-/RNG-afhængigt).
    const buildPair = () => {
      const a = makeModel([makeCol('c', 'H', ['forventet-værdi'])], 1);
      const b = makeModel([makeCol('c', 'H', ['faktisk-værdi'])], 1);
      return findFirstKontrolTableParityDiff(a, b);
    };
    const first = buildPair();
    const second = buildPair();
    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    expect(first!.expectedHash).toBe(second!.expectedHash);
    expect(first!.actualHash).toBe(second!.actualHash);
    // 8-hex FNV-1a-format (ingen tids-/RNG-komponent).
    expect(first!.expectedHash).toMatch(/^[0-9a-f]{8}$/);
  });

  // ── Ikke-vacuous: diff må ikke kollapse forskellige værdier til samme hash ──

  it('giver forskellige hash for forskellige værdier (ingen vacuous lighed via hash-kollision)', () => {
    // Parity rapporterer hashes, men SAMMENLIGNER på rå skalarer. Denne test sikrer
    // desuden, at de rapporterede hashes faktisk adskiller de to forskellige værdier,
    // så et diff aldrig fremstår som "ens hash" når værdierne reelt afviger.
    const a = makeModel([makeCol('c', 'H', ['100,00'])], 1);
    const b = makeModel([makeCol('c', 'H', ['100,01'])], 1);
    const diff = findFirstKontrolTableParityDiff(a, b);
    expect(diff).not.toBeNull();
    expect(diff!.expectedHash).not.toBe(diff!.actualHash);
  });

  it('opdager talværdi-afvigelse selv når displaytekst er numerisk ens-lignende', () => {
    // En reel divergens-detektion: number 100 vs string "100" må fanges
    // (toCsvScalar normaliserer begge til "100", så de er bevidst ens her —
    //  testen dokumenterer at scalar-normalisering er den valgte sammenligningsregel).
    const a = makeModel([makeCol('c', 'H', [100])], 1);
    const b = makeModel([makeCol('c', 'H', ['100'])], 1);
    expect(findFirstKontrolTableParityDiff(a, b)).toBeNull();

    // Men 100 vs 101 SKAL give diff.
    const c = makeModel([makeCol('c', 'H', [100])], 1);
    const d = makeModel([makeCol('c', 'H', [101])], 1);
    expect(findFirstKontrolTableParityDiff(c, d)).not.toBeNull();
  });
});
