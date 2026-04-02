import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { OffentligeYdelserRow } from '../../../schemas/formSchemas';
import type { AmountValue } from '../../../schemas/amountExpressionSchema';
import OffentligeYdelserTable from '../../../components/tables/OffentligeYdelserTable';
import { deriveOffentligeYdelserRow } from '../../../domain/erstatningsopgoerelse/helpers/offentligeYdelserDerived';
import { formatCurrency } from '../../../utils/formatUtils';

type Derived = { periodiseringLabel: string; antalDageDisplay: string; ydelsePerDagDisplay: string };

const formatAntalDage = (value: number): string => {
  return new Intl.NumberFormat('da-DK', { maximumFractionDigits: 0 }).format(value);
};

const asAmount = (value: number): AmountValue => ({ kind: 'number', value });

const makeRow = (overrides: Partial<OffentligeYdelserRow>): OffentligeYdelserRow => ({
  id: 'row1',
  fraDato: '',
  tilDato: '',
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

  const derivedByRowId = React.useMemo(() => {
    const map = new Map<string, Derived>();
    for (const row of tableData) {
      const derived = deriveOffentligeYdelserRow(row);
      map.set(row.id, {
        periodiseringLabel: derived.periodiseringLabel,
        antalDageDisplay: derived.antalDage !== null ? formatAntalDage(derived.antalDage) : '',
        ydelsePerDagDisplay: derived.ydelsePerDag !== null ? formatCurrency(derived.ydelsePerDag) : '',
      });
    }
    return map;
  }, [tableData]);

  const handleTableDataChange = React.useCallback(
    (next: OffentligeYdelserRow[]) => {
      onPersist(next);
      setTableData(next);
    },
    [onPersist]
  );

  return <OffentligeYdelserTable tableData={tableData} derivedByRowId={derivedByRowId} onTableDataChange={handleTableDataChange} />;
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
    const user = userEvent.setup();
    const onPersist = vi.fn();

    render(
      <DerivedHarness
        onPersist={onPersist}
        initial={[
          makeRow({
            fraDato: '01-01-2024',
            tilDato: '10-01-2024',
            ydelsestype: 'flextilskud',
            ydelse: asAmount(100),
          }),
        ]}
      />
    );

    expect(getDerivedTexts()).toEqual({ antalDageDisplay: '10', ydelsePerDagDisplay: '10,00' });

    const input = getYdelseInput();
    await user.click(input);
    await user.keyboard('{Backspace}');

    await waitFor(() => {
      expect(onPersist).toHaveBeenCalledTimes(1);
      expect(getDerivedTexts()).toEqual({ antalDageDisplay: '10', ydelsePerDagDisplay: '' });
    });

    fireEvent.blur(input);
    await waitFor(() => {
      expect(onPersist).toHaveBeenCalledTimes(1);
    });
  }, TEST_TIMEOUT_MS);

  it('bevarer fokus i samme celleposition når sidste værdi slettes i række med min. 2 rækker', async () => {
    const user = userEvent.setup();
    const onPersist = vi.fn();

    render(
      <DerivedHarness
        onPersist={onPersist}
        initial={[
          makeRow({
            id: 'row-a',
            fraDato: '01-01-2024',
            tilDato: '10-01-2024',
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
    await user.click(input);
    await user.keyboard('{Delete}');

    await waitFor(() => {
      const cellsNow = getFirstDataRowCells();
      const focusedInput = within(cellsNow[2]!).getByRole('textbox');
      expect(document.activeElement).toBe(focusedInput);
      expect(onPersist).toHaveBeenCalledTimes(1);
    });
  }, TEST_TIMEOUT_MS);

  it('bevarer fokus når værdi oprettes og efterfølgende slettes i ellers tom tabel', async () => {
    const user = userEvent.setup();
    const onPersist = vi.fn();

    render(<DerivedHarness onPersist={onPersist} initial={[makeRow({})]} />);

    const input = getYdelseInput();

    await user.dblClick(input);
    await user.type(input, '100');
    fireEvent.blur(input);

    await waitFor(() => {
      expect(onPersist).toHaveBeenCalledTimes(1);
    });

    await user.click(getYdelseInput());
    await user.keyboard('{Delete}');

    await waitFor(() => {
      const cellsNow = getFirstDataRowCells();
      const focusedInput = within(cellsNow[2]!).getByRole('textbox');
      expect(document.activeElement).toBe(focusedInput);
    });
  }, TEST_TIMEOUT_MS);

  it('bevarer fokus i dropdown-felt når valgt ydelsestype ryddes med Delete', async () => {
    const user = userEvent.setup();
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
    act(() => {
      combobox.focus();
    });
    expect(document.activeElement).toBe(combobox);
    await user.keyboard('{Delete}');

    await waitFor(() => {
      const focusedCombobox = getYdelsestypeCombobox();
      expect(document.activeElement).toBe(focusedCombobox);
    });
  }, TEST_TIMEOUT_MS);

  it('updates derived cells only on blur when entering an already-canonical amount (no normalization delta)', async () => {
    const user = userEvent.setup();
    const onPersist = vi.fn();

    render(
      <DerivedHarness
        onPersist={onPersist}
        initial={[
          makeRow({
            fraDato: '01-01-2024',
            tilDato: '10-01-2024',
            ydelsestype: 'flextilskud',
            ydelse: undefined,
          }),
        ]}
      />
    );

    expect(getDerivedTexts()).toEqual({ antalDageDisplay: '10', ydelsePerDagDisplay: '' });

    const input = getYdelseInput();
    await user.dblClick(input);
    await user.type(input, '100,00');

    expect(onPersist).not.toHaveBeenCalled();
    expect(getDerivedTexts()).toEqual({ antalDageDisplay: '10', ydelsePerDagDisplay: '' });

    fireEvent.blur(input);

    await waitFor(() => {
      expect(onPersist).toHaveBeenCalledTimes(1);
      expect(getDerivedTexts()).toEqual({ antalDageDisplay: '10', ydelsePerDagDisplay: '10,00' });
    });
  }, TEST_TIMEOUT_MS);

  it('recomputes ydelse/dag when clearing tillæg (tillæg-only -> empty)', async () => {
    const user = userEvent.setup();
    const onPersist = vi.fn();

    render(
      <DerivedHarness
        onPersist={onPersist}
        initial={[
          makeRow({
            fraDato: '01-01-2024',
            tilDato: '10-01-2024',
            ydelsestype: 'flextilskud',
            ydelse: undefined,
            tillaeg: asAmount(50),
          }),
        ]}
      />
    );

    expect(getDerivedTexts()).toEqual({ antalDageDisplay: '10', ydelsePerDagDisplay: '5,00' });

    const input = getTillaegInput();
    await user.click(input);
    await user.keyboard('{Delete}');

    await waitFor(() => {
      expect(onPersist).toHaveBeenCalledTimes(1);
      expect(getDerivedTexts()).toEqual({ antalDageDisplay: '10', ydelsePerDagDisplay: '' });
    });

    fireEvent.blur(input);
    await waitFor(() => {
      expect(onPersist).toHaveBeenCalledTimes(1);
    });
  }, TEST_TIMEOUT_MS);

  it('recomputes ydelse/dag when clearing a date dependency (tilDato -> invalid period)', async () => {
    const user = userEvent.setup();
    const onPersist = vi.fn();

    render(
      <DerivedHarness
        onPersist={onPersist}
        initial={[
          makeRow({
            fraDato: '01-01-2024',
            tilDato: '10-01-2024',
            ydelsestype: 'flextilskud',
            ydelse: asAmount(100),
          }),
        ]}
      />
    );

    expect(getDerivedTexts()).toEqual({ antalDageDisplay: '10', ydelsePerDagDisplay: '10,00' });

    const input = getTilDatoInput();
    await user.click(input);
    await user.keyboard('{Backspace}');

    await waitFor(() => {
      expect(onPersist).toHaveBeenCalledTimes(1);
      expect(getDerivedTexts()).toEqual({ antalDageDisplay: '', ydelsePerDagDisplay: '' });
    });

    fireEvent.blur(input);
    await waitFor(() => {
      expect(onPersist).toHaveBeenCalledTimes(1);
    });
  }, TEST_TIMEOUT_MS);

  it('viser ikke ydelse pr. dag for midlertidigt EET-rækker', () => {
    render(
      <DerivedHarness
        onPersist={vi.fn()}
        initial={[
          makeRow({
            fraDato: '01-01-2024',
            tilDato: '10-01-2024',
            ydelsestype: 'midlertidigt_eet',
            ydelse: asAmount(1000),
          }),
        ]}
      />
    );

    expect(getDerivedTexts()).toEqual({ antalDageDisplay: '10', ydelsePerDagDisplay: '' });
  });

  it('recomputes ydelse/dag on blur when entering an already-canonical date (no normalization delta)', async () => {
    const user = userEvent.setup();
    const onPersist = vi.fn();

    render(
      <DerivedHarness
        onPersist={onPersist}
        initial={[
          makeRow({
            fraDato: '',
            tilDato: '10-01-2024',
            ydelsestype: 'flextilskud',
            ydelse: asAmount(100),
          }),
        ]}
      />
    );

    expect(getDerivedTexts()).toEqual({ antalDageDisplay: '', ydelsePerDagDisplay: '' });

    const input = getFraDatoInput();
    await user.dblClick(input);
    await user.type(input, '01-01-2024');

    expect(onPersist).not.toHaveBeenCalled();
    expect(getDerivedTexts()).toEqual({ antalDageDisplay: '', ydelsePerDagDisplay: '' });

    fireEvent.blur(input);

    await waitFor(() => {
      expect(onPersist).toHaveBeenCalledTimes(1);
      expect(getDerivedTexts()).toEqual({ antalDageDisplay: '10', ydelsePerDagDisplay: '10,00' });
    });
  }, TEST_TIMEOUT_MS);
});
