import * as React from 'react';
import type { GridCellCoord, GridCorePublicAPI, GridCoreStateStore } from './gridCoreTypes';

export type GridCoreTableKind = 'grid' | 'loose';

export type GridCoreStateContextValue = Readonly<{
  focusedCell: GridCellCoord | null;
  editingCell: GridCellCoord | null;
}>;

export type GridCoreApiContextValue = Readonly<
  GridCorePublicAPI & {
    tableKind?: GridCoreTableKind;
  }
>;

export type GridCoreProviderValue = Readonly<
  GridCoreApiContextValue & {
    gridStateStore: GridCoreStateStore;
  }
>;

export type GridCoreContextValue = Readonly<GridCoreStateContextValue & GridCoreApiContextValue>;

export const GridCoreApiReactContext = React.createContext<GridCoreApiContextValue | null>(null);
export const GridCoreStoreReactContext = React.createContext<GridCoreStateStore | null>(null);
