import type * as React from 'react';
import { getGridCoreForTable } from './gridCoreRegistry';
import { getWrappedNextColumn } from './tableNavigationCommon';
import { focusTableElement, isTableElementVisible, TABLE_FOCUSABLE_SELECTOR } from './tableFocusHelpers';

type CellLocator = Readonly<{ rowIndex: number; colIndex: number; subIndex: number; rowId?: string }>;

// Normativ UX-regel:
// Tab-sekvensen har et "startcelle-anker".
// Enter/Shift+Enter skal navigere vertikalt ud fra denne startcelle,
// ikke fra den celle der aktuelt har fokus ved Enter-tryk.
type TabAnchor = CellLocator;

const tabAnchorByTable = new WeakMap<HTMLTableElement, TabAnchor>();
const pendingRecoveryByTable = new WeakMap<HTMLTableElement, Readonly<{ desired: CellLocator }>>();
const CONTAINER_ROW_SELECTOR =
  '.row--label-right-hover,.row--label-right,.row--label-offset,.row,[class*="row--label-right"],[class*="row--label-offset"],[class*="hover-row"]';
const CONTAINER_FOCUSABLE_SELECTOR =
  'input[role="combobox"]:not([disabled]):not([tabindex="-1"]):not([type="hidden"]):not([type="button"]),' +
  'input:not([disabled]):not([tabindex="-1"]):not([type="hidden"]):not([type="button"]),' +
  'select:not([disabled]):not([tabindex="-1"]),' +
  'textarea:not([disabled]):not([tabindex="-1"]),' +
  'button[data-mineo-focusable-button="true"]:not([tabindex="-1"]),' +
  '[role="combobox"][tabindex]:not([tabindex="-1"]):not([aria-disabled="true"]),' +
  '[aria-haspopup][tabindex]:not([tabindex="-1"]):not([aria-disabled="true"]),' +
  '[aria-controls][tabindex]:not([tabindex="-1"]):not([aria-disabled="true"])';

// Navigation semantics (owned by this module):
// - Enter / Shift+Enter: move vertically while keeping the "anchor cell" if one exists; otherwise use current cell.
// - ArrowUp/ArrowDown: move vertically from the current cell (clears the anchor).
//   - At table top/bottom edge, event is intentionally released so Container can continue navigation outside the table.
// - ArrowLeft/ArrowRight: move horizontally within the current row and wrap at row edges.
// Note: We `stopPropagation()` for owned keys so the Container-level Tab trap does not also run.
// Tab is NOT owned here; it is handled by Container-level navigation for natural flow across tables.

const isComposing = (e: React.KeyboardEvent): boolean => {
  const native = e.nativeEvent as unknown as { isComposing?: boolean };
  return native.isComposing === true;
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

const isTableDropdownExpanded = (target: HTMLElement | null): boolean => {
  if (!target) return false;
  const dropdownHost = target.closest('[data-mineo-table-dropdown="true"]') as HTMLElement | null;
  if (!dropdownHost) return false;

  const trigger = dropdownHost.querySelector('[role="combobox"],[aria-haspopup],[aria-controls]') as HTMLElement | null;
  if (!trigger) return false;
  if (trigger.getAttribute('aria-expanded') === 'true') return true;

  const controlsId = trigger.getAttribute('aria-controls');
  if (!controlsId) return false;
  const controlled = document.getElementById(controlsId);
  if (!(controlled instanceof HTMLElement)) return false;
  if (controlled.hasAttribute('hidden')) return false;
  if (controlled.getAttribute('aria-hidden') === 'true') return false;
  const style = window.getComputedStyle(controlled);
  if (style.display === 'none' || style.visibility === 'hidden') return false;
  return true;
};

const shouldIgnoreKey = (e: React.KeyboardEvent): boolean => {
  if (e.ctrlKey || e.metaKey || e.altKey) return true;
  if (isComposing(e)) return true;
  return false;
};

const scheduleFocusRecovery = (table: HTMLTableElement, desired: CellLocator) => {
  pendingRecoveryByTable.set(table, { desired });
  requestAnimationFrame(() => {
    const pending = pendingRecoveryByTable.get(table);
    if (!pending) return;
    pendingRecoveryByTable.delete(table);

    const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (active && table.contains(active)) return;

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
          const focusables = Array.from(cell.querySelectorAll<HTMLElement>(TABLE_FOCUSABLE_SELECTOR)).filter((el) => isTableElementVisible(el));
          const idx = Math.min(Math.max(0, pending.desired.subIndex), Math.max(0, focusables.length - 1));
          const target = focusables[idx] ?? null;
          if (target) {
            focusTableElement(target);
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
    focusTableElement(target);
  });
};

type TableGrid = Readonly<{
  order: readonly HTMLElement[];
  cellFocusables: ReadonlyArray<ReadonlyArray<ReadonlyArray<HTMLElement>>>;
  rowIds: readonly (string | null)[];
}>;

type OutsideFocusRow = Readonly<{
  top: number;
  elements: readonly HTMLElement[];
}>;

const moveFocusOutsideTable = (
  table: HTMLTableElement,
  fromElement: HTMLElement,
  direction: 'up' | 'down'
): boolean => {
  const scrollContainer = table.closest('[data-mineo-scroll-container="true"]');
  if (!(scrollContainer instanceof HTMLElement)) return false;

  const focusables = Array.from(scrollContainer.querySelectorAll<HTMLElement>(CONTAINER_FOCUSABLE_SELECTOR))
    .filter((el) => isTableElementVisible(el))
    .filter((el) => !table.contains(el));
  if (focusables.length === 0) return false;

  const visualRowTolerancePx = 8;
  const rectByElement = new Map<HTMLElement, DOMRect>();
  const getRect = (element: HTMLElement): DOMRect => {
    const cached = rectByElement.get(element);
    if (cached) return cached;
    const rect = element.getBoundingClientRect();
    rectByElement.set(element, rect);
    return rect;
  };

  const sortByHorizontalPosition = (items: readonly HTMLElement[]): HTMLElement[] => {
    return items
      .slice()
      .sort((a, b) => {
        const aRect = getRect(a);
        const bRect = getRect(b);
        if (aRect.left !== bRect.left) return aRect.left - bRect.left;
        return aRect.top - bRect.top;
      });
  };

  const rowsByContainer = new Map<HTMLElement, HTMLElement[]>();
  const rowsWithoutContainer: Array<{ top: number; elements: HTMLElement[] }> = [];

  for (const element of focusables) {
    const rowContainer = element.closest(CONTAINER_ROW_SELECTOR);
    if (rowContainer instanceof HTMLElement && scrollContainer.contains(rowContainer)) {
      if (!rowsByContainer.has(rowContainer)) {
        rowsByContainer.set(rowContainer, []);
      }
      rowsByContainer.get(rowContainer)?.push(element);
      continue;
    }

    const top = getRect(element).top;
    const existing = rowsWithoutContainer.find((row) => Math.abs(row.top - top) <= visualRowTolerancePx);
    if (existing) {
      existing.elements.push(element);
    } else {
      rowsWithoutContainer.push({ top, elements: [element] });
    }
  }

  const rows: OutsideFocusRow[] = [
    ...Array.from(rowsByContainer.entries()).map(([container, elements]) => ({
      top: container.getBoundingClientRect().top,
      elements: sortByHorizontalPosition(elements),
    })),
    ...rowsWithoutContainer.map((row) => ({
      top: row.top,
      elements: sortByHorizontalPosition(row.elements),
    })),
  ]
    .filter((row) => row.elements.length > 0)
    .sort((a, b) => a.top - b.top);

  if (rows.length === 0) return false;

  const activeTop = fromElement.getBoundingClientRect().top;
  const targetRow = direction === 'down'
    ? rows.find((row) => row.top > activeTop + visualRowTolerancePx) ?? rows[0]
    : [...rows].reverse().find((row) => row.top < activeTop - visualRowTolerancePx) ?? rows[rows.length - 1];
  if (!targetRow) return false;

  const target = direction === 'down'
    ? targetRow.elements[0]
    : targetRow.elements[targetRow.elements.length - 1];
  if (!target) return false;

  focusTableElement(target);
  requestAnimationFrame(() => {
    const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (active && !table.contains(active)) return;
    focusTableElement(target);
  });
  return true;
};

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
      const focusables = Array.from(cell.querySelectorAll<HTMLElement>(TABLE_FOCUSABLE_SELECTOR)).filter((el) => isTableElementVisible(el));
      if (focusables.length === 0) continue;
      cellFocusables[rowIndex][cell.cellIndex] = focusables;
      order.push(...focusables);
    }
  }

  return { order, cellFocusables, rowIds };
};

const getActiveLocator = (table: HTMLTableElement, target: HTMLElement, grid: TableGrid): CellLocator | null => {
  const focusableTarget =
    (target.closest(TABLE_FOCUSABLE_SELECTOR) as HTMLElement | null) ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);

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

const moveVertical = (grid: TableGrid, base: CellLocator, deltaRows: number) => {
  const rowCount = grid.cellFocusables.length;
  if (rowCount === 0) return;

  const nextRowIndex = (base.rowIndex + deltaRows + rowCount) % rowCount;
  const nextRow = grid.cellFocusables[nextRowIndex] ?? [];
  const target = findInRow(nextRow, base.colIndex, base.subIndex);
  if (!target) return;
  focusTableElement(target);
};

const resolveAnchorLocator = (grid: TableGrid, anchor: TabAnchor, fallback: CellLocator): CellLocator => {
  const rowCount = grid.cellFocusables.length;
  if (rowCount === 0) return fallback;

  // Row-id prioriteres, så ankeret bevares stabilt selv ved rækkeflyt/normalisering.
  if (anchor.rowId) {
    const rowIndex = grid.rowIds.indexOf(anchor.rowId);
    if (rowIndex >= 0) {
      return { ...anchor, rowIndex };
    }
  }

  const clampedRowIndex = Math.min(Math.max(0, anchor.rowIndex), rowCount - 1);
  const rowId = grid.rowIds[clampedRowIndex] ?? undefined;
  return { ...anchor, rowIndex: clampedRowIndex, ...(rowId ? { rowId } : {}) };
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

const pickHorizontalTarget = (
  grid: TableGrid,
  base: CellLocator,
  direction: -1 | 1,
  core: ReturnType<typeof getGridCoreForTable>
): Readonly<{ locator: CellLocator; target: HTMLElement | null }> | null => {
  const row = grid.cellFocusables[base.rowIndex] ?? [];
  const selectableCols = row
    .map((cell, colIndex) => ({ cell, colIndex }))
    .filter((entry) => entry.cell.length > 0)
    .map((entry) => entry.colIndex);

  if (selectableCols.length <= 1) return null;

  const nextCol = getWrappedNextColumn(selectableCols, base.colIndex, direction, (candidateCol) => {
    const locator: CellLocator = {
      rowIndex: base.rowIndex,
      colIndex: candidateCol,
      subIndex: base.subIndex,
      ...(grid.rowIds[base.rowIndex] ? { rowId: grid.rowIds[base.rowIndex] ?? undefined } : {}),
    };
    const nextCell = toCellCoord(locator);
    if (!nextCell) return false;
    const nextHandle = core?.getEditor(nextCell);
    return nextHandle?.getIsLocked() !== true;
  });
  if (nextCol === null) return null;

  const cell = row[nextCol] ?? [];
  if (cell.length === 0) return null;

  const subIndex = Math.min(Math.max(0, base.subIndex), cell.length - 1);
  const locator: CellLocator = {
    rowIndex: base.rowIndex,
    colIndex: nextCol,
    subIndex,
    ...(grid.rowIds[base.rowIndex] ? { rowId: grid.rowIds[base.rowIndex] ?? undefined } : {}),
  };

  return { locator, target: cell[subIndex] ?? null };
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

  const widgetIsExpanded = getNearestExpanded(target) || isTableDropdownExpanded(target);
  // When a popup widget is expanded/open, do not interfere with its internal keyboard handling.
  if (widgetIsExpanded) return;

  const core = getGridCoreForTable(table);
  const activeCell = toCellCoord(activePos);
  const activeEditableCell = core && activeCell ? core.getEditor(activeCell) : null;
  const isLocked = activeEditableCell?.getIsLocked() === true;
  const isEditing = core && activeCell ? isSameCell(core.getEditingCell(), activeCell) : false;

  const isTableDropdownTarget = target.closest('[data-mineo-table-dropdown="true"]') !== null;
  if (isTableDropdownTarget && key === 'Enter') return;

  if (isEscapeKey && isEditing && activeEditableCell) {
    e.preventDefault();
    e.stopPropagation();
    tabAnchorByTable.delete(table);
    core?.clearFocusPlan();
    if (core && activeCell) {
      core.setFocusedCell(activeCell);
    }
    activeEditableCell.cancelEdit();
    return;
  }

  // TableDropdown: keep its existing keyboard contract (Enter opens, Delete clears when allowed).
  if (isTableDropdownTarget) {
    if (!isNavigationKey && !isDeleteKey) return;
  }

  if (isDeleteKey && !isEditing && activeEditableCell && !isLocked) {
    e.preventDefault();
    e.stopPropagation();
    // Fokus-plan: Behold fokus på samme celle efter Delete
    if (core && activeCell) {
      core.requestFocusPlan({ from: activeCell, to: activeCell, reason: 'commit' });
    }
    activeEditableCell.clearAndCommit();
    core?.executeFocusPlan();
    scheduleFocusRecovery(table, activePos);
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

  const activeFocusable =
    (target.closest(TABLE_FOCUSABLE_SELECTOR) as HTMLElement | null) ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);

  if (key === 'Tab') {
    // Bevar første celle i en sammenhængende Tab-sekvens som anker ("first Tab wins").
    // Vi opdaterer ikke ankeret på efterfølgende Tab-tryk i samme sekvens.
    if (!tabAnchorByTable.has(table)) {
      tabAnchorByTable.set(table, activePos);
    }
    return;
  }

  if (key === 'Enter') {
    const anchor = tabAnchorByTable.get(table);
    const base: CellLocator = anchor ? resolveAnchorLocator(grid, anchor, activePos) : activePos;
    e.preventDefault();
    e.stopPropagation();
    const deltaRows = e.shiftKey ? -1 : 1;
    const { nextRowIndex, nextRowId } = pickVerticalTarget(grid, base, deltaRows);
    const targetLocator = { rowIndex: nextRowIndex, colIndex: base.colIndex, subIndex: base.subIndex, ...(nextRowId ? { rowId: nextRowId } : {}) };
    const targetCell = toCellCoord(targetLocator);
    if (core && activeCell && targetCell) {
      core.requestFocusPlan({ from: activeCell, to: targetCell, reason: 'enter' });
    }
    moveVertical(grid, base, deltaRows);
    scheduleFocusRecovery(table, targetLocator);
    // Enter fuldfører tab-anker-navigation og skal altid nulstille ankeret.
    tabAnchorByTable.delete(table);
    return;
  }

  if (key === 'ArrowUp' || key === 'ArrowDown') {
    const rowCount = grid.cellFocusables.length;
    const atTopEdge = key === 'ArrowUp' && activePos.rowIndex === 0;
    const atBottomEdge = key === 'ArrowDown' && activePos.rowIndex === Math.max(0, rowCount - 1);

    // Release edge arrows so Container can continue navigation outside the table.
    if (atTopEdge || atBottomEdge) {
      const nativeEvent = e.nativeEvent as unknown as { mineoTableBoundaryExit?: boolean };
      nativeEvent.mineoTableBoundaryExit = true;
      e.preventDefault();
      tabAnchorByTable.delete(table);
      if (activeFocusable) {
        const movedOutsideTable = moveFocusOutsideTable(table, activeFocusable, key === 'ArrowUp' ? 'up' : 'down');
        if (movedOutsideTable) {
          e.stopPropagation();
        }
      }
      return;
    }

    tabAnchorByTable.delete(table);
    e.preventDefault();
    e.stopPropagation();
    const deltaRows = key === 'ArrowUp' ? -1 : 1;
    const { nextRowIndex, nextRowId } = pickVerticalTarget(grid, activePos, deltaRows);
    const targetLocator = { rowIndex: nextRowIndex, colIndex: activePos.colIndex, subIndex: activePos.subIndex, ...(nextRowId ? { rowId: nextRowId } : {}) };
    const targetCell = toCellCoord(targetLocator);
    if (core && activeCell && targetCell) {
      core.requestFocusPlan({ from: activeCell, to: targetCell, reason: 'arrow' });
    }
    moveVertical(grid, activePos, deltaRows);
    scheduleFocusRecovery(table, targetLocator);
    return;
  }

  // ArrowLeft/ArrowRight in editor mode belongs to caret movement and must not clear the Tab-anchor.
  if (key === 'ArrowLeft' || key === 'ArrowRight') {
    if (isEditing) return;
  }

  // ArrowLeft/ArrowRight navigation (kun når !isEditing)
  // Wrap-adfærd: Når kanten nås, hop til modsatte ende i samme række.
  if ((key === 'ArrowLeft' || key === 'ArrowRight') && !isEditing) {
    e.preventDefault();
    e.stopPropagation();
    tabAnchorByTable.delete(table);

    if (!activeFocusable) return;
    const direction: -1 | 1 = key === 'ArrowRight' ? 1 : -1;
    const next = pickHorizontalTarget(grid, activePos, direction, core);
    if (!next?.target) return;

    const nextCell = toCellCoord(next.locator);
    if (core && activeCell && nextCell) {
      core.requestFocusPlan({ from: activeCell, to: nextCell, reason: 'arrow' });
    }
    next.target.focus();
    scheduleFocusRecovery(table, next.locator);
    return;
  }

  tabAnchorByTable.delete(table);
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

  const activeElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const activeLocator = activeElement && table.contains(activeElement) ? getActiveLocator(table, activeElement, grid) : null;
  const activeCell = activeLocator ? toCellCoord(activeLocator) : null;
  const editing = core.getEditingCell();
  if (isSameCell(activeCell, cell) && !isSameCell(editing, cell)) {
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
          // Invariant: queueMicrotask ensures input onBlur runs first (while isEditing is still true).
          // Do NOT make this synchronous/flushSync; it would break commit-on-blur and can overwrite drafts.
          // Decision note: this microtask is an infrastructure exception to the normal form rule.
          // Reason: table blur-capture must defer editor shutdown until the cell input's own blur-commit
          // has completed, otherwise valid committed input can be lost.
          // Risk: widening this pattern outside grid infrastructure would reintroduce hidden commit timing.
          // Re-evaluate when: grid-core can express "blur finished" synchronously without microtask ordering.
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
