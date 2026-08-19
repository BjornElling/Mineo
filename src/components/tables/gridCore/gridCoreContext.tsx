import * as React from 'react';
import type { GridCoreApiContextValue, GridCoreProviderValue } from './gridCoreContext.shared';
import { GridCoreApiReactContext, GridCoreStoreReactContext } from './gridCoreContext.shared';

export type { GridCoreTableKind, GridCoreStateContextValue, GridCoreApiContextValue, GridCoreContextValue, GridCoreProviderValue } from './gridCoreContext.shared';

/**
 * GridCore – kanoniske import-stier:
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
export const GridCoreProvider = ({ value, children }: { value: GridCoreProviderValue; children: React.ReactNode }) => {
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
      <GridCoreStoreReactContext.Provider value={value.gridStateStore}>{children}</GridCoreStoreReactContext.Provider>
    </GridCoreApiReactContext.Provider>
  );
};
