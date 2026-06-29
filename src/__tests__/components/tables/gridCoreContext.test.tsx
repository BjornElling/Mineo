// @vitest-environment jsdom
import * as React from 'react';
import { act, render, screen } from '@testing-library/react';
import { GridCoreProvider } from '../../../components/tables/gridCore/gridCoreContext';
import { useGridCellEditing, useGridCellFocus } from '../../../components/tables/useGridCore';
import type { GridCellCoord, GridCoreStateStore } from '../../../components/tables/gridCore/gridCoreTypes';

const GRID_CELL: GridCellCoord = { rowId: 'row-1', colIndex: 0 };

describe('GridCoreProvider', () => {
  it('state store notifies useSyncExternalStore consumers when focused/editing cell changes', () => {
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
      const listenersRef = React.useRef<Set<() => void>>(new Set());

      React.useEffect(() => {
        setFocusedCellRef.current = setFocusedCell;
        setEditingCellRef.current = setEditingCell;
      }, []);

      React.useEffect(() => {
        listenersRef.current.forEach((listener) => listener());
      }, [editingCell, focusedCell]);

      const gridStateStore = React.useMemo<GridCoreStateStore>(() => ({
        subscribe: (listener) => {
          listenersRef.current.add(listener);
          return () => {
            listenersRef.current.delete(listener);
          };
        },
        getFocusedCell: () => focusedCell,
        getEditingCell: () => editingCell,
      }), [editingCell, focusedCell]);

      return (
        <GridCoreProvider
          value={{
            gridStateStore,
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
