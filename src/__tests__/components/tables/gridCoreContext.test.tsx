import * as React from 'react';
import { act, render, screen } from '@testing-library/react';
import { GridCoreProvider } from '../../../components/tables/gridCore/gridCoreContext';
import { useGridCellEditing, useGridCellFocus } from '../../../components/tables/useGridCore';
import type { GridCellCoord } from '../../../components/tables/gridCore/gridCoreTypes';

const GRID_CELL: GridCellCoord = { rowId: 'row-1', colIndex: 0 };

describe('GridCoreProvider', () => {
  it('legacy value-path notifies useSyncExternalStore consumers when focused/editing cell changes', () => {
    const setFocusedCellRef = { current: null as React.Dispatch<React.SetStateAction<GridCellCoord | null>> | null };
    const setEditingCellRef = { current: null as React.Dispatch<React.SetStateAction<GridCellCoord | null>> | null };

    const Probe = () => {
      const focused = useGridCellFocus(GRID_CELL);
      const editing = useGridCellEditing(GRID_CELL);
      return <div>{`${focused ? 'focused' : 'blurred'}:${editing ? 'editing' : 'closed'}`}</div>;
    };

    const Wrapper = () => {
      const [focusedCell, setFocusedCell] = React.useState<GridCellCoord | null>(null);
      const [editingCell, setEditingCell] = React.useState<GridCellCoord | null>(null);

      React.useEffect(() => {
        setFocusedCellRef.current = setFocusedCell;
        setEditingCellRef.current = setEditingCell;
      }, []);

      return (
        <GridCoreProvider
          value={{
            focusedCell,
            editingCell,
            openEditing: () => undefined,
            closeEditing: () => undefined,
            registerEditor: () => undefined,
            unregisterEditor: () => undefined,
            getEditor: () => null,
            requestFocusPlan: () => undefined,
          }}
        >
          <Probe />
        </GridCoreProvider>
      );
    };

    render(<Wrapper />);

    expect(screen.getByText('blurred:closed')).toBeInTheDocument();

    act(() => {
      setFocusedCellRef.current?.(GRID_CELL);
      setEditingCellRef.current?.(GRID_CELL);
    });

    expect(screen.getByText('focused:editing')).toBeInTheDocument();

    act(() => {
      setEditingCellRef.current?.(null);
    });

    expect(screen.getByText('focused:closed')).toBeInTheDocument();
  });
});
