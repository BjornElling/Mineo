// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { LoenudviklingManuelRow } from '../../../schemas/formSchemas';
import type { AmountValue } from '../../../schemas/amountExpressionSchema';
import LoenudviklingManuelTable from '../../../components/tables/LoenudviklingManuelTable';

const asAmount = (value: number): AmountValue => ({ kind: 'number', value });

const makeRow = (id: string, overrides: Partial<LoenudviklingManuelRow> = {}): LoenudviklingManuelRow => ({
  id,
  dato: undefined,
  grundloen: undefined,
  feriepenge: undefined,
  shSoSats: undefined,
  fritvalg: undefined,
  agPension: undefined,
  ...overrides,
});

const getDataRows = (): HTMLElement[] => {
  const rows = screen.getAllByRole('row');
  return rows.slice(1);
};

describe('LoenudviklingManuelTable fokus-gendannelse', () => {
  const TEST_TIMEOUT_MS = 15000;

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
  }, TEST_TIMEOUT_MS);

  it('låser base-rækkens procentfelter når readOnlyBaseRowPercentFields er aktiv', () => {
    render(
      <LoenudviklingManuelTable
        tableData={[
          makeRow('base-row', { feriepenge: 15, shSoSats: 0, fritvalg: 7, agPension: 9 }),
          makeRow('row-a'),
        ]}
        baseDateDisplay="01-01-2024"
        readOnlyBaseRowPercentFields={true}
      />
    );

    const rows = getDataRows();
    const baseRowCells = within(rows[0]!).getAllByRole('cell');
    const ferieInput = within(baseRowCells[2]!).getByRole('textbox');
    const shSoInput = within(baseRowCells[3]!).getByRole('textbox');
    const fritvalgInput = within(baseRowCells[4]!).getByRole('textbox');
    const pensionInput = within(baseRowCells[5]!).getByRole('textbox');

    expect(ferieInput).toHaveAttribute('data-mineo-grid-locked', 'true');
    expect(shSoInput).toHaveAttribute('data-mineo-grid-locked', 'true');
    expect(fritvalgInput).toHaveAttribute('data-mineo-grid-locked', 'true');
    expect(pensionInput).toHaveAttribute('data-mineo-grid-locked', 'true');
    expect(ferieInput).toHaveValue('15,00 %');
    expect(fritvalgInput).toHaveValue('7,00 %');
    expect(pensionInput).toHaveValue('9,00 %');
  });

  it('viser placeholder "0 %" for ikke-udfyldte base-procentfelter, men 0,00 % for eksplicit nul', () => {
    render(
      <LoenudviklingManuelTable
        tableData={[
          // fritvalg er undefined (ikke udfyldt); shSoSats er eksplicit 0.
          makeRow('base-row', { feriepenge: 12.5, shSoSats: 0, fritvalg: undefined, agPension: 8.15 }),
          makeRow('row-a'),
        ]}
        baseDateDisplay="02-05-2017"
        readOnlyBaseRowPercentFields={true}
      />
    );

    const rows = getDataRows();
    const baseRowCells = within(rows[0]!).getAllByRole('cell');
    const shSoInput = within(baseRowCells[3]!).getByRole('textbox');
    const fritvalgInput = within(baseRowCells[4]!).getByRole('textbox');

    // Ikke-udfyldt felt: tom værdi, men placeholder vises i stedet for et tomt felt.
    expect(fritvalgInput).toHaveValue('');
    expect(fritvalgInput).toHaveAttribute('placeholder', '0 %');

    // Eksplicit nul må ikke kollapse til placeholder.
    expect(shSoInput).toHaveValue('0,00 %');
  });

  it('viser tooltip på read-only dato og read-only procentsatser', async () => {
    const user = userEvent.setup();

    render(
      <LoenudviklingManuelTable
        tableData={[
          makeRow('base-row', { feriepenge: 15, shSoSats: 0, fritvalg: 7, agPension: 9 }),
          makeRow('row-a'),
        ]}
        baseDateDisplay="01-01-2024"
        baseDateInfoTooltipText="Anmeldedato"
        readOnlyBaseRowPercentFields={true}
      />
    );

    const rows = getDataRows();
    const baseRowCells = within(rows[0]!).getAllByRole('cell');
    const dateInput = within(baseRowCells[0]!).getByRole('textbox');
    const ferieInput = within(baseRowCells[2]!).getByRole('textbox');

    await user.hover(dateInput);
    expect(await screen.findByText('Anmeldedato')).toBeInTheDocument();

    await user.unhover(dateInput);
    await user.hover(ferieInput);
    expect(await screen.findByText('Værdien angives ovenfor')).toBeInTheDocument();
  });
});
