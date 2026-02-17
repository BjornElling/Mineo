/**
 * Grid UX Spec (normative)
 *
 * This file intentionally contains no runtime logic.
 * It is the frozen UX contract that all Mineo grid tables MUST follow.
 *
 * Scope (current): HTML-grid tables using `StandardGridTable` + `Table*Input` components,
 * including (at least):
 * - Årsløn (`src/components/tables/AarsloenTable.tsx`)
 * - Offentlige ydelser (`src/components/tables/OffentligeYdelserTable.tsx`)
 */

export const GRID_UX_SPEC = {
  navigation: {
    /**
     * Global model: all Mineo grid tables share the same keyboard semantics.
     *
     * - Tab / Shift+Tab: horizontal traversal (row-major) within the table; wraps/cycles.
     * - Enter / Shift+Enter: vertical traversal within the table; wraps/cycles.
     *
     * Focus is trapped: Tab/Shift+Tab MUST NOT leave the table. Exiting is explicit via pointer click outside
     * (or programmatic focus changes).
     */
    traversalModel: 'excel-like' as const,

    /**
     * Tab-anchor rule (universal):
     * After a Tab-sequence, Enter uses the column where the sequence started (anchor column),
     * not the column where focus currently is.
     *
     * NOTE: The anchor concerns the column (and possible sub-control index), not the row.
     */
    tabAnchor: 'column-only' as const,

    /**
     * Arrow keys:
     * - ArrowUp/ArrowDown participate in vertical traversal and clear the Tab-anchor.
     * - ArrowLeft/ArrowRight navigate horisontalt i samme række med wrap ved rækkekanter.
     */
    arrowKeySemantics: {
      upDown: 'vertical-navigation' as const,
      leftRight: 'horizontal-navigation-wrap-row' as const,
    },

    /**
     * Popup widgets:
     * When a popup widget is expanded/open, GridCore MUST NOT interfere with its internal keyboard handling.
     */
    expandedWidgetBypass: true,

    /**
     * Dropdown cells (TableDropdown contract):
     * - Tab can focus the dropdown
     * - Enter opens the menu (must NOT trigger grid Enter navigation)
     * - Selection commits immediately
     * - Delete/Backspace clears (only when allowEmpty=true and menu is closed)
     *
     * This contract relies on the wrapper attribute:
     * `data-mineo-table-dropdown="true"`
     */
    dropdownContract: true,
  },

  editing: {
    /**
     * Two-stage editing model:
     * - Cell focus (readOnly): navigation mode
     * - Editor open: typing mode
     *
     * Activation:
     * - First click on an unfocused cell: focus only (readOnly)
     * - Click on an already focused cell: open editor, keep caret position
     * - Double click: open editor, select all
     * - First printable key: open editor and replace all content with the first key
     */
    twoStageActivation: true,

    /**
     * Commit timing:
     * Commit is triggered when the editor closes (typically via blur by focus movement).
     *
     * Enter semantics:
     * - When Enter/Shift+Enter is pressed (even while the editor is open), grid navigation occurs.
     *   The focus move causes blur, which triggers the commit pipeline.
     */
    commitOnEditorClose: true,

    /**
     * Validation failures:
     * Navigation MUST NOT be blocked by invalid input.
     * The raw draft may remain visible in the cell with red border + tooltip.
     */
    allowLeavingInvalidDraft: true,

    /**
     * Escape:
     * If the editor is open, Escape reverts the cell to its original value (at editor-open time)
     * and closes the editor.
     */
    escapeRevertsAndCloses: true,

    /**
     * Delete/Backspace (editor closed / cell-focus):
     * Clears the cell and commits immediately, without opening the editor.
     * Focus remains in the cell in readOnly mode.
     */
    deleteClearsAndCommitsImmediately: true,
  },

  rows: {
    /**
     * Row lifecycle (universal for Mineo grid tables):
     * - At least 2 rows exist at all times.
     * - At least 1 trailing empty input row exists at all times.
     * - Empty middle rows may be deleted at every commit/blur (aggressive cleanup).
     * - "Blur is blur": there is no special case for "internal navigation" vs leaving the table.
     */
    minRows: 2,
    trailingEmptyRow: true,
    cleanupOnEveryCommitOrBlur: true,
    blurIsBlur: true,
  },

  sorting: {
    /**
     * Sorting (shared model):
     * - All header cells are clickable.
     * - No icon is shown initially.
     * - Clicking a header sorts by that column; clicking again flips direction.
     * - Sorting is stable and memory-based:
     *   - Primary sort: active (blue) icon
     *   - Secondary sort: previous primary (grey) icon
     *   - Ties in primary are resolved by secondary, then original insertion order.
     * - Sorting is permanent once activated (no "clear sorting" state).
     */
    headersAlwaysClickable: true,
    defaultDirection: 'asc' as const,
    permanentOnceActivated: true,
    stableWithSecondaryMemory: true,
  },
} as const;
