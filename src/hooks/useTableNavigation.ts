import React from 'react';
import { flushSync } from 'react-dom';
import type { AarsloenTableColumnKey } from '../types/common';

const FIRST_KEY_ALLOWED_PATTERN_NON_AMOUNT = /^[0-9]$/;
const FIRST_KEY_ALLOWED_PATTERN_AMOUNT = /^[0-9.,]$/;

/**
 * Type for en celle-reference (position i tabel)
 */
export interface CellPosition {
  row: number;
  col: number;
  rowIdx: number;
  colIdx: number;
}

/**
 * Type for tabel-række data
 */
export interface TableRowData {
  id: string | number;
}

/**
 * Type for periode
 */
export type LoenPeriode = 'maaned' | 'uge' | 'dag';

/**
 * Type for saniterings-callback
 */
export type SanitizeCallback = (value: string) => string;
// Contract: table inputs persist strings; the canonical empty value is always '' (never undefined/null).

/**
 * Type for persist callback
 */
export type PersistCallback = (rowId: string | number, colKey: AarsloenTableColumnKey, value: string) => void;

/**
 * Type for internalChange callback
 */
export type InternalChangeCallback = (rowId: string | number, colKey: AarsloenTableColumnKey, value: string) => void;

/**
 * Hook parametre type
 */
export interface UseTableNavigationParams {
  tableData: TableRowData[];
  editableColumns: number[];
  onInternalChange?: InternalChangeCallback;
  onPersist?: PersistCallback;
  loenperiode: LoenPeriode;
}

/**
 * Return type for useTableNavigation hook
 */
export interface UseTableNavigationReturn {
  // Refs
  inputRefs: React.MutableRefObject<Record<string, HTMLElement | null>>;
  registerInput: (rowIdx: number, colIdx: number, element: HTMLElement | null) => void;
  registerSanitizeCallback: (rowIdx: number, colIdx: number, callback: SanitizeCallback) => void;

  // State checkers
  isEditorOpen: (rowIdx: number, colIdx: number) => boolean;

  // Event handlers
  handleKeyDown: (evt: React.KeyboardEvent<HTMLElement>, rowIdx: number, colIdx: number) => void;
  handleFocus: (rowIdx: number, colIdx: number) => void;
  handleClick: (evt: React.MouseEvent<HTMLElement>, rowIdx: number, colIdx: number) => void;
  handleDoubleClick: (rowIdx: number, colIdx: number) => void;
  handleMouseDown: (evt: React.MouseEvent<HTMLElement>, rowIdx: number, colIdx: number) => void;
}

/**
 * useTableNavigation - Custom hook til Excel-lignende navigation i tabeller
 *
 * Håndterer al keyboard og mouse navigation for tabeller med redigerbare celler.
 * Understøtter to distinkte tilstande:
 * - Celle-fokus (readOnly): Navigation med piletaster, Tab, Enter
 * - Editor-åben: Redigering med cursor-bevægelse i tekst
 *
 * @param params - Hook parametre
 * @returns Navigation interface
 */
// Navigation contract (cross-cutting):
// - This hook is the "single owner" for Tab/Enter focus traversal within the table.
// - Tab sets an anchor (start cell). Enter moves vertically while preserving the anchor column.
// - The page `Container` also traps Tab/Enter; callers must bind `handleKeyDown` so it can `preventDefault()` + `stopPropagation()`,
//   otherwise focus may move twice.
const useTableNavigation = ({
  tableData,
  editableColumns,
  onInternalChange,
  onPersist,
  loenperiode
}: UseTableNavigationParams): UseTableNavigationReturn => {
  // Editor-tilstand: Hvilken celle har editor åben (null = ingen)
  const [editorCell, setEditorCell] = React.useState<CellPosition | null>(null);

  // Refs til alle input-felter: { "rowIdx-colIdx": DOMElement }
  const inputRefs = React.useRef<Record<string, HTMLElement | null>>({});

  // Tab-anchor: Husker startcelle (row/col) for Tab/Enter sekvens
  const tabAnchorRef = React.useRef<CellPosition | null>(null);

  // Sidste tast: Bruges til at bestemme Tab-anchor adfærd
  const lastKeyRef = React.useRef<string | null>(null);

  // PERFORMANCE OPTIMERING (Nov 2025): Pending persist for asynkron håndtering
  // Gemmer celle-koordinater for persist der skal køres EFTER navigation
  // Dette sikrer at fokus flyttes STRAKS uden at vente på sanitize/persist
  const pendingPersistRef = React.useRef<CellPosition | null>(null);

  // Mus-estimat: Husker om mousedown skete på allerede fokuseret celle
  const mouseDownFocusedCellRef = React.useRef<CellPosition | null>(null);

  // Original værdier: Gemmes når editor åbnes, gendannes ved Escape
  const originalValuesRef = React.useRef<Record<string, string>>({});

  /**
   * Konverter kolonne-indeks til datamodel-nøgle
   *
   * @param colIdx - Kolonne-indeks
   * @param period - Lønperiode
   * @returns Kolonnenøgle (fx 'col2', 'col0_maaned', 'col1_uge')
   */
  const getColumnKey = React.useCallback((colIdx: number, period: LoenPeriode): AarsloenTableColumnKey => {
    if (colIdx === 0) return `col0_${period}`;
    if (colIdx === 1) return `col1_${period}`;
    if (colIdx === 2) return 'col2';
    if (colIdx === 3) return 'col3';
    if (colIdx === 4) return 'col4';
    return 'col5';
  }, []);

  /**
   * Hent nuværende værdi for en celle fra tableData
   *
   * @param rowIdx - Række-indeks
   * @param colIdx - Kolonne-indeks
   * @returns Celleværdi
   */
  const getCurrentValue = React.useCallback((rowIdx: number, colIdx: number): string => {
    if (!tableData[rowIdx]) return '';
    const row = tableData[rowIdx] as unknown as Record<string, unknown>;
    const colKey = getColumnKey(colIdx, loenperiode);
    const raw = row[colKey];
    if (raw === undefined || raw === null) return '';
    return typeof raw === 'string' ? raw : String(raw);
  }, [tableData, loenperiode, getColumnKey]);

  /**
   * Sæt fokus på en celle
   *
   * @param rowIdx - Række-indeks
   * @param colIdx - Kolonne-indeks
   */
  const focusCell = React.useCallback((rowIdx: number, colIdx: number): void => {
    const key = `${rowIdx}-${colIdx}`;
    const inputElement = inputRefs.current[key];

    if (inputElement) {
      inputElement.focus();
    }
  }, []);

  /**
   * Åbn editor i en celle
   *
   * @param rowIdx - Række-indeks
   * @param colIdx - Kolonne-indeks
   * @param preserveAnchor - Hvis true, bevar Tab-anchor (bruges ved Tab-navigation)
   */
  const openEditor = React.useCallback((rowIdx: number, colIdx: number, preserveAnchor = false): void => {
    const key = `${rowIdx}-${colIdx}`;

    // Gem NUVÆRENDE værdi som original (til Escape)
    originalValuesRef.current[key] = getCurrentValue(rowIdx, colIdx);

    // Åbn editor
    setEditorCell({ row: rowIdx, col: colIdx, rowIdx, colIdx });

    // Nulstil Tab-anchor KUN hvis ikke preserveAnchor
    if (!preserveAnchor) {
      tabAnchorRef.current = null;
      lastKeyRef.current = null;
    }
  }, [getCurrentValue]);

  /**
   * Luk editor (alle celler bliver readOnly)
   */
  const closeEditor = React.useCallback((): void => {
    // PERFORMANCE: Kun re-render hvis editor faktisk er åben
    if (editorCell !== null) {
      setEditorCell(null);
    }
  }, [editorCell]);

  /**
   * Tjek om editor er åben i en specifik celle
   *
   * @param rowIdx - Række-indeks
   * @param colIdx - Kolonne-indeks
   * @returns True hvis editor er åben i denne celle
   */
  const isEditorOpen = React.useCallback((rowIdx: number, colIdx: number): boolean => {
    return editorCell?.row === rowIdx && editorCell?.col === colIdx;
  }, [editorCell]);

  /**
   * Registrer et input-element i refs-registret
   *
   * @param rowIdx - Række-indeks
   * @param colIdx - Kolonne-indeks
   * @param element - DOM-element
   */
  const registerInput = React.useCallback((rowIdx: number, colIdx: number, element: HTMLElement | null): void => {
    const key = `${rowIdx}-${colIdx}`;
    inputRefs.current[key] = element;
  }, []);

  /**
   * Fjern fokus fra alle celler
   */
  const removeFocus = React.useCallback((): void => {
    if (document.activeElement) {
      (document.activeElement as HTMLElement)?.blur?.();
    }
    tabAnchorRef.current = null;
    lastKeyRef.current = null;
  }, []);

  // Refs til saniterings-callbacks fra input-komponenter
  const sanitizeCallbacks = React.useRef<Record<string, SanitizeCallback>>({});

  /**
   * Registrer en saniterings-callback for en celle
   *
   * @param rowIdx - Række-indeks
   * @param colIdx - Kolonne-indeks
   * @param callback - Saniterings-funktion der returnerer saneret værdi
   */
  const registerSanitizeCallback = React.useCallback((rowIdx: number, colIdx: number, callback: SanitizeCallback): void => {
    const key = `${rowIdx}-${colIdx}`;
    sanitizeCallbacks.current[key] = callback;
  }, []);

  /**
   * Persist værdi til backend/sessionStorage
   * VIGTIGT: Saniterer værdien før persist ved at kalde input-komponentens sanitize callback
   * Kun persister hvis værdien faktisk er ændret (undgår duplicate undo-entries)
   *
   * @param rowIdx - Række-indeks
   * @param colIdx - Kolonne-indeks
   */
  const persistValue = React.useCallback((rowIdx: number, colIdx: number): void => {
    if (!tableData[rowIdx]) return;

    const row = tableData[rowIdx];
    let value = getCurrentValue(rowIdx, colIdx);
    const colKey = getColumnKey(colIdx, loenperiode);

    // Kør sanitering hvis tilgængelig
    const key = `${rowIdx}-${colIdx}`;
    const sanitize = sanitizeCallbacks.current[key];
    if (sanitize) {
      value = sanitize(value);
    }

    // Tjek om værdien faktisk er ændret (sammenlign med original værdi)
    const originalValue = originalValuesRef.current[key];
    if (originalValue !== undefined && originalValue === value) {
      // Ryd originalValue da editering er færdig (selvom ingen ændring)
      delete originalValuesRef.current[key];
      return; // Skip persist hvis værdien er den samme
    }

    // Ryd originalValue efter persist (editering er færdig)
    delete originalValuesRef.current[key];

    if (onPersist) {
      onPersist(row.id, colKey, value);
    }
  }, [tableData, getCurrentValue, getColumnKey, loenperiode, onPersist]);

  /**
   * Gendan original værdi (Escape-funktionalitet)
   *
   * @param rowIdx - Række-indeks
   * @param colIdx - Kolonne-indeks
   */
  const restoreOriginalValue = React.useCallback((rowIdx: number, colIdx: number): void => {
    if (!tableData[rowIdx]) return;

    const key = `${rowIdx}-${colIdx}`;
    const row = tableData[rowIdx];
    const colKey = getColumnKey(colIdx, loenperiode);
    const originalValue = originalValuesRef.current[key] || '';

    if (onPersist) {
      flushSync(() => {
        onPersist(row.id, colKey, originalValue);
      });
    }

    // Ryd original værdi fra ref
    delete originalValuesRef.current[key];
  }, [tableData, getColumnKey, loenperiode, onPersist]);

  /**
   * Slet celle-indhold og persist STRAKS
   *
   * @param rowIdx - Række-indeks
   * @param colIdx - Kolonne-indeks
   */
  const deleteAndPersist = React.useCallback((rowIdx: number, colIdx: number): void => {
    if (!tableData[rowIdx]) return;

    const row = tableData[rowIdx];
    const colKey = getColumnKey(colIdx, loenperiode);

    if (onPersist) {
      onPersist(row.id, colKey, ''); // Tom værdi
    }

    // Fokus bevares på celle (editor forbliver lukket)
    focusCell(rowIdx, colIdx);
  }, [tableData, getColumnKey, loenperiode, onPersist, focusCell]);

  /**
   * Slet celle-indhold og åbn editor
   *
   * @param rowIdx - Række-indeks
   * @param colIdx - Kolonne-indeks
   */
  const _deleteAndOpenEditor = React.useCallback((rowIdx: number, colIdx: number): void => {
    if (!tableData[rowIdx]) return;

    const key = `${rowIdx}-${colIdx}`;
    const row = tableData[rowIdx];
    const colKey = getColumnKey(colIdx, loenperiode);

    // Gem nuværende værdi som original (til Escape)
    originalValuesRef.current[key] = getCurrentValue(rowIdx, colIdx);

    // Slet værdien - brug onInternalChange (undgå parent state opdatering)
    if (onInternalChange) {
      onInternalChange(row.id, colKey, '');
    }

    // Åbn editor
    setEditorCell({ row: rowIdx, col: colIdx, rowIdx, colIdx });

    // Fokuser input-felt
    focusCell(rowIdx, colIdx);
  }, [tableData, getColumnKey, loenperiode, onInternalChange, focusCell, getCurrentValue]);

  /**
   * Åbn editor og erstat indhold med en ny værdi (fx første tastetryk)
   *
   * @param rowIdx - Række-indeks
   * @param colIdx - Kolonne-indeks
   * @param newValue - Ny værdi
   */
  const openEditorAndSetValue = React.useCallback((rowIdx: number, colIdx: number, newValue: string): void => {
    if (!tableData[rowIdx]) return;

    const key = `${rowIdx}-${colIdx}`;
    const row = tableData[rowIdx];
    const colKey = getColumnKey(colIdx, loenperiode);

    // Gem nuværende værdi som original til Escape
    originalValuesRef.current[key] = getCurrentValue(rowIdx, colIdx);

    // Brug onInternalChange i stedet for onPersist (undgå parent state opdatering ved første tastetryk)
    if (onInternalChange) {
      onInternalChange(row.id, colKey, newValue);
    }

    setEditorCell({ row: rowIdx, col: colIdx, rowIdx, colIdx });
    focusCell(rowIdx, colIdx);

    // VIGTIGT: Bevar anchor hvis forrige tast var Tab eller Enter
    // Dette sikrer at Tab → Type → Enter sekvensen fungerer korrekt
    if (lastKeyRef.current !== 'Tab' && lastKeyRef.current !== 'Enter') {
      tabAnchorRef.current = null;
      lastKeyRef.current = null;
    }
  }, [tableData, getColumnKey, loenperiode, onInternalChange, getCurrentValue, focusCell]);

  /**
   * Vertikal navigation (Op/Ned piletaster)
   *
   * @param currentRow - Nuværende række-indeks
   * @param currentCol - Nuværende kolonne-indeks
   * @param direction - Retning: -1 for op, 1 for ned
   */
  const navigateVertical = React.useCallback((currentRow: number, currentCol: number, direction: number): void => {
    const rowCount = tableData.length;
    const newRow = (currentRow + direction + rowCount) % rowCount;
    focusCell(newRow, currentCol);
  }, [tableData, focusCell]);

  /**
   * Horizontal navigation (Venstre/Højre piletaster)
   *
   * @param currentRow - Nuværende række-indeks
   * @param currentCol - Nuværende kolonne-indeks
   * @param direction - Retning: -1 for venstre, 1 for højre
   */
  const navigateHorizontal = React.useCallback((currentRow: number, currentCol: number, direction: number): void => {
    const currentIdx = editableColumns.indexOf(currentCol);
    const newIdx = currentIdx + direction;

    if (newIdx >= 0 && newIdx < editableColumns.length) {
      // Samme række
      focusCell(currentRow, editableColumns[newIdx]);
    } else if (direction > 0) {
      // Wrap til næste række, første kolonne
      const newRow = (currentRow + 1) % tableData.length;
      focusCell(newRow, editableColumns[0]);
    } else {
      // Wrap til forrige række, sidste kolonne
      const newRow = (currentRow - 1 + tableData.length) % tableData.length;
      focusCell(newRow, editableColumns[editableColumns.length - 1]);
    }
  }, [editableColumns, tableData, focusCell]);

  /**
   * Navigation med piletaster (kaldes fra celle-fokus mode)
   *
   * @param rowIdx - Række-indeks
   * @param colIdx - Kolonne-indeks
   * @param key - Tast-navn ('ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight')
   */
  const navigateWithArrow = React.useCallback((rowIdx: number, colIdx: number, key: string): void => {
    // Nulstil Tab-anchor når piletaster bruges
    tabAnchorRef.current = null;
    lastKeyRef.current = key;

    switch (key) {
      case 'ArrowUp':
        navigateVertical(rowIdx, colIdx, -1);
        break;
      case 'ArrowDown':
        navigateVertical(rowIdx, colIdx, 1);
        break;
      case 'ArrowLeft':
        navigateHorizontal(rowIdx, colIdx, -1);
        break;
      case 'ArrowRight':
        navigateHorizontal(rowIdx, colIdx, 1);
        break;
      default:
        break;
    }
  }, [navigateVertical, navigateHorizontal]);

  /**
   * Tab navigation med anchor-memory
   *
   * @param currentRow - Nuværende række-indeks
   * @param currentCol - Nuværende kolonne-indeks
   * @param forward - True for Tab, false for Shift+Tab
   */
  const navigateTab = React.useCallback((currentRow: number, currentCol: number, forward: boolean): void => {
    // Sæt Tab-anchor hvis ikke allerede sat ELLER hvis forrige tast ikke var Tab
    // VIGTIGT: Anchor må KUN sættes første gang i Tab-sekvensen, IKKE hver gang
    if (!tabAnchorRef.current || lastKeyRef.current !== 'Tab') {
      tabAnchorRef.current = { row: currentRow, col: currentCol, rowIdx: currentRow, colIdx: currentCol };
    }

    lastKeyRef.current = 'Tab';

    // Samme som horizontal navigation
    navigateHorizontal(currentRow, currentCol, forward ? 1 : -1);
  }, [navigateHorizontal]);

  /**
   * Enter navigation med anchor-memory
   *
   * @param currentRow - Nuværende række-indeks
   * @param currentCol - Nuværende kolonne-indeks
   * @param shiftKey - True for Shift+Enter
   */
  const navigateEnter = React.useCallback((currentRow: number, currentCol: number, shiftKey: boolean): void => {
    const hasAnchor = Boolean(tabAnchorRef.current);

    // Hvis vi har en anchor (fra Tab-sekvens), brug anchor-kolonnen
    // Hvis vi IKKE har anchor, brug nuværende kolonne som anchor
    const targetCol = hasAnchor && tabAnchorRef.current ? tabAnchorRef.current.col : currentCol;

    // Sæt anchor KUN hvis ikke allerede sat OG forrige tast ikke var Tab/Enter
    // VIGTIGT: Hvis anchor allerede findes (fra Tab), BEVAR den!
    if (!hasAnchor) {
      tabAnchorRef.current = { row: currentRow, col: currentCol, rowIdx: currentRow, colIdx: currentCol };
    }

    lastKeyRef.current = 'Enter';

    const direction = shiftKey ? -1 : 1;
    const rowCount = tableData.length;
    const newRow = (currentRow + direction + rowCount) % rowCount;

    // Bevar anchor-kolonnen, men opdater ikke base-row (vi navigerer fra CURRENT row)
    focusCell(newRow, targetCol);
  }, [tableData, focusCell]);

  /**
   * Hovedlogik: Keyboard event handler
   *
   * @param evt - Keyboard event
   * @param rowIdx - Række-indeks
   * @param colIdx - Kolonne-indeks
   */
  const handleKeyDown = React.useCallback((evt: React.KeyboardEvent<HTMLElement>, rowIdx: number, colIdx: number): void => {
    const isEditorOpenHere = editorCell?.row === rowIdx && editorCell?.col === colIdx;

    // === EDITOR ER ÅBEN ===
    if (isEditorOpenHere) {
      switch (evt.key) {
        case 'Escape':
          evt.preventDefault();
          evt.stopPropagation();
          restoreOriginalValue(rowIdx, colIdx);
          closeEditor();
          focusCell(rowIdx, colIdx); // Behold fokus på celle
          break;

        case 'ArrowUp':
        case 'ArrowDown':
          evt.preventDefault();
          evt.stopPropagation();

          // PERFORMANCE: Queue persist for EFTER navigation
          pendingPersistRef.current = { row: rowIdx, col: colIdx, rowIdx, colIdx };

          // Navigate FØRST (instant focus)
          closeEditor();
          navigateVertical(rowIdx, colIdx, evt.key === 'ArrowUp' ? -1 : 1);

          // Persist BAGEFTER (asynkront via queueMicrotask)
          queueMicrotask(() => {
            if (pendingPersistRef.current) {
              const { rowIdx: pRow, colIdx: pCol } = pendingPersistRef.current;
              persistValue(pRow, pCol);
              pendingPersistRef.current = null;
            }
          });
          break;

        case 'Tab':
          evt.preventDefault();
          evt.stopPropagation();

          // PERFORMANCE: Queue persist for EFTER navigation
          pendingPersistRef.current = { row: rowIdx, col: colIdx, rowIdx, colIdx };

          // Navigate FØRST (instant focus)
          closeEditor();
          navigateTab(rowIdx, colIdx, !evt.shiftKey);

          // Persist BAGEFTER (asynkront via queueMicrotask)
          queueMicrotask(() => {
            if (pendingPersistRef.current) {
              const { rowIdx: pRow, colIdx: pCol } = pendingPersistRef.current;
              persistValue(pRow, pCol);
              pendingPersistRef.current = null;
            }
          });
          break;

        case 'Enter':
          evt.preventDefault();
          evt.stopPropagation();

          // PERFORMANCE: Queue persist for EFTER navigation
          pendingPersistRef.current = { row: rowIdx, col: colIdx, rowIdx, colIdx };

          // Navigate FØRST (instant focus)
          closeEditor();
          navigateEnter(rowIdx, colIdx, evt.shiftKey);

          // Persist BAGEFTER (asynkront via queueMicrotask)
          queueMicrotask(() => {
            if (pendingPersistRef.current) {
              const { rowIdx: pRow, colIdx: pCol } = pendingPersistRef.current;
              persistValue(pRow, pCol);
              pendingPersistRef.current = null;
            }
          });
          break;

        // Venstre/højre og Delete/Backspace håndteres af input-felt
        default:
          break;
      }
      return;
    }

    // === CELLE HAR FOKUS (EDITOR LUKKET) ===
    switch (evt.key) {
      case 'Escape':
        evt.preventDefault();
        evt.stopPropagation();
        removeFocus();
        break;

      case 'Delete':
        evt.preventDefault();
        evt.stopPropagation();
        deleteAndPersist(rowIdx, colIdx);
        break;

      case 'Backspace':
        evt.preventDefault();
        evt.stopPropagation();
        deleteAndPersist(rowIdx, colIdx);
        break;

      case 'ArrowUp':
      case 'ArrowDown':
      case 'ArrowLeft':
      case 'ArrowRight':
        evt.preventDefault();
        evt.stopPropagation();
        navigateWithArrow(rowIdx, colIdx, evt.key);
        break;

      case 'Tab':
        evt.preventDefault();
        evt.stopPropagation();
        navigateTab(rowIdx, colIdx, !evt.shiftKey);
        break;

      case 'Enter':
        evt.preventDefault();
        evt.stopPropagation();
        navigateEnter(rowIdx, colIdx, evt.shiftKey);
        break;

      default: {
        const isPrintableKey = evt.key.length === 1 && !evt.ctrlKey && !evt.altKey && !evt.metaKey;
        if (isPrintableKey) {
          const pattern = colIdx >= 2 ? FIRST_KEY_ALLOWED_PATTERN_AMOUNT : FIRST_KEY_ALLOWED_PATTERN_NON_AMOUNT;
          if (!pattern.test(evt.key)) break;
          evt.preventDefault();
          evt.stopPropagation();
          const initialValue = evt.key === '.' ? ',' : evt.key;
          openEditorAndSetValue(rowIdx, colIdx, initialValue);
        }
        break;
      }
    }
  }, [
    editorCell,
    restoreOriginalValue,
    closeEditor,
    focusCell,
    persistValue,
    navigateVertical,
    navigateTab,
    navigateEnter,
    removeFocus,
    deleteAndPersist,
    navigateWithArrow,
    openEditorAndSetValue,
  ]);

  /**
   * Focus event handler
   *
   * @param rowIdx - Række-indeks
   * @param colIdx - Kolonne-indeks
   */
  const handleFocus = React.useCallback((rowIdx: number, colIdx: number): void => {
    // PERFORMANCE: Flush pending persist fra tidligere celle hvis bruger navigerer til ny celle
    if (pendingPersistRef.current &&
        (pendingPersistRef.current.rowIdx !== rowIdx ||
         pendingPersistRef.current.colIdx !== colIdx)) {
      const { rowIdx: oldRow, colIdx: oldCol } = pendingPersistRef.current;
      persistValue(oldRow, oldCol);
      pendingPersistRef.current = null;
    }

    // Når celle får fokus uden at editor er åben
    if (!isEditorOpen(rowIdx, colIdx)) {
      // Luk eventuel anden editor
      if (editorCell) {
        persistValue(editorCell.row, editorCell.col);
        closeEditor();
      }
    }
  }, [isEditorOpen, editorCell, persistValue, closeEditor]);

  /**
   * Click event handler
   *
   * @param evt - Click event
   * @param rowIdx - Række-indeks
   * @param colIdx - Kolonne-indeks
   */
  const handleClick = React.useCallback((evt: React.MouseEvent<HTMLElement>, rowIdx: number, colIdx: number): void => {
    // Første klik: Giv fokus, luk eventuel editor
    if (editorCell && (editorCell.row !== rowIdx || editorCell.col !== colIdx)) {
      persistValue(editorCell.row, editorCell.col);
      closeEditor();
    }

    const shouldOpenFromClick =
      mouseDownFocusedCellRef.current?.row === rowIdx &&
      mouseDownFocusedCellRef.current?.col === colIdx;

    mouseDownFocusedCellRef.current = null;

    if (shouldOpenFromClick) {
      openEditor(rowIdx, colIdx);
    } else {
      focusCell(rowIdx, colIdx);
    }
  }, [editorCell, persistValue, closeEditor, focusCell, openEditor]);

  /**
   * Double-click event handler (åbn editor)
   *
   * @param rowIdx - Række-indeks
   * @param colIdx - Kolonne-indeks
   */
  const handleDoubleClick = React.useCallback((rowIdx: number, colIdx: number): void => {
    // Åbn editor i celle med fokus
    openEditor(rowIdx, colIdx);
  }, [openEditor]);

  /**
   * Mouse down event handler
   *
   * @param evt - Mouse event
   * @param rowIdx - Række-indeks
   * @param colIdx - Kolonne-indeks
   */
  const handleMouseDown = React.useCallback((evt: React.MouseEvent<HTMLElement>, rowIdx: number, colIdx: number): void => {
    // Nulstil keyboard state når der klikkes med musen
    lastKeyRef.current = null;
    tabAnchorRef.current = null;

    const key = `${rowIdx}-${colIdx}`;
    const inputElement = inputRefs.current[key];
    const alreadyActive = document.activeElement === inputElement;
    mouseDownFocusedCellRef.current = alreadyActive ? { row: rowIdx, col: colIdx, rowIdx, colIdx } : null;
  }, []);

  // Cleanup refs ved unmount for at forhindre memory leaks
  React.useEffect(() => {
    return () => {
      // Ryd alle refs for at frigive memory
      inputRefs.current = {};
      originalValuesRef.current = {};
      sanitizeCallbacks.current = {};

      // Ryd også navigation state
      tabAnchorRef.current = null;
      lastKeyRef.current = null;
      mouseDownFocusedCellRef.current = null;
      pendingPersistRef.current = null;
    };
  }, []);

  // Returnér hook interface
  return {
    // Refs
    inputRefs,
    registerInput,
    registerSanitizeCallback,

    // State checkers
    isEditorOpen,

    // Event handlers
    handleKeyDown,
    handleFocus,
    handleClick,
    handleDoubleClick,
    handleMouseDown,
  };
};

export default useTableNavigation;
