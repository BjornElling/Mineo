import * as React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GridCoreProvider } from '../../../components/tables/gridCoreContext';
import type { GridCellCoord } from '../../../components/tables/gridCoreTypes';
import TableDateInput from '../../../components/inputs/table/TableDateInput';

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

describe('TableDateInput', () => {
  it('commits formatted date and shows range error when out of range', async () => {
    const user = userEvent.setup();
    const gridCell = { rowId: 'row-1', colIndex: 0 };

    const Wrapper = () => {
      const [value, setValue] = React.useState('');
      const [editingCell, setEditingCell] = React.useState<GridCellCoord | null>(gridCell);
      const gridValue = React.useMemo(() => createGridValue(gridCell, editingCell), [editingCell]);

      return (
        <GridCoreProvider value={gridValue}>
          <TableDateInput
            gridCell={gridCell}
            value={value}
            minDate="2020-01-01"
            maxDate="2020-12-31"
            onBlur={(e) => {
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
    await user.type(input, '1-1-28');
    await user.tab();

    expect(input).toHaveValue('01-01-2028');
    const describedBy = input.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    const errorEl = describedBy ? document.getElementById(describedBy) : null;
    expect(errorEl).toBeTruthy();
    expect(errorEl).toHaveTextContent(/Dato skal/);
  });

  it('keeps invalid format and shows error', async () => {
    const user = userEvent.setup();
    const gridCell = { rowId: 'row-2', colIndex: 0 };

    const Wrapper = () => {
      const [value, setValue] = React.useState('');
      const [editingCell, setEditingCell] = React.useState<GridCellCoord | null>(gridCell);
      const gridValue = React.useMemo(() => createGridValue(gridCell, editingCell), [editingCell]);

      return (
        <GridCoreProvider value={gridValue}>
          <TableDateInput
            gridCell={gridCell}
            value={value}
            onBlur={(e) => {
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
    await user.type(input, '1-1');
    await user.tab();

    expect(input).toHaveValue('1-1');
    const describedBy = input.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    const errorEl = describedBy ? document.getElementById(describedBy) : null;
    expect(errorEl).toBeTruthy();
    expect(errorEl).toHaveTextContent('Ugyldig dato');
  });
});
