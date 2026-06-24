// @vitest-environment jsdom
//
// A3-integration: celle-fejl-kanalen gennem en FAKTISK tabel (OffentligeYdelserTable).
// `useTableCellErrorTracker` har unit-tests for read-time-filtreringen isoleret; her dækkes hele
// kæden: en celle-fejl rapporteres af cellen → trackeren → validerings-summary (det Gem gater på),
// og når den fejlende RÆKKE fjernes, filtreres dens fejl væk ved læsning, så Gem ikke længere
// blokeres (read-time-filtrering mod gyldige rækker — værnet mod stille datatab i 14.2 §2.4).
import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { OffentligeYdelserRow } from '../../../schemas/formSchemas';
import type { AmountValue } from '../../../schemas/amountExpressionSchema';
import type { ISODateString } from '../../../types/branded';
import type { OffentligeYdelserTableValidationSummary } from '../../../types/table';
import OffentligeYdelserTable from '../../../components/tables/OffentligeYdelserTable';

const setupUser = () => userEvent.setup({ pointerEventsCheck: 0 });
const asDate = (s: string) => s as ISODateString;
const asAmount = (value: number): AmountValue => ({ kind: 'number', value });

const makeRow = (overrides: Partial<OffentligeYdelserRow>): OffentligeYdelserRow => ({
  id: 'row1',
  fraDato: undefined,
  tilDato: undefined,
  ydelse: undefined,
  tillaeg: undefined,
  ydelsestype: '',
  ...overrides,
});

const getDataRowCells = (rowIndex: number): HTMLElement[] => {
  const rows = screen.getAllByRole('row');
  // rows[0] er header; data-rækker starter ved index 1.
  return within(rows[rowIndex + 1]!).getAllByRole('cell');
};

const getFraDatoInput = (rowIndex: number): HTMLInputElement =>
  within(getDataRowCells(rowIndex)[0]!).getByRole('textbox') as HTMLInputElement;

const openInputEditing = async (user: ReturnType<typeof userEvent.setup>, input: HTMLElement) => {
  await user.click(input);
  if (input.hasAttribute('readonly')) await user.keyboard('1');
  await waitFor(() => expect(input).not.toHaveAttribute('readonly'));
};

const Harness = ({
  initial,
  onSummary,
}: {
  initial: OffentligeYdelserRow[];
  onSummary: (summary: OffentligeYdelserTableValidationSummary) => void;
}) => {
  const [tableData, setTableData] = React.useState<OffentligeYdelserRow[]>(initial);
  return (
    <OffentligeYdelserTable
      tableData={tableData}
      onTableDataChange={setTableData}
      onValidationChange={onSummary}
    />
  );
};

describe('OffentligeYdelserTable — celle-fejl-kanal-integration', () => {
  const TEST_TIMEOUT_MS = 30000;

  it('en celle-fejl blokerer Gem, og fjernelse af den fejlende række frigør gaten', async () => {
    const user = setupUser();
    let latest: OffentligeYdelserTableValidationSummary | null = null;
    const onSummary = (summary: OffentligeYdelserTableValidationSummary) => {
      latest = summary;
    };

    // row1 er fuldt udfyldt og gyldig → ikke-tom (beholder sit id + får en slet-knap) OG uden
    // mangler-fejl, så baseline er ren og en senere fejl udelukkende stammer fra den ugyldige dato.
    render(
      <Harness
        onSummary={onSummary}
        initial={[
          makeRow({
            id: 'row1',
            fraDato: asDate('01-01-2024'),
            tilDato: asDate('10-01-2024'),
            ydelsestype: 'flextilskud',
            ydelse: asAmount(100),
          }),
          makeRow({ id: 'row2' }),
        ]}
      />
    );

    // Udgangspunkt: ingen fejl.
    await waitFor(() => expect(latest?.hasErrors ?? false).toBe(false));

    // Fremkald en celle-fejl i row1: en ugyldig dato (måned 99) → cellen rapporterer hasError på commit.
    const fraDato = getFraDatoInput(0);
    await openInputEditing(user, fraDato);
    fireEvent.change(fraDato, { target: { value: '99-99-9999' } });
    fireEvent.blur(fraDato);

    await waitFor(() => {
      expect(latest?.hasErrors).toBe(true);
      expect(latest?.firstErrorCell?.rowId).toBe('row1');
      expect(latest?.firstErrorCell?.colKey).toBe('fraDato');
    });

    // Slet den fejlende række. Read-time-filtreringen mod de levende rækker skal fjerne dens fejl fra
    // summary'en, så Gem ikke længere blokeres af et spøgelses-mål uden synligt felt.
    fireEvent.click(screen.getByLabelText('Slet rækken'));

    await waitFor(() => {
      expect(latest?.hasErrors).toBe(false);
    });
  }, TEST_TIMEOUT_MS);
});
