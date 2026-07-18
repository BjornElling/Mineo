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
      const nextRows = sortGridRows({ rows, getRowId, isRowEmpty, sortState: nextSortState, getSortValueByColId });
      onSortedRowsChange?.(nextRows);
      setSortState(nextSortState);
    },
    [getRowId, getSortValueByColId, isRowEmpty, onSortedRowsChange, rows, sortState]
  );

  return { sortedRows, getSortRole, getSortDirection, handleHeaderClick };
};
