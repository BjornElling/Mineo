import * as React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GridCoreProvider } from '../../../components/tables/gridCore/gridCoreContext';
import type { GridCellCoord } from '../../../components/tables/gridCore/gridCoreTypes';
import TableYearInput from '../../../components/inputs/table/TableYearInput';

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

describe('TableYearInput', () => {
  it('normalizes pasted text while not editing', async () => {
    const user = userEvent.setup();
    const gridCell = { rowId: 'row-1', colIndex: 0 };

    const Wrapper = () => {
      const [value, setValue] = React.useState('');
      const [editingCell, setEditingCell] = React.useState<GridCellCoord | null>(null);
      const gridValue = React.useMemo(() => createGridValue(gridCell, editingCell), [editingCell]);

      return (
        <GridCoreProvider value={gridValue}>
          <TableYearInput
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
    await user.paste(input, 'adffergregs//sgd1712,56//');

    expect(input).toHaveValue('1712');
  });
});
