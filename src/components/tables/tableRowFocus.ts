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

const tableFocusableSelector =
  'input[role="combobox"]:not([disabled]):not([tabindex="-1"]):not([type="hidden"]),' +
  'input:not([disabled]):not([tabindex="-1"]):not([type="hidden"]),' +
  'select:not([disabled]):not([tabindex="-1"]),' +
  'textarea:not([disabled]):not([tabindex="-1"]),' +
  'button:not([disabled]):not([tabindex="-1"]),' +
  '[role="combobox"][tabindex]:not([tabindex="-1"]):not([aria-disabled="true"]),' +
  '[aria-haspopup][tabindex]:not([tabindex="-1"]):not([aria-disabled="true"]),' +
  '[aria-controls][tabindex]:not([tabindex="-1"]):not([aria-disabled="true"])';

const isElementVisible = (el: HTMLElement): boolean => {
  if (!el.isConnected) return false;
  const style = window.getComputedStyle(el);
  if (style.display === 'none') return false;
  if (style.visibility === 'hidden') return false;
  return true;
};

const focusElement = (el: HTMLElement) => {
  try {
    el.focus({ preventScroll: true });
  } catch {
    el.focus();
  }
};

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
  const escapedRowId = CSS.escape(rowId);
  const row = table.querySelector(`tbody tr[data-mineo-row-id="${escapedRowId}"]`);
  return row instanceof HTMLTableRowElement ? row : null;
};

const getFirstFocusableInCell = (cell: HTMLTableCellElement): HTMLElement | null => {
  const focusables = Array.from(cell.querySelectorAll<HTMLElement>(tableFocusableSelector)).filter((el) => isElementVisible(el));
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

  const cell = row.cells[plan.colIndex];
  if (!cell) return;

  const target = getFirstFocusableInCell(cell);
  if (!target) return;

  focusElement(target);
};
