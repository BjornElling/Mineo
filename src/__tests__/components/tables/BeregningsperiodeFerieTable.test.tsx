import { render, screen } from '@testing-library/react';
import type { FerieperiodeRow } from '../../../schemas/formSchemas';
import type { FerieDraftRow } from '../../../domain/erstatningsopgoerelse/tableDraftRows';
import { toISODateString } from '../../../types/branded';
import BeregningsperiodeFerieTable from '../../../components/tables/BeregningsperiodeFerieTable';

describe('BeregningsperiodeFerieTable', () => {
  it('shows a special error message when the date is outside the beregningsperiode (and bounds are valid)', () => {
    const row: FerieDraftRow = { id: 'row1', fra: '', til: '' };

    const committedById = new Map<string, FerieperiodeRow>([
      [
        'row1',
        {
          id: 'row1',
          fra: toISODateString('2023-04-30'),
          til: undefined,
        },
      ],
    ]);

    render(
      <BeregningsperiodeFerieTable
        rows={[row]}
        committedById={committedById}
        feriedageById={{ row1: null }}
        onFieldChange={() => () => undefined}
        onRowBlur={() => undefined}
        beregningsperiodeFra={toISODateString('2023-05-01')}
        beregningsperiodeTil={toISODateString('2023-05-31')}
      />
    );

    const input = screen.getByDisplayValue('30-04-2023');
    const describedBy = input.getAttribute('aria-describedby') ?? '';
    const errorId = describedBy
      .split(' ')
      .map((v) => v.trim())
      .find((v) => v.endsWith('-error'));

    expect(errorId).toBeTruthy();
    const errorNode = errorId ? document.getElementById(errorId) : null;
    expect(errorNode).not.toBeNull();
    expect(errorNode?.textContent).toBe('Ferie i beregningsperioden skal også ligge inden for beregningsperioden.');
  });
});

