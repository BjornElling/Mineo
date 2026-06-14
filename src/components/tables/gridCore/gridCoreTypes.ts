/**
 * Type-definitioner for GridCore-systemet
 *
 * VIGTIGT: Denne fil indeholder KUN type-definitioner - ingen runtime-kode.
 */

export type GridCellCoord = Readonly<{ rowId: string; colIndex: number }>;

export type GridOpenEditSource = 'pointer' | 'key' | 'doubleClick';

export type FocusChangeReason = 'tab' | 'enter' | 'arrow' | 'sort' | 'commit';

/**
 * FocusPlan-invarianter:
 * - `from` SKAL svare til den fokuserede celle på request-tidspunktet
 * - `to` SKAL være en gyldig, fokusbar celle
 * - planen ignoreres hvis editoren er åben
 */
export type FocusPlan = Readonly<{
  from: GridCellCoord;
  to: GridCellCoord;
  reason: FocusChangeReason;
}>;

export type GridCellEditorHandle = Readonly<{
  getElement: () => HTMLElement | null;
  getIsLocked: () => boolean;
  commitCurrent: () => boolean;
  clearAndCommit: () => void;
  cancelEdit: () => void;
  /**
   * Forbered en tast-initieret redigering (overwrite-all-semantik).
   *
   * Returnerer `true` når tasten accepteres og editoren kan åbnes.
   * Returnerer `false` for at angive "ignorér denne tast til edit-start" (fx ikke-ciffer på en heltalscelle).
   */
  prepareEditFromKey: (key: string) => boolean;
  selectAll: () => void;
}>;

export type GridCoreStateStore = Readonly<{
  subscribe: (listener: () => void) => () => void;
  getFocusedCell: () => GridCellCoord | null;
  getEditingCell: () => GridCellCoord | null;
}>;

/**
 * Public API exposed via GridCore Context
 *
 * VIGTIGT: Dette er den primære API-kontrakt.
 * GridCoreController implementerer denne + interne metoder.
 * Ved at definere Public API først, sikrer vi at API-boundary er eksplicit.
 *
 * DOMÆNE-KOMMANDOER (validerede transitions):
 * - openEditing: Åbn editor med validering (locked-check, focusplan-koordinering)
 * - closeEditing: Luk editor
 * - requestFocusPlan: Anmod om fokus-flytning (udføres når editor lukker)
 *
 * EDITOR REGISTRY (infra-lag):
 * - registerEditor / unregisterEditor / getEditor: Editor lifecycle management
 *
 * BEMÆRK: Raw state-setters (setFocusedCell, setEditingCell) er IKKE en del af public API.
 * De er internal-only og kan ikke bruges af consumers for at sikre invariants.
 */
export type GridCorePublicAPI = Readonly<{
  openEditing: (cell: GridCellCoord, source: GridOpenEditSource) => void;
  closeEditing: () => void;
  registerEditor: (cell: GridCellCoord, handle: GridCellEditorHandle) => void;
  unregisterEditor: (cell: GridCellCoord) => void;
  getEditor: (cell: GridCellCoord) => GridCellEditorHandle | null;
  requestFocusPlan: (plan: FocusPlan) => void;
}>;

/**
 * Internal GridCore Controller interface (registry-eksponeret)
 *
 * Implementerer GridCorePublicAPI + interne metoder til brug i keyboard navigation.
 *
 * BEMÆRK: Denne type eksponeres via registry til tableKeyboardNavigation.
 * Raw setters (setFocusedCell, setEditingCell) er EN DEL af denne type
 * fordi keyboard navigation har brug for dem.
 *
 * INTERNE METODER (må ALDRIG eksponeres via Context):
 * - setFocusedCell / setEditingCell: Raw state setters uden validering
 * - executeFocusPlan / clearFocusPlan / getPendingFocusPlan: Focus plan management
 */
export type GridCoreController = GridCorePublicAPI &
  Readonly<{
    getFocusedCell: () => GridCellCoord | null;
    setFocusedCell: (cell: GridCellCoord | null) => void;
    getEditingCell: () => GridCellCoord | null;
    /**
     * Rå setter for redigerende celle. `options.synchronously` flusher store-notifikationen
     * synkront (via flushSync), så editor-open er observerbar i samme tick — bruges af
     * `openEditing`. Udelad for normal async-notifikation (fx editor-close).
     */
    setEditingCell: (cell: GridCellCoord | null, options?: Readonly<{ synchronously?: boolean }>) => void;
    executeFocusPlan: () => void;
    clearFocusPlan: () => void;
    getPendingFocusPlan: () => FocusPlan | null;
  }>;
