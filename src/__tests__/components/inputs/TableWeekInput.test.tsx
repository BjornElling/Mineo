import * as React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GridCoreProvider } from '../../../components/tables/gridCore/gridCoreContext';
import type { GridCellCoord } from '../../../components/tables/gridCore/gridCoreTypes';
import TableWeekInput from '../../../components/inputs/table/TableWeekInput';

const createGridValue = (gridCell: GridCellCoord, editingCell: GridCellCoord | null) => {
  return {
    focusedCell: gridCell,
    editingCell,
    openEditing: vi.fn(),
    closeEditing: vi.fn(),
    registerEditor: vi.fn(),
    unregisterEditor: vi.fn(),
    getEditor: vi.fn().mockReturnValue(null),
    requestFocusPlan: vi.fn(),
  };
};

describe('TableWeekInput', () => {
  it('afviser uge 53 i år med kun 52 uger', async () => {
    const user = userEvent.setup();
    const gridCell = { rowId: 'row-1', colIndex: 0 };
    const onBlur = vi.fn();

    const Wrapper = () => {
      const [value, setValue] = React.useState('01/2025');
      const [editingCell, setEditingCell] = React.useState<GridCellCoord | null>(gridCell);
      const gridValue = React.useMemo(() => createGridValue(gridCell, editingCell), [editingCell]);

      return (
        <GridCoreProvider value={gridValue}>
          <TableWeekInput
            gridCell={gridCell}
            value={value}
            onBlur={(e) => {
              onBlur(e.target.value);
              setValue(e.target.value);
              setEditingCell(null);
            }}
          />
        </GridCoreProvider>
      );
    };

    render(<Wrapper />);

    const input = screen.getByRole('textbox');
    await user.click(input);
    await user.clear(input);
    await user.type(input, '53/2025');
    await user.tab();

    expect(onBlur).not.toHaveBeenCalled();
    expect(input).toHaveValue('53/2025');
    const describedBy = input.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    const errorEl = describedBy ? document.getElementById(describedBy) : null;
    expect(errorEl).toHaveTextContent('Uge skal være mellem 1 og 52');
  });

  it('accepterer uge 53 i år med 53 uger', async () => {
    const user = userEvent.setup();
    const gridCell = { rowId: 'row-2', colIndex: 0 };
    const onBlur = vi.fn();

    const Wrapper = () => {
      const [value, setValue] = React.useState('01/2004');
      const [editingCell, setEditingCell] = React.useState<GridCellCoord | null>(gridCell);
      const gridValue = React.useMemo(() => createGridValue(gridCell, editingCell), [editingCell]);

      return (
        <GridCoreProvider value={gridValue}>
          <TableWeekInput
            gridCell={gridCell}
            value={value}
            onBlur={(e) => {
              onBlur(e.target.value);
              setValue(e.target.value);
              setEditingCell(null);
            }}
          />
        </GridCoreProvider>
      );
    };

    render(<Wrapper />);

    const input = screen.getByRole('textbox');
    await user.click(input);
    await user.clear(input);
    await user.type(input, '53/2004');
    await user.tab();

    expect(onBlur).toHaveBeenCalledWith('53/2004');
    expect(input).toHaveValue('53/2004');
  });

  it('accepterer punktum som separator og normaliserer til slash', async () => {
    const user = userEvent.setup();
    const gridCell = { rowId: 'row-3', colIndex: 0 };
    const onBlur = vi.fn();

    const Wrapper = () => {
      const [value, setValue] = React.useState('01/2004');
      const [editingCell, setEditingCell] = React.useState<GridCellCoord | null>(gridCell);
      const gridValue = React.useMemo(() => createGridValue(gridCell, editingCell), [editingCell]);

      return (
        <GridCoreProvider value={gridValue}>
          <TableWeekInput
            gridCell={gridCell}
            value={value}
            onBlur={(e) => {
              onBlur(e.target.value);
              setValue(e.target.value);
              setEditingCell(null);
            }}
          />
        </GridCoreProvider>
      );
    };

    render(<Wrapper />);

    const input = screen.getByRole('textbox');
    await user.click(input);
    await user.clear(input);
    await user.type(input, '53.2004');
    await user.tab();

    expect(onBlur).toHaveBeenCalledWith('53/2004');
    expect(input).toHaveValue('53/2004');
  });
});
