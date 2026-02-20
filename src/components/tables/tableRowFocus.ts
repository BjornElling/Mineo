import { focusTableElement, isTableElementVisible, TABLE_FOCUSABLE_SELECTOR } from './tableFocusHelpers';

export type RowRemovalFocusPlan = Readonly<{
  // Column mapping is DOM-index based and assumes no colSpan divergence between rows.
  targetIndex: number;
  colIndex: number;
}>;

type ActiveCellInfo = Readonly<{
  rowId: string;
  colIndex: number;
}>;

type BuildPlanParams<TRow> = Readonly<{
  table: HTMLTableElement | null;
  prevRows: readonly TRow[];
  nextRows: readonly TRow[];
  visibleRowIds: readonly string[];
  getRowId: (row: TRow) => string;
}>;

type ApplyPlanParams = Readonly<{
  table: HTMLTableElement | null;
  plan: RowRemovalFocusPlan;
  visibleRowIds: readonly string[];
}>;

type BuildRetainedEmptyRowPlanParams<TRow> = Readonly<{
  table: HTMLTableElement | null;
  prevRows: readonly TRow[];
  nextRows: readonly TRow[];
  rowId: string;
  colIndex: number;
  visibleRowIds: readonly string[];
  isRowEmpty: (row: TRow) => boolean;
  getRowId: (row: TRow) => string;
}>;

type BuildRemovedRowFallbackFocusPlanParams<TRow> = Readonly<{
  prevRows: readonly TRow[];
  nextRows: readonly TRow[];
  rowId: string;
  colIndex: number;
  visibleRowIds: readonly string[];
  getRowId: (row: TRow) => string;
}>;

const getActiveCellInfo = (table: HTMLTableElement): ActiveCellInfo | null => {
  const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  if (!active || !table.contains(active)) return null;

  const row = active.closest('tr');
  if (!(row instanceof HTMLTableRowElement)) return null;

  const rowId = row.getAttribute('data-mineo-row-id');
  if (!rowId) return null;

  const cell = active.closest('td,th');
  if (!(cell instanceof HTMLTableCellElement)) return null;

  return { rowId, colIndex: cell.cellIndex };
};

const getRowById = (table: HTMLTableElement, rowId: string): HTMLTableRowElement | null => {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    const escapedRowId = CSS.escape(rowId);
    const row = table.querySelector(`tbody tr[data-mineo-row-id="${escapedRowId}"]`);
    return row instanceof HTMLTableRowElement ? row : null;
  }

  const rows = Array.from(table.querySelectorAll('tbody tr[data-mineo-row-id]')).filter(
    (row): row is HTMLTableRowElement => row instanceof HTMLTableRowElement
  );
  return rows.find((row) => row.getAttribute('data-mineo-row-id') === rowId) ?? null;
};

const getFirstFocusableInCell = (cell: HTMLTableCellElement): HTMLElement | null => {
  const focusables = Array.from(cell.querySelectorAll<HTMLElement>(TABLE_FOCUSABLE_SELECTOR)).filter((el) =>
    isTableElementVisible(el, { requireConnected: true })
  );
  return focusables[0] ?? null;
};

const buildRemovedRowSet = <TRow>(prevRows: readonly TRow[], nextRows: readonly TRow[], getRowId: (row: TRow) => string): Set<string> => {
  const removed = new Set(prevRows.map(getRowId));
  for (const row of nextRows) {
    removed.delete(getRowId(row));
  }
  return removed;
};

/**
 * Build a focus plan for row removal.
 *
 * Preconditions:
 * - `visibleRowIds` is the current (pre-update) DOM order of `<tr data-mineo-row-id>`.
 * - `prevRows` and `nextRows` represent the pre/post committed data model (not DOM).
 * - Apply the plan in a layout effect after the DOM has rendered the next rows.
 */
export const buildRowRemovalFocusPlan = <TRow>(params: BuildPlanParams<TRow>): RowRemovalFocusPlan | null => {
  const { table, prevRows, nextRows, visibleRowIds, getRowId } = params;
  if (!table) return null;

  const active = getActiveCellInfo(table);
  if (!active) return null;

  const removedRowIds = buildRemovedRowSet(prevRows, nextRows, getRowId);
  if (!removedRowIds.has(active.rowId)) return null;

  const activeIndex = visibleRowIds.indexOf(active.rowId);
  if (activeIndex < 0) return null;

  return { targetIndex: activeIndex, colIndex: active.colIndex };
};

/**
 * Build a focus plan when a row becomes empty but is retained by table normalization
 * (e.g. min-row policy keeps 2 rows visible).
 */
export const buildRetainedEmptyRowFocusPlan = <TRow>(params: BuildRetainedEmptyRowPlanParams<TRow>): RowRemovalFocusPlan | null => {
  const { table, prevRows, nextRows, rowId, colIndex, visibleRowIds, isRowEmpty, getRowId } = params;
  if (!table) return null;

  const active = getActiveCellInfo(table);
  if (!active) return null;
  if (active.rowId !== rowId) return null;

  const prevRow = prevRows.find((row) => getRowId(row) === rowId);
  const nextRow = nextRows.find((row) => getRowId(row) === rowId);
  if (!prevRow || !nextRow) return null;
  if (isRowEmpty(prevRow) || !isRowEmpty(nextRow)) return null;

  const targetIndex = visibleRowIds.indexOf(rowId);
  if (targetIndex < 0) return null;

  return { targetIndex, colIndex };
};

/**
 * Build fallback focus plan for blur-commit scenarios where `activeElement` may
 * already be outside table while the committed row is still removed.
 */
export const buildRemovedRowFallbackFocusPlan = <TRow>(params: BuildRemovedRowFallbackFocusPlanParams<TRow>): RowRemovalFocusPlan | null => {
  const { prevRows, nextRows, rowId, colIndex, visibleRowIds, getRowId } = params;
  const prevHasRow = prevRows.some((row) => getRowId(row) === rowId);
  if (!prevHasRow) return null;

  const rowWasRemoved = !nextRows.some((row) => getRowId(row) === rowId);
  if (!rowWasRemoved) return null;

  const targetIndex = visibleRowIds.indexOf(rowId);
  if (targetIndex < 0) return null;

  return { targetIndex, colIndex };
};

/**
 * Apply a previously computed focus plan.
 *
 * Preconditions:
 * - `visibleRowIds` is the current (post-update) DOM order of `<tr data-mineo-row-id>`.
 * - The table DOM has been committed (useLayoutEffect).
 */
export const applyRowRemovalFocusPlan = (params: ApplyPlanParams): void => {
  const { table, plan, visibleRowIds } = params;
  if (!table) return;

  // By design, deleting the last visible row does not force a fallback focus target.
  const targetRowId = visibleRowIds[plan.targetIndex];
  if (!targetRowId) return;

  const row = getRowById(table, targetRowId);
  if (!row) return;

  if (import.meta.env.DEV) {
    const firstDataRow = table.querySelector('tbody tr[data-mineo-row-id]');
    if (firstDataRow instanceof HTMLTableRowElement && row.cells.length !== firstDataRow.cells.length) {
      console.warn('Fokus-gendan i tabel afbrudt: colSpan/kolonnestruktur matcher ikke mellem rækker.');
      return;
    }
  }

  const cell = row.cells[plan.colIndex];
  if (!cell) return;

  const target = getFirstFocusableInCell(cell);
  if (!target) return;

  focusTableElement(target);
};
