import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { StandardLoenTableRow } from '../../../schemas/formSchemas';
import type { AmountValue } from '../../../schemas/amountExpressionSchema';
import StandardLoenTable from '../../../components/tables/StandardLoenTable';

type Derived = { col6: string; col7: string; col8: string; col9: string };

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

  const ferieberet = amounts.col2 + amounts.col3 + amounts.col4;
  const fpFvShSo = ferieberet * totalPct;
  const pensionBase = (amounts.col2 + amounts.col3) * (1 + totalPct);
  const pension = pensionBase * pensionPct;
  const samlet = ferieberet + fpFvShSo + pension + amounts.col5;

  return {
    col6: formatNumber(ferieberet),
    col7: formatNumber(fpFvShSo),
    col8: formatNumber(pension),
    col9: formatNumber(samlet),
  };
};

const getFirstDataRowCells = (): HTMLElement[] => {
  const rows = screen.getAllByRole('row');
  const firstDataRow = rows[1];
  return within(firstDataRow).getAllByRole('cell');
};

const getDerivedTexts = (): Derived => {
  const cells = getFirstDataRowCells();
  return {
    col6: (cells[6]?.textContent ?? '').trim(),
    col7: (cells[7]?.textContent ?? '').trim(),
    col8: (cells[8]?.textContent ?? '').trim(),
    col9: (cells[9]?.textContent ?? '').trim(),
  };
};

const makeRow = (overrides: Partial<StandardLoenTableRow>): StandardLoenTableRow => ({
  id: 'row1',
  col0_maaned: '',
  col1_maaned: '',
  col0_uge: '',
  col1_uge: '',
  col0_dag: '',
  col1_dag: '',
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
    const user = userEvent.setup();

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

    await user.dblClick(input);
    await user.clear(input);
    await user.type(input, nextValue);

    expect(onTableDataChange).not.toHaveBeenCalled();
    expect(getDerivedTexts()).toEqual(initial);

    fireEvent.blur(input);

    const nextAmounts = { ...baseAmounts, [colKey]: Number(nextValue) } as typeof baseAmounts;
    const expectedAfterBlur = computeDerived(nextAmounts);

    await waitFor(() => {
      expect(getDerivedTexts()).toEqual(expectedAfterBlur);
      expect(onTableDataChange).toHaveBeenCalledTimes(1);
    });
  }, TEST_TIMEOUT_MS);

  it('restores focus to same cell position when last value is cleared in a retained row (min 2 rows)', async () => {
    const user = userEvent.setup();
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

    await user.dblClick(input);
    await user.clear(input);
    fireEvent.blur(input);

    await waitFor(() => {
      const cellsNow = getFirstDataRowCells();
      const focusedInput = within(cellsNow[2]).getByRole('textbox');
      expect(document.activeElement).toBe(focusedInput);
      expect(onTableDataChange).toHaveBeenCalledTimes(1);
    });
  }, TEST_TIMEOUT_MS);
});
