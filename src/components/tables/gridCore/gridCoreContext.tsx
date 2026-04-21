import * as React from 'react';
import type { GridCoreContextValue, GridCoreLegacyStateContextValue, GridCoreApiContextValue } from './gridCoreContext.shared';
import { GridCoreApiReactContext, GridCoreStoreReactContext } from './gridCoreContext.shared';
import type { GridCoreStateStore } from './gridCoreTypes';

export type { GridCoreTableKind, GridCoreStateContextValue, GridCoreApiContextValue, GridCoreContextValue } from './gridCoreContext.shared';

/**
 * GridCore — kanoniske import-stier:
 *   Provider:  import { GridCoreProvider } from './gridCoreContext'
 *   Hooks:     import { useGridCellFocus, useGridCellEditing, useGridCoreApi } from './useGridCore'
 *   Typer:     import type { ... } from './gridCoreContext.shared'  (eller via re-exports herfra)
 */

/**
 * GridCore Provider komponent
 *
 * API ligger i React context, mens focused/editing-state leveres via en stabil ekstern store.
 * Consumers skal abonnere via useSyncExternalStore-baserede hooks for celle-specifikke snapshots.
 */
export const GridCoreProvider = ({ value, children }: { value: GridCoreContextValue; children: React.ReactNode }) => {
  const legacyStateRef = React.useRef<GridCoreLegacyStateContextValue | null>(null);
  const legacyListenersRef = React.useRef<Set<() => void>>(new Set());
  const warnedAboutLegacyValueRef = React.useRef(false);
  const legacyStateStore = React.useMemo<GridCoreStateStore>(() => ({
    subscribe: (listener) => {
      legacyListenersRef.current.add(listener);
      return () => {
        legacyListenersRef.current.delete(listener);
      };
    },
    getFocusedCell: () => legacyStateRef.current?.focusedCell ?? null,
    getEditingCell: () => legacyStateRef.current?.editingCell ?? null,
  }), []);
  const legacyFocusedCell = 'gridStateStore' in value ? null : value.focusedCell;
  const legacyEditingCell = 'gridStateStore' in value ? null : value.editingCell;

  React.useEffect(() => {
    if ('gridStateStore' in value) return;
    legacyStateRef.current = {
      focusedCell: value.focusedCell,
      editingCell: value.editingCell,
    };
    legacyListenersRef.current.forEach((listener) => listener());
  }, [legacyEditingCell, legacyFocusedCell, value]);

  React.useEffect(() => {
    if (import.meta.env.PROD || import.meta.env.MODE === 'test' || warnedAboutLegacyValueRef.current || 'gridStateStore' in value) return;
    warnedAboutLegacyValueRef.current = true;
    console.warn('GridCoreProvider: legacy focusedCell/editingCell value is deprecated. Migrate callsites to gridStateStore.');
  }, [value]);

  const stateStore = 'gridStateStore' in value ? value.gridStateStore : legacyStateStore;

  const apiValue = React.useMemo<GridCoreApiContextValue>(
    () => ({
      tableKind: value.tableKind,
      openEditing: value.openEditing,
      closeEditing: value.closeEditing,
      registerEditor: value.registerEditor,
      unregisterEditor: value.unregisterEditor,
      getEditor: value.getEditor,
      requestFocusPlan: value.requestFocusPlan,
    }),
    [value.closeEditing, value.getEditor, value.openEditing, value.registerEditor, value.requestFocusPlan, value.tableKind, value.unregisterEditor]
  );
  return (
    <GridCoreApiReactContext.Provider value={apiValue}>
      <GridCoreStoreReactContext.Provider value={stateStore}>{children}</GridCoreStoreReactContext.Provider>
    </GridCoreApiReactContext.Provider>
  );
};
