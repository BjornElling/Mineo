import * as React from 'react';
import type { GridCellCoord, GridCorePublicAPI } from './gridCoreTypes';

export type GridCoreTableKind = 'grid' | 'loose';

/**
 * React Context value type for GridCore
 *
 * VIGTIGT: Dette er den offentlige API for GridCore.
 * Den er baseret på GridCorePublicAPI fra gridCoreTypes.ts
 * og sikrer at vi kun eksponerer det vi skal.
 *
 * ARKITEKTONISK BEGRÆNSNING:
 * Context blander state (focusedCell, editingCell) og API (methods).
 * Dette betyder at enhver ændring i focus/editing trigger rerender af alle consumers.
 * På sigt bør state og API måske splittes i to separate contexts for bedre performance.
 */
export type GridCoreStateContextValue = Readonly<{
  focusedCell: GridCellCoord | null;
  editingCell: GridCellCoord | null;
}>;

export type GridCoreApiContextValue = Readonly<
  GridCorePublicAPI & {
    tableKind?: GridCoreTableKind;
  }
>;

export type GridCoreContextValue = Readonly<GridCoreStateContextValue & GridCoreApiContextValue>;

const GridCoreStateReactContext = React.createContext<GridCoreStateContextValue | null>(null);
const GridCoreApiReactContext = React.createContext<GridCoreApiContextValue | null>(null);

/**
 * Hook til at få adgang til GridCore context
 *
 * VIGTIGT: Denne hook SKAL kaldes inden for en GridCoreProvider.
 * Kaster fejl hvis context mangler.
 *
 * @returns {GridCoreContextValue} GridCore context value
 */
export const useGridCore = (): GridCoreContextValue => {
  const state = useGridCoreState();
  const api = useGridCoreApi();
  return { ...state, ...api };
};

export const useGridCoreState = (): GridCoreStateContextValue => {
  const ctx = React.useContext(GridCoreStateReactContext);
  if (!ctx) throw new Error('useGridCoreState: missing GridCoreProvider in component tree');
  return ctx;
};

export const useGridCoreApi = (): GridCoreApiContextValue => {
  const ctx = React.useContext(GridCoreApiReactContext);
  if (!ctx) throw new Error('useGridCoreApi: missing GridCoreProvider in component tree');
  return ctx;
};

/**
 * GridCore Provider komponent
 *
 * Wrapper der leverer GridCore context til child-komponenter.
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
