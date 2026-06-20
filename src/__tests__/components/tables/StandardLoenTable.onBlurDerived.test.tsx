import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { StandardLoenTableRow } from '../../../schemas/formSchemas';
import type { AmountValue } from '../../../schemas/amountExpressionSchema';
import StandardLoenTable from '../../../components/tables/StandardLoenTable';
import { DATE_ORDER_ERROR_MESSAGE } from '../../../utils/dateOrderValidation';
import { toISODateString } from '../../../types/branded';

type Derived = { fpFvShSo: string; pension: string; samlet: string };

const asAmount = (value: number): AmountValue => ({ kind: 'number', value });

const formatNumber = (num: number): string => {
  const rounded = Math.round(num * 100) / 100;
  const [int, dec] = rounded.toFixed(2).split('.');
  const formatted = int.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${formatted},${dec}`;
};

const computeDerived = (amounts: { col2: number; col3: number; col4: number; col5: number }): Derived => {
  const totalPct = 0.155;
  const pensionPct = 0.1;

  const loenPlusLoen2 = amounts.col2 + amounts.col3;
  const loenPlusLoen2PlusIkkePensLoen = loenPlusLoen2 + amounts.col4;
  const fpFvShSo = loenPlusLoen2PlusIkkePensLoen * totalPct;
  const pension = loenPlusLoen2 * (1 + totalPct) * pensionPct;
  const samlet = loenPlusLoen2PlusIkkePensLoen + fpFvShSo + pension + amounts.col5;

  // Afledte beløbsceller viser enheden "kr." (samme kanoniske enhed som redigerbare beløbsfelter).
  return {
    fpFvShSo: `${formatNumber(fpFvShSo)} kr.`,
    pension: `${formatNumber(pension)} kr.`,
    samlet: `${formatNumber(samlet)} kr.`,
  };
};

const setupUser = () => userEvent.setup({ pointerEventsCheck: 0 });

const setDraftValue = (input: HTMLElement, value: string) => {
  fireEvent.change(input, { target: { value } });
};

const openInputEditing = async (user: ReturnType<typeof userEvent.setup>, input: HTMLElement, startKey = '1') => {
  await user.click(input);
  if (input.hasAttribute('readonly')) {
    await user.keyboard(startKey);
  }
  await waitFor(() => {
    expect(input).not.toHaveAttribute('readonly');
  });
};

const getFirstDataRowCells = (): HTMLElement[] => {
  const rows = screen.getAllByRole('row');
  const firstDataRow = rows[1];
  return within(firstDataRow).getAllByRole('cell');
};

const getDerivedTexts = (): Derived => {
  const cells = getFirstDataRowCells();
  // 2 periodekolonner + 4 inputkolonner + 3 derived = 9 kolonner
  // Derived: fpFvShSo=cells[6], pension=cells[7], samlet=cells[8]
  return {
    fpFvShSo: (cells[6]?.textContent ?? '').trim(),
    pension: (cells[7]?.textContent ?? '').trim(),
    samlet: (cells[8]?.textContent ?? '').trim(),
  };
};

const getFirstPeriodInputs = (): [HTMLInputElement, HTMLInputElement] => {
  const cells = getFirstDataRowCells();
  return [
    within(cells[0]).getByRole('textbox') as HTMLInputElement,
    within(cells[1]).getByRole('textbox') as HTMLInputElement,
  ];
};

const flushAnimationFrame = async (): Promise<void> => {
  await act(async () => {
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });
  });
};

const makeRow = (overrides: Partial<StandardLoenTableRow>): StandardLoenTableRow => ({
  id: 'row1',
  col0_maaned: '',
  col1_maaned: '',
  col0_uge: '',
  col1_uge: '',
  col0_dag: undefined,
  col1_dag: undefined,
  col2: undefined,
  col3: undefined,
  col4: undefined,
  col5: undefined,
  ...overrides,
});

describe('StandardLoenTable', () => {
  const TEST_TIMEOUT_MS = 30000;

  it('viser de nye lønkolonneoverskrifter', () => {
    render(
      <StandardLoenTable
        loenperiode="maaned"
        satser={{ ferie: 12.5, fritvalg: 1, shSo: 2, bededag: 0, pension: 10 }}
        tableData={[makeRow({ col0_maaned: '1', col1_maaned: '2024' })]}
      />
    );

    expect(screen.getByText('Løn')).toBeInTheDocument();
    expect(screen.getByText('Løn (2)')).toBeInTheDocument();
    expect(screen.queryByText('Grundløn')).not.toBeInTheDocument();
    expect(screen.queryByText('Tillæg')).not.toBeInTheDocument();
  });

  it.each([
    { colIdx: 2, colKey: 'col2', nextValue: '2000' },
    { colIdx: 3, colKey: 'col3', nextValue: '600' },
    { colIdx: 4, colKey: 'col4', nextValue: '250' },
    { colIdx: 5, colKey: 'col5', nextValue: '500' },
  ] as const)('updates derived cells only on blur (%s)', async ({ colIdx, colKey, nextValue }) => {
    const user = setupUser();

    const onTableDataChange = vi.fn();
    const baseAmounts = { col2: 1000, col3: 500, col4: 200, col5: 300 };

    render(
      <StandardLoenTable
        loenperiode="maaned"
        satser={{ ferie: 12.5, fritvalg: 1, shSo: 2, bededag: 0, pension: 10 }}
        tableData={[
          makeRow({
            col0_maaned: '1',
            col1_maaned: '2024',
            col2: asAmount(baseAmounts.col2),
            col3: asAmount(baseAmounts.col3),
            col4: asAmount(baseAmounts.col4),
            col5: asAmount(baseAmounts.col5),
          }),
        ]}
        onTableDataChange={onTableDataChange}
      />
    );

    const initial = computeDerived(baseAmounts);
    expect(getDerivedTexts()).toEqual(initial);

    const cellsBefore = getFirstDataRowCells();
    const targetCell = cellsBefore[colIdx];
    const input = within(targetCell).getByRole('textbox');

    await openInputEditing(user, input, nextValue[0] ?? '1');
    setDraftValue(input, nextValue);

    expect(onTableDataChange).not.toHaveBeenCalled();
    expect(getDerivedTexts()).toEqual(initial);

    await act(async () => {
      fireEvent.blur(input);
    });

    const nextAmounts = { ...baseAmounts, [colKey]: Number(nextValue) } as typeof baseAmounts;
    const expectedAfterBlur = computeDerived(nextAmounts);

    await waitFor(() => {
      expect(getDerivedTexts()).toEqual(expectedAfterBlur);
      expect(onTableDataChange).toHaveBeenCalledTimes(1);
      expect(onTableDataChange.mock.calls[0]?.[1]).toEqual({ fieldPath: `row1:${colIdx}` });
    });
  }, TEST_TIMEOUT_MS);

  it('restores focus to same cell position when last value is cleared in a retained row (min 2 rows)', async () => {
    const user = setupUser();
    const onTableDataChange = vi.fn();

    render(
      <StandardLoenTable
        loenperiode="maaned"
        satser={{ ferie: 12.5, fritvalg: 1, shSo: 2, bededag: 0, pension: 10 }}
        tableData={[
          makeRow({
            id: 'row-a',
            col2: asAmount(1000),
          }),
          makeRow({
            id: 'row-b',
          }),
        ]}
        onTableDataChange={onTableDataChange}
      />
    );

    const firstRowCells = getFirstDataRowCells();
    const input = within(firstRowCells[2]).getByRole('textbox');

    await openInputEditing(user, input);
    setDraftValue(input, '');
    fireEvent.blur(input);

    await waitFor(() => {
      const cellsNow = getFirstDataRowCells();
      const focusedInput = within(cellsNow[2]).getByRole('textbox');
      expect(document.activeElement).toBe(focusedInput);
      expect(onTableDataChange).toHaveBeenCalledTimes(1);
    });
  }, TEST_TIMEOUT_MS);

  it.each([
    {
      loenperiode: 'dag' as const,
      row: makeRow({ col0_dag: toISODateString('2024-01-10'), col1_dag: toISODateString('2024-01-09') }),
    },
    {
      loenperiode: 'uge' as const,
      row: makeRow({ col0_uge: '03/2024', col1_uge: '02/2024' }),
    },
  ])('viser central fra/til-fejl i standardgrid for $loenperiode', async ({ loenperiode, row }) => {
    const onValidationChange = vi.fn();

    render(
      <StandardLoenTable
        loenperiode={loenperiode}
        satser={{ ferie: 12.5, fritvalg: 1, shSo: 2, bededag: 0, pension: 10 }}
        tableData={[row]}
        onValidationChange={onValidationChange}
      />
    );

    const [fraInput, tilInput] = getFirstPeriodInputs();
    const fraDescribedBy = fraInput.getAttribute('aria-describedby');
    const tilDescribedBy = tilInput.getAttribute('aria-describedby');

    expect(fraDescribedBy).toBeTruthy();
    expect(tilDescribedBy).toBeTruthy();
    expect(fraDescribedBy ? document.getElementById(fraDescribedBy) : null).toHaveTextContent(DATE_ORDER_ERROR_MESSAGE);
    expect(tilDescribedBy ? document.getElementById(tilDescribedBy) : null).toHaveTextContent(DATE_ORDER_ERROR_MESSAGE);

    await waitFor(() => {
      expect(onValidationChange).toHaveBeenCalled();
      expect(onValidationChange.mock.calls.at(-1)?.[0]).toMatchObject({
        hasErrors: true,
        firstErrorCell: { rowId: row.id },
      });
    });
  }, TEST_TIMEOUT_MS);

  it('removes a fully cleared middle row and normalizes back to trailing empty rows only', async () => {
    const user = setupUser();
    const onTableDataChange = vi.fn();

    render(
      <StandardLoenTable
        loenperiode="dag"
        satser={{ ferie: 12.5, fritvalg: 1, shSo: 2, bededag: 0, pension: 10 }}
        tableData={[
          makeRow({
            id: 'row-a',
            col0_dag: toISODateString('2025-01-01'),
            col1_dag: toISODateString('2025-01-31'),
            col2: asAmount(11111),
          }),
          makeRow({
            id: 'row-b',
            col0_dag: toISODateString('2025-02-01'),
            col1_dag: toISODateString('2025-02-28'),
            col2: asAmount(22222),
          }),
          makeRow({
            id: 'row-c',
          }),
        ]}
        onTableDataChange={onTableDataChange}
      />
    );

    const getMiddleRowTextbox = (cellIndex: number): HTMLInputElement => {
      const rows = screen.getAllByRole('row');
      const middleRow = rows[2];
      const cells = within(middleRow).getAllByRole('cell');
      return within(cells[cellIndex]).getByRole('textbox');
    };

    const clearCell = async (cellIndex: number) => {
      const input = getMiddleRowTextbox(cellIndex);
      await openInputEditing(user, input);
      setDraftValue(input, '');
      await act(async () => {
        fireEvent.blur(input);
      });
      await flushAnimationFrame();
    };

    await clearCell(0);
    await clearCell(1);
    await clearCell(2);

    await waitFor(() => {
      const bodyRows = screen.getAllByRole('row').slice(1);
      // Visningen normaliserer fortsat tilbage til min. 2 rækker (den udfyldte + en efterfølgende tom).
      expect(bodyRows).toHaveLength(2);
      expect(onTableDataChange).toHaveBeenCalled();
      // Persistering inkluderer kun bruger-indtastede (non-empty) rækker — den syntetiske tomme
      // række gemmes ikke (jf. save/load-kontrakten; konvergeret med de øvrige grid-tabeller).
      const latestCall = onTableDataChange.mock.calls.at(-1)?.[0] as StandardLoenTableRow[] | undefined;
      expect(latestCall).toHaveLength(1);
      expect(latestCall?.[0]?.id).toBe('row-a');
      expect(latestCall?.some((row) => row.id === 'row-b')).toBe(false);
    });
  }, TEST_TIMEOUT_MS);

  it('drops rows that are only kept alive by hidden period columns from another loenperiode', async () => {
    render(
      <StandardLoenTable
        loenperiode="dag"
        satser={{ ferie: 12.5, fritvalg: 1, shSo: 2, bededag: 0, pension: 10 }}
        tableData={[
          makeRow({
            id: 'row-a',
            col0_dag: toISODateString('2025-01-01'),
            col1_dag: toISODateString('2025-01-31'),
            col2: asAmount(11111),
          }),
          makeRow({
            id: 'row-b',
            col0_maaned: '2',
            col1_maaned: '2025',
          }),
          makeRow({
            id: 'row-c',
          }),
        ]}
      />
    );

    await waitFor(() => {
      const bodyRows = screen.getAllByRole('row').slice(1);
      expect(bodyRows).toHaveLength(2);
      expect(screen.queryByDisplayValue('2')).not.toBeInTheDocument();
      expect(screen.queryByDisplayValue('2025')).not.toBeInTheDocument();
    });
  }, TEST_TIMEOUT_MS);
});
