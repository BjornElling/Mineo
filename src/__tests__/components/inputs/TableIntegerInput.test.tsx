// @vitest-environment jsdom
import * as React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GridCoreProvider } from '../../../components/tables/gridCore/gridCoreContext';
import type { GridCellCoord } from '../../../components/tables/gridCore/gridCoreTypes';
import TableIntegerInput from '../../../components/inputs/table/TableIntegerInput';
import { createGridCoreTestStateStore } from './gridCoreTestUtils';

const createGridValue = (gridCell: GridCellCoord, editingCell: GridCellCoord | null) => {
  return {
    gridStateStore: createGridCoreTestStateStore(gridCell, editingCell),
    openEditing: vi.fn(),
    closeEditing: vi.fn(),
    registerEditor: vi.fn(),
    unregisterEditor: vi.fn(),
    getEditor: vi.fn().mockReturnValue(null),
    requestFocusPlan: vi.fn(),
  };
};

describe('TableIntegerInput', () => {
  it('normalizes pasted text while not editing', async () => {
    const user = userEvent.setup();
    const gridCell = { rowId: 'row-1', colIndex: 0 };

    const Wrapper = () => {
      const [value, setValue] = React.useState('');
      const [editingCell, setEditingCell] = React.useState<GridCellCoord | null>(null);
      const gridValue = React.useMemo(() => createGridValue(gridCell, editingCell), [editingCell]);

      return (
        <GridCoreProvider value={gridValue}>
          <TableIntegerInput
            gridCell={gridCell}
            value={value}
            maxDigits={4}
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
    input.focus();
    await user.paste('adffergregs//sgd1712,56//');

    expect(input).toHaveValue('1712');
  });

  it('does not infer negative integer paste in table input because negatives are unsupported there', async () => {
    const user = userEvent.setup();
    const gridCell = { rowId: 'row-2', colIndex: 0 };

    const Wrapper = () => {
      const [value, setValue] = React.useState('');
      const [editingCell, setEditingCell] = React.useState<GridCellCoord | null>(null);
      const gridValue = React.useMemo(() => createGridValue(gridCell, editingCell), [editingCell]);

      return (
        <GridCoreProvider value={gridValue}>
          <TableIntegerInput
            gridCell={gridCell}
            value={value}
            maxDigits={4}
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
    input.focus();
    await user.paste('abc - 1712,56');

    expect(input).toHaveValue('1712');
  });
});
