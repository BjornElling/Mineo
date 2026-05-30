import { sortGridRows, toggleGridSort, getGridSortRole, normalizeGridRows } from '../../../components/tables/gridCore/gridModel';
import type { GridSortState } from '../../../components/tables/gridCore/gridModel';

type TestRow = { id: string; name: string; amount: number | null | undefined };

const getRowId = (row: TestRow) => row.id;
const isRowEmpty = (row: TestRow) => row.name === '' && row.amount == null;

const rows: readonly TestRow[] = [
  { id: 'a', name: 'Charlie', amount: 30 },
  { id: 'b', name: 'Alice', amount: 10 },
  { id: 'c', name: 'Bob', amount: 20 },
  { id: 'd', name: '', amount: undefined }, // tom række
  { id: 'e', name: 'Alice', amount: 5 },
];

const getSortValueByColId = (colId: string) => {
  if (colId === 'name') return (row: TestRow) => row.name;
  if (colId === 'amount') return (row: TestRow) => row.amount ?? null;
  return undefined;
};

describe('sortGridRows', () => {
  it('returnerer kopi af rows uden sortering når sortState er tom', () => {
    const result = sortGridRows({ rows, getRowId, isRowEmpty, sortState: {}, getSortValueByColId });
    expect(result).toEqual([...rows]);
    expect(result).not.toBe(rows);
  });

  it('sorterer ascending på string-kolonne', () => {
    const sortState: GridSortState = { primary: { colId: 'name', dir: 'asc' } };
    const result = sortGridRows({ rows, getRowId, isRowEmpty, sortState, getSortValueByColId });
    const names = result.filter((r) => !isRowEmpty(r)).map((r) => r.name);
    expect(names).toEqual(['Alice', 'Alice', 'Bob', 'Charlie']);
  });

  it('sorterer descending på string-kolonne', () => {
    const sortState: GridSortState = { primary: { colId: 'name', dir: 'desc' } };
    const result = sortGridRows({ rows, getRowId, isRowEmpty, sortState, getSortValueByColId });
    const names = result.filter((r) => !isRowEmpty(r)).map((r) => r.name);
    expect(names).toEqual(['Charlie', 'Bob', 'Alice', 'Alice']);
  });

  it('sorterer ascending på number-kolonne', () => {
    const sortState: GridSortState = { primary: { colId: 'amount', dir: 'asc' } };
    const result = sortGridRows({ rows, getRowId, isRowEmpty, sortState, getSortValueByColId });
    const amounts = result.filter((r) => !isRowEmpty(r)).map((r) => r.amount);
    expect(amounts).toEqual([5, 10, 20, 30]);
  });

  it('sorterer descending på number-kolonne', () => {
    const sortState: GridSortState = { primary: { colId: 'amount', dir: 'desc' } };
    const result = sortGridRows({ rows, getRowId, isRowEmpty, sortState, getSortValueByColId });
    const amounts = result.filter((r) => !isRowEmpty(r)).map((r) => r.amount);
    expect(amounts).toEqual([30, 20, 10, 5]);
  });

  it('tom-rækker placeres altid sidst uanset retning', () => {
    const sortStateAsc: GridSortState = { primary: { colId: 'name', dir: 'asc' } };
    const sortStateDesc: GridSortState = { primary: { colId: 'name', dir: 'desc' } };
    const resultAsc = sortGridRows({ rows, getRowId, isRowEmpty, sortState: sortStateAsc, getSortValueByColId });
    const resultDesc = sortGridRows({ rows, getRowId, isRowEmpty, sortState: sortStateDesc, getSortValueByColId });
    expect(isRowEmpty(resultAsc[resultAsc.length - 1]!)).toBe(true);
    expect(isRowEmpty(resultDesc[resultDesc.length - 1]!)).toBe(true);
  });

  it('sekundær sortering bruges ved tie på primær', () => {
    // To Alice-rækker med amount 10 og 5 — sekundær sort på amount asc giver 5 før 10
    const sortState: GridSortState = {
      primary: { colId: 'name', dir: 'asc' },
      secondary: { colId: 'amount', dir: 'asc' },
    };
    const result = sortGridRows({ rows, getRowId, isRowEmpty, sortState, getSortValueByColId });
    const aliceRows = result.filter((r) => r.name === 'Alice');
    expect(aliceRows[0]?.amount).toBe(5);
    expect(aliceRows[1]?.amount).toBe(10);
  });

  it('sekundær sort desc ved tie', () => {
    const sortState: GridSortState = {
      primary: { colId: 'name', dir: 'asc' },
      secondary: { colId: 'amount', dir: 'desc' },
    };
    const result = sortGridRows({ rows, getRowId, isRowEmpty, sortState, getSortValueByColId });
    const aliceRows = result.filter((r) => r.name === 'Alice');
    expect(aliceRows[0]?.amount).toBe(10);
    expect(aliceRows[1]?.amount).toBe(5);
  });

  it('tie-break på insertion order når primær og sekundær er ens', () => {
    const tiedRows: readonly TestRow[] = [
      { id: 'x', name: 'Alice', amount: 10 },
      { id: 'y', name: 'Alice', amount: 10 },
    ];
    const sortState: GridSortState = {
      primary: { colId: 'name', dir: 'asc' },
      secondary: { colId: 'amount', dir: 'asc' },
    };
    const result = sortGridRows({ rows: tiedRows, getRowId, isRowEmpty, sortState, getSortValueByColId });
    expect(result[0]?.id).toBe('x');
    expect(result[1]?.id).toBe('y');
  });

  it('ukendt colId giver undefined getter og bevarer insertion order', () => {
    const sortState: GridSortState = { primary: { colId: 'unknown', dir: 'asc' } };
    const result = sortGridRows({ rows, getRowId, isRowEmpty, sortState, getSortValueByColId });
    // Alle værdier er undefined → alle "tomme" sort-values → insertion order bevaret for non-empty rows
    const nonEmptyIds = result.filter((r) => !isRowEmpty(r)).map((r) => r.id);
    expect(nonEmptyIds).toEqual(['a', 'b', 'c', 'e']);
  });
});

describe('toggleGridSort', () => {
  it('første klik sætter primær asc', () => {
    const result = toggleGridSort({}, 'name');
    expect(result.primary).toEqual({ colId: 'name', dir: 'asc' });
    expect(result.secondary).toBeUndefined();
  });

  it('andet klik på samme kolonne flipper til desc', () => {
    const state: GridSortState = { primary: { colId: 'name', dir: 'asc' } };
    const result = toggleGridSort(state, 'name');
    expect(result.primary).toEqual({ colId: 'name', dir: 'desc' });
  });

  it('tredje klik på samme kolonne flipper tilbage til asc', () => {
    const state: GridSortState = { primary: { colId: 'name', dir: 'desc' } };
    const result = toggleGridSort(state, 'name');
    expect(result.primary).toEqual({ colId: 'name', dir: 'asc' });
  });

  it('klik på ny kolonne rykker primær til sekundær', () => {
    const state: GridSortState = { primary: { colId: 'name', dir: 'desc' } };
    const result = toggleGridSort(state, 'amount');
    expect(result.primary).toEqual({ colId: 'amount', dir: 'asc' });
    expect(result.secondary).toEqual({ colId: 'name', dir: 'desc' });
  });

  it('klik på ny kolonne erstatter eksisterende sekundær', () => {
    const state: GridSortState = {
      primary: { colId: 'name', dir: 'asc' },
      secondary: { colId: 'amount', dir: 'desc' },
    };
    const result = toggleGridSort(state, 'other');
    expect(result.primary).toEqual({ colId: 'other', dir: 'asc' });
    expect(result.secondary).toEqual({ colId: 'name', dir: 'asc' });
  });
});

describe('getGridSortRole', () => {
  it('returnerer primary for primær kolonne', () => {
    const state: GridSortState = { primary: { colId: 'name', dir: 'asc' } };
    expect(getGridSortRole(state, 'name')).toBe('primary');
  });

  it('returnerer secondary for sekundær kolonne', () => {
    const state: GridSortState = {
      primary: { colId: 'name', dir: 'asc' },
      secondary: { colId: 'amount', dir: 'desc' },
    };
    expect(getGridSortRole(state, 'amount')).toBe('secondary');
  });

  it('returnerer none for inaktiv kolonne', () => {
    const state: GridSortState = { primary: { colId: 'name', dir: 'asc' } };
    expect(getGridSortRole(state, 'amount')).toBe('none');
  });

  it('returnerer none for tom state', () => {
    expect(getGridSortRole({}, 'name')).toBe('none');
  });
});

describe('normalizeGridRows', () => {
  type Row = { id: string; val: string | undefined };
  const isEmpty = (r: Row) => r.val === undefined;
  let counter = 0;
  const createEmpty = (): Row => ({ id: `new-${++counter}`, val: undefined });

  beforeEach(() => {
    counter = 0;
  });

  it('bevarer én trailing tom række og fjerner ingen ikke-tomme rækker', () => {
    const input: Row[] = [
      { id: '1', val: 'a' },
      { id: '2', val: 'b' },
      { id: '3', val: undefined },
    ];
    const result = normalizeGridRows({ rows: input, minRows: 1, isRowEmpty: isEmpty, createEmptyRow: createEmpty });
    expect(result).toHaveLength(3);
    expect(result[2]?.id).toBe('3'); // eksisterende tom bevaret
    expect(isEmpty(result[result.length - 1]!)).toBe(true);
  });

  it('tilføjer trailing tom række når ingen tom eksisterer', () => {
    const input: Row[] = [{ id: '1', val: 'a' }, { id: '2', val: 'b' }];
    const result = normalizeGridRows({ rows: input, minRows: 1, isRowEmpty: isEmpty, createEmptyRow: createEmpty });
    expect(result).toHaveLength(3);
    expect(isEmpty(result[2]!)).toBe(true);
  });

  it('fjerner multiple tomme rækker og beholder kun én trailing tom', () => {
    const input: Row[] = [
      { id: '1', val: 'a' },
      { id: '2', val: undefined },
      { id: '3', val: undefined },
    ];
    const result = normalizeGridRows({ rows: input, minRows: 1, isRowEmpty: isEmpty, createEmptyRow: createEmpty });
    expect(result).toHaveLength(2);
    expect(result[0]?.val).toBe('a');
    expect(isEmpty(result[1]!)).toBe(true);
  });

  it('opfylder minRows ved at indsætte tomme rækker før trailing tom', () => {
    const input: Row[] = [{ id: '1', val: 'a' }];
    const result = normalizeGridRows({ rows: input, minRows: 4, isRowEmpty: isEmpty, createEmptyRow: createEmpty });
    expect(result).toHaveLength(4);
    expect(result[0]?.val).toBe('a');
    expect(isEmpty(result[result.length - 1]!)).toBe(true);
    // Alle mellemliggende er tomme
    for (let i = 1; i < result.length; i++) {
      expect(isEmpty(result[i]!)).toBe(true);
    }
  });

  it('tom input giver præcis minRows rækker (alle tomme)', () => {
    const result = normalizeGridRows({ rows: [], minRows: 3, isRowEmpty: isEmpty, createEmptyRow: createEmpty });
    expect(result).toHaveLength(3);
    result.forEach((r) => expect(isEmpty(r)).toBe(true));
  });

  it('minRows <= 1 giver altid mindst 1 række', () => {
    const result = normalizeGridRows({ rows: [], minRows: 0, isRowEmpty: isEmpty, createEmptyRow: createEmpty });
    expect(result).toHaveLength(1);
    expect(isEmpty(result[0]!)).toBe(true);
  });

  describe('determinisme-kontrakt (StrictMode-sikkerhed)', () => {
    // createEmptyRow er deterministisk pr. seed — modellerer en korrekt implementering
    // (fx createEmptyRowId('row', seed)) i stedet for en RNG.
    const createDeterministicEmpty = (seed: number): Row => ({ id: `empty-${seed}`, val: undefined });

    it('to kald med samme input giver IDENTISKE rækker inkl. id (forhindrer persist-desync)', () => {
      const input: Row[] = [{ id: '1', val: 'a' }];
      const a = normalizeGridRows({ rows: input, minRows: 3, isRowEmpty: isEmpty, createEmptyRow: createDeterministicEmpty });
      const b = normalizeGridRows({ rows: input, minRows: 3, isRowEmpty: isEmpty, createEmptyRow: createDeterministicEmpty });
      expect(a).toEqual(b);
      expect(a.map((r) => r.id)).toEqual(b.map((r) => r.id));
    });

    it('seed er unikt pr. oprettet tom række, så deterministiske id ikke kolliderer', () => {
      const input: Row[] = [{ id: '1', val: 'a' }];
      const result = normalizeGridRows({ rows: input, minRows: 4, isRowEmpty: isEmpty, createEmptyRow: createDeterministicEmpty });
      const emptyIds = result.filter((r) => isEmpty(r)).map((r) => r.id);
      expect(new Set(emptyIds).size).toBe(emptyIds.length);
    });
  });
});
