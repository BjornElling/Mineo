import * as React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GridCoreProvider } from '../../../components/tables/gridCore/gridCoreContext';
import type { GridCellCoord } from '../../../components/tables/gridCore/gridCoreTypes';
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

  it('crasher ikke ved minDate > maxDate og viser konfigurationsfejl', () => {
    const gridCell = { rowId: 'row-3', colIndex: 0 };
    const gridValue = createGridValue(gridCell, gridCell);

    expect(() => {
      render(
        <GridCoreProvider value={gridValue}>
          <TableDateInput
            gridCell={gridCell}
            value="15-06-2025"
            minDate="2025-12-31"
            maxDate="2025-01-01"
          />
        </GridCoreProvider>
      );
    }).not.toThrow();

    const input = screen.getByRole('textbox');
    const describedBy = input.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    const errorEl = describedBy ? document.getElementById(describedBy) : null;
    expect(errorEl).toHaveTextContent('Ingen gyldige datoer');
  });

  it('revaliderer range-fejl når minDate ændres og rydder fejlen uden ny brugerinput', async () => {
    const user = userEvent.setup();
    const gridCell = { rowId: 'row-4', colIndex: 0 };

    const Wrapper = () => {
      const [value, setValue] = React.useState('01-01-2023');
      const [minDate, setMinDate] = React.useState('2024-01-01');
      const [editingCell, setEditingCell] = React.useState<GridCellCoord | null>(gridCell);
      const gridValue = React.useMemo(() => createGridValue(gridCell, editingCell), [editingCell]);

      return (
        <GridCoreProvider value={gridValue}>
          <button type="button" onClick={() => setMinDate('2023-01-01')}>
            loosen-min
          </button>
          <TableDateInput
            gridCell={gridCell}
            value={value}
            minDate={minDate}
            maxDate="2026-12-31"
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
    await user.tab();

    let describedBy = input.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    let errorEl = describedBy ? document.getElementById(describedBy) : null;
    expect(errorEl).toBeTruthy();
    expect(errorEl).toHaveTextContent(/Dato skal/);

    await user.click(screen.getByRole('button', { name: 'loosen-min' }));

    await waitFor(() => {
      describedBy = input.getAttribute('aria-describedby');
      expect(describedBy).toBeNull();
    });
  });
});
