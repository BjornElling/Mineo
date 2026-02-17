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
export type GridCoreContextValue = Readonly<
  GridCorePublicAPI & {
    focusedCell: GridCellCoord | null;
    editingCell: GridCellCoord | null;
    tableKind?: GridCoreTableKind;
  }
>;

const GridCoreReactContext = React.createContext<GridCoreContextValue | null>(null);

/**
 * Hook til at få adgang til GridCore context
 *
 * VIGTIGT: Denne hook SKAL kaldes inden for en GridCoreProvider.
 * Kaster fejl hvis context mangler.
 *
 * @returns {GridCoreContextValue} GridCore context value
 */
export const useGridCore = (): GridCoreContextValue => {
  const ctx = React.useContext(GridCoreReactContext);
  if (!ctx) {
    throw new Error('useGridCore: missing GridCoreProvider in component tree');
  }
  return ctx;
};

/**
 * GridCore Provider komponent
 *
 * Wrapper der leverer GridCore context til child-komponenter.
 */
export const GridCoreProvider = ({ value, children }: { value: GridCoreContextValue; children: React.ReactNode }) => {
  return <GridCoreReactContext.Provider value={value}>{children}</GridCoreReactContext.Provider>;
};
