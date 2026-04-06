import * as React from 'react';
import {
  getGridSortRole,
  sortGridRows,
  toggleGridSort,
  type GridSortDirection,
  type GridSortRole,
  type GridSortState,
  type GridSortValueGetter,
} from './gridCore/gridModel';

export type { GridSortDirection, GridSortRole, GridSortState };

export type TableSortColumn<TRow> = Readonly<{
  colId: string;
  getSortValue: GridSortValueGetter<TRow>;
}>;

export type UseTableSortResult<TRow> = Readonly<{
  sortedRows: TRow[];
  getSortRole: (colId: string) => GridSortRole;
  getSortDirection: (colId: string) => GridSortDirection | undefined;
  handleHeaderClick: (colId: string) => void;
}>;

/**
 * Hook der tilføjer klik-sortering til enhver tabel (StandardGridTable eller StandardLooseTable).
 *
 * Brug:
 *   const { sortedRows, getSortRole, getSortDirection, handleHeaderClick } =
 *     useTableSort({ rows, getRowId, isRowEmpty, columns });
 *
 * Render header-celler med sortRole/sortDirection/onClick.
 * Iterer over sortedRows i stedet for rows direkte.
 */
export const useTableSort = <TRow>({
  rows,
  getRowId,
  isRowEmpty,
  columns,
  onSortedRowsChange,
}: Readonly<{
  rows: readonly TRow[];
  getRowId: (row: TRow) => string;
  isRowEmpty: (row: TRow) => boolean;
  columns: readonly TableSortColumn<TRow>[];
  onSortedRowsChange?: (sortedRows: TRow[]) => void;
}>): UseTableSortResult<TRow> => {
  const [sortState, setSortState] = React.useState<GridSortState>({});

  const getSortValueByColId = React.useCallback(
    (colId: string) => columns.find((col) => col.colId === colId)?.getSortValue,
    [columns]
  );

  const sortedRows = React.useMemo(
    () =>
      sortGridRows({
        rows,
        getRowId,
        isRowEmpty,
        sortState,
        getSortValueByColId,
      }),
    [rows, getRowId, isRowEmpty, sortState, getSortValueByColId]
  );

  const onSortedRowsChangeRef = React.useRef(onSortedRowsChange);
  React.useLayoutEffect(() => {
    onSortedRowsChangeRef.current = onSortedRowsChange;
  });

  const sortedRowsRef = React.useRef(sortedRows);
  sortedRowsRef.current = sortedRows;

  const isMountedRef = React.useRef(false);

  // Udløser onSortedRowsChange kun når brugeren ændrer sort-state (ikke ved initial mount,
  // og ikke når rows-prop'en ændrer sig — det ville give uendelig løkke).
  //
  // Implementeret som useEffect frem for et direkte kald i handleHeaderClick, fordi
  // sortedRows er memoized og ikke opdateres synkront i samme render-cyklus som sortState.
  // useEffect garanterer at sortedRowsRef.current er opdateret (synkront i render) inden
  // callbacken udløses. onSortedRowsChangeRef sikrer at vi altid kalder den seneste version
  // af callbacken uden at skulle have den i effect-dependency-arrayet.
  React.useEffect(() => {
    if (!isMountedRef.current) {
      isMountedRef.current = true;
      return;
    }
    onSortedRowsChangeRef.current?.(sortedRowsRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortState]);

  const getSortRole = React.useCallback(
    (colId: string): GridSortRole => getGridSortRole(sortState, colId),
    [sortState]
  );

  const getSortDirection = React.useCallback(
    (colId: string): GridSortDirection | undefined => {
      if (sortState.primary?.colId === colId) return sortState.primary.dir;
      if (sortState.secondary?.colId === colId) return sortState.secondary.dir;
      return undefined;
    },
    [sortState]
  );

  const handleHeaderClick = React.useCallback(
    (colId: string) => {
      setSortState((prev) => toggleGridSort(prev, colId));
    },
    []
  );

  return { sortedRows, getSortRole, getSortDirection, handleHeaderClick };
};
