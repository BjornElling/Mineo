import * as React from 'react';
import { flushSync } from 'react-dom';
import { areSameGridCellOrBothNull, gridCellKey } from './gridCore/gridCoreUtils';
import type { FocusPlan, GridCellCoord, GridCellEditorHandle, GridCoreController, GridCoreStateStore, GridOpenEditSource } from './gridCore/gridCoreTypes';
import { attachGridCoreToTable, detachGridCoreFromTable } from './gridCore/gridCoreRegistry';
import type { GridCoreProviderValue, GridCoreTableKind } from './gridCore/gridCoreContext.shared';

type UseGridCoreControllerResult = Readonly<{
  internalTableRef: React.RefObject<HTMLTableElement | null>;
  controller: GridCoreController;
  contextValue: GridCoreProviderValue;
}>;

type UseGridCoreControllerOptions = Readonly<{
  tableKind?: GridCoreTableKind;
}>;

export const useGridCoreController = (options: UseGridCoreControllerOptions = {}): UseGridCoreControllerResult => {
  const tableKind = options.tableKind ?? 'grid';
  const internalTableRef = React.useRef<HTMLTableElement | null>(null);
  const editorRegistryRef = React.useRef<Map<string, GridCellEditorHandle>>(new Map());

  const focusedCellRef = React.useRef<GridCellCoord | null>(null);
  const editingCellRef = React.useRef<GridCellCoord | null>(null);
  const pendingFocusPlanRef = React.useRef<FocusPlan | null>(null);
  const listenersRef = React.useRef<Set<() => void>>(new Set());
  const focusRafIdRef = React.useRef<number | null>(null);
  const pendingStoreNotificationRef = React.useRef(false);
  const [storeVersion, bumpStoreVersion] = React.useReducer((value: number) => value + 1, 0);

  const scheduleCellFocus = React.useCallback((cell: GridCellCoord | null) => {
    if (focusRafIdRef.current !== null) {
      cancelAnimationFrame(focusRafIdRef.current);
      focusRafIdRef.current = null;
    }

    if (cell === null) return;

    focusRafIdRef.current = requestAnimationFrame(() => {
      focusRafIdRef.current = null;
      if (!areSameGridCellOrBothNull(focusedCellRef.current, cell)) return;
      const handle = editorRegistryRef.current.get(gridCellKey(cell));
      if (!handle || handle.getIsLocked()) return;
      const element = handle.getElement();
      if (element && element.isConnected) {
        // preventScroll: navigations-grenene har allerede positioneret cellen via focusTableElement
        // (preventScroll). En rå .focus() her ville scrolle cellen i syne igen og give et scroll-hop
        // (jf. keyboard-navigation.md "ingen scroll-hop"). Denne RAF skal kun bekræfte DOM-fokus.
        element.focus({ preventScroll: true });
      }
    });
  }, []);

  const notifyStoreChange = React.useCallback((synchronously: boolean) => {
    pendingStoreNotificationRef.current = true;
    if (synchronously) {
      flushSync(() => {
        bumpStoreVersion();
      });
      return;
    }
    bumpStoreVersion();
  }, []);

  React.useLayoutEffect(() => {
    if (!pendingStoreNotificationRef.current) return;
    pendingStoreNotificationRef.current = false;
    listenersRef.current.forEach((listener) => listener());
  }, [storeVersion]);

  const gridStateStore = React.useMemo<GridCoreStateStore>(() => {
    return {
      subscribe: (listener) => {
        listenersRef.current.add(listener);
        return () => {
          listenersRef.current.delete(listener);
        };
      },
      getFocusedCell: () => focusedCellRef.current,
      getEditingCell: () => editingCellRef.current,
    };
  }, []);

  const controller = React.useMemo<GridCoreController>(() => {
    const getFocusedCell = () => focusedCellRef.current;
    const getEditingCell = () => editingCellRef.current;

    const setFocusedCell = (cell: GridCellCoord | null) => {
      if (areSameGridCellOrBothNull(focusedCellRef.current, cell)) return;
      focusedCellRef.current = cell;
      notifyStoreChange(false);
      scheduleCellFocus(cell);
    };

    const setEditingCell = (cell: GridCellCoord | null, options?: Readonly<{ synchronously?: boolean }>) => {
      if (areSameGridCellOrBothNull(editingCellRef.current, cell)) return;
      editingCellRef.current = cell;
      notifyStoreChange(options?.synchronously === true);
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
      setEditingCell(null);
      executeFocusPlan();
    };

    const openEditing = (cell: GridCellCoord, source: GridOpenEditSource) => {
      const handle = getEditor(cell);
      if (handle?.getIsLocked() === true) return;

      if (source === 'pointer' || source === 'doubleClick') {
        pendingFocusPlanRef.current = null;
      }

      handle?.openCurrent?.();
      setEditingCell(cell, { synchronously: true });
      if (source === 'doubleClick') {
        requestAnimationFrame(() => {
          if (areSameGridCellOrBothNull(editingCellRef.current, cell)) {
            handle?.selectAll();
          }
        });
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
  }, [notifyStoreChange, scheduleCellFocus]);

  const contextValue = React.useMemo<GridCoreProviderValue>(() => {
    return {
      gridStateStore,
      tableKind,
      openEditing: controller.openEditing,
      closeEditing: controller.closeEditing,
      registerEditor: controller.registerEditor,
      unregisterEditor: controller.unregisterEditor,
      getEditor: controller.getEditor,
      requestFocusPlan: controller.requestFocusPlan,
    };
  }, [controller, gridStateStore, tableKind]);

  // Den åbne celleeditor barriereres gennem input-runtimens `ActiveEditorRegistry` og
  // `CriticalActionCoordinator` (§3.5/§3.6), som `useGridCellSurface` melder cellen ind i.

  React.useEffect(() => {
    const table = internalTableRef.current;
    if (!table) return;
    attachGridCoreToTable(table, controller);
    return () => {
      detachGridCoreFromTable(table);
    };
  }, [controller]);

  React.useEffect(() => {
    const handleDocumentPointerDown = (event: PointerEvent) => {
      const table = internalTableRef.current;
      if (!table) return;
      const target = event.target;
      if (target instanceof Node && table.contains(target)) return;

      const editingCell = controller.getEditingCell();
      if (!editingCell) return;
      const editor = controller.getEditor(editingCell);
      if (!editor || editor.getIsLocked()) return;
      editor.commitCurrent();
    };

    document.addEventListener('pointerdown', handleDocumentPointerDown, true);
    return () => {
      document.removeEventListener('pointerdown', handleDocumentPointerDown, true);
    };
  }, [controller]);

  React.useEffect(() => {
    return () => {
      if (focusRafIdRef.current !== null) {
        cancelAnimationFrame(focusRafIdRef.current);
      }
    };
  }, []);

  return {
    internalTableRef,
    controller,
    contextValue,
  };
};
