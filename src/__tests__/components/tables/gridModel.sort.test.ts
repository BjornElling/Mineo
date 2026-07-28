import { sortGridRows, toggleGridSort, getGridSortRole } from '../../../components/tables/gridCore/gridModel';
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
