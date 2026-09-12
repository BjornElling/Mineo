import type { AmountValue } from '../../../schemas/amountExpressionSchema';
import type { OffentligeYdelserRow } from '../../../schemas/formSchemas';
import { deriveOffentligeYdelserRow } from '../../../domain/erstatningsopgoerelse/helpers/offentligeYdelserDerived';
import { toISODateString } from '../../../types/branded';

const asAmount = (value: number): AmountValue => ({ kind: 'number', value });

describe('DATA-001/TD-020 – ydelsestype som downstream-consumer', () => {
  it('fører feriepenge-registerets arbejdsdage gennem ydelsesconsumerens dagstotal', () => {
    const row: OffentligeYdelserRow = {
      id: 'typed-data-facit-feriepenge',
      fraDato: toISODateString('2024-01-05'),
      tilDato: toISODateString('2024-01-08'),
      ydelse: asAmount(1400),
      tillaeg: asAmount(600),
      ydelsestype: 'feriepenge',
    };

    const result = deriveOffentligeYdelserRow(row);

    // Fredag–mandag indeholder to arbejdsdage. Registerets arbejdsdage-regel skal derfor
    // føre 2.000 kr. gennem den faktiske consumer som 1.000 kr. pr. dag.
    expect(result).toEqual({
      periodiseringLabel: 'Arbejdsdage',
      antalDage: 2,
      ydelsePerDag: 1000,
    });
  });
});
