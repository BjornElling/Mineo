import type { AmountValue } from '../../../schemas/amountExpressionSchema';
import type { OffentligeYdelserRow } from '../../../schemas/formSchemas';
import { deriveOffentligeYdelserRow } from '../../../domain/erstatningsopgoerelse/offentligeYdelserDerived';

const asAmountValue = (value: number): AmountValue => ({ kind: 'number', value });

const baseRow: OffentligeYdelserRow = {
  id: 'row-1',
  fraDato: '',
  tilDato: '',
  ydelse: undefined,
  tillaeg: undefined,
  ydelsestype: '',
};

describe('deriveOffentligeYdelserRow', () => {
  it('returnerer nuller når ydelsestype mangler', () => {
    const result = deriveOffentligeYdelserRow(baseRow);
    expect(result.antalDage).toBeNull();
    expect(result.ydelsePerDag).toBeNull();
  });

  it('beregner ydelse pr. dag for kalenderdage', () => {
    const row: OffentligeYdelserRow = {
      ...baseRow,
      fraDato: '01-01-2024',
      tilDato: '10-01-2024',
      ydelsestype: 'dagpenge',
      ydelse: asAmountValue(1000),
      tillaeg: asAmountValue(0),
    };
    const result = deriveOffentligeYdelserRow(row);
    expect(result.antalDage).toBe(10);
    expect(result.ydelsePerDag).toBe(100);
  });

  it('returnerer null ved ugyldig periode', () => {
    const row: OffentligeYdelserRow = {
      ...baseRow,
      fraDato: '10-01-2024',
      tilDato: '01-01-2024',
      ydelsestype: 'dagpenge',
      ydelse: asAmountValue(100),
      tillaeg: asAmountValue(0),
    };
    const result = deriveOffentligeYdelserRow(row);
    expect(result.antalDage).toBeNull();
    expect(result.ydelsePerDag).toBeNull();
  });
});
