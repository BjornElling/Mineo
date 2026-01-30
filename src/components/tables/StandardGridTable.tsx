import * as React from 'react';
import { Box } from '@mui/material';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import type { CSSProperties } from 'react';
import { flushSync } from 'react-dom';
import { getHtmlTableStyles, tableColors } from '../../config/tableTheme';
import { GridCoreProvider, type GridCoreContextValue } from './gridCoreContext';
import { attachGridCoreToTable, detachGridCoreFromTable } from './gridCoreRegistry';
import { gridCellKey, areSameGridCellOrBothNull } from './gridCoreUtils';
import type { GridCellCoord, GridCoreController, GridCellEditorHandle, GridOpenEditSource, FocusPlan } from './gridCoreTypes';
import { handleTableBlurCapture, handleTableDoubleClickCapture, handleTableFocusCapture, handleTableKeyDownCapture, handleTablePointerDownCapture } from './tableKeyboardNavigation';
import type { GridSortDirection, GridSortRole } from './gridModel';

export type StandardGridTableProps = Readonly<{
  /**
   * Table type 2: egentlig tabel (HTML table + table-inputs).
   *
   * - Central styling via `getHtmlTableStyles`
   * - Intended for Table*Input components (draft onChange, commit onBlur)
   */
  children: React.ReactNode;
  beforeTable?: React.ReactNode;
  tableWidth: CSSProperties['width'];
  tableLayout?: CSSProperties['tableLayout'];
  useSmallFont?: boolean;
  /**
   * Optional max-width wrapper + horizontal scrolling.
   */
  containerSx?: Record<string, unknown>;
  /**
   * DANGER: Disables GridCore navigation entirely.
   *
   * Default: false (navigation enabled).
   * Only set to true when a table implements its own complete navigation system.
   * Setting this to true breaks standard grid behavior - use only as escape hatch.
   */
  __dangerouslyDisableGridNavigation?: boolean;
}>;

export const StandardGridTable = React.memo(
  ({
    children,
    beforeTable,
    tableWidth,
    tableLayout = 'fixed',
    useSmallFont = false,
    containerSx,
    __dangerouslyDisableGridNavigation = false,
  }: StandardGridTableProps) => {
    const tableRef = React.useRef<HTMLTableElement | null>(null);

    const editorRegistryRef = React.useRef<Map<string, GridCellEditorHandle>>(new Map());

    const [focusedCell, setFocusedCellState] = React.useState<GridCellCoord | null>(null);
    const focusedCellRef = React.useRef<GridCellCoord | null>(null);

    const [editingCell, setEditingCellState] = React.useState<GridCellCoord | null>(null);
    const editingCellRef = React.useRef<GridCellCoord | null>(null);

    const pendingFocusPlanRef = React.useRef<FocusPlan | null>(null);
    React.useEffect(() => {
      focusedCellRef.current = focusedCell;
    }, [focusedCell]);

    React.useEffect(() => {
      editingCellRef.current = editingCell;
    }, [editingCell]);

    // VIGTIGT: Controller er stabilt objekt med state-setters.
    //
    // API INVARIANTER:
    // - setFocusedCell/setEditingCell er "raw setters" uden validering
    // - Consumers af Public API får adgang til disse - de skal bruges ansvarligt
    // - Domæne-kommandoer (openEditing, closeEditing, requestFocusPlan) håndterer validering
    // - På sigt bør raw setters måske flyttes til internal-only API
    const controller = React.useMemo<GridCoreController>(() => {
      const getFocusedCell = () => focusedCellRef.current;
      const getEditingCell = () => editingCellRef.current;

      // BEMÆRK: Disse raw setters validerer ikke invariants.
      // Brug openEditing/closeEditing/requestFocusPlan for sikre transitions.
      const setFocusedCell = (cell: GridCellCoord | null) => {
        focusedCellRef.current = cell;
        setFocusedCellState(cell);
      };

      const setEditingCell = (cell: GridCellCoord | null) => {
        editingCellRef.current = cell;
        setEditingCellState(cell);
      };

      const getEditor = (cell: GridCellCoord) => {
        return editorRegistryRef.current.get(gridCellKey(cell)) ?? null;
      };

      const registerEditor = (cell: GridCellCoord, handle: GridCellEditorHandle) => {
        editorRegistryRef.current.set(gridCellKey(cell), handle);
      };

      const unregisterEditor = (cell: GridCellCoord) => {
        editorRegistryRef.current.delete(gridCellKey(cell));
      };

      const closeEditing = () => {
        // KRITISK: Opdater ref synkront før state for at undgå race i executeFocusPlan
        // executeFocusPlan checker editingCellRef.current, som først opdateres ved næste render
        // hvis vi kun bruger setState. Ved at opdatere ref direkte sikrer vi at
        // executeFocusPlan ser "lukket" tilstand i samme tick.
        editingCellRef.current = null;
        setEditingCellState(null);

        // Eksekvér fokusplan immediately efter lukning (one-shot per close)
        // Dette sikrer at plan kun udføres én gang pr. editor-close transition
        executeFocusPlan();
      };

      const openEditing = (cell: GridCellCoord, source: GridOpenEditSource) => {
        const handle = getEditor(cell);
        if (handle?.getIsLocked() === true) return;

        // KRITISK: Ryd fokus-plan kun ved direkte bruger-initierede åbninger (ikke key-navigation)
        if (source === 'pointer' || source === 'doubleClick') {
          pendingFocusPlanRef.current = null;
        }

        if (source === 'key') {
          // prepareEditFromKey is invoked by tableKeyboardNavigation before opening.
          flushSync(() => setEditingCellState(cell));
          return;
        }

        if (source === 'pointer') {
          // Must be sync so the browser can place the caret on the click position.
          flushSync(() => setEditingCellState(cell));
          return;
        }

        flushSync(() => setEditingCellState(cell));
        handle?.selectAll();
      };

      const requestFocusPlan = (plan: FocusPlan) => {
        // Hvis editor er åben, skal fokus-plan IKKE gemmes (bruger-regel)
        if (editingCellRef.current !== null) {
          return;
        }
        pendingFocusPlanRef.current = plan;
      };

      const executeFocusPlan = () => {
        const plan = pendingFocusPlanRef.current;
        if (!plan) return;

        // Hvis editor er åben, skal fokus-plan IKKE udføres (bruger-regel)
        if (editingCellRef.current !== null) {
          pendingFocusPlanRef.current = null;
          return;
        }

        // Validér plan.to før eksekvering
        const toHandle = getEditor(plan.to);
        if (!toHandle || toHandle.getIsLocked()) {
          // Fallback: Forsøg at fokusere plan.from (deterministisk fallback med validering)
          const fromHandle = getEditor(plan.from);
          if (fromHandle && !fromHandle.getIsLocked()) {
            // Opdater state til from hvis vi ikke allerede er der
            setFocusedCell(plan.from);
          }
          // Ryd plan uanset om fallback lykkedes
          pendingFocusPlanRef.current = null;
          return;
        }

        // Udfør fokus-flytning til plan.to (state only)
        // VIGTIGT: Kun state-opdatering her. DOM-fokus sker via dedikeret effect.
        setFocusedCell(plan.to);

        // Ryd fokus-plan
        pendingFocusPlanRef.current = null;
      };

      const clearFocusPlan = () => {
        pendingFocusPlanRef.current = null;
      };

      const getPendingFocusPlan = () => pendingFocusPlanRef.current;

      return {
        getFocusedCell,
        setFocusedCell,
        getEditingCell,
        setEditingCell,
        openEditing,
        closeEditing,
        registerEditor,
        unregisterEditor,
        getEditor,
        requestFocusPlan,
        executeFocusPlan,
        clearFocusPlan,
        getPendingFocusPlan,
      };
    }, []);

    // VIGTIGT: Context value konstrueres eksplicit som facade.
    // Vi eksponerer IKKE controlleren direkte (undgår spread, type assertions).
    // Dette sikrer at:
    // - Interne metoder (executeFocusPlan, clearFocusPlan, setFocusedCell, setEditingCell) ikke lækkes
    // - Consumers kun får adgang til validerede domæne-kommandoer
    // - Invariants kan ikke brydes via public API
    const contextValue = React.useMemo<GridCoreContextValue>(() => {
      return {
        focusedCell,
        editingCell,
        openEditing: controller.openEditing,
        closeEditing: controller.closeEditing,
        registerEditor: controller.registerEditor,
        unregisterEditor: controller.unregisterEditor,
        getEditor: controller.getEditor,
        requestFocusPlan: controller.requestFocusPlan,
      };
    }, [controller, editingCell, focusedCell]);

    // Registry lifecycle effect
    //
    // VIGTIGT: table captures fra tableRef.current sikrer at attach/detach
    // arbejder på samme DOM-node gennem hele komponentens liv.
    //
    // Forudsætning: <table> ref ændrer sig ikke (ingen dynamisk key, ingen conditional mount).
    // Hvis table-elementet remounter, vil registry fail-fast ved double attach.
    React.useEffect(() => {
      const table = tableRef.current;
      if (!table) return;
      attachGridCoreToTable(table, controller);
      return () => {
        detachGridCoreFromTable(table);
      };
    }, [controller]);

    // State-drevet DOM focus effect
    //
    // VIGTIGT: Dette er den ENESTE kilde til DOM-fokusering i GridCore.
    // executeFocusPlan opdaterer KUN state. DOM-fokus afledes her fra focusedCell state.
    //
    // Dette sikrer:
    // - State → Render → DOM fokus i korrekt rækkefølge
    // - Ingen timing-race mellem state og DOM
    // - DOM fokus følger altid den committede render
    // - Staleness-guard: Fokuserer kun hvis target stadig matcher
    // - Cleanup: Annullerer rAF ved unmount eller ny fokusering
    React.useEffect(() => {
      if (focusedCell === null) return;

      // Capture target for staleness-guard
      const targetCell = focusedCell;

      const handle = controller.getEditor(targetCell);
      if (!handle || handle.getIsLocked()) return;

      const element = handle.getElement();
      if (!element) return;

      const rafId = requestAnimationFrame(() => {
        // Staleness-guard: Verificer at target stadig matcher aktuel focusedCell
        if (!areSameGridCellOrBothNull(focusedCellRef.current, targetCell)) {
          // Fokus har ændret sig - drop denne fokusering
          return;
        }

        // Re-hent element for at verificere det stadig er mounted efter render
        const currentElement = handle.getElement();
        if (currentElement && currentElement.isConnected) {
          currentElement.focus();
        }
      });

      // Cleanup: Annullér rAF ved unmount eller ny focusedCell
      return () => {
        cancelAnimationFrame(rafId);
      };
    }, [controller, focusedCell]);

    return (
      <Box sx={{ width: '100%', overflowX: 'auto', ...(containerSx ?? {}) }}>
        {beforeTable}
        <GridCoreProvider value={contextValue}>
          <table
            ref={tableRef}
            data-mineo-table-navigation="true"
            onKeyDownCapture={!__dangerouslyDisableGridNavigation ? handleTableKeyDownCapture : undefined}
            onBlurCapture={!__dangerouslyDisableGridNavigation ? handleTableBlurCapture : undefined}
            onFocusCapture={!__dangerouslyDisableGridNavigation ? handleTableFocusCapture : undefined}
            onPointerDownCapture={!__dangerouslyDisableGridNavigation ? handleTablePointerDownCapture : undefined}
            onDoubleClickCapture={!__dangerouslyDisableGridNavigation ? handleTableDoubleClickCapture : undefined}
            style={{
              ...getHtmlTableStyles(useSmallFont),
              width: tableWidth,
              tableLayout,
            }}
          >
            {children}
          </table>
        </GridCoreProvider>
      </Box>
    );
  }
);

StandardGridTable.displayName = 'StandardGridTable';

export type StandardGridHeaderCellProps = Readonly<{
  children: React.ReactNode;
  onClick?: () => void;
  sortRole?: GridSortRole;
  sortDirection?: GridSortDirection;
}>;

export const StandardGridHeaderCell = React.memo(({ children, onClick, sortRole = 'none', sortDirection = 'asc' }: StandardGridHeaderCellProps) => {
  const showIcon = sortRole !== 'none';
  const Icon = sortDirection === 'desc' ? KeyboardArrowDownIcon : KeyboardArrowUpIcon;
  const iconColor = sortRole === 'primary' ? '#1976d2' : 'rgba(0, 0, 0, 0.45)';
  return (
    <th
      style={{
        padding: '8px 4px',
        border: 'none',
        borderBottom: `1px solid ${tableColors.border}`,
        fontWeight: 500,
        textAlign: 'center',
        cursor: onClick ? 'pointer' : 'default',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        position: 'relative',
        backgroundColor: tableColors.headerBackground,
      }}
      onClick={onClick}
    >
      {children}
      {showIcon ? (
        <Icon
          sx={{
            position: 'absolute',
            bottom: 2,
            right: 2,
            fontSize: '14px',
            color: iconColor,
          }}
        />
      ) : null}
    </th>
  );
});

StandardGridHeaderCell.displayName = 'StandardGridHeaderCell';

export const getStandardGridBodyRowStyle = (rowIndex: number): CSSProperties => {
  return {
    backgroundColor: rowIndex % 2 === 0 ? tableColors.evenRowBackground : tableColors.oddRowBackground,
  };
};

export type StandardGridCellStyle = Readonly<{
  align?: 'left' | 'center' | 'right';
}>;

export const getStandardGridCellStyle = ({ align = 'center' }: StandardGridCellStyle = {}): CSSProperties => {
  return {
    padding: 0,
    border: 'none',
    textAlign: align,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    cursor: 'pointer', // Pegefinger-ikon over celler (Excel-stil)
  };
};
