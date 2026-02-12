import * as React from 'react';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { GridCoreProvider } from '../../../components/tables/gridCoreContext';
import type { GridCellCoord, GridCellEditorHandle } from '../../../components/tables/gridCoreTypes';
import TableAmountInput from '../../../components/inputs/table/TableAmountInput';
import type { AmountValue } from '../../../schemas/amountExpressionSchema';
import * as expressionAmountModule from '../../../utils/expressionAmount';

const gridCell: GridCellCoord = { rowId: 'row-1', colIndex: 0 };

const setup = (initialValue: AmountValue | undefined) => {
  const onBlur = vi.fn();
  let editorHandle: GridCellEditorHandle | null = null;
  const setEditingCellRef = { current: null as React.Dispatch<React.SetStateAction<GridCellCoord | null>> | null };

  const Wrapper = () => {
    const [value, setValue] = React.useState<AmountValue | undefined>(initialValue);
    const [editingCell, setEditingCell] = React.useState<GridCellCoord | null>(gridCell);

    React.useEffect(() => {
      setEditingCellRef.current = setEditingCell;
    }, [setEditingCell]);

    const gridValue = React.useMemo(
      () => ({
        focusedCell: gridCell,
        editingCell,
        openEditing: vi.fn(),
        closeEditing: () => setEditingCell(null),
        registerEditor: (_cell: GridCellCoord, handle: GridCellEditorHandle) => {
          editorHandle = handle;
        },
        unregisterEditor: vi.fn(),
        getEditor: () => editorHandle,
        requestFocusPlan: vi.fn(),
      }),
      [editingCell]
    );

    return (
      <GridCoreProvider value={gridValue}>
        <TableAmountInput
          gridCell={gridCell}
          value={value}
          onBlur={(e) => {
            onBlur(e);
            setValue(e.target.value);
            setEditingCell(null);
          }}
        />
      </GridCoreProvider>
    );
  };

  render(<Wrapper />);

  const input = screen.getByRole('textbox');
  const setEditingCell = (next: GridCellCoord | null) => {
    if (!setEditingCellRef.current) return;
    act(() => {
      setEditingCellRef.current?.(next);
    });
  };

  return { input, onBlur, setEditingCell };
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('no-op bruger committed fingerprint', () => {
  it('emitter ikke commit på no-op og parser ikke committed værdi igen', async () => {
    const user = userEvent.setup();
    const parseSpy = vi.spyOn(expressionAmountModule, 'parseAmountInput');
    const { input, onBlur, setEditingCell } = setup({ kind: 'expression', expression: '1+2', value: 3 });

    await user.click(input);
    await user.tab();

    expect(onBlur).not.toHaveBeenCalled();
    expect(parseSpy).toHaveBeenCalledTimes(1);
    expect(parseSpy).toHaveBeenNthCalledWith(
      1,
      '1+2',
      expect.objectContaining({
        precision: 2,
        allowNegative: true,
      })
    );

    setEditingCell(null);
  });
});
