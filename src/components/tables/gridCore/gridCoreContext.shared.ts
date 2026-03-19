import * as React from 'react';
import type { GridCorePublicAPI } from './gridCoreTypes';

export type GridCoreTableKind = 'grid' | 'loose';

export type GridCoreStateContextValue = Readonly<{
  focusedCell: import('./gridCoreTypes').GridCellCoord | null;
  editingCell: import('./gridCoreTypes').GridCellCoord | null;
}>;

export type GridCoreApiContextValue = Readonly<
  GridCorePublicAPI & {
    tableKind?: GridCoreTableKind;
  }
>;

export type GridCoreContextValue = Readonly<GridCoreStateContextValue & GridCoreApiContextValue>;

export const GridCoreStateReactContext = React.createContext<GridCoreStateContextValue | null>(null);
export const GridCoreApiReactContext = React.createContext<GridCoreApiContextValue | null>(null);
