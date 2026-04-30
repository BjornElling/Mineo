import type { GridCellCoord, GridCoreStateStore } from '../../../components/tables/gridCore/gridCoreTypes';

export const createGridCoreTestStateStore = (
  focusedCell: GridCellCoord | null,
  editingCell: GridCellCoord | null
): GridCoreStateStore => ({
  subscribe: () => () => undefined,
  getFocusedCell: () => focusedCell,
  getEditingCell: () => editingCell,
});
