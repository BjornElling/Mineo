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

  // Ny primær sortering er altid stigende.
  // Den tidligere primære bliver sekundær (stabil sorterings-hukommelse).
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
  // Tomme værdier sorteres altid sidst (begge retninger håndteres ved fortegnsskift på callsite'et).
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

    // insertionIndexByRowId er bygget fra de samme `rows`, så et lookup-miss kan kun ske ved et
    // brud på getRowId-determinismekontrakten. Fald tilbage på `rows.length` (sorterer manglende
    // sidst, deterministisk) i stedet for 0, der ville kollapse distinkte rækker til samme nøgle
    // og gøre comparatoren ustabil.
    const aIdx = insertionIndexByRowId.get(getRowId(a));
    const bIdx = insertionIndexByRowId.get(getRowId(b));
    if (import.meta.env.DEV && (aIdx === undefined || bIdx === undefined)) {
      throw new Error('sortGridRows: getRowId returnerede en ukendt id under sortering (ikke-deterministisk getRowId)');
    }
    return (aIdx ?? rows.length) - (bIdx ?? rows.length);
  });

  return [...sorted, ...emptyRows];
};
