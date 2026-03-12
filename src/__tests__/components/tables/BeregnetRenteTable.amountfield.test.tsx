import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BeregnetRenteTable from '../../../components/tables/BeregnetRenteTable';
import type { RentekravDraftRow } from '../../../domain/renteberegning/tableDraftRows';
import type { RentekravRow } from '../../../schemas/formSchemas';

vi.mock('../../../contexts/useFormPersistence', () => ({
  useFormPersistence: () => ({
    getPersistedData: () => undefined,
  }),
}));

vi.mock('../../../contexts/useAppSettings', () => ({
  useAppSettings: () => ({
    settings: {},
  }),
}));

describe('BeregnetRenteTable amount commit wiring', () => {
  it('clears amount and commits row on Delete in closed StyledAmountField', async () => {
    const user = userEvent.setup();
    const valueWriter = vi.fn();
    const onFieldChange = vi.fn(() => valueWriter);
    const onRowBlur = vi.fn();

    const row: RentekravDraftRow = {
      id: 'r1',
      belob: '100,00',
      renterFra: '',
      tillaegstid: '',
      enhed: 'dage',
    };

    const committedRow: RentekravRow = {
      id: 'r1',
      belob: { kind: 'number', value: 100 },
      renterFra: undefined,
      tillaegstid: undefined,
      enhed: 'dage',
    };

    render(
      <BeregnetRenteTable
        rows={[row]}
        committedById={new Map([[row.id, committedRow]])}
        onFieldChange={onFieldChange}
        onRowBlur={onRowBlur}
        beregningsdato={undefined}
        onDownloadSpecifikation={vi.fn(async () => undefined)}
        onError={() => undefined}
        beregningsdatoHasError={false}
      />
    );

    const amountInput = screen.getByPlaceholderText('0,00 kr.');
    await user.click(amountInput);
    await user.keyboard('{Delete}');

    expect(onFieldChange).toHaveBeenCalledWith('r1', 'belob');
    expect(valueWriter).toHaveBeenCalledWith('');
    expect(onRowBlur).toHaveBeenCalledWith('r1');
  });
});
