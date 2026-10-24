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

/** De sorterings-props en header-celle skal have. Se {@link bindSortableHeader}. */
export type SortableHeaderProps = Readonly<{
  onClick: () => void;
  sortRole: GridSortRole;
  sortDirection: GridSortDirection | undefined;
}>;

export type UseTableSortResult<TRow> = Readonly<{
  sortedRows: TRow[];
  getSortRole: (colId: string) => GridSortRole;
  getSortDirection: (colId: string) => GridSortDirection | undefined;
  handleHeaderClick: (colId: string) => void;
}>;

export type UseTableSortOptions<TRow> = Readonly<{
  rows: readonly TRow[];
  /** Lås rækken med dette id først; den indgår ikke i kolonnernes sortering. */
  anchorRowId?: string;
  getRowId: (row: TRow) => string;
  isRowEmpty: (row: TRow) => boolean;
  columns: readonly TableSortColumn<TRow>[];
  onSortedRowsChange?: (sortedRows: TRow[]) => void;
}>;

const sameIds = (left: readonly string[], right: readonly string[]): boolean =>
  left.length === right.length && left.every((id, index) => id === right[index]);

/**
 * Binder en header-celles sorterings-props ud fra ÉT `colId`.
 *
 * Uden den skrives kolonne-id'et tre gange pr. header-celle (`onClick`, `sortRole`,
 * `sortDirection`). To af de tre kan stave forkert, uden at noget fejler – kolonnen holder
 * blot op med at vise sin sorteringspil, mens klikket stadig virker. Det er en fejl, hverken
 * typecheck eller en render-test fanger, fordi alle tre argumenter er `string`.
 */
export const bindSortableHeader = <TRow>(
  sort: UseTableSortResult<TRow>,
  colId: string
): SortableHeaderProps => ({
  onClick: () => sort.handleHeaderClick(colId),
  sortRole: sort.getSortRole(colId),
  sortDirection: sort.getSortDirection(colId),
});

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
  anchorRowId,
  getRowId,
  isRowEmpty,
  columns,
  onSortedRowsChange,
}: UseTableSortOptions<TRow>): UseTableSortResult<TRow> => {
  const [sortState, setSortState] = React.useState<GridSortState>({});

  const anchorRow = React.useMemo(
    () => anchorRowId === undefined ? undefined : rows.find((row) => getRowId(row) === anchorRowId),
    [anchorRowId, getRowId, rows]
  );
  const sortableRows = React.useMemo(
    () => anchorRow === undefined ? rows : rows.filter((row) => getRowId(row) !== anchorRowId),
    [anchorRow, anchorRowId, getRowId, rows]
  );
  const persistVisibleOrder = React.useCallback((sortedRows: TRow[]) => {
    if (onSortedRowsChange === undefined) return;
    onSortedRowsChange(anchorRow === undefined ? sortedRows : [anchorRow, ...sortedRows]);
  }, [anchorRow, onSortedRowsChange]);

  const getSortValueByColId = React.useCallback(
    (colId: string) => columns.find((col) => col.colId === colId)?.getSortValue,
    [columns]
  );

  const sortedSortableRows = React.useMemo(
    () =>
      sortGridRows({
        rows: sortableRows,
        getRowId,
        isRowEmpty,
        sortState,
        getSortValueByColId,
      }),
    [sortableRows, getRowId, isRowEmpty, sortState, getSortValueByColId]
  );
  const sortedRows = React.useMemo(
    () => anchorRow === undefined ? sortedSortableRows : [anchorRow, ...sortedSortableRows],
    [anchorRow, sortedSortableRows]
  );

  // En aktiv sortering skal også gælde efter inputændringer, ikke kun efter headerklik. Det dækker bl.a. en
  // ændret sorteringsværdi, en genindsat række ved undo og en ny række. Headerklikket persisterer fortsat
  // synkront nedenfor; effekten springer over det samme headerklik og skriver kun ved en reel forskel. Dermed
  // bliver sortering ikke et ekstra history-trin eller en render-loop.
  const latestOrderRef = React.useRef({
    rows: sortableRows,
    sortedRows: sortedSortableRows,
    getRowId,
    onSortedRowsChange: onSortedRowsChange === undefined ? undefined : persistVisibleOrder,
  });
  latestOrderRef.current = {
    rows: sortableRows,
    sortedRows: sortedSortableRows,
    getRowId,
    onSortedRowsChange: onSortedRowsChange === undefined ? undefined : persistVisibleOrder,
  };
  const justPersistedHeaderOrderRef = React.useRef<readonly string[] | null>(null);
  React.useEffect(() => {
    const current = latestOrderRef.current;
    if (current.onSortedRowsChange === undefined) return;
    const currentIds = current.rows.map(current.getRowId);
    const sortedIds = current.sortedRows.map(current.getRowId);
    const headerOrder = justPersistedHeaderOrderRef.current;
    if (headerOrder !== null && sameIds(headerOrder, sortedIds)) {
      justPersistedHeaderOrderRef.current = null;
      return;
    }
    if (sameIds(currentIds, sortedIds)) return;
    current.onSortedRowsChange(current.sortedRows);
  }, [sortableRows, sortedSortableRows]);

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
      // Persistér rækkefølgen i samme event som headerklikket. En efterfølgende save/download i samme task må
      // aldrig kunne se den gamle orden, mens tabellen allerede viser den nye sortering.
      const nextSortState = toggleGridSort(sortState, colId);
      const nextRows = sortGridRows({ rows: sortableRows, getRowId, isRowEmpty, sortState: nextSortState, getSortValueByColId });
      justPersistedHeaderOrderRef.current = onSortedRowsChange === undefined ? null : nextRows.map(getRowId);
      try {
        persistVisibleOrder(nextRows);
      } catch (error) {
        justPersistedHeaderOrderRef.current = null;
        throw error;
      }
      setSortState(nextSortState);
    },
    [getRowId, getSortValueByColId, isRowEmpty, onSortedRowsChange, persistVisibleOrder, sortableRows, sortState]
  );

  return { sortedRows, getSortRole, getSortDirection, handleHeaderClick };
};
