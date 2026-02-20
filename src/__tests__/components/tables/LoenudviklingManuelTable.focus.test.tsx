import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import type { LoenudviklingManuelRow } from '../../../schemas/formSchemas';
import type { AmountValue } from '../../../schemas/amountExpressionSchema';
import LoenudviklingManuelTable from '../../../components/tables/LoenudviklingManuelTable';

const asAmount = (value: number): AmountValue => ({ kind: 'number', value });

const makeRow = (id: string, overrides: Partial<LoenudviklingManuelRow> = {}): LoenudviklingManuelRow => ({
  id,
  dato: '',
  grundloen: undefined,
  feriepenge: '',
  shSoSats: '',
  fritvalg: '',
  agPension: '',
  ...overrides,
});

const getDataRows = (): HTMLElement[] => {
  const rows = screen.getAllByRole('row');
  return rows.slice(1);
};

describe('LoenudviklingManuelTable fokus-gendannelse', () => {
  it('bevarer fokus i samme celleposition når slettet række normaliseres væk', async () => {
    const user = userEvent.setup();
    const onTableDataChange = vi.fn();

    render(
      <LoenudviklingManuelTable
        tableData={[
          makeRow('base-row'),
          makeRow('row-a', { grundloen: asAmount(1000) }),
          makeRow('row-b'),
        ]}
        onTableDataChange={onTableDataChange}
        baseDateDisplay="01-01-2024"
      />
    );

    const beforeRows = getDataRows();
    const secondDataRowCells = within(beforeRows[1]!).getAllByRole('cell');
    const input = within(secondDataRowCells[1]!).getByRole('textbox');

    await user.click(input);
    await user.keyboard('{Delete}');

    await waitFor(() => {
      const afterRows = getDataRows();
      const secondRowCells = within(afterRows[1]!).getAllByRole('cell');
      const focusedInput = within(secondRowCells[1]!).getByRole('textbox');
      expect(document.activeElement).toBe(focusedInput);
      expect(onTableDataChange).toHaveBeenCalledTimes(1);
    });
  });
});
