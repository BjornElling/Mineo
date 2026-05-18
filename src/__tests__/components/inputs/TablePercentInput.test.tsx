import * as React from 'react';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GridCoreProvider } from '../../../components/tables/gridCore/gridCoreContext';
import type { GridCellCoord } from '../../../components/tables/gridCore/gridCoreTypes';
import TablePercentInput from '../../../components/inputs/table/TablePercentInput';
import { createPercentCommittedPayload, createPercentTableInputAdapter } from '../../../hooks/tableInput';
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

describe('TablePercentInput', () => {
  it('bruger numerisk canonical som grundlag for percent fingerprint', () => {
    const payload = createPercentCommittedPayload('12,50', true);

    expect(payload.model).toBe('12,50');
    expect(payload.canonical).toBe('12.50');
  });

  it('bevarer fingerprint gennem parse af committed display-string', () => {
    const adapter = createPercentTableInputAdapter({
      allowNegative: false,
      allowDecimals: true,
      minValue: 0,
      maxValue: 100,
    });
    const committed = '12,50';
    const parsed = adapter.parse(committed);

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(adapter.toCommittedPayload(parsed.value).fingerprint).toBe(adapter.toCommittedPayload(committed).fingerprint);
  });

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

  it('normalizes pasted text to the longest prefix under default max while not editing', async () => {
    const user = userEvent.setup();
    const gridCell = { rowId: 'row-2', colIndex: 0 };
    const onBlur = vi.fn();

    const Wrapper = () => {
      const [value, setValue] = React.useState<string>('');
      const [editingCell, setEditingCell] = React.useState<GridCellCoord | null>(null);
      const gridValue = React.useMemo(() => createGridValue(gridCell, editingCell), [editingCell]);

      return (
        <GridCoreProvider value={gridValue}>
          <TablePercentInput
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
    await user.paste(input, 'adffergregs//sgd1712,56//');

    expect(onBlur).toHaveBeenCalledWith('17,00');
    expect(input).toHaveValue('17,00 %');
  });

  it('normalizes pasted text against explicit maxValue while not editing', async () => {
    const user = userEvent.setup();
    const gridCell = { rowId: 'row-3', colIndex: 0 };
    const onBlur = vi.fn();

    const Wrapper = () => {
      const [value, setValue] = React.useState<string>('');
      const [editingCell, setEditingCell] = React.useState<GridCellCoord | null>(null);
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
    await user.paste(input, 'adffergregs//sgd1712,56//');

    expect(onBlur).toHaveBeenCalledWith('171,00');
    expect(input).toHaveValue('171,00 %');
  });
});
