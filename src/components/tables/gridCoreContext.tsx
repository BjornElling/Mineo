import * as React from 'react';
import type { GridCoreContextValue, GridCoreStateContextValue, GridCoreApiContextValue } from './gridCoreContext.shared';
import { GridCoreStateReactContext, GridCoreApiReactContext } from './gridCoreContext.shared';

export type { GridCoreTableKind, GridCoreStateContextValue, GridCoreApiContextValue, GridCoreContextValue } from './gridCoreContext.shared';

/**
 * GridCore — kanoniske import-stier:
 *   Provider:  import { GridCoreProvider } from './gridCoreContext'
 *   Hooks:     import { useGridCoreState, useGridCoreApi } from './useGridCore'
 *   Typer:     import type { ... } from './gridCoreContext.shared'  (eller via re-exports herfra)
 */

/**
 * GridCore Provider komponent
 *
 * State (focusedCell, editingCell) og API (methods) er splittet i to separate contexts
 * via GridCoreStateReactContext og GridCoreApiReactContext. Consumers skal bruge
 * useGridCoreState() eller useGridCoreApi() direkte fremfor useGridCore(), så de kun
 * re-renderer ved ændringer i den context de faktisk bruger.
 */
export const GridCoreProvider = ({ value, children }: { value: GridCoreContextValue; children: React.ReactNode }) => {
  const stateValue = React.useMemo<GridCoreStateContextValue>(
    () => ({ focusedCell: value.focusedCell, editingCell: value.editingCell }),
    [value.editingCell, value.focusedCell]
  );
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
      <GridCoreStateReactContext.Provider value={stateValue}>{children}</GridCoreStateReactContext.Provider>
    </GridCoreApiReactContext.Provider>
  );
};
