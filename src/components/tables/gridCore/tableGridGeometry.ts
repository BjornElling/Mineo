import { getGridCoreForTable } from './gridCoreRegistry';
import { getWrappedNextColumn } from './tableNavigationCommon';
import { isTableElementVisible, TABLE_FOCUSABLE_SELECTOR } from './tableFocusHelpers';

/**
 * Rene geometri-/target-picker-funktioner for grid-tabel-navigation.
 *
 * Adskilt fra `tableKeyboardNavigation.ts` (event-handlerne + den modul-globale fokus-state):
 * intet her rører WeakMap-state, focus eller events — funktionerne bygger en grid-model af
 * DOM'en og udvælger navigationsmål deterministisk ud fra den. Det holder den store
 * handler-fil fokuseret på event-flow og gør target-pickerne enheds-testbare i isolation.
 */

export type CellLocator = Readonly<{ rowIndex: number; colIndex: number; subIndex: number; rowId?: string }>;

export type TableGrid = Readonly<{
  order: readonly HTMLElement[];
  cellFocusables: ReadonlyArray<ReadonlyArray<ReadonlyArray<HTMLElement>>>;
  rowIds: readonly (string | null)[];
}>;

type GridCore = ReturnType<typeof getGridCoreForTable>;

export const buildGrid = (table: HTMLTableElement): TableGrid => {
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

export const getActiveLocator = (table: HTMLTableElement, target: HTMLElement, grid: TableGrid): CellLocator | null => {
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

export const findInRow = (gridRow: ReadonlyArray<ReadonlyArray<HTMLElement>>, preferredColIndex: number, subIndex: number): HTMLElement | null => {
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

// En celle er valgbar som navigationsmål, hvis dens editor ikke er låst. Låste (skrivebeskyttede)
// celler springes over ved BÅDE horisontal og vertikal navigation (brugervalg 2026-06-14), så
// piletaster aldrig lander på en celle, brugeren ikke kan redigere.
const isColumnUnlockedInRow = (grid: TableGrid, rowIndex: number, colIndex: number, core: GridCore): boolean => {
  if (!core) return true;
  const rowId = grid.rowIds[rowIndex];
  if (!rowId) return true;
  return core.getEditor({ rowId, colIndex })?.getIsLocked() !== true;
};

// Lock-aware variant af findInRow til VERTIKAL navigation: finder en fokuserbar, ikke-låst celle i
// rækken (foretrukken kolonne først, derefter nærmeste til højre/venstre) og returnerer både
// elementet og dets faktiske kolonne, så fokus-plan/-recovery registrerer den rigtige celle.
const findSelectableInRow = (
  grid: TableGrid,
  rowIndex: number,
  preferredColIndex: number,
  subIndex: number,
  core: GridCore
): Readonly<{ target: HTMLElement; colIndex: number }> | null => {
  const gridRow = grid.cellFocusables[rowIndex] ?? [];
  const tryCol = (colIndex: number): Readonly<{ target: HTMLElement; colIndex: number }> | null => {
    const el = pickFromCell(gridRow[colIndex] ?? [], subIndex);
    if (!el) return null;
    if (!isColumnUnlockedInRow(grid, rowIndex, colIndex, core)) return null;
    return { target: el, colIndex };
  };
  const direct = tryCol(preferredColIndex);
  if (direct) return direct;
  for (let colIndex = preferredColIndex + 1; colIndex < gridRow.length; colIndex += 1) {
    const candidate = tryCol(colIndex);
    if (candidate) return candidate;
  }
  for (let colIndex = preferredColIndex - 1; colIndex >= 0; colIndex -= 1) {
    const candidate = tryCol(colIndex);
    if (candidate) return candidate;
  }
  return null;
};

export const resolveAnchorLocator = (grid: TableGrid, anchor: CellLocator, fallback: CellLocator): CellLocator => {
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

// Find næste vertikale navigationsmål i `deltaRows`-retning, idet rækker uden en valgbar (ikke-låst,
// fokuserbar) celle springes over. `allowWrap=true` (Enter) cirkulerer rundt; `allowWrap=false`
// (piletaster) stopper ved kanten, så kalderen kan udføre edge-exit til Container.
export const pickVerticalTarget = (
  grid: TableGrid,
  base: CellLocator,
  deltaRows: number,
  core: GridCore,
  allowWrap: boolean
): Readonly<{ nextRowIndex: number; nextRowId: string | null; colIndex: number; target: HTMLElement }> | null => {
  const rowCount = grid.cellFocusables.length;
  if (rowCount === 0) return null;
  for (let step = 1; step <= rowCount; step += 1) {
    let rowIndex = base.rowIndex + deltaRows * step;
    if (allowWrap) {
      rowIndex = ((rowIndex % rowCount) + rowCount) % rowCount;
      if (rowIndex === base.rowIndex) break;
    } else if (rowIndex < 0 || rowIndex >= rowCount) {
      break;
    }
    const found = findSelectableInRow(grid, rowIndex, base.colIndex, base.subIndex, core);
    if (found) {
      return { nextRowIndex: rowIndex, nextRowId: grid.rowIds[rowIndex] ?? null, colIndex: found.colIndex, target: found.target };
    }
  }
  return null;
};

export const pickHorizontalTarget = (
  grid: TableGrid,
  base: CellLocator,
  direction: -1 | 1,
  core: GridCore
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

export const isSameCell = (
  a: Readonly<{ rowId: string; colIndex: number }> | null,
  b: Readonly<{ rowId: string; colIndex: number }> | null
): boolean => {
  if (!a || !b) return false;
  return a.rowId === b.rowId && a.colIndex === b.colIndex;
};

export const toCellCoord = (locator: CellLocator): Readonly<{ rowId: string; colIndex: number }> | null => {
  if (!locator.rowId) return null;
  return { rowId: locator.rowId, colIndex: locator.colIndex };
};
