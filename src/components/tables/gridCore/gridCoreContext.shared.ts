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

export type GridCoreLegacyStateContextValue = Readonly<{
  focusedCell: GridCellCoord | null;
  editingCell: GridCellCoord | null;
}>;

export type GridCoreContextValue = Readonly<
  GridCoreApiContextValue &
    (
      | {
          gridStateStore: GridCoreStateStore;
        }
      | GridCoreLegacyStateContextValue
    )
>;

export const GridCoreApiReactContext = React.createContext<GridCoreApiContextValue | null>(null);
export const GridCoreStoreReactContext = React.createContext<GridCoreStateStore | null>(null);
