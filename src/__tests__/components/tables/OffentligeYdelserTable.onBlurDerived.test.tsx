// @vitest-environment jsdom
import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { OffentligeYdelserRow } from '../../../schemas/formSchemas';
import type { AmountValue } from '../../../schemas/amountExpressionSchema';
import type { ISODateString } from '../../../types/branded';
import OffentligeYdelserTable from '../../../components/tables/OffentligeYdelserTable';
import { deriveOffentligeYdelserRow } from '../../../domain/erstatningsopgoerelse/helpers/offentligeYdelserDerived';
import { formatAsAmount, formatKr } from '../../../utils/formatUtils';
import {
  blurTableElement,
  changeTableInput,
  clearFocusedTableCell,
  flushTableInteraction,
  focusTableElement,
  keyDownTableElement,
  openTableInputEditing,
} from './tableInteractionTestUtils';

const asDate = (s: string) => s as ISODateString;

type Derived = { periodiseringLabel: string; antalDageDisplay: string; ydelsePerDagDisplay: string };

const formatAntalDage = (value: number): string => {
  return formatAsAmount(value, 0);
};

const asAmount = (value: number): AmountValue => ({ kind: 'number', value });

const setupUser = () => userEvent.setup({ pointerEventsCheck: 0 });

const makeRow = (overrides: Partial<OffentligeYdelserRow>): OffentligeYdelserRow => ({
  id: 'row1',
  fraDato: undefined,
  tilDato: undefined,
  ydelse: undefined,
  tillaeg: undefined,
  ydelsestype: '',
  ...overrides,
});

const getFirstDataRowCells = (): HTMLElement[] => {
  const rows = screen.getAllByRole('row');
  const firstDataRow = rows[1];
  return within(firstDataRow).getAllByRole('cell');
};

const getDerivedTexts = (): Pick<Derived, 'antalDageDisplay' | 'ydelsePerDagDisplay'> => {
  const cells = getFirstDataRowCells();
  return {
    antalDageDisplay: (cells[6]?.textContent ?? '').trim(),
    ydelsePerDagDisplay: (cells[7]?.textContent ?? '').trim(),
  };
};

const buildDerivedByRowId = (rows: readonly OffentligeYdelserRow[]): ReadonlyMap<string, Derived> => {
  const map = new Map<string, Derived>();
  for (const row of rows) {
    const derived = deriveOffentligeYdelserRow(row);
    map.set(row.id, {
      periodiseringLabel: derived.periodiseringLabel,
      antalDageDisplay: derived.antalDage !== null ? formatAntalDage(derived.antalDage) : '',
      ydelsePerDagDisplay: derived.ydelsePerDag !== null ? formatKr(derived.ydelsePerDag, 2) : '',
    });
  }
  return map;
};

const getYdelseInput = (): HTMLInputElement => {
  const cells = getFirstDataRowCells();
  return within(cells[2]!).getByRole('textbox') as HTMLInputElement;
};

const getTillaegInput = (): HTMLInputElement => {
  const cells = getFirstDataRowCells();
  return within(cells[3]!).getByRole('textbox') as HTMLInputElement;
};

const getFraDatoInput = (): HTMLInputElement => {
  const cells = getFirstDataRowCells();
  return within(cells[0]!).getByRole('textbox') as HTMLInputElement;
};

const getTilDatoInput = (): HTMLInputElement => {
  const cells = getFirstDataRowCells();
  return within(cells[1]!).getByRole('textbox') as HTMLInputElement;
};

const getYdelsestypeCombobox = (): HTMLElement => {
  const cells = getFirstDataRowCells();
  return within(cells[4]!).getByRole('combobox');
};

const DerivedHarness = ({ initial, onPersist }: { initial: OffentligeYdelserRow[]; onPersist: (next: OffentligeYdelserRow[]) => void }) => {
  const [tableData, setTableData] = React.useState<OffentligeYdelserRow[]>(initial);

  const derivedByRowId = React.useMemo(() => buildDerivedByRowId(tableData), [tableData]);

  const handleTableDataChange = React.useCallback(
    (next: OffentligeYdelserRow[]) => {
      onPersist(next);
      setTableData(next);
      return true;
    },
    [onPersist]
  );

  return (
    <>
      <OffentligeYdelserTable tableData={tableData} derivedByRowId={derivedByRowId} onTableDataChange={handleTableDataChange} />
      <button type="button">Udenfor</button>
    </>
  );
};

describe('OffentligeYdelserTable (Ydelse / dag)', () => {
  const TEST_TIMEOUT_MS = 30000;

  it('viser de nye ydelseskolonneoverskrifter', () => {
    render(<DerivedHarness onPersist={vi.fn()} initial={[makeRow({})]} />);

    expect(screen.getByText('Ydelse')).toBeInTheDocument();
    expect(screen.getByText('Ydelse (2)')).toBeInTheDocument();
    expect(screen.queryByText('Evt. tillæg')).not.toBeInTheDocument();
  });

  it('recomputes ydelse/dag when clearing ydelse via Backspace in focus-only mode', async () => {
    const onPersist = vi.fn();

    render(
      <DerivedHarness
        onPersist={onPersist}
        initial={[
          makeRow({
            fraDato: asDate('01-01-2024'),
            tilDato: asDate('10-01-2024'),
            ydelsestype: 'flextilskud',
            ydelse: asAmount(100),
          }),
        ]}
      />
    );

    expect(getDerivedTexts()).toEqual({ antalDageDisplay: '10', ydelsePerDagDisplay: '10,00 kr.' });

    const input = getYdelseInput();
    await clearFocusedTableCell(input, 'Backspace');

    await waitFor(() => {
      expect(onPersist).toHaveBeenCalledTimes(1);
      expect(getDerivedTexts()).toEqual({ antalDageDisplay: '10', ydelsePerDagDisplay: '' });
    });

    await blurTableElement(input);
    await waitFor(() => {
      expect(onPersist).toHaveBeenCalledTimes(1);
    });
  }, TEST_TIMEOUT_MS);

  it('bevarer fokus i samme celleposition når sidste værdi slettes i række med min. 2 rækker', async () => {
    const onPersist = vi.fn();

    render(
      <DerivedHarness
        onPersist={onPersist}
        initial={[
          makeRow({
            id: 'row-a',
            fraDato: asDate('01-01-2024'),
            tilDato: asDate('10-01-2024'),
            ydelsestype: 'flextilskud',
            ydelse: asAmount(100),
          }),
          makeRow({
            id: 'row-b',
          }),
        ]}
      />
    );

    const input = getYdelseInput();
    await clearFocusedTableCell(input, 'Delete');

    await waitFor(() => {
      const cellsNow = getFirstDataRowCells();
      const focusedInput = within(cellsNow[2]!).getByRole('textbox');
      expect(document.activeElement).toBe(focusedInput);
      expect(onPersist).toHaveBeenCalledTimes(1);
    });
  }, TEST_TIMEOUT_MS);

  it('bevarer fokus når værdi oprettes og efterfølgende slettes i ellers tom tabel', async () => {
    const onPersist = vi.fn();

    render(<DerivedHarness onPersist={onPersist} initial={[makeRow({})]} />);

    const input = getYdelseInput();

    await openTableInputEditing(input);
    await changeTableInput(input, '100');
    await blurTableElement(input);

    await waitFor(() => {
      expect(onPersist).toHaveBeenCalledTimes(1);
    });

    await clearFocusedTableCell(getYdelseInput(), 'Delete');

    await waitFor(() => {
      const cellsNow = getFirstDataRowCells();
      const focusedInput = within(cellsNow[2]!).getByRole('textbox');
      expect(document.activeElement).toBe(focusedInput);
    });
  }, TEST_TIMEOUT_MS);

  it('bevarer fokus i dropdown-felt når valgt ydelsestype ryddes med Delete', async () => {
    const onPersist = vi.fn();

    render(
      <DerivedHarness
        onPersist={onPersist}
        initial={[
          makeRow({
            id: 'row-a',
            ydelsestype: 'flextilskud',
          }),
          makeRow({
            id: 'row-b',
          }),
        ]}
      />
    );

    const combobox = getYdelsestypeCombobox();
    await focusTableElement(combobox);
    expect(document.activeElement).toBe(combobox);
    await keyDownTableElement(combobox, { key: 'Delete' });

    await waitFor(() => {
      const focusedCombobox = getYdelsestypeCombobox();
      expect(document.activeElement).toBe(focusedCombobox);
    });
  }, TEST_TIMEOUT_MS);

  it('updates derived cells only on blur when entering an already-canonical amount (no normalization delta)', async () => {
    const onPersist = vi.fn();

    render(
      <DerivedHarness
        onPersist={onPersist}
        initial={[
          makeRow({
            fraDato: asDate('01-01-2024'),
            tilDato: asDate('10-01-2024'),
            ydelsestype: 'flextilskud',
            ydelse: undefined,
          }),
        ]}
      />
    );

    expect(getDerivedTexts()).toEqual({ antalDageDisplay: '10', ydelsePerDagDisplay: '' });

    const input = getYdelseInput();
    await openTableInputEditing(input);
    await changeTableInput(input, '100,00');

    expect(input).toHaveValue('100,00');
    expect(onPersist).not.toHaveBeenCalled();
    expect(getDerivedTexts()).toEqual({ antalDageDisplay: '10', ydelsePerDagDisplay: '' });

    await blurTableElement(input);

    await waitFor(() => {
      expect(onPersist).toHaveBeenCalledTimes(1);
      expect(getDerivedTexts()).toEqual({ antalDageDisplay: '10', ydelsePerDagDisplay: '10,00 kr.' });
    });
  }, TEST_TIMEOUT_MS);

  it('recomputes ydelse/dag when clearing tillæg (tillæg-only -> empty)', async () => {
    const onPersist = vi.fn();

    render(
      <DerivedHarness
        onPersist={onPersist}
        initial={[
          makeRow({
            fraDato: asDate('01-01-2024'),
            tilDato: asDate('10-01-2024'),
            ydelsestype: 'flextilskud',
            ydelse: undefined,
            tillaeg: asAmount(50),
          }),
        ]}
      />
    );

    expect(getDerivedTexts()).toEqual({ antalDageDisplay: '10', ydelsePerDagDisplay: '5,00 kr.' });

    const input = getTillaegInput();
    await clearFocusedTableCell(input, 'Delete');

    await waitFor(() => {
      expect(onPersist).toHaveBeenCalledTimes(1);
      expect(getDerivedTexts()).toEqual({ antalDageDisplay: '10', ydelsePerDagDisplay: '' });
    });

    await blurTableElement(input);
    await waitFor(() => {
      expect(onPersist).toHaveBeenCalledTimes(1);
    });
  }, TEST_TIMEOUT_MS);

  it('recomputes ydelse/dag when clearing a date dependency (tilDato -> invalid period)', async () => {
    const onPersist = vi.fn();

    render(
      <DerivedHarness
        onPersist={onPersist}
        initial={[
          makeRow({
            fraDato: asDate('01-01-2024'),
            tilDato: asDate('10-01-2024'),
            ydelsestype: 'flextilskud',
            ydelse: asAmount(100),
          }),
        ]}
      />
    );

    expect(getDerivedTexts()).toEqual({ antalDageDisplay: '10', ydelsePerDagDisplay: '10,00 kr.' });

    const input = getTilDatoInput();
    await clearFocusedTableCell(input, 'Backspace');

    await waitFor(() => {
      expect(onPersist).toHaveBeenCalledTimes(1);
      expect(getDerivedTexts()).toEqual({ antalDageDisplay: '', ydelsePerDagDisplay: '' });
    });

    await blurTableElement(input);
    await waitFor(() => {
      expect(onPersist).toHaveBeenCalledTimes(1);
    });
  }, TEST_TIMEOUT_MS);

  it('viser ydelse pr. dag for midlertidigt EET-rækker (totalbeløb divideret med antal dage)', () => {
    render(
      <DerivedHarness
        onPersist={vi.fn()}
        initial={[
          makeRow({
            fraDato: asDate('01-01-2024'),
            tilDato: asDate('10-01-2024'),
            ydelsestype: 'midlertidigt_eet',
            ydelse: asAmount(1000),
          }),
        ]}
      />
    );

    expect(getDerivedTexts()).toEqual({ antalDageDisplay: '10', ydelsePerDagDisplay: '100,00 kr.' });
  });

  it('bevarer afledte celler når resync får et andet committed row-id end den renderede række', async () => {
    const oldRow = makeRow({
      id: 'old-render-id',
      fraDato: asDate('01-01-2024'),
      tilDato: asDate('10-01-2024'),
      ydelsestype: 'flextilskud',
      ydelse: asAmount(100),
    });
    const newRow = { ...oldRow, id: 'new-committed-id', ydelse: asAmount(200) };

    const { rerender } = render(
      <OffentligeYdelserTable
        tableData={[oldRow]}
        derivedByRowId={buildDerivedByRowId([oldRow])}
        onTableDataChange={vi.fn()}
      />
    );

    expect(getDerivedTexts()).toEqual({ antalDageDisplay: '10', ydelsePerDagDisplay: '10,00 kr.' });

    rerender(
      <OffentligeYdelserTable
        tableData={[newRow]}
        derivedByRowId={buildDerivedByRowId([newRow])}
        onTableDataChange={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(getDerivedTexts()).toEqual({ antalDageDisplay: '10', ydelsePerDagDisplay: '20,00 kr.' });
    });
  });

  it('recomputes ydelse/dag on blur when entering an already-canonical date (no normalization delta)', async () => {
    const onPersist = vi.fn();

    render(
      <DerivedHarness
        onPersist={onPersist}
        initial={[
          makeRow({
            fraDato: undefined,
            tilDato: asDate('10-01-2024'),
            ydelsestype: 'flextilskud',
            ydelse: asAmount(100),
          }),
        ]}
      />
    );

    expect(getDerivedTexts()).toEqual({ antalDageDisplay: '', ydelsePerDagDisplay: '' });

    const input = getFraDatoInput();
    await openTableInputEditing(input);
    await changeTableInput(input, '01-01-2024');

    expect(input).toHaveValue('01-01-2024');
    expect(onPersist).not.toHaveBeenCalled();
    expect(getDerivedTexts()).toEqual({ antalDageDisplay: '', ydelsePerDagDisplay: '' });

    await blurTableElement(input);

    await waitFor(() => {
      expect(onPersist).toHaveBeenCalledTimes(1);
      expect(getDerivedTexts()).toEqual({ antalDageDisplay: '10', ydelsePerDagDisplay: '10,00 kr.' });
    });
  }, TEST_TIMEOUT_MS);

  it('gemmer fra-dato ved klik udenfor standard grid table', async () => {
    const user = setupUser();
    const onPersist = vi.fn();

    render(
      <DerivedHarness
        onPersist={onPersist}
        initial={[
          makeRow({
            fraDato: undefined,
            tilDato: asDate('10-01-2024'),
            ydelsestype: 'flextilskud',
            ydelse: asAmount(100),
          }),
        ]}
      />
    );

    const input = getFraDatoInput();
    const outsideButton = screen.getByRole('button', { name: 'Udenfor' });

    await openTableInputEditing(input);
    await changeTableInput(input, '1-1-2024');

    expect(input).toHaveFocus();
    expect(input).toHaveValue('1-1-2024');

    await user.click(outsideButton);

    await waitFor(() => {
      expect(outsideButton).toHaveFocus();
    });

    await flushTableInteraction();

    await waitFor(() => {
      expect(onPersist).toHaveBeenCalledTimes(1);
      expect(getFraDatoInput()).toHaveValue('01-01-2024');
      expect(getDerivedTexts()).toEqual({ antalDageDisplay: '10', ydelsePerDagDisplay: '10,00 kr.' });
    });
  }, TEST_TIMEOUT_MS);
});
