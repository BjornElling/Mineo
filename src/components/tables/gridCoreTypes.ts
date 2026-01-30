/**
 * Type definitions for GridCore system
 *
 * VIGTIGT: Denne fil indeholder KUN type definitions - ingen runtime-kode.
 */

export type GridCellCoord = Readonly<{ rowId: string; colIndex: number }>;

export type GridOpenEditSource = 'pointer' | 'key' | 'doubleClick';

export type FocusChangeReason = 'tab' | 'enter' | 'arrow' | 'sort' | 'commit';

/**
 * FocusPlan invariants:
 * - `from` MUST equal the focused cell at request-time
 * - `to` MUST be a valid, focusable cell
 * - plan is ignored if editor is open
 */
export type FocusPlan = Readonly<{
  from: GridCellCoord;
  to: GridCellCoord;
  reason: FocusChangeReason;
}>;

export type GridCellEditorHandle = Readonly<{
  getElement: () => HTMLElement | null;
  getIsLocked: () => boolean;
  clearAndCommit: () => void;
  cancelEdit: () => void;
  /**
   * Prepare a key-initiated edit (overwrite-all semantics).
   *
   * Returns `true` when the key is accepted and the editor can be opened.
   * Returns `false` to indicate "ignore this key for edit-start" (e.g. non-digit on an integer cell).
   */
  prepareEditFromKey: (key: string) => boolean;
  selectAll: () => void;
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
    setEditingCell: (cell: GridCellCoord | null) => void;
    executeFocusPlan: () => void;
    clearFocusPlan: () => void;
    getPendingFocusPlan: () => FocusPlan | null;
  }>;
