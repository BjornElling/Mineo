import * as React from 'react';
import type { GridCoreContextValue, GridCoreStateContextValue, GridCoreApiContextValue } from './gridCore/gridCoreContext.shared';
import { GridCoreApiReactContext, GridCoreStoreReactContext } from './gridCore/gridCoreContext.shared';
import type { GridCellCoord, GridCoreStateStore } from './gridCore/gridCoreTypes';
import { areSameGridCell } from './gridCore/gridCoreUtils';

const getGridStateSnapshot = (store: GridCoreStateStore): GridCoreStateContextValue => ({
  focusedCell: store.getFocusedCell(),
  editingCell: store.getEditingCell(),
});

export const useGridCoreStore = (): GridCoreStateStore => {
  const ctx = React.useContext(GridCoreStoreReactContext);
  if (!ctx) throw new Error('useGridCoreStore: missing GridCoreProvider in component tree');
  return ctx;
};

export const useGridCoreState = (): GridCoreStateContextValue => {
  const store = useGridCoreStore();
  return React.useSyncExternalStore(
    store.subscribe,
    () => getGridStateSnapshot(store),
    () => getGridStateSnapshot(store)
  );
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

/**
 * Kombineret hook der abonnerer på begge GridCore-contexts.
 * Brug kun denne hvis komponenten har brug for både state og API.
 * Ellers foretrækkes useGridCellFocus()/useGridCellEditing() eller useGridCoreApi() direkte.
 *
 * ADVARSEL: Returnerer et nyt objekt-spread ved hvert render — er ikke referentielt stabil.
 * Må ikke bruges som basis for useMemo/useCallback-deps eller sendes som prop til
 * React.memo-wrappede komponenter. Brug celle-specifikke GridCore-hooks og/eller useGridCoreApi() separat i de tilfælde.
 */
export const useGridCore = (): GridCoreContextValue => {
  const state = useGridCoreState();
  const api = useGridCoreApi();
  return { ...state, ...api };
};
