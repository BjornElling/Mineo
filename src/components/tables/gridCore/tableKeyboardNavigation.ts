import type * as React from 'react';
import { getGridCoreForTable } from './gridCoreRegistry';
import {
  CONTAINER_FOCUSABLE_SELECTOR,
  CONTAINER_ROW_SELECTOR,
  focusTableElement,
  isTableElementVisible,
  markTableBoundaryExit,
  TABLE_FOCUSABLE_SELECTOR,
} from './tableFocusHelpers';
import { isInClosedPopupWidget, isPopupWidgetExpanded } from '../../inputs/popupWidgetSemantics';
import type { GridCellCoord } from './gridCoreTypes';
import {
  buildGrid,
  findInRow,
  getActiveLocator,
  isSameCell,
  pickHorizontalTarget,
  pickVerticalTarget,
  resolveAnchorLocator,
  toCellCoord,
  type CellLocator,
} from './tableGridGeometry';

// Normativ UX-regel:
// Tab-sekvensen har et "startcelle-anker".
// Enter/Shift+Enter skal navigere vertikalt ud fra denne startcelle,
// ikke fra den celle der aktuelt har fokus ved Enter-tryk.
type TabAnchor = CellLocator;

// Modul-lokal gestus-/navigations-state. BEMÆRK: ingen af disse spejler controller-state — de er
// rene UI-gestus-/traversals-data, der ikke har nogen pendant i `GridCoreController`:
// - `tabAnchorByTable`: "first-Tab-wins"-ankeret for Enter-vertikal-navigation.
// - `pendingRecoveryByTable`: transient RAF-fokus-recovery efter en nav-flytning.
// - `clickEditableCellByTable`: hvilken celle der er "armet" til to-trins-klik-redigering.
// - `pointerDownFocusedCellByTable`: pointerdown→click-bogføring for to-trins-klik.
// Den fokuserede celle ejes derimod af ÉN autoritet: `core.setFocusedCell`, sat fra
// `handleTableFocusCapture` når fysisk DOM-fokus lander (læses via `core.getFocusedCell()`).
const tabAnchorByTable = new WeakMap<HTMLTableElement, TabAnchor>();
const pendingRecoveryByTable = new WeakMap<HTMLTableElement, Readonly<{ desired: CellLocator }>>();
const clickEditableCellByTable = new WeakMap<HTMLTableElement, GridCellCoord>();
const pointerDownFocusedCellByTable = new WeakMap<HTMLTableElement, GridCellCoord>();

// Navigations-semantik (ejet af dette modul):
// - Enter / Shift+Enter: flyt vertikalt mens "anchor-cellen" bevares hvis den findes; ellers brug den aktuelle celle.
// - ArrowUp/ArrowDown: flyt vertikalt fra den aktuelle celle (rydder ankeret).
//   - Ved tabellens top-/bundkant frigives eventet bevidst, så Container kan fortsætte navigation uden for tabellen.
// - ArrowLeft/ArrowRight: flyt horisontalt inden for den aktuelle række og wrap ved rækkekanter.
// Bemærk: Vi kalder `stopPropagation()` for ejede taster, så Container-niveauets Tab-trap ikke også kører.
// Tab ejes IKKE her; den håndteres af navigation på Container-niveau for et naturligt flow på tværs af tabeller.

const isComposing = (e: React.KeyboardEvent): boolean => {
  const native = e.nativeEvent as unknown as { isComposing?: boolean };
  return native.isComposing === true;
};

// Popup-semantik (åben/lukket dropdown m.v.) ejes af `popupWidgetSemantics` — ét sted for både
// Container og grid-navigationen. Grid'et har derfor INGEN egen dropdown-klassifikation længere.

/**
 * Elementer, hvis pointer-interaktion IKKE er grid'ets: en popup-kontrol åbner/lukker selv sin menu, og
 * slet-række-knappen ligger uden for celle-navigationen. Grid'et må derfor ikke føre to-trins-
 * redigeringsbogføring (arm/openEditing) for dem — det ville åbne en "editor" for en kontrol, der ikke
 * har nogen. Samme klassifikation som Enter-grenen, så en dropdown ikke behandles forskelligt
 * afhængigt af eventtype (UT-F02, punkt 5).
 */
const ownsItsOwnPointerInteraction = (target: HTMLElement): boolean => {
  if (isInClosedPopupWidget(target)) return true;
  if (isPopupWidgetExpanded(target)) return true;
  return target.closest('[data-mineo-row-delete="true"]') !== null;
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

const isPrintableCharacterKey = (e: React.KeyboardEvent): boolean => {
  if (shouldIgnoreKey(e)) return false;
  return e.key.length === 1;
};

const armClickEditableCell = (table: HTMLTableElement, cell: GridCellCoord) => {
  clickEditableCellByTable.set(table, cell);
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

  // Eneste skrive-sti for den logiske fokuserede celle: fysisk DOM-fokus landede → spejl det i controlleren.
  // Navigations-grenene flytter fysisk fokus imperativt (focusTableElement) og lader denne capture
  // opdatere controller-state; de udsteder IKKE en fokus-plan for ren navigation (planen er forbeholdt
  // udskudt fokus hen over editor-luk, jf. Delete-grenen + closeEditing→executeFocusPlan).
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

  // Når en popup-widget er expanded/åben, så bland dig ikke i dens interne keyboard-håndtering.
  if (isPopupWidgetExpanded(target)) return;

  const core = getGridCoreForTable(table);
  const activeCell = toCellCoord(activePos);
  const activeEditableCell = core && activeCell ? core.getEditor(activeCell) : null;
  const isLocked = activeEditableCell?.getIsLocked() === true;
  const isEditing = core && activeCell ? isSameCell(core.getEditingCell(), activeCell) : false;

  // En LUKKET popup-kontrol i en celle ejer selv sin aktiveringstast: Enter skal åbne menuen, ikke
  // flytte cellefokus. Klassifikationen er kontrollens ARIA-semantik (§keyboard-navigation.md) —
  // ikke et komponentnavn eller en privat markør-attribut.
  const isClosedPopupTarget = isInClosedPopupWidget(target);
  if (isClosedPopupTarget && key === 'Enter') return;

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

  // Popup-celle: kun navigations- og delete-taster ejes af grid'et (Delete rydder når `allowEmpty`).
  // Printbare taster åbner IKKE en tekst-editor på en dropdown — kontrollen har ingen fritekst.
  if (isClosedPopupTarget) {
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

  if (isPrintableKey && !isEditing && activeCell && activeEditableCell && !isLocked) {
    const accepted = activeEditableCell.prepareEditFromKey(e.key);
    if (!accepted) return;
    e.preventDefault();
    e.stopPropagation();
    core?.openEditing(activeCell, 'key');
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
    // Enter fuldfører tab-anker-navigation og skal altid nulstille ankeret.
    tabAnchorByTable.delete(table);
    const result = pickVerticalTarget(grid, base, deltaRows, core, true);
    if (!result) return; // ingen valgbar (ikke-låst) celle nogen steder → no-op
    const targetLocator = { rowIndex: result.nextRowIndex, colIndex: result.colIndex, subIndex: base.subIndex, ...(result.nextRowId ? { rowId: result.nextRowId } : {}) };
    focusTableElement(result.target);
    scheduleFocusRecovery(table, targetLocator);
    return;
  }

  if (key === 'ArrowUp' || key === 'ArrowDown') {
    const deltaRows = key === 'ArrowUp' ? -1 : 1;
    // Søg uden wrap efter næste række med en valgbar (ikke-låst) celle. Findes ingen — enten fordi
    // vi er ved tabellens kant, eller fordi de resterende rækker i retningen kun har låste celler —
    // frigives eventet, så Container fortsætter navigation uden for tabellen.
    const result = pickVerticalTarget(grid, activePos, deltaRows, core, false);

    if (!result) {
      markTableBoundaryExit(e.nativeEvent);
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
    const targetLocator = { rowIndex: result.nextRowIndex, colIndex: result.colIndex, subIndex: activePos.subIndex, ...(result.nextRowId ? { rowId: result.nextRowId } : {}) };
    focusTableElement(result.target);
    scheduleFocusRecovery(table, targetLocator);
    return;
  }

  // ArrowLeft/ArrowRight i editor-mode hører til caret-bevægelse og må ikke rydde Tab-ankeret.
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

    // Brug focusTableElement (preventScroll) som alle øvrige nav-grene, så horisontal navigation
    // ikke giver scroll-hop (jf. keyboard-navigation.md). En rå `.focus()` ville scrolle.
    focusTableElement(next.target);
    scheduleFocusRecovery(table, next.locator);
    return;
  }

  tabAnchorByTable.delete(table);
};

export const handleTablePointerDownCapture = (e: React.PointerEvent<HTMLTableElement>) => {
  const table = e.currentTarget;
  tabAnchorByTable.delete(table);
  pendingRecoveryByTable.delete(table);
  pointerDownFocusedCellByTable.delete(table);

  const core = getGridCoreForTable(table);
  if (!core) return;

  const target = e.target instanceof HTMLElement ? e.target : null;
  if (!target) return;
  if (!table.contains(target)) return;
  if (ownsItsOwnPointerInteraction(target)) return;

  const grid = buildGrid(table);
  if (grid.order.length === 0) return;
  const locator = getActiveLocator(table, target, grid);
  if (!locator) return;
  const cell = toCellCoord(locator);
  if (!cell) return;

  // Læs den fokuserede celle fra den eneste autoritet (controlleren). Den blur-nulstillede
  // `clickEditableCellByTable`-gate nedenfor sikrer, at en stale (uden-for-tabel) fokuseret celle
  // ikke fejlagtigt armerer to-trins-redigering.
  const activeCell = core.getFocusedCell();
  const clickEditableCell = clickEditableCellByTable.get(table) ?? null;
  const editing = core.getEditingCell();
  // `immediateEditing` (data-attribut) er touch-aktiveringen for grid-CELLER (tabel-inputs).
  // Den frie inputs uden for grid'et (beregningsdato-felt, kommentar-textarea) bruger i stedet
  // `singleStageClick` i useTwoStageInputActivation. Begge drives af samme isMobile-flag og dækker
  // samme UX-mål (åbn editor ved første tap), men ad to forskellige infrastrukturer — ret dem samlet.
  const immediateEditing = table.dataset.mineoImmediateEditing === 'true';
  if (immediateEditing) {
    if (!isSameCell(editing, cell)) {
      core.openEditing(cell, 'pointer');
    }
    // Sæt flag så handleTableClickCapture ikke åbner editing igen (editing-guard dækker det).
    pointerDownFocusedCellByTable.set(table, cell);
  } else if (isSameCell(activeCell, cell) && isSameCell(clickEditableCell, cell) && !isSameCell(editing, cell)) {
    pointerDownFocusedCellByTable.set(table, cell);
  }
};

export const handleTableClickCapture = (e: React.MouseEvent<HTMLTableElement>) => {
  const table = e.currentTarget;
  const focusedCellAtPointerDown = pointerDownFocusedCellByTable.get(table);
  pointerDownFocusedCellByTable.delete(table);

  // immediateEditing: openEditing er allerede kaldt i pointerDown — klik-eventet skal ikke åbne igen.
  // Denne guard er nødvendig fordi React state-opdateringen fra openEditing kan være asynkron,
  // så getEditingCell() nedenfor ikke nødvendigvis returnerer den nye celle endnu.
  if (table.dataset.mineoImmediateEditing === 'true') return;

  const target = e.target instanceof HTMLElement ? e.target : null;
  if (!target) return;
  if (!table.contains(target)) return;
  if (ownsItsOwnPointerInteraction(target)) return;

  const core = getGridCoreForTable(table);
  if (!core) return;
  const grid = buildGrid(table);
  if (grid.order.length === 0) return;
  const locator = getActiveLocator(table, target, grid);
  if (!locator) return;
  const cell = toCellCoord(locator);
  if (!cell) return;
  armClickEditableCell(table, cell);
  if (!focusedCellAtPointerDown) return;
  if (!isSameCell(focusedCellAtPointerDown, cell)) return;
  if (isSameCell(core.getEditingCell(), cell)) return;
  core.openEditing(cell, 'pointer');
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
          // Invariant: queueMicrotask sikrer at input onBlur kører først (mens isEditing stadig er true).
          // Gør IKKE dette synkront/flushSync; det ville bryde commit-on-blur og kan overskrive drafts.
          // Decision note: denne microtask er en infrastruktur-undtagelse fra den normale form-regel.
          // Reason: tabellens blur-capture skal udskyde editor-nedlukning indtil celle-inputtets eget blur-commit
          // er fuldført, ellers kan gyldigt committet input gå tabt.
          // Risk: at udvide dette mønster uden for grid-infrastrukturen ville genindføre skjult commit-timing.
          // Re-evaluate when: grid-core kan udtrykke "blur finished" synkront uden microtask-ordering.
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
  clickEditableCellByTable.delete(table);
  pointerDownFocusedCellByTable.delete(table);
  tabAnchorByTable.delete(table);
};

export const handleTableDoubleClickCapture = (e: React.MouseEvent<HTMLTableElement>) => {
  const table = e.currentTarget;
  const target = e.target instanceof HTMLElement ? e.target : null;
  if (!target) return;
  if (!table.contains(target)) return;
  if (ownsItsOwnPointerInteraction(target)) return;

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
