import * as React from 'react';
import { flushSync } from 'react-dom';
import { areSameGridCellOrBothNull, gridCellKey } from './gridCoreUtils';
import type { FocusPlan, GridCellCoord, GridCellEditorHandle, GridCoreController, GridOpenEditSource } from './gridCoreTypes';
import { attachGridCoreToTable, detachGridCoreFromTable } from './gridCoreRegistry';
import type { GridCoreContextValue, GridCoreTableKind } from './gridCoreContext.shared';

type UseGridCoreControllerResult = Readonly<{
  internalTableRef: React.MutableRefObject<HTMLTableElement | null>;
  controller: GridCoreController;
  contextValue: GridCoreContextValue;
}>;

type UseGridCoreControllerOptions = Readonly<{
  tableKind?: GridCoreTableKind;
}>;

export const useGridCoreController = (options: UseGridCoreControllerOptions = {}): UseGridCoreControllerResult => {
  const tableKind = options.tableKind ?? 'grid';
  const internalTableRef = React.useRef<HTMLTableElement | null>(null);
  const editorRegistryRef = React.useRef<Map<string, GridCellEditorHandle>>(new Map());

  const [focusedCell, setFocusedCellState] = React.useState<GridCellCoord | null>(null);
  const focusedCellRef = React.useRef<GridCellCoord | null>(focusedCell);
  const [editingCell, setEditingCellState] = React.useState<GridCellCoord | null>(null);
  const editingCellRef = React.useRef<GridCellCoord | null>(editingCell);
  const pendingFocusPlanRef = React.useRef<FocusPlan | null>(null);

  const controller = React.useMemo<GridCoreController>(() => {
    const getFocusedCell = () => focusedCellRef.current;
    const getEditingCell = () => editingCellRef.current;

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
      editingCellRef.current = null;
      setEditingCellState(null);
      executeFocusPlan();
    };

    const openEditing = (cell: GridCellCoord, source: GridOpenEditSource) => {
      const handle = getEditor(cell);
      if (handle?.getIsLocked() === true) return;

      if (source === 'pointer' || source === 'doubleClick') {
        pendingFocusPlanRef.current = null;
      }

      editingCellRef.current = cell;
      flushSync(() => setEditingCellState(cell));
      if (source === 'doubleClick') {
        handle?.selectAll();
      }
    };

    const requestFocusPlan = (plan: FocusPlan) => {
      if (editingCellRef.current !== null) return;
      pendingFocusPlanRef.current = plan;
    };

    const executeFocusPlan = () => {
      const plan = pendingFocusPlanRef.current;
      if (!plan) return;

      if (editingCellRef.current !== null) {
        pendingFocusPlanRef.current = null;
        return;
      }

      const toHandle = getEditor(plan.to);
      if (!toHandle || toHandle.getIsLocked()) {
        const fromHandle = getEditor(plan.from);
        if (fromHandle && !fromHandle.getIsLocked()) {
          setFocusedCell(plan.from);
        }
        pendingFocusPlanRef.current = null;
        return;
      }

      setFocusedCell(plan.to);
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

  const contextValue = React.useMemo<GridCoreContextValue>(() => {
    return {
      focusedCell,
      editingCell,
      tableKind,
      openEditing: controller.openEditing,
      closeEditing: controller.closeEditing,
      registerEditor: controller.registerEditor,
      unregisterEditor: controller.unregisterEditor,
      getEditor: controller.getEditor,
      requestFocusPlan: controller.requestFocusPlan,
    };
  }, [controller, editingCell, focusedCell, tableKind]);

  React.useEffect(() => {
    const table = internalTableRef.current;
    if (!table) return;
    attachGridCoreToTable(table, controller);
    return () => {
      detachGridCoreFromTable(table);
    };
  }, [controller]);

  React.useEffect(() => {
    if (focusedCell === null) return;
    const targetCell = focusedCell;

    const handle = controller.getEditor(targetCell);
    if (!handle || handle.getIsLocked()) return;

    const element = handle.getElement();
    if (!element) return;

    const rafId = requestAnimationFrame(() => {
      if (!areSameGridCellOrBothNull(focusedCellRef.current, targetCell)) return;
      const currentElement = handle.getElement();
      if (currentElement && currentElement.isConnected) {
        currentElement.focus();
      }
    });

    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [controller, focusedCell]);

  return {
    internalTableRef,
    controller,
    contextValue,
  };
};
