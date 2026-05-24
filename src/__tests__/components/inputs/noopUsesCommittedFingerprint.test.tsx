import * as React from 'react';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GridCoreProvider } from '../../../components/tables/gridCore/gridCoreContext';
import type { GridCellCoord, GridCellEditorHandle } from '../../../components/tables/gridCore/gridCoreTypes';
import TableAmountInput from '../../../components/inputs/table/TableAmountInput';
import TableDateInput from '../../../components/inputs/table/TableDateInput';
import TableIntegerInput from '../../../components/inputs/table/TableIntegerInput';
import TablePercentInput from '../../../components/inputs/table/TablePercentInput';
import TableWeekInput from '../../../components/inputs/table/TableWeekInput';
import TableYearInput from '../../../components/inputs/table/TableYearInput';
import type { AmountValue } from '../../../schemas/amountExpressionSchema';
import * as expressionAmountModule from '../../../utils/expressionAmount';
import { isISODateString, toISODateString, type ISODateString } from '../../../types/branded';
import { createGridCoreTestStateStore } from './gridCoreTestUtils';

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
        gridStateStore: createGridCoreTestStateStore(gridCell, editingCell),
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

type StringNoopCase = Readonly<{
  label: string;
  value: string;
  renderInput: (value: string, onBlur: (value: string) => void) => React.JSX.Element;
}>;

type DateNoopCase = Readonly<{
  label: string;
  value: ISODateString;
  renderInput: (value: ISODateString | undefined, onBlur: (value: ISODateString | undefined) => void) => React.JSX.Element;
}>;

const iso = (value: string): ISODateString => toISODateString(value);

const STRING_NOOP_CASES: readonly StringNoopCase[] = [
  {
    label: 'integer',
    value: '42',
    renderInput: (value, onBlur) => <TableIntegerInput gridCell={gridCell} value={value} onBlur={(e) => onBlur(e.target.value)} />,
  },
  {
    label: 'percent',
    value: '12,50',
    renderInput: (value, onBlur) => <TablePercentInput gridCell={gridCell} value={value} onBlur={(e) => onBlur(e.target.value)} />,
  },
  {
    label: 'week',
    value: '01/2025',
    renderInput: (value, onBlur) => <TableWeekInput gridCell={gridCell} value={value} onBlur={(e) => onBlur(e.target.value)} />,
  },
  {
    label: 'year',
    value: '2025',
    renderInput: (value, onBlur) => <TableYearInput gridCell={gridCell} value={value} onBlur={(e) => onBlur(e.target.value)} />,
  },
];

const DATE_NOOP_CASES: readonly DateNoopCase[] = [
  {
    label: 'date',
    value: iso('2025-01-01'),
    renderInput: (value, onBlur) => <TableDateInput gridCell={gridCell} value={value} onBlur={(e) => onBlur(e.target.value)} />,
  },
];

const setupStringNoop = (testCase: StringNoopCase) => {
  const onBlur = vi.fn<(value: string) => void>();

  const Wrapper = () => {
    const [value, setValue] = React.useState(testCase.value);
    const [editingCell, setEditingCell] = React.useState<GridCellCoord | null>(gridCell);

    const gridValue = React.useMemo(
      () => ({
        gridStateStore: createGridCoreTestStateStore(gridCell, editingCell),
        openEditing: vi.fn(),
        closeEditing: () => setEditingCell(null),
        registerEditor: vi.fn(),
        unregisterEditor: vi.fn(),
        getEditor: () => null,
        requestFocusPlan: vi.fn(),
      }),
      [editingCell]
    );

    return (
      <GridCoreProvider value={gridValue}>
        {testCase.renderInput(value, (next) => {
          onBlur(next);
          setValue(next);
          setEditingCell(null);
        })}
      </GridCoreProvider>
    );
  };

  render(<Wrapper />);
  return { onBlur, input: screen.getByRole('textbox') };
};

const setupDateNoop = (testCase: DateNoopCase) => {
  const onBlur = vi.fn<(value: ISODateString | undefined) => void>();

  const Wrapper = () => {
    const [value, setValue] = React.useState<ISODateString | undefined>(testCase.value);
    const [editingCell, setEditingCell] = React.useState<GridCellCoord | null>(gridCell);

    const gridValue = React.useMemo(
      () => ({
        gridStateStore: createGridCoreTestStateStore(gridCell, editingCell),
        openEditing: vi.fn(),
        closeEditing: () => setEditingCell(null),
        registerEditor: vi.fn(),
        unregisterEditor: vi.fn(),
        getEditor: () => null,
        requestFocusPlan: vi.fn(),
      }),
      [editingCell]
    );

    return (
      <GridCoreProvider value={gridValue}>
        {testCase.renderInput(value, (next) => {
          onBlur(next);
          setValue(isISODateString(next) ? next : undefined);
          setEditingCell(null);
        })}
      </GridCoreProvider>
    );
  };

  render(<Wrapper />);
  return { onBlur, input: screen.getByRole('textbox') };
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

  it.each(STRING_NOOP_CASES)('emitter ikke commit på no-op for $label', async (testCase) => {
    const user = userEvent.setup();
    const { input, onBlur } = setupStringNoop(testCase);

    await user.click(input);
    await user.tab();

    expect(onBlur).not.toHaveBeenCalled();
  });

  it.each(DATE_NOOP_CASES)('emitter ikke commit på no-op for $label', async (testCase) => {
    const user = userEvent.setup();
    const { input, onBlur } = setupDateNoop(testCase);

    await user.click(input);
    await user.tab();

    expect(onBlur).not.toHaveBeenCalled();
  });
});
