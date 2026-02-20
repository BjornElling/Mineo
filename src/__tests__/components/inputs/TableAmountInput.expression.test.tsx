import * as React from 'react';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GridCoreProvider } from '../../../components/tables/gridCoreContext';
import type { GridCellCoord, GridCellEditorHandle } from '../../../components/tables/gridCoreTypes';
import TableAmountInput from '../../../components/inputs/table/TableAmountInput';
import type { AmountValue } from '../../../schemas/amountExpressionSchema';

const gridCell: GridCellCoord = { rowId: 'row-1', colIndex: 0 };

const setup = (
  initialValue: AmountValue | undefined,
  options?: Readonly<{ canBeNegative?: boolean }>
) => {
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
          canBeNegative={options?.canBeNegative}
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
  const TEST_TIMEOUT_MS = 15000;

  it('preserves expression errors across blur, focus, and re-edit', async () => {
    const user = userEvent.setup();
    const { input, onBlur, setEditingCell } = setup(undefined);

    await user.click(input);
    await user.type(input, '1+');
    await user.tab();

    setEditingCell(null);

    expect(onBlur).not.toHaveBeenCalled();
    expect(input).toHaveValue('1+');

    await user.click(input);
    expect(input).toHaveValue('1+');

    setEditingCell(gridCell);
    expect(input).toHaveValue('1+');
  }, TEST_TIMEOUT_MS);

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
  }, TEST_TIMEOUT_MS);

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
  }, TEST_TIMEOUT_MS);

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
  }, TEST_TIMEOUT_MS);

  it('does not emit blur when commit result matches the latest committed value', async () => {
    const user = userEvent.setup();
    const { input, onBlur, setEditingCell } = setup({ kind: 'expression', expression: '1+2', value: 3 });

    await user.click(input);
    await user.tab();

    expect(onBlur).not.toHaveBeenCalled();

    setEditingCell(null);
  }, TEST_TIMEOUT_MS);

  it('clears error state when draft is emptied', async () => {
    const user = userEvent.setup();
    const { input, onBlur, setEditingCell } = setup(undefined);

    await user.click(input);
    await user.type(input, '1+');
    await user.tab();

    setEditingCell(null);

    expect(onBlur).not.toHaveBeenCalled();
    expect(input).toHaveValue('1+');

    setEditingCell(gridCell);
    await user.clear(input);
    await user.tab();

    // Kontrakt 1A: no-op må ikke emitte commit til parent.
    expect(onBlur).not.toHaveBeenCalled();
    expect(input).toHaveValue('');
  }, TEST_TIMEOUT_MS);

  it('normalizes -0 to 0 on commit', async () => {
    const user = userEvent.setup();
    const { input, onBlur } = setup(undefined);

    await user.click(input);
    await user.type(input, '-0');
    await user.tab();

    expect(onBlur).toHaveBeenCalledWith(
      expect.objectContaining({
        target: {
          value: { kind: 'number', value: 0 },
        },
      })
    );
    expect(input).toHaveValue('0,00');
  }, TEST_TIMEOUT_MS);

  it('removes all non-allowed characters on paste', async () => {
    const user = userEvent.setup();
    const { input, onBlur } = setup(undefined);

    await user.click(input);
    await user.paste(input, 'ab1c2,3d');
    await user.tab();

    expect(onBlur).toHaveBeenCalledWith(
      expect.objectContaining({
        target: {
          value: { kind: 'number', value: 12.3 },
        },
      })
    );
    expect(input).toHaveValue('12,30');
  }, TEST_TIMEOUT_MS);

  it('rejects leading minus in prepareEditFromKey when canBeNegative=false', async () => {
    const { getEditor } = setup(undefined, { canBeNegative: false });
    const editor = getEditor();
    expect(editor).not.toBeNull();

    let accepted: boolean | undefined;
    act(() => {
      accepted = editor?.prepareEditFromKey('-');
    });

    expect(accepted).toBe(false);
  }, TEST_TIMEOUT_MS);

  it('blocks unary minus typing when canBeNegative=false', async () => {
    const user = userEvent.setup();
    const { input, onBlur } = setup(undefined, { canBeNegative: false });

    await user.click(input);
    await user.type(input, '-1');
    await user.tab();

    expect(onBlur).toHaveBeenCalledWith(
      expect.objectContaining({
        target: {
          value: { kind: 'number', value: 1 },
        },
      })
    );
    expect(input).toHaveValue('1,00');
  }, TEST_TIMEOUT_MS);

  it('blocks unary minus paste when canBeNegative=false', async () => {
    const user = userEvent.setup();
    const { input, onBlur } = setup(undefined, { canBeNegative: false });

    await user.click(input);
    await user.paste(input, '-123');
    await user.tab();

    expect(onBlur).not.toHaveBeenCalled();
    expect(input).toHaveValue('');
  }, TEST_TIMEOUT_MS);
});
