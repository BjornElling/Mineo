import type * as React from 'react';
import { getGridCoreForTable } from './gridCoreRegistry';

type CellLocator = Readonly<{ rowIndex: number; colIndex: number; subIndex: number; rowId?: string }>;

type TabAnchor = Readonly<{ colIndex: number; subIndex: number }>;

const tabAnchorByTable = new WeakMap<HTMLTableElement, TabAnchor>();
const pendingRecoveryByTable = new WeakMap<HTMLTableElement, Readonly<{ desired: CellLocator; intendedTarget: HTMLElement | null }>>();

// Navigation semantics (owned by this module):
// - Enter / Shift+Enter: move vertically while keeping the "anchor column" if one exists; otherwise use current column.
// - ArrowUp/ArrowDown: move vertically from the current cell (clears the anchor).
// Note: We `stopPropagation()` for owned keys so the Container-level Tab trap does not also run.
// Tab is NOT owned here; it is handled by Container-level navigation for natural flow across tables.

// IMPORTANT: this selector is shared by keyboard navigation and must be robust across
// different input strategies (e.g. "cell focus" where inputs may be `readOnly`).
// If you change it, verify tabbing in both:
// - HTML-grid tables using Table*Input components
// - MUI tables with "cell focus"/editor patterns (e.g. Årsløn)
const focusableSelector =
  'input[role="combobox"]:not([disabled]):not([tabindex="-1"]):not([type="hidden"]),' +
  'input:not([disabled]):not([tabindex="-1"]):not([type="hidden"]),' +
  'select:not([disabled]):not([tabindex="-1"]),' +
  'textarea:not([disabled]):not([tabindex="-1"]),' +
  'button:not([disabled]):not([tabindex="-1"]),' +
  '[role="combobox"][tabindex]:not([tabindex="-1"]):not([aria-disabled="true"]),' +
  '[aria-haspopup][tabindex]:not([tabindex="-1"]):not([aria-disabled="true"]),' +
  '[aria-controls][tabindex]:not([tabindex="-1"]):not([aria-disabled="true"])';

const isComposing = (e: React.KeyboardEvent): boolean => {
  const native = e.nativeEvent as unknown as { isComposing?: boolean };
  return native.isComposing === true;
};

const isElementVisible = (el: HTMLElement): boolean => {
  const rects = el.getClientRects();
  const style = window.getComputedStyle(el);
  if (style.display === 'none') return false;
  if (style.visibility === 'hidden') return false;
  // JSDOM does not implement layout and returns empty rects; treat as visible unless explicitly hidden.
  if (rects.length === 0) return true;
  return true;
};

const getWidgetHost = (el: HTMLElement | null): HTMLElement | null => {
  if (!el) return null;
  return el.closest('[role="combobox"],[aria-haspopup],[aria-controls]') as HTMLElement | null;
};

const getNearestExpanded = (el: HTMLElement | null): boolean => {
  if (!el) return false;
  const expandedHost = el.closest('[aria-expanded]') as HTMLElement | null;
  if (expandedHost?.getAttribute('aria-expanded') === 'true') return true;

  const widgetHost = getWidgetHost(el);
  if (widgetHost?.getAttribute('aria-expanded') === 'true') return true;

  const controlsId = widgetHost?.getAttribute('aria-controls');
  if (!controlsId) return false;
  const controlled = document.getElementById(controlsId);
  if (!(controlled instanceof HTMLElement)) return false;
  if (controlled.hasAttribute('hidden')) return false;
  if (controlled.getAttribute('aria-hidden') === 'true') return false;

  const rects = controlled.getClientRects();
  if (rects.length === 0) return false;
  const style = window.getComputedStyle(controlled);
  if (style.display === 'none' || style.visibility === 'hidden') return false;
  return true;
};

const shouldIgnoreKey = (e: React.KeyboardEvent): boolean => {
  if (e.ctrlKey || e.metaKey || e.altKey) return true;
  if (isComposing(e)) return true;
  return false;
};

const focusElement = (el: HTMLElement) => {
  try {
    el.focus({ preventScroll: true });
  } catch {
    el.focus();
  }
};

const scheduleFocusRecovery = (table: HTMLTableElement, desired: CellLocator, intendedTarget: HTMLElement | null) => {
  pendingRecoveryByTable.set(table, { desired, intendedTarget });
  requestAnimationFrame(() => {
    const pending = pendingRecoveryByTable.get(table);
    if (!pending) return;
    pendingRecoveryByTable.delete(table);

    const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (active && table.contains(active)) return;

    // Only recover focus when the element we *intended* to focus is gone (unmounted).
    // This avoids interfering with normal blur/commit flows in loose tables where values are committed on blur.
    if (pending.intendedTarget && pending.intendedTarget.isConnected && table.contains(pending.intendedTarget)) return;

    if (typeof pending.desired.rowId === 'string' && pending.desired.rowId.trim() !== '') {
      const rowId = pending.desired.rowId;
      const rows = Array.from(table.querySelectorAll('tbody tr')).filter((row): row is HTMLTableRowElement => row instanceof HTMLTableRowElement);
      const row = rows.find((r) => r.getAttribute('data-mineo-row-id') === rowId) ?? null;
      if (row) {
        const cells = Array.from(row.querySelectorAll<HTMLTableCellElement>('td,th')).filter(
          (cell): cell is HTMLTableCellElement => cell instanceof HTMLTableCellElement
        );
        const cell = cells[pending.desired.colIndex] ?? null;
        if (cell) {
          const focusables = Array.from(cell.querySelectorAll<HTMLElement>(focusableSelector)).filter((el) => isElementVisible(el));
          const idx = Math.min(Math.max(0, pending.desired.subIndex), Math.max(0, focusables.length - 1));
          const target = focusables[idx] ?? null;
          if (target) {
            focusElement(target);
            return;
          }
        }
      }
    }

    const grid = buildGrid(table);
    if (grid.order.length === 0) return;

    const rowIdx = Math.min(Math.max(0, pending.desired.rowIndex), Math.max(0, grid.cellFocusables.length - 1));
    const row = grid.cellFocusables[rowIdx] ?? [];
    const target = findInRow(row, pending.desired.colIndex, pending.desired.subIndex);
    if (!target) return;
    focusElement(target);
  });
};

type TableGrid = Readonly<{
  order: readonly HTMLElement[];
  cellFocusables: ReadonlyArray<ReadonlyArray<ReadonlyArray<HTMLElement>>>;
  rowIds: readonly (string | null)[];
}>;

const buildGrid = (table: HTMLTableElement): TableGrid => {
  const bodyRows = Array.from(table.querySelectorAll('tbody tr')).filter((row): row is HTMLTableRowElement => row instanceof HTMLTableRowElement);

  let maxColIndex = -1;
  for (const row of bodyRows) {
    const rowCells = Array.from(row.querySelectorAll('td,th')).filter(
      (cell): cell is HTMLTableCellElement => cell instanceof HTMLTableCellElement
    );
    for (const cell of rowCells) {
      maxColIndex = Math.max(maxColIndex, cell.cellIndex);
    }
  }

  const cellFocusables: Array<Array<Array<HTMLElement>>> = [];
  const order: HTMLElement[] = [];
  const rowIds: Array<string | null> = [];

  for (let rowIndex = 0; rowIndex < bodyRows.length; rowIndex += 1) {
    cellFocusables[rowIndex] = Array.from({ length: Math.max(0, maxColIndex + 1) }, () => []);

    const row = bodyRows[rowIndex];
    rowIds[rowIndex] = row.getAttribute('data-mineo-row-id');
    const rowCells = Array.from(row.querySelectorAll('td,th')).filter(
      (cell): cell is HTMLTableCellElement => cell instanceof HTMLTableCellElement
    );

    for (const cell of rowCells) {
      const focusables = Array.from(cell.querySelectorAll<HTMLElement>(focusableSelector)).filter((el) => isElementVisible(el));
      if (focusables.length === 0) continue;
      cellFocusables[rowIndex][cell.cellIndex] = focusables;
      order.push(...focusables);
    }
  }

  return { order, cellFocusables, rowIds };
};

const getActiveLocator = (table: HTMLTableElement, target: HTMLElement, grid: TableGrid): CellLocator | null => {
  const focusableTarget =
    (target.closest(focusableSelector) as HTMLElement | null) ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);

  const cell = (focusableTarget ?? target).closest('td,th') as HTMLTableCellElement | null;
  if (!cell) return null;
  const row = cell.closest('tr') as HTMLTableRowElement | null;
  if (!row) return null;
  const tbody = row.closest('tbody');
  if (!tbody || !table.contains(tbody)) return null;

  const bodyRows = Array.from(table.querySelectorAll('tbody tr')).filter((r): r is HTMLTableRowElement => r instanceof HTMLTableRowElement);
  const rowIndex = bodyRows.indexOf(row);
  if (rowIndex < 0) return null;

  const colIndex = cell.cellIndex;
  const cellItems = grid.cellFocusables[rowIndex]?.[colIndex] ?? [];
  const rowId = grid.rowIds[rowIndex] ?? null;
  if (cellItems.length === 0) return { rowIndex, colIndex, subIndex: 0, ...(rowId ? { rowId } : {}) };

  const resolvedFocusable =
    cellItems.includes(focusableTarget as HTMLElement) ? (focusableTarget as HTMLElement) : cellItems.find((el) => el.contains(focusableTarget ?? target));

  const subIndex = resolvedFocusable ? Math.max(0, cellItems.indexOf(resolvedFocusable)) : 0;
  return { rowIndex, colIndex, subIndex, ...(rowId ? { rowId } : {}) };
};

const pickFromCell = (cell: readonly HTMLElement[], preferredSubIndex: number): HTMLElement | null => {
  if (cell.length === 0) return null;
  return cell[Math.min(Math.max(0, preferredSubIndex), cell.length - 1)] ?? null;
};

const findInRow = (gridRow: ReadonlyArray<ReadonlyArray<HTMLElement>>, preferredColIndex: number, subIndex: number): HTMLElement | null => {
  const directCell = gridRow[preferredColIndex] ?? [];
  const direct = pickFromCell(directCell, subIndex);
  if (direct) return direct;

  for (let colIndex = preferredColIndex + 1; colIndex < gridRow.length; colIndex += 1) {
    const candidate = pickFromCell(gridRow[colIndex] ?? [], subIndex);
    if (candidate) return candidate;
  }
  for (let colIndex = preferredColIndex - 1; colIndex >= 0; colIndex -= 1) {
    const candidate = pickFromCell(gridRow[colIndex] ?? [], subIndex);
    if (candidate) return candidate;
  }
  return null;
};

const _moveRowMajor = (grid: TableGrid, activeEl: HTMLElement, delta: number) => {
  const { order } = grid;
  if (order.length === 0) return;

  const currentIndex = order.indexOf(activeEl);
  if (currentIndex < 0) return;

  const nextIndex = (currentIndex + delta + order.length) % order.length;
  focusElement(order[nextIndex]);
};

const moveVertical = (grid: TableGrid, base: CellLocator, deltaRows: number) => {
  const rowCount = grid.cellFocusables.length;
  if (rowCount === 0) return;

  const nextRowIndex = (base.rowIndex + deltaRows + rowCount) % rowCount;
  const nextRow = grid.cellFocusables[nextRowIndex] ?? [];
  const target = findInRow(nextRow, base.colIndex, base.subIndex);
  if (!target) return;
  focusElement(target);
};

const pickVerticalTarget = (
  grid: TableGrid,
  base: CellLocator,
  deltaRows: number
): Readonly<{ nextRowIndex: number; nextRowId: string | null; target: HTMLElement | null }> => {
  const rowCount = grid.cellFocusables.length;
  if (rowCount === 0) return { nextRowIndex: base.rowIndex, nextRowId: null, target: null };
  const nextRowIndex = (base.rowIndex + deltaRows + rowCount) % rowCount;
  const nextRow = grid.cellFocusables[nextRowIndex] ?? [];
  const target = findInRow(nextRow, base.colIndex, base.subIndex);
  return { nextRowIndex, nextRowId: grid.rowIds[nextRowIndex] ?? null, target };
};

export const clearTableTabAnchor = (table: HTMLTableElement) => {
  tabAnchorByTable.delete(table);
};

const isPrintableCharacterKey = (e: React.KeyboardEvent): boolean => {
  if (shouldIgnoreKey(e)) return false;
  return e.key.length === 1;
};

const isSameCell = (a: Readonly<{ rowId: string; colIndex: number }> | null, b: Readonly<{ rowId: string; colIndex: number }> | null): boolean => {
  if (!a || !b) return false;
  return a.rowId === b.rowId && a.colIndex === b.colIndex;
};

const toCellCoord = (locator: CellLocator): Readonly<{ rowId: string; colIndex: number }> | null => {
  if (!locator.rowId) return null;
  return { rowId: locator.rowId, colIndex: locator.colIndex };
};

export const handleTableFocusCapture = (e: React.FocusEvent<HTMLTableElement>) => {
  const table = e.currentTarget;
  const target = e.target instanceof HTMLElement ? e.target : null;
  if (!target) return;
  if (!table.contains(target)) return;

  const core = getGridCoreForTable(table);
  if (!core) return;

  const grid = buildGrid(table);
  if (grid.order.length === 0) return;
  const locator = getActiveLocator(table, target, grid);
  if (!locator) return;

  const cell = toCellCoord(locator);
  if (!cell) return;

  core.setFocusedCell(cell);
};

export const handleTableKeyDownCapture = (e: React.KeyboardEvent<HTMLTableElement>) => {
  if (e.defaultPrevented) return;

  const key = e.key;
  const isNavigationKey = key === 'Tab' || key === 'Enter' || key === 'ArrowUp' || key === 'ArrowDown' || key === 'ArrowLeft' || key === 'ArrowRight';
  const isDeleteKey = key === 'Backspace' || key === 'Delete';
  const isEscapeKey = key === 'Escape';
  const isPrintableKey = isPrintableCharacterKey(e);
  if (!isNavigationKey && !isDeleteKey && !isEscapeKey && !isPrintableKey) return;

  const table = e.currentTarget;
  const target = e.target instanceof HTMLElement ? e.target : null;
  if (!target) return;
  if (!table.contains(target)) return;

  const grid = buildGrid(table);
  if (grid.order.length === 0) return;

  const activePos = getActiveLocator(table, target, grid);
  if (!activePos) return;

  const widgetIsExpanded = getNearestExpanded(target);
  // When a popup widget is expanded/open, do not interfere with its internal keyboard handling.
  if (widgetIsExpanded) return;

  const core = getGridCoreForTable(table);
  const activeCell = toCellCoord(activePos);
  const activeEditableCell = core && activeCell ? core.getEditor(activeCell) : null;
  const isLocked = activeEditableCell?.getIsLocked() === true;
  const isEditing = core && activeCell ? isSameCell(core.getEditingCell(), activeCell) : false;

  if (isEscapeKey && isEditing && activeEditableCell) {
    e.preventDefault();
    e.stopPropagation();
    activeEditableCell.cancelEdit();
    // Fokus-plan: Behold fokus på samme celle efter Escape
    if (core && activeCell) {
      core.requestFocusPlan({ from: activeCell, to: activeCell, reason: 'commit' });
    }
    return;
  }

  // TableDropdown: keep its existing keyboard contract (Enter opens, Delete clears when allowed).
  if (target.closest('[data-mineo-table-dropdown="true"]')) {
    if (!isNavigationKey) return;
  }

  if (isDeleteKey && !isEditing && activeEditableCell && !isLocked) {
    e.preventDefault();
    e.stopPropagation();
    // Fokus-plan: Behold fokus p† samme celle efter Delete
    if (core && activeCell) {
      core.requestFocusPlan({ from: activeCell, to: activeCell, reason: 'commit' });
    }
    activeEditableCell.clearAndCommit();
    core?.executeFocusPlan();
    return;
  }

  if (isPrintableKey && !isEditing && activeEditableCell && !isLocked) {
    const accepted = activeEditableCell.prepareEditFromKey(e.key);
    if (!accepted) return;
    e.preventDefault();
    e.stopPropagation();
    core?.openEditing(activeCell!, 'key');
    return;
  }

  if (!isNavigationKey) return;
  if (shouldIgnoreKey(e)) return;

  // TableDropdown: Enter should always open the dropdown menu (never trigger table-level Enter navigation).
  // Contract: `TableDropdown` marks its wrapper with `data-mineo-table-dropdown="true"`.
  // See `src/components/inputs/table/TableDropdown.tsx`.
  if (key === 'Enter' && target.closest('[data-mineo-table-dropdown="true"]')) {
    return;
  }

  const activeFocusable =
    (target.closest(focusableSelector) as HTMLElement | null) ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);

  if (key === 'Tab') {
    tabAnchorByTable.delete(table);
    return;
  }

  if (key === 'Enter') {
    const anchor = tabAnchorByTable.get(table);
    const base: CellLocator = anchor ? { ...activePos, colIndex: anchor.colIndex, subIndex: anchor.subIndex } : activePos;
    e.preventDefault();
    e.stopPropagation();
    const deltaRows = e.shiftKey ? -1 : 1;
    const { nextRowIndex, nextRowId, target } = pickVerticalTarget(grid, base, deltaRows);
    const targetLocator = { rowIndex: nextRowIndex, colIndex: base.colIndex, subIndex: base.subIndex, ...(nextRowId ? { rowId: nextRowId } : {}) };
    const targetCell = toCellCoord(targetLocator);
    if (core && activeCell && targetCell) {
      core.requestFocusPlan({ from: activeCell, to: targetCell, reason: 'enter' });
    }
    moveVertical(grid, base, deltaRows);
    scheduleFocusRecovery(table, targetLocator, target);
    tabAnchorByTable.delete(table);
    return;
  }

  if (key === 'ArrowUp' || key === 'ArrowDown') {
    e.preventDefault();
    e.stopPropagation();
    tabAnchorByTable.delete(table);
    const deltaRows = key === 'ArrowUp' ? -1 : 1;
    const { nextRowIndex, nextRowId, target } = pickVerticalTarget(grid, activePos, deltaRows);
    const targetLocator = { rowIndex: nextRowIndex, colIndex: activePos.colIndex, subIndex: activePos.subIndex, ...(nextRowId ? { rowId: nextRowId } : {}) };
    const targetCell = toCellCoord(targetLocator);
    if (core && activeCell && targetCell) {
      core.requestFocusPlan({ from: activeCell, to: targetCell, reason: 'arrow' });
    }
    moveVertical(grid, activePos, deltaRows);
    scheduleFocusRecovery(table, targetLocator, target);
  }

  // ArrowLeft/ArrowRight navigation (kun når !isEditing)
  // STOP-adfærd: Stopper ved rækkegrænser og låste celler (Excel-stil)
  if ((key === 'ArrowLeft' || key === 'ArrowRight') && !isEditing) {
    e.preventDefault();
    e.stopPropagation();

    const delta = key === 'ArrowRight' ? 1 : -1;

    if (activeFocusable) {
      const currentIndex = grid.order.indexOf(activeFocusable);
      if (currentIndex < 0) return;

      // KRITISK: Find næste celle i SAMME RÆKKE (ikke wrap til næste række)
      const currentRow = activePos.rowIndex;
      const nextIndex = currentIndex + delta;

      // STOP ved grid-kant (Excel-adfærd)
      if (nextIndex < 0 || nextIndex >= grid.order.length) {
        return; // Ingen navigation hvis vi er ved kanten
      }

      const nextEl = grid.order[nextIndex];
      const nextLocator = getActiveLocator(table, nextEl, grid);

      // Verificer at vi stadig er i samme række
      if (!nextLocator || nextLocator.rowIndex !== currentRow) {
        return; // Stop hvis vi ville skifte række
      }

      // STOP ved låste celler (forudsigeligt i tillidskritisk værktøj)
      const nextCell = toCellCoord(nextLocator);
      if (!nextCell) return;
      const nextHandle = core?.getEditor(nextCell);
      if (nextHandle?.getIsLocked()) {
        return; // Stop ved låste celler
      }

      // Udfør navigation
      if (core && activeCell && nextCell) {
        core.requestFocusPlan({ from: activeCell, to: nextCell, reason: 'arrow' });
      }
      nextEl.focus();
      scheduleFocusRecovery(table, nextLocator, nextEl);
    }
    return;
  }
};

export const handleTablePointerDownCapture = (e: React.PointerEvent<HTMLTableElement>) => {
  const table = e.currentTarget;
  tabAnchorByTable.delete(table);
  pendingRecoveryByTable.delete(table);

  const core = getGridCoreForTable(table);
  if (!core) return;

  const target = e.target instanceof HTMLElement ? e.target : null;
  if (!target) return;
  if (!table.contains(target)) return;
  if (target.closest('[data-mineo-table-dropdown="true"]')) return;

  const grid = buildGrid(table);
  if (grid.order.length === 0) return;
  const locator = getActiveLocator(table, target, grid);
  if (!locator) return;
  const cell = toCellCoord(locator);
  if (!cell) return;

  const focused = core.getFocusedCell();
  const editing = core.getEditingCell();
  if (isSameCell(focused, cell) && !isSameCell(editing, cell)) {
    core.openEditing(cell, 'pointer');
  }
};

export const handleTableBlurCapture = (e: React.FocusEvent<HTMLTableElement>) => {
  const table = e.currentTarget;

  const core = getGridCoreForTable(table);
  if (core) {
    const target = e.target instanceof HTMLElement ? e.target : null;
    if (target && table.contains(target)) {
      const grid = buildGrid(table);
      const locator = getActiveLocator(table, target, grid);
        if (locator) {
          const cell = toCellCoord(locator);
          if (cell && isSameCell(core.getEditingCell(), cell)) {
            // Close editor state *after* input onBlur has had a chance to commit.
            // Sync close in capture-phase can overwrite the live draft before commit on click-outside.
            queueMicrotask(() => {
              if (isSameCell(core.getEditingCell(), cell)) {
                core.setEditingCell(null);
              }
            });
          }
        }
      }
    }

  const related = e.relatedTarget;
  if (related instanceof Node && table.contains(related)) return;
  tabAnchorByTable.delete(table);
};

export const handleTableDoubleClickCapture = (e: React.MouseEvent<HTMLTableElement>) => {
  const table = e.currentTarget;
  const target = e.target instanceof HTMLElement ? e.target : null;
  if (!target) return;
  if (!table.contains(target)) return;
  if (target.closest('[data-mineo-table-dropdown="true"]')) return;

  const core = getGridCoreForTable(table);
  if (!core) return;
  const grid = buildGrid(table);
  if (grid.order.length === 0) return;
  const locator = getActiveLocator(table, target, grid);
  if (!locator) return;
  const cell = toCellCoord(locator);
  if (!cell) return;
  core.openEditing(cell, 'doubleClick');
};

