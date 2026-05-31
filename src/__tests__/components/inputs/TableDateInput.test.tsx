import * as React from 'react';
import { act, createEvent, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GridCoreProvider } from '../../../components/tables/gridCore/gridCoreContext';
import type { GridCellCoord } from '../../../components/tables/gridCore/gridCoreTypes';
import TableDateInput from '../../../components/inputs/table/TableDateInput';
import { sanitizeTableDateDraft } from '../../../hooks/tableInput';
import { toISODateString, type ISODateString } from '../../../types/branded';
import { createGridCoreTestStateStore } from './gridCoreTestUtils';
import { __resetDraftHistoryRegistryForTests, restoreDraftHistoryTarget } from '../../../utils/draftHistoryRegistry';

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

describe('TableDateInput', () => {
  const iso = (value: string): ISODateString => toISODateString(value);

  beforeEach(() => {
    __resetDraftHistoryRegistryForTests();
  });

  it('commits formatted date and shows range error when out of range', async () => {
    const user = userEvent.setup();
    const gridCell = { rowId: 'row-1', colIndex: 0 };

    const Wrapper = () => {
      const [value, setValue] = React.useState<React.ComponentProps<typeof TableDateInput>['value']>(undefined);
      const [editingCell, setEditingCell] = React.useState<GridCellCoord | null>(gridCell);
      const gridValue = React.useMemo(() => createGridValue(gridCell, editingCell), [editingCell]);

      return (
        <GridCoreProvider value={gridValue}>
          <TableDateInput
            gridCell={gridCell}
            value={value}
            minDate={toISODateString("2020-01-01")}
            maxDate={toISODateString("2020-12-31")}
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

  it('viser ISO-model som dansk display og sanitizer dansk draft til ISO', () => {
    const gridCell = { rowId: 'row-iso-display', colIndex: 0 };
    const gridValue = createGridValue(gridCell, null);

    render(
      <GridCoreProvider value={gridValue}>
        <TableDateInput gridCell={gridCell} value={iso('2026-05-24')} />
      </GridCoreProvider>
    );

    expect(screen.getByRole('textbox')).toHaveValue('24-05-2026');
    expect(sanitizeTableDateDraft('24-05-2026', { twoDigitYearPolicy: 'infer' })).toBe(toISODateString('2026-05-24'));
    expect(sanitizeTableDateDraft('ikke en dato', { twoDigitYearPolicy: 'infer' })).toBeUndefined();
  });

  it('keeps invalid format and shows error', async () => {
    const user = userEvent.setup();
    const gridCell = { rowId: 'row-2', colIndex: 0 };

    const Wrapper = () => {
      const [value, setValue] = React.useState<ISODateString | undefined>(undefined);
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

  it('history-restore rydder invalid table-date draft selv når committed value er uændret', async () => {
    const user = userEvent.setup();
    const gridCell = { rowId: 'row-restore', colIndex: 0 };
    const gridValue = createGridValue(gridCell, gridCell);

    render(
      <GridCoreProvider value={gridValue}>
        <TableDateInput gridCell={gridCell} value={iso('2020-01-01')} />
      </GridCoreProvider>
    );

    const input = screen.getByRole('textbox');
    await user.click(input);
    await user.clear(input);
    await user.type(input, '99-99-2020');
    fireEvent.blur(input);

    expect(input).toHaveValue('99-99-2020');

    act(() => {
      expect(
        restoreDraftHistoryTarget(
          { focusToken: null, fieldPath: 'row-restore:0' },
          { kind: 'committed' }
        )
      ).toBe(true);
    });

    expect(input).toHaveValue('01-01-2020');
    expect(input).not.toHaveAttribute('aria-describedby');
  });

  it('crasher ikke ved minDate > maxDate og viser konfigurationsfejl', () => {
    const gridCell = { rowId: 'row-3', colIndex: 0 };
    const gridValue = createGridValue(gridCell, gridCell);

    expect(() => {
      render(
        <GridCoreProvider value={gridValue}>
          <TableDateInput
            gridCell={gridCell}
            value={iso('2025-06-15')}
            minDate={toISODateString("2025-12-31")}
            maxDate={toISODateString("2025-01-01")}
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
      const [value, setValue] = React.useState<ISODateString | undefined>(iso('2023-01-01'));
      const [minDate, setMinDate] = React.useState(toISODateString('2024-01-01'));
      const [editingCell, setEditingCell] = React.useState<GridCellCoord | null>(gridCell);
      const gridValue = React.useMemo(() => createGridValue(gridCell, editingCell), [editingCell]);

      return (
        <GridCoreProvider value={gridValue}>
          <button type="button" onClick={() => setMinDate(toISODateString('2023-01-01'))}>
            loosen-min
          </button>
          <TableDateInput
            gridCell={gridCell}
            value={value}
            minDate={minDate}
            maxDate={toISODateString("2026-12-31")}
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

  it('normalizes pasted text while not editing', async () => {
    const user = userEvent.setup();
    const gridCell = { rowId: 'row-5', colIndex: 0 };

    const Wrapper = () => {
      const [value, setValue] = React.useState<ISODateString | undefined>(undefined);
      const [editingCell, setEditingCell] = React.useState<GridCellCoord | null>(null);
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
    input.focus();
    await user.paste('adffergregs//sgd1712,56//');

    expect(input).toHaveValue('17-12-1956');
  });

  it('normalizes commas and other special characters to hyphens on commit', async () => {
    const user = userEvent.setup();
    const gridCell = { rowId: 'row-5b', colIndex: 0 };

    const Wrapper = () => {
      const [value, setValue] = React.useState<ISODateString | undefined>(undefined);
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
    await user.type(input, '1,1@28');
    await user.tab();

    expect(input).toHaveValue('01-01-2028');
  });

  it('committer ikke ufuldstændig dato med trailing separator', async () => {
    const user = userEvent.setup();
    const gridCell = { rowId: 'row-5bb', colIndex: 0 };

    const Wrapper = () => {
      const [value, setValue] = React.useState<ISODateString | undefined>(undefined);
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
    await user.type(input, '1-1-2-');
    await user.tab();

    expect(input).toHaveValue('1-1-2-');
    const describedBy = input.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    const errorEl = describedBy ? document.getElementById(describedBy) : null;
    expect(errorEl).toHaveTextContent('Ugyldig dato');
  });

  it('rejects letters in date drafts', async () => {
    const user = userEvent.setup();
    const gridCell = { rowId: 'row-5c', colIndex: 0 };
    const gridValue = createGridValue(gridCell, gridCell);

    render(
      <GridCoreProvider value={gridValue}>
        <TableDateInput gridCell={gridCell} value={undefined} />
      </GridCoreProvider>
    );

    const input = screen.getByRole('textbox') as HTMLInputElement;
    await user.click(input);
    await user.type(input, '1a1');

    expect(input).toHaveValue('11');
  });

  it('copies the full field value while focused and not editing', async () => {
    const user = userEvent.setup();
    const gridCell = { rowId: 'row-6', colIndex: 0 };

    const Wrapper = () => {
      const [editingCell] = React.useState<GridCellCoord | null>(null);
      const gridValue = React.useMemo(() => createGridValue(gridCell, editingCell), [editingCell]);

      return (
        <GridCoreProvider value={gridValue}>
          <TableDateInput gridCell={gridCell} value={iso('2023-05-01')} />
        </GridCoreProvider>
      );
    };

    render(<Wrapper />);

    const input = screen.getByRole('textbox') as HTMLInputElement;
    await user.click(input);

    const clipboardData = {
      setData: vi.fn(),
      getData: vi.fn(),
    } as unknown as DataTransfer;
    const copyEvent = createEvent.copy(input);
    Object.defineProperty(copyEvent, 'clipboardData', { value: clipboardData });

    fireEvent(input, copyEvent);

    expect(clipboardData.setData).toHaveBeenCalledWith('text/plain', '01-05-2023');
    expect(copyEvent.defaultPrevented).toBe(true);
  });
});
