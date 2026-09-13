import type { AmountValue } from '../../../schemas/amountExpressionSchema';
import type { OffentligeYdelserRow } from '../../../schemas/formSchemas';
import { deriveOffentligeYdelserRow } from '../../../domain/erstatningsopgoerelse/helpers/offentligeYdelserDerived';
import { toISODateString } from '../../../types/branded';

const iso = (value: string) => toISODateString(value);
const amount = (value: number): AmountValue => ({ kind: 'number', value });

describe('DATA-001/TD-020 – uddannelseshjælp som downstream-consumer', () => {
  it('fører uddannelseshjælp gennem kalenderdagsconsumerens dagstotal', () => {
    const row: OffentligeYdelserRow = {
      id: 'uddannelseshjaelp-kalenderdage',
      fraDato: iso('2024-01-05'),
      tilDato: iso('2024-01-08'),
      ydelse: amount(1200),
      tillaeg: amount(300),
      ydelsestype: 'uddannelseshjaelp',
    };

    const result = deriveOffentligeYdelserRow(row);

    // Fredag–mandag er fire kalenderdage. Ydelsen er 1.200 kr. + 300 kr. i tillæg,
    // så det håndberegnede facit er 1.500 kr. / 4 = 375 kr. pr. dag.
    expect(result).toEqual({
      periodiseringLabel: 'Kalenderdage',
      antalDage: 4,
      ydelsePerDag: 375,
    });
  });
});
