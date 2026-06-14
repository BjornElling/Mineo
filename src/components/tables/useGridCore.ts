import * as React from 'react';
import type { GridCoreApiContextValue } from './gridCore/gridCoreContext.shared';
import { GridCoreApiReactContext, GridCoreStoreReactContext } from './gridCore/gridCoreContext.shared';
import type { GridCellCoord, GridCoreStateStore } from './gridCore/gridCoreTypes';
import { areSameGridCell } from './gridCore/gridCoreUtils';

export const useGridCoreStore = (): GridCoreStateStore => {
  const ctx = React.useContext(GridCoreStoreReactContext);
  if (!ctx) throw new Error('useGridCoreStore: missing GridCoreProvider in component tree');
  return ctx;
};

export const useGridCoreApi = (): GridCoreApiContextValue => {
  const ctx = React.useContext(GridCoreApiReactContext);
  if (!ctx) throw new Error('useGridCoreApi: missing GridCoreProvider in component tree');
  return ctx;
};

export const useGridCellFocus = (gridCell: GridCellCoord): boolean => {
  const store = useGridCoreStore();
  return React.useSyncExternalStore(
    store.subscribe,
    // Vigtigt: snapshot er en boolean. React kan derfor sikkert undgå re-render,
    // når andre cellers state ændrer sig men resultatet for denne celle forbliver `false`.
    () => areSameGridCell(store.getFocusedCell(), gridCell),
    () => areSameGridCell(store.getFocusedCell(), gridCell)
  );
};

export const useGridCellEditing = (gridCell: GridCellCoord): boolean => {
  const store = useGridCoreStore();
  return React.useSyncExternalStore(
    store.subscribe,
    // Samme invariant som useGridCellFocus: behold snapshot som primitive boolean.
    () => areSameGridCell(store.getEditingCell(), gridCell),
    () => areSameGridCell(store.getEditingCell(), gridCell)
  );
};
