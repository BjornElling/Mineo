import * as React from 'react';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GridCoreProvider } from '../../../components/tables/gridCoreContext';
import type { GridCellCoord, GridCellEditorHandle } from '../../../components/tables/gridCoreTypes';
import TableAmountInput from '../../../components/inputs/table/TableAmountInput';
import type { AmountValue } from '../../../schemas/amountExpressionSchema';

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

  return { input, onBlur, setEditingCell, getEditor: () => editorHandle };
};

describe('TableAmountInput expression behavior', () => {
  it('preserves expression errors across blur, focus, and re-edit', async () => {
    const user = userEvent.setup();
    const { input, onBlur, setEditingCell } = setup(undefined);

    await user.click(input);
    await user.type(input, '1+');
    await user.tab();

    setEditingCell(null);

    expect(onBlur).not.toHaveBeenCalled();
    expect(input).toHaveValue('Fejl');

    await user.click(input);
    expect(input).toHaveValue('Fejl');

    setEditingCell(gridCell);
    expect(input).toHaveValue('1+');
  });

  it('cancelEdit restores the last committed value', async () => {
    const user = userEvent.setup();
    const { input, setEditingCell, getEditor } = setup(undefined);

    await user.click(input);
    await user.type(input, '1+');
    await user.tab();

    setEditingCell(null);
    setEditingCell(gridCell);

    const editor = getEditor();
    expect(editor).not.toBeNull();
    act(() => {
      editor?.cancelEdit();
    });

    expect(input).toHaveValue('');
  });

  it('clearAndCommit emits undefined and clears the display', async () => {
    const user = userEvent.setup();
    const { input, onBlur, getEditor } = setup({ kind: 'expression', expression: '1+2', value: 3 });

    await user.click(input);

    const editor = getEditor();
    expect(editor).not.toBeNull();
    act(() => {
      editor?.clearAndCommit();
    });

    expect(onBlur).toHaveBeenCalledWith(
      expect.objectContaining({
        target: { value: undefined },
      })
    );
    expect(input).toHaveValue('');
  });

  it('supports key-initiated edit for expression starters', async () => {
    const { input, setEditingCell, getEditor } = setup(undefined);

    setEditingCell(null);
    const editor = getEditor();
    expect(editor).not.toBeNull();

    // prepareEditFromKey trigger state-ændringer og skal wrappes i act()
    let accepted: boolean | undefined;
    act(() => {
      accepted = editor?.prepareEditFromKey('(');
    });
    expect(accepted).toBe(true);

    setEditingCell(gridCell);
    expect(input).toHaveValue('(');

    let rejected: boolean | undefined;
    act(() => {
      rejected = editor?.prepareEditFromKey('a');
    });
    expect(rejected).toBe(false);
  });

  it('does not emit blur when commit result matches the latest committed value', async () => {
    const user = userEvent.setup();
    const { input, onBlur, setEditingCell } = setup({ kind: 'expression', expression: '1+2', value: 3 });

    await user.click(input);
    await user.tab();

    expect(onBlur).not.toHaveBeenCalled();

    setEditingCell(null);
  });
});
