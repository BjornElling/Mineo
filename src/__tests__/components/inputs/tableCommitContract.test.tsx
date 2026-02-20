import * as React from 'react';
import { act } from '@testing-library/react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import StandardLooseTable from '../../../components/tables/StandardLooseTable';
import { GridCoreProvider } from '../../../components/tables/gridCoreContext';
import type { GridCellCoord } from '../../../components/tables/gridCoreTypes';
import TableDateInput from '../../../components/inputs/table/TableDateInput';
import TableIntegerInput from '../../../components/inputs/table/TableIntegerInput';
import TablePercentInput from '../../../components/inputs/table/TablePercentInput';
import TableTextInput from '../../../components/inputs/table/TableTextInput';
import TableWeekInput from '../../../components/inputs/table/TableWeekInput';
import TableYearInput from '../../../components/inputs/table/TableYearInput';

const gridCell: GridCellCoord = { rowId: 'row-1', colIndex: 0 };

const createGridValue = (editingCell: GridCellCoord | null) => {
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

type NoopCase = Readonly<{
  label: string;
  renderInput: (onBlur: (value: string) => void) => React.JSX.Element;
}>;

type InvalidPreserveCase = Readonly<{
  label: string;
  initialValue: string;
  invalidDraft: string;
  renderManagedInput: (props: Readonly<{ value: string; onBlur: (value: string) => void }>) => React.JSX.Element;
}>;

type ConfigPreserveCase = Readonly<{
  label: string;
  renderInput: () => React.JSX.Element;
}>;

type ClickOutsideCommitCase = Readonly<{
  label: string;
  initialValue: string;
  typedDraft: string;
  expectedCommitted: string;
  renderManagedInput: (props: Readonly<{ value: string; onBlur: (value: string) => void }>) => React.JSX.Element;
}>;

type EscapeCancelCase = Readonly<{
  label: string;
  initialValue: string;
  typedDraft: string;
  expectedDisplayAfterCancel?: string;
  renderManagedInput: (props: Readonly<{ value: string; onBlur: (value: string) => void }>) => React.JSX.Element;
}>;

type DeleteClearCase = Readonly<{
  label: string;
  initialValue: string;
  expectedCommitted: string;
  renderManagedInput: (props: Readonly<{ value: string; onBlur: (value: string) => void }>) => React.JSX.Element;
}>;

const NOOP_CASES: readonly NoopCase[] = [
  {
    label: 'integer',
    renderInput: (onBlur) => (
      <TableIntegerInput
        gridCell={gridCell}
        value="42"
        onBlur={(e) => onBlur(e.target.value)}
      />
    ),
  },
  {
    label: 'percent',
    renderInput: (onBlur) => (
      <TablePercentInput
        gridCell={gridCell}
        value="12,50"
        onBlur={(e) => onBlur(e.target.value)}
      />
    ),
  },
  {
    label: 'week',
    renderInput: (onBlur) => (
      <TableWeekInput
        gridCell={gridCell}
        value="1/2025"
        onBlur={(e) => onBlur(e.target.value)}
      />
    ),
  },
  {
    label: 'year',
    renderInput: (onBlur) => (
      <TableYearInput
        gridCell={gridCell}
        value="2025"
        onBlur={(e) => onBlur(e.target.value)}
      />
    ),
  },
  {
    label: 'date',
    renderInput: (onBlur) => (
      <TableDateInput
        gridCell={gridCell}
        value="01-01-2025"
        onBlur={(e) => onBlur(e.target.value)}
      />
    ),
  },
  {
    label: 'text',
    renderInput: (onBlur) => (
      <TableTextInput
        gridCell={gridCell}
        value="abc"
        onBlur={(e) => onBlur(e.target.value)}
      />
    ),
  },
];

const INVALID_PRESERVE_CASES: readonly InvalidPreserveCase[] = [
  {
    label: 'integer',
    initialValue: '5',
    invalidDraft: '9',
    renderManagedInput: ({ value, onBlur }) => (
      <TableIntegerInput
        gridCell={gridCell}
        value={value}
        maxValue={5}
        onBlur={(e) => onBlur(e.target.value)}
      />
    ),
  },
  {
    label: 'percent',
    initialValue: '1,00',
    invalidDraft: '9',
    renderManagedInput: ({ value, onBlur }) => (
      <TablePercentInput
        gridCell={gridCell}
        value={value}
        maxValue={5}
        onBlur={(e) => onBlur(e.target.value)}
      />
    ),
  },
  {
    label: 'week',
    initialValue: '1/2025',
    invalidDraft: '54/20',
    renderManagedInput: ({ value, onBlur }) => (
      <TableWeekInput
        gridCell={gridCell}
        value={value}
        onBlur={(e) => onBlur(e.target.value)}
      />
    ),
  },
  {
    label: 'year',
    initialValue: '2025',
    invalidDraft: '1999',
    renderManagedInput: ({ value, onBlur }) => (
      <TableYearInput
        gridCell={gridCell}
        value={value}
        minYear={2000}
        onBlur={(e) => onBlur(e.target.value)}
      />
    ),
  },
  {
    label: 'date',
    initialValue: '01-01-2025',
    invalidDraft: '32-01-2025',
    renderManagedInput: ({ value, onBlur }) => (
      <TableDateInput
        gridCell={gridCell}
        value={value}
        onBlur={(e) => onBlur(e.target.value)}
      />
    ),
  },
];

const CONFIG_PRESERVE_CASES: readonly ConfigPreserveCase[] = [
  {
    label: 'integer',
    renderInput: () => (
      <TableIntegerInput
        gridCell={gridCell}
        value="5"
        minValue={10}
        maxValue={5}
      />
    ),
  },
  {
    label: 'percent',
    renderInput: () => (
      <TablePercentInput
        gridCell={gridCell}
        value="1,00"
        minValue={10}
        maxValue={5}
      />
    ),
  },
  {
    label: 'week',
    renderInput: () => (
      <TableWeekInput
        gridCell={gridCell}
        value="1/2025"
        minYear={2030}
        maxYear={2020}
      />
    ),
  },
  {
    label: 'year',
    renderInput: () => (
      <TableYearInput
        gridCell={gridCell}
        value="2025"
        minYear={2030}
        maxYear={2020}
      />
    ),
  },
  {
    label: 'date',
    renderInput: () => (
      <TableDateInput
        gridCell={gridCell}
        value="15-06-2025"
        minDate="2025-12-31"
        maxDate="2025-01-01"
      />
    ),
  },
];

const CLICK_OUTSIDE_COMMIT_CASES: readonly ClickOutsideCommitCase[] = [
  {
    label: 'integer',
    initialValue: '1',
    typedDraft: '42',
    expectedCommitted: '42',
    renderManagedInput: ({ value, onBlur }) => (
      <TableIntegerInput
        gridCell={gridCell}
        value={value}
        onBlur={(e) => onBlur(e.target.value)}
      />
    ),
  },
  {
    label: 'percent',
    initialValue: '1,00',
    typedDraft: '2,5',
    expectedCommitted: '2,50',
    renderManagedInput: ({ value, onBlur }) => (
      <TablePercentInput
        gridCell={gridCell}
        value={value}
        onBlur={(e) => onBlur(e.target.value)}
      />
    ),
  },
  {
    label: 'week',
    initialValue: '1/2025',
    typedDraft: '2/2025',
    expectedCommitted: '2/2025',
    renderManagedInput: ({ value, onBlur }) => (
      <TableWeekInput
        gridCell={gridCell}
        value={value}
        onBlur={(e) => onBlur(e.target.value)}
      />
    ),
  },
  {
    label: 'year',
    initialValue: '2024',
    typedDraft: '2026',
    expectedCommitted: '2026',
    renderManagedInput: ({ value, onBlur }) => (
      <TableYearInput
        gridCell={gridCell}
        value={value}
        onBlur={(e) => onBlur(e.target.value)}
      />
    ),
  },
  {
    label: 'date',
    initialValue: '01-01-2024',
    typedDraft: '1-2-2025',
    expectedCommitted: '01-02-2025',
    renderManagedInput: ({ value, onBlur }) => (
      <TableDateInput
        gridCell={gridCell}
        value={value}
        onBlur={(e) => onBlur(e.target.value)}
      />
    ),
  },
  {
    label: 'text',
    initialValue: 'foo',
    typedDraft: 'bar',
    expectedCommitted: 'bar',
    renderManagedInput: ({ value, onBlur }) => (
      <TableTextInput
        gridCell={gridCell}
        value={value}
        onBlur={(e) => onBlur(e.target.value)}
      />
    ),
  },
];

const ESCAPE_CANCEL_CASES: readonly EscapeCancelCase[] = [
  {
    label: 'integer',
    initialValue: '42',
    typedDraft: '99',
    renderManagedInput: ({ value, onBlur }) => <TableIntegerInput gridCell={gridCell} value={value} onBlur={(e) => onBlur(e.target.value)} />,
  },
  {
    label: 'percent',
    initialValue: '12,50',
    typedDraft: '33',
    expectedDisplayAfterCancel: '12,50 %',
    renderManagedInput: ({ value, onBlur }) => <TablePercentInput gridCell={gridCell} value={value} onBlur={(e) => onBlur(e.target.value)} />,
  },
  {
    label: 'week',
    initialValue: '1/2025',
    typedDraft: '2/2025',
    renderManagedInput: ({ value, onBlur }) => <TableWeekInput gridCell={gridCell} value={value} onBlur={(e) => onBlur(e.target.value)} />,
  },
  {
    label: 'year',
    initialValue: '2025',
    typedDraft: '2026',
    renderManagedInput: ({ value, onBlur }) => <TableYearInput gridCell={gridCell} value={value} onBlur={(e) => onBlur(e.target.value)} />,
  },
  {
    label: 'date',
    initialValue: '01-01-2025',
    typedDraft: '15-06-2025',
    renderManagedInput: ({ value, onBlur }) => <TableDateInput gridCell={gridCell} value={value} onBlur={(e) => onBlur(e.target.value)} />,
  },
];

const DELETE_CLEAR_CASES: readonly DeleteClearCase[] = [
  {
    label: 'integer',
    initialValue: '42',
    expectedCommitted: '',
    renderManagedInput: ({ value, onBlur }) => <TableIntegerInput gridCell={gridCell} value={value} onBlur={(e) => onBlur(e.target.value)} />,
  },
  {
    label: 'percent',
    initialValue: '12,50',
    expectedCommitted: '',
    renderManagedInput: ({ value, onBlur }) => <TablePercentInput gridCell={gridCell} value={value} onBlur={(e) => onBlur(e.target.value)} />,
  },
  {
    label: 'week',
    initialValue: '1/2025',
    expectedCommitted: '',
    renderManagedInput: ({ value, onBlur }) => <TableWeekInput gridCell={gridCell} value={value} onBlur={(e) => onBlur(e.target.value)} />,
  },
  {
    label: 'year',
    initialValue: '2025',
    expectedCommitted: '',
    renderManagedInput: ({ value, onBlur }) => <TableYearInput gridCell={gridCell} value={value} onBlur={(e) => onBlur(e.target.value)} />,
  },
  {
    label: 'date',
    initialValue: '01-01-2025',
    expectedCommitted: '',
    renderManagedInput: ({ value, onBlur }) => <TableDateInput gridCell={gridCell} value={value} onBlur={(e) => onBlur(e.target.value)} />,
  },
];

const setupManaged = (input: InvalidPreserveCase) => {
  const onBlur = vi.fn<(value: string) => void>();
  const setEditingCellRef = { current: null as React.Dispatch<React.SetStateAction<GridCellCoord | null>> | null };

  const Wrapper = () => {
    const [value, setValue] = React.useState(input.initialValue);
    const [editingCell, setEditingCell] = React.useState<GridCellCoord | null>(gridCell);

    React.useEffect(() => {
      setEditingCellRef.current = setEditingCell;
    }, []);

    return (
      <GridCoreProvider value={createGridValue(editingCell)}>
        {input.renderManagedInput({
          value,
          onBlur: (nextValue) => {
            onBlur(nextValue);
            setValue(nextValue);
            setEditingCell(null);
          },
        })}
      </GridCoreProvider>
    );
  };

  render(<Wrapper />);

  const setEditingCell = (next: GridCellCoord | null) => {
    act(() => {
      setEditingCellRef.current?.(next);
    });
  };

  return { onBlur, setEditingCell };
};

const setupManagedWithOutside = (input: ClickOutsideCommitCase) => {
  const onBlur = vi.fn<(value: string) => void>();
  const setEditingCellRef = { current: null as React.Dispatch<React.SetStateAction<GridCellCoord | null>> | null };

  const Wrapper = () => {
    const [value, setValue] = React.useState(input.initialValue);
    const [editingCell, setEditingCell] = React.useState<GridCellCoord | null>(gridCell);

    React.useEffect(() => {
      setEditingCellRef.current = setEditingCell;
    }, []);

    return (
      <>
        <GridCoreProvider value={createGridValue(editingCell)}>
          {input.renderManagedInput({
            value,
            onBlur: (nextValue) => {
              onBlur(nextValue);
              setValue(nextValue);
              setEditingCell(null);
            },
          })}
        </GridCoreProvider>
        <button
          type="button"
          onMouseDown={() => {
            setEditingCellRef.current?.(null);
          }}
        >
          Udenfor
        </button>
      </>
    );
  };

  render(<Wrapper />);

  return { onBlur };
};

describe('table commit-kontrakt', () => {
  const TEST_TIMEOUT_MS = 20000;

  it.each(NOOP_CASES)('no-op i $label emitter ikke onBlur-commit', async ({ renderInput }) => {
    const user = userEvent.setup();
    const onBlur = vi.fn<(value: string) => void>();

    render(
      <GridCoreProvider value={createGridValue(gridCell)}>
        {renderInput((value) => onBlur(value))}
      </GridCoreProvider>
    );

    const input = screen.getByRole('textbox');
    await user.click(input);
    await user.tab();

    expect(onBlur).not.toHaveBeenCalled();
  });

  it.each(INVALID_PRESERVE_CASES)(
    'input-error i $label emitter ikke commit og draft bevares over edit-close',
    async (inputCase) => {
      const user = userEvent.setup();
      const { onBlur, setEditingCell } = setupManaged(inputCase);
      const input = screen.getByRole('textbox');

      await user.click(input);
      await user.clear(input);
      await user.type(input, inputCase.invalidDraft);
      await user.tab();

      expect(onBlur).not.toHaveBeenCalled();

      setEditingCell(null);
      expect(input).toHaveValue(inputCase.invalidDraft);

      setEditingCell(gridCell);
      expect(input).toHaveValue(inputCase.invalidDraft);
    }
  );

  it.each(CONFIG_PRESERVE_CASES)('config-fejl i $label fejler hurtigt ved render', ({ renderInput }) => {
    expect(() => {
      render(
        <GridCoreProvider value={createGridValue(gridCell)}>
          {renderInput()}
        </GridCoreProvider>
      );
    }).toThrowError();
  });

  it.each(CLICK_OUTSIDE_COMMIT_CASES)(
    'klik udenfor committer korrekt i $label',
    async (inputCase) => {
      const user = userEvent.setup();
      const { onBlur } = setupManagedWithOutside(inputCase);
      const input = screen.getByRole('textbox');
      const outside = screen.getByRole('button', { name: 'Udenfor' });

      await user.click(input);
      await user.clear(input);
      await user.type(input, inputCase.typedDraft);
      await user.click(outside);

      expect(onBlur).toHaveBeenCalledWith(inputCase.expectedCommitted);
    }
  );

  it('ArrowDown under edit committer præcis én gang før fokus flyttes', async () => {
    const user = userEvent.setup();
    const row1Cell: GridCellCoord = { rowId: 'row-1', colIndex: 0 };
    const row2Cell: GridCellCoord = { rowId: 'row-2', colIndex: 0 };

    const onRow1Blur = vi.fn<(value: string) => void>();

    const Wrapper = () => {
      const [row1Value, setRow1Value] = React.useState('1');
      const [editingCell, setEditingCell] = React.useState<GridCellCoord | null>(row1Cell);
      const [focusedCell, setFocusedCell] = React.useState<GridCellCoord | null>(row1Cell);

      return (
        <GridCoreProvider
          value={{
            focusedCell,
            editingCell,
            openEditing: (cell) => {
              setFocusedCell(cell);
              setEditingCell(cell);
            },
            closeEditing: () => setEditingCell(null),
            registerEditor: vi.fn(),
            unregisterEditor: vi.fn(),
            getEditor: vi.fn().mockReturnValue(null),
            requestFocusPlan: vi.fn(),
          }}
        >
          <StandardLooseTable>
            <tbody>
              <tr data-mineo-row-id="row-1">
                <td>
                  <TableIntegerInput
                    gridCell={row1Cell}
                    value={row1Value}
                    onBlur={(e) => {
                      onRow1Blur(e.target.value);
                      setRow1Value(e.target.value);
                      setEditingCell(null);
                    }}
                  />
                </td>
              </tr>
              <tr data-mineo-row-id="row-2">
                <td>
                  <TableIntegerInput
                    gridCell={row2Cell}
                    value="2"
                  />
                </td>
              </tr>
            </tbody>
          </StandardLooseTable>
        </GridCoreProvider>
      );
    };

    render(<Wrapper />);
    const [input1, input2] = screen.getAllByRole('textbox');

    await user.click(input1);
    await user.click(input1);
    await waitFor(() => {
      expect(input1).not.toHaveAttribute('readonly');
    });
    await user.clear(input1);
    await user.type(input1, '42');
    await user.keyboard('{ArrowDown}');

    expect(onRow1Blur).toHaveBeenCalledTimes(1);
    expect(onRow1Blur).toHaveBeenCalledWith('42');
    expect(document.activeElement).toBe(input2);
  });

  it('week-input tillader redigering foran ugyldig /2022 efter genåbning', async () => {
    const user = userEvent.setup();
    const onBlur = vi.fn<(value: string) => void>();
    const setEditingCellRef = { current: null as React.Dispatch<React.SetStateAction<GridCellCoord | null>> | null };

    const Wrapper = () => {
      const [value, setValue] = React.useState('1/2022');
      const [editingCell, setEditingCell] = React.useState<GridCellCoord | null>(gridCell);

      React.useEffect(() => {
        setEditingCellRef.current = setEditingCell;
      }, []);

      return (
        <GridCoreProvider value={createGridValue(editingCell)}>
          <TableWeekInput
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
    await user.clear(input);
    await user.type(input, '/2022');
    await user.tab();

    expect(onBlur).not.toHaveBeenCalled();
    expect(input).toHaveValue('/2022');

    act(() => {
      setEditingCellRef.current?.(gridCell);
    });

    await user.click(input);
    input.setSelectionRange(0, 0);
    await user.type(input, '1');

    expect(input).not.toHaveValue('/2022');
    expect(String((input as HTMLInputElement).value)).toContain('1');
  });

  it('integer med enforceRange=false committer out-of-range værdi men markerer fejl', async () => {
    const user = userEvent.setup();
    const onBlur = vi.fn<(value: string) => void>();

    const Wrapper = () => {
      const [value, setValue] = React.useState('4');
      const [editingCell, setEditingCell] = React.useState<GridCellCoord | null>(gridCell);

      return (
        <GridCoreProvider value={createGridValue(editingCell)}>
          <TableIntegerInput
            gridCell={gridCell}
            value={value}
            minValue={0}
            maxValue={5}
            enforceRange={false}
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
    await user.type(input, '9');
    await user.tab();

    expect(onBlur).toHaveBeenCalledTimes(1);
    expect(onBlur).toHaveBeenCalledWith('9');
    expect(input).toHaveValue('9');
    const describedBy = input.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
  });

  it('integer uden maxValue afleder ikke maxDigits fra minValue', async () => {
    const user = userEvent.setup();
    const onBlur = vi.fn<(value: string) => void>();

    const Wrapper = () => {
      const [value, setValue] = React.useState('100');
      const [editingCell, setEditingCell] = React.useState<GridCellCoord | null>(gridCell);

      return (
        <GridCoreProvider value={createGridValue(editingCell)}>
          <TableIntegerInput
            gridCell={gridCell}
            value={value}
            minValue={100}
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
    await user.type(input, '1000');
    await user.tab();

    expect(onBlur).toHaveBeenCalledWith('1000');
    expect(input).toHaveValue('1000');
  });

  it('Escape annullerer text-edit uden commit', async () => {
    const user = userEvent.setup();
    const onBlur = vi.fn<(value: string) => void>();

    const Wrapper = () => {
      const [value, setValue] = React.useState('foo');
      return (
        <StandardLooseTable>
          <tbody>
            <tr data-mineo-row-id="row-1">
              <td>
                <TableTextInput
                  gridCell={gridCell}
                  value={value}
                  onBlur={(e) => {
                    onBlur(e.target.value);
                    setValue(e.target.value);
                  }}
                />
              </td>
            </tr>
          </tbody>
        </StandardLooseTable>
      );
    };

    render(<Wrapper />);
    const input = screen.getByRole('textbox');

    await user.click(input);
    await user.click(input);
    await waitFor(() => {
      expect(input).not.toHaveAttribute('readonly');
    });

    await user.clear(input);
    await user.type(input, 'bar');
    await user.keyboard('{Escape}');

    expect(onBlur).not.toHaveBeenCalled();
    expect(input).toHaveValue('foo');
  });

  it('Delete på fokuseret text-celle uden edit rydder og committer straks', async () => {
    const user = userEvent.setup();
    const onBlur = vi.fn<(value: string) => void>();

    const Wrapper = () => {
      const [value, setValue] = React.useState('foo');
      return (
        <StandardLooseTable>
          <tbody>
            <tr data-mineo-row-id="row-1">
              <td>
                <TableTextInput
                  gridCell={gridCell}
                  value={value}
                  onBlur={(e) => {
                    onBlur(e.target.value);
                    setValue(e.target.value);
                  }}
                />
              </td>
            </tr>
          </tbody>
        </StandardLooseTable>
      );
    };

    render(<Wrapper />);
    const input = screen.getByRole('textbox');

    await user.click(input);
    await user.keyboard('{Delete}');

    expect(onBlur).toHaveBeenCalledTimes(1);
    expect(onBlur).toHaveBeenCalledWith('');
    expect(input).toHaveValue('');
  });

  it.each(ESCAPE_CANCEL_CASES)('Escape annullerer $label-edit uden commit', async (inputCase) => {
    const user = userEvent.setup();
    const onBlur = vi.fn<(value: string) => void>();

    const Wrapper = () => {
      const [value, setValue] = React.useState(inputCase.initialValue);
      return (
        <StandardLooseTable>
          <tbody>
            <tr data-mineo-row-id="row-1">
              <td>
                {inputCase.renderManagedInput({
                  value,
                  onBlur: (nextValue) => {
                    onBlur(nextValue);
                    setValue(nextValue);
                  },
                })}
              </td>
            </tr>
          </tbody>
        </StandardLooseTable>
      );
    };

    render(<Wrapper />);
    const input = screen.getByRole('textbox');

    await user.click(input);
    await user.click(input);
    await waitFor(() => {
      expect(input).not.toHaveAttribute('readonly');
    });
    await user.clear(input);
    await user.type(input, inputCase.typedDraft);
    await user.keyboard('{Escape}');

    expect(onBlur).not.toHaveBeenCalled();
    expect(input).toHaveValue(inputCase.expectedDisplayAfterCancel ?? inputCase.initialValue);
  }, TEST_TIMEOUT_MS);

  it.each(DELETE_CLEAR_CASES)('Delete på fokuseret $label-celle uden edit rydder og committer straks', async (inputCase) => {
    const user = userEvent.setup();
    const onBlur = vi.fn<(value: string) => void>();

    const Wrapper = () => {
      const [value, setValue] = React.useState(inputCase.initialValue);
      return (
        <StandardLooseTable>
          <tbody>
            <tr data-mineo-row-id="row-1">
              <td>
                {inputCase.renderManagedInput({
                  value,
                  onBlur: (nextValue) => {
                    onBlur(nextValue);
                    setValue(nextValue);
                  },
                })}
              </td>
            </tr>
          </tbody>
        </StandardLooseTable>
      );
    };

    render(<Wrapper />);
    const input = screen.getByRole('textbox');

    await user.click(input);
    await user.keyboard('{Delete}');

    await waitFor(() => {
      expect(onBlur).toHaveBeenCalledTimes(1);
      expect(onBlur).toHaveBeenCalledWith(inputCase.expectedCommitted);
      expect(input).toHaveValue('');
    });
  }, TEST_TIMEOUT_MS);

});
