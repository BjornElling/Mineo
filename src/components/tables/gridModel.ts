export type GridSortDirection = 'asc' | 'desc';

export type GridSortState = Readonly<{
  primary?: Readonly<{ colId: string; dir: GridSortDirection }>;
  secondary?: Readonly<{ colId: string; dir: GridSortDirection }>;
}>;

export type GridSortRole = 'none' | 'primary' | 'secondary';

export const getGridSortRole = (state: GridSortState, colId: string): GridSortRole => {
  if (state.primary?.colId === colId) return 'primary';
  if (state.secondary?.colId === colId) return 'secondary';
  return 'none';
};

export const toggleGridSort = (state: GridSortState, colId: string): GridSortState => {
  const primary = state.primary;
  const secondary = state.secondary;

  if (primary?.colId === colId) {
    const nextDir: GridSortDirection = primary.dir === 'asc' ? 'desc' : 'asc';
    return { primary: { colId, dir: nextDir }, secondary };
  }

  // New primary sort is always ascending.
  // The previous primary becomes secondary (stable sort memory).
  return {
    primary: { colId, dir: 'asc' },
    secondary: primary ? { colId: primary.colId, dir: primary.dir } : undefined,
  };
};

type GridSortValue = string | number | null | undefined;

export type GridSortValueGetter<TRow> = (row: TRow) => GridSortValue;

const isEmptySortValue = (value: GridSortValue): boolean => {
  if (value === null || value === undefined) return true;
  if (typeof value === 'number') return !Number.isFinite(value);
  return value.trim() === '';
};

const compareSortValues = (a: GridSortValue, b: GridSortValue): number => {
  const aEmpty = isEmptySortValue(a);
  const bEmpty = isEmptySortValue(b);
  if (aEmpty && bEmpty) return 0;
  // Empty values always sort last (both directions handled by sign flip at the callsite).
  if (aEmpty) return 1;
  if (bEmpty) return -1;

  if (typeof a === 'number' && typeof b === 'number') return a - b;

  const aText = typeof a === 'string' ? a : String(a);
  const bText = typeof b === 'string' ? b : String(b);
  return aText.localeCompare(bText, 'da-DK');
};

export const sortGridRows = <TRow>(params: Readonly<{
  rows: readonly TRow[];
  getRowId: (row: TRow) => string;
  isRowEmpty: (row: TRow) => boolean;
  sortState: GridSortState;
  getSortValueByColId: (colId: string) => GridSortValueGetter<TRow> | undefined;
}>): TRow[] => {
  const { rows, getRowId, isRowEmpty, sortState, getSortValueByColId } = params;

  const primary = sortState.primary;
  if (!primary) return [...rows];

  const nonEmptyRows: TRow[] = [];
  const emptyRows: TRow[] = [];
  for (const row of rows) {
    if (isRowEmpty(row)) emptyRows.push(row);
    else nonEmptyRows.push(row);
  }

  const insertionIndexByRowId = new Map<string, number>();
  for (let idx = 0; idx < rows.length; idx += 1) {
    insertionIndexByRowId.set(getRowId(rows[idx]), idx);
  }

  const primaryGetter = getSortValueByColId(primary.colId);
  const secondary = sortState.secondary;
  const secondaryGetter = secondary ? getSortValueByColId(secondary.colId) : undefined;

  const primaryDirSign = primary.dir === 'asc' ? 1 : -1;
  const secondaryDirSign = secondary && secondary.dir === 'asc' ? 1 : -1;

  const sorted = [...nonEmptyRows].sort((a, b) => {
    const primaryA = primaryGetter?.(a);
    const primaryB = primaryGetter?.(b);
    const primaryCmp = compareSortValues(primaryA, primaryB);
    if (primaryCmp !== 0) return primaryCmp * primaryDirSign;

    if (secondary && secondaryGetter) {
      const secondaryA = secondaryGetter(a);
      const secondaryB = secondaryGetter(b);
      const secondaryCmp = compareSortValues(secondaryA, secondaryB);
      if (secondaryCmp !== 0) return secondaryCmp * secondaryDirSign;
    }

    const aIdx = insertionIndexByRowId.get(getRowId(a)) ?? 0;
    const bIdx = insertionIndexByRowId.get(getRowId(b)) ?? 0;
    return aIdx - bIdx;
  });

  return [...sorted, ...emptyRows];
};

export const normalizeGridRows = <TRow>(params: Readonly<{
  rows: readonly TRow[];
  minRows: number;
  isRowEmpty: (row: TRow) => boolean;
  createEmptyRow: () => TRow;
}>): TRow[] => {
  const { rows, minRows, isRowEmpty, createEmptyRow } = params;

  const existingTrailingEmpty = rows.length > 0 && isRowEmpty(rows[rows.length - 1]) ? rows[rows.length - 1] : null;
  const nonEmptyRows = rows.filter((row) => !isRowEmpty(row));

  const normalized: TRow[] = [...nonEmptyRows];
  normalized.push(existingTrailingEmpty ?? createEmptyRow());

  // Ensure minimum row count while keeping the trailing empty row at the end.
  const safeMinRows = Math.max(1, Math.trunc(minRows));
  while (normalized.length < safeMinRows) {
    normalized.splice(Math.max(0, normalized.length - 1), 0, createEmptyRow());
  }

  return normalized;
};

