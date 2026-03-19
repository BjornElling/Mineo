import * as React from 'react';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { GridCoreProvider } from '../../../components/tables/gridCore/gridCoreContext';
import type { GridCellCoord } from '../../../components/tables/gridCore/gridCoreTypes';
import TablePercentInput from '../../../components/inputs/table/TablePercentInput';

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

describe('TablePercentInput', () => {
  it('accepterer commit over 100 når maxValue er højere', async () => {
    const user = userEvent.setup();
    const gridCell = { rowId: 'row-1', colIndex: 0 };
    const onBlur = vi.fn();

    const Wrapper = () => {
      const [value, setValue] = React.useState<string>('');
      const [editingCell, setEditingCell] = React.useState<GridCellCoord | null>(gridCell);
      const gridValue = React.useMemo(() => createGridValue(gridCell, editingCell), [editingCell]);

      return (
        <GridCoreProvider value={gridValue}>
          <TablePercentInput
            gridCell={gridCell}
            value={value}
            minValue={0}
            maxValue={200}
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
    await user.type(input, '150,25');
    await user.tab();

    expect(onBlur).toHaveBeenCalledWith('150,25');
    expect(input).toHaveValue('150,25 %');
  });

  it('tillader indtastning over maxValue under typing', async () => {
    const user = userEvent.setup();
    const gridCell = { rowId: 'row-1', colIndex: 0 };
    const onBlur = vi.fn();

    const Wrapper = () => {
      const [value, setValue] = React.useState<string>('');
      const [editingCell, setEditingCell] = React.useState<GridCellCoord | null>(gridCell);
      const gridValue = React.useMemo(() => createGridValue(gridCell, editingCell), [editingCell]);

      return (
        <GridCoreProvider value={gridValue}>
          <TablePercentInput
            gridCell={gridCell}
            value={value}
            minValue={0}
            maxValue={100}
            allowDecimals={false}
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
    await user.type(input, '101');
    await act(async () => {
      input.blur();
    });

    expect(input).toHaveValue('101');
    if (onBlur.mock.calls.length > 0) {
      expect(onBlur).toHaveBeenLastCalledWith('101');
    }
  });
});
