import { focusTableElement, isTableElementVisible, TABLE_FOCUSABLE_SELECTOR } from './tableFocusHelpers';

export type RowRemovalFocusPlan = Readonly<{
  // Kolonne-mapping er DOM-indeks-baseret og antager ingen colSpan-divergens mellem rækker.
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

type BuildCommitFocusPlanParams<TRow> = Readonly<{
  table: HTMLTableElement | null;
  prevRows: readonly TRow[];
  nextRows: readonly TRow[];
  rowId: string;
  colIndex: number;
  visibleRowIds: readonly string[];
  isRowEmpty: (row: TRow) => boolean;
  getRowId: (row: TRow) => string;
}>;

type EvaluateRowCommitParams<TRow> = BuildCommitFocusPlanParams<TRow> &
  Readonly<{
    getFingerprint: (rows: readonly TRow[]) => string;
    lastPersistedFingerprint: string | null;
  }>;

type EvaluateRowCommitResult = Readonly<{
  focusPlan: RowRemovalFocusPlan | null;
  shouldPersist: boolean;
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
 * Byg en fokus-plan til fjernelse af en række.
 *
 * Forudsætninger:
 * - `visibleRowIds` er den aktuelle (før-opdatering) DOM-rækkefølge af `<tr data-mineo-row-id>`.
 * - `prevRows` og `nextRows` repræsenterer den committede datamodel før/efter (ikke DOM).
 * - Anvend planen i en layout effect efter at DOM'en har renderet de næste rækker.
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
 * Byg en fokus-plan når en række bliver tom, men beholdes af tabel-normaliseringen
 * (fx min-row-politikken holder 2 rækker synlige).
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
 * Byg en fallback-fokus-plan til blur-commit-scenarier hvor `activeElement` allerede
 * kan være uden for tabellen, mens den committede række stadig fjernes.
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
 * Kanonisk tre-trins fokus-plan-kæde for række-commits:
 * 1) fjernelse af aktiv række, 2) blur-sikker fallback for fjernet række, 3) beholdt tom række.
 */
export const buildCommitFocusPlan = <TRow>(params: BuildCommitFocusPlanParams<TRow>): RowRemovalFocusPlan | null => {
  const { table, prevRows, nextRows, rowId, colIndex, visibleRowIds, isRowEmpty, getRowId } = params;

  let plan = buildRowRemovalFocusPlan({
    table,
    prevRows,
    nextRows,
    visibleRowIds,
    getRowId,
  });
  if (plan) return plan;

  plan = buildRemovedRowFallbackFocusPlan({
    prevRows,
    nextRows,
    rowId,
    colIndex,
    visibleRowIds,
    getRowId,
  });
  if (plan) return plan;

  return buildRetainedEmptyRowFocusPlan({
    table,
    prevRows,
    nextRows,
    rowId,
    colIndex,
    visibleRowIds,
    isRowEmpty,
    getRowId,
  });
};

/**
 * Fælles evaluering af udfaldet af et række-commit, brugt af flere tabeller:
 * - beregner kanonisk fokus-plan
 * - rapporterer om persistering skal køre (fingerprint-delta vs. sidst persisteret)
 */
export const evaluateRowCommit = <TRow>(params: EvaluateRowCommitParams<TRow>): EvaluateRowCommitResult => {
  const {
    table,
    prevRows,
    nextRows,
    rowId,
    colIndex,
    visibleRowIds,
    isRowEmpty,
    getRowId,
    getFingerprint,
    lastPersistedFingerprint,
  } = params;

  const focusPlan = buildCommitFocusPlan({
    table,
    prevRows,
    nextRows,
    rowId,
    colIndex,
    visibleRowIds,
    isRowEmpty,
    getRowId,
  });
  const nextFingerprint = getFingerprint(nextRows);
  return {
    focusPlan,
    shouldPersist: lastPersistedFingerprint !== nextFingerprint,
  };
};

/**
 * Anvend en tidligere beregnet fokus-plan.
 *
 * Forudsætninger:
 * - `visibleRowIds` er den aktuelle (efter-opdatering) DOM-rækkefølge af `<tr data-mineo-row-id>`.
 * - Tabellens DOM er committed (useLayoutEffect).
 */
export const applyRowRemovalFocusPlan = (params: ApplyPlanParams): void => {
  const { table, plan, visibleRowIds } = params;
  if (!table) return;

  // By design tvinger sletning af den sidste synlige række ikke et fallback-fokus-mål frem.
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
