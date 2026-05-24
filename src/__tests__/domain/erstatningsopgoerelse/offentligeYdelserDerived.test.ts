import type { AmountValue } from '../../../schemas/amountExpressionSchema';
import type { OffentligeYdelserRow } from '../../../schemas/formSchemas';
import { deriveOffentligeYdelserRow } from '../../../domain/erstatningsopgoerelse/helpers/offentligeYdelserDerived';

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
      fraDato: '2024-01-01',
      tilDato: '2024-01-10',
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
      fraDato: '2024-01-10',
      tilDato: '2024-01-01',
      ydelsestype: 'dagpenge',
      ydelse: asAmountValue(100),
      tillaeg: asAmountValue(0),
    };
    const result = deriveOffentligeYdelserRow(row);
    expect(result.antalDage).toBeNull();
    expect(result.ydelsePerDag).toBeNull();
  });

  it('returnerer periodiseringLabel fra ydelsestype-config', () => {
    const row: OffentligeYdelserRow = {
      ...baseRow,
      fraDato: '2024-01-01',
      tilDato: '2024-01-10',
      ydelsestype: 'dagpenge',
      ydelse: asAmountValue(1000),
    };
    const result = deriveOffentligeYdelserRow(row);
    expect(result.periodiseringLabel).toBe('Kalenderdage');
  });

  it('returnerer tom periodiseringLabel for ukendt ydelsestype', () => {
    const result = deriveOffentligeYdelserRow({ ...baseRow, ydelsestype: 'ukendt-type' });
    expect(result.periodiseringLabel).toBe('');
    expect(result.antalDage).toBeNull();
  });

  it('antalDage sat men ydelsePerDag null når ydelse og tillaeg begge mangler', () => {
    const row: OffentligeYdelserRow = {
      ...baseRow,
      fraDato: '2024-01-01',
      tilDato: '2024-01-10',
      ydelsestype: 'dagpenge',
      ydelse: undefined,
      tillaeg: undefined,
    };
    const result = deriveOffentligeYdelserRow(row);
    expect(result.antalDage).toBe(10);
    expect(result.ydelsePerDag).toBeNull();
  });

  it('summerer ydelse + tillaeg korrekt', () => {
    const row: OffentligeYdelserRow = {
      ...baseRow,
      fraDato: '2024-01-01',
      tilDato: '2024-01-10',
      ydelsestype: 'dagpenge',
      ydelse: asAmountValue(800),
      tillaeg: asAmountValue(200),
    };
    const result = deriveOffentligeYdelserRow(row);
    expect(result.ydelsePerDag).toBe(100);
  });

  it('behandler de to ydelsesfelter ens og summerer dem blot i beregningen', () => {
    const kunFoersteFelt: OffentligeYdelserRow = {
      ...baseRow,
      fraDato: '2024-01-01',
      tilDato: '2024-01-10',
      ydelsestype: 'dagpenge',
      ydelse: asAmountValue(1000),
      tillaeg: asAmountValue(0),
    };
    const fordeltMellemBegge: OffentligeYdelserRow = {
      ...baseRow,
      fraDato: '2024-01-01',
      tilDato: '2024-01-10',
      ydelsestype: 'dagpenge',
      ydelse: asAmountValue(800),
      tillaeg: asAmountValue(200),
    };

    expect(deriveOffentligeYdelserRow(fordeltMellemBegge)).toEqual(deriveOffentligeYdelserRow(kunFoersteFelt));
  });

  it('sygedagpenge bruger arbejdsdage-periodisering (periodiseringLabel = Arbejdsdage)', () => {
    const row: OffentligeYdelserRow = {
      ...baseRow,
      fraDato: '2024-01-08',
      tilDato: '2024-01-12',
      ydelsestype: 'sygedagpenge',
      ydelse: asAmountValue(2500),
      tillaeg: asAmountValue(0),
    };
    const result = deriveOffentligeYdelserRow(row);
    expect(result.periodiseringLabel).toBe('Arbejdsdage');
    expect(result.antalDage).toBeGreaterThan(0);
    expect(result.ydelsePerDag).toBeGreaterThan(0);
  });

  it('kun tillaeg (ydelse undefined) → ydelsePerDag beregnes fra tillaeg alene', () => {
    const row: OffentligeYdelserRow = {
      ...baseRow,
      fraDato: '2024-01-01',
      tilDato: '2024-01-10',
      ydelsestype: 'dagpenge',
      ydelse: undefined,
      tillaeg: asAmountValue(500),
    };
    const result = deriveOffentligeYdelserRow(row);
    // (0 + 500) / 10 dage = 50
    expect(result.ydelsePerDag).toBe(50);
  });

  it('beregner ydelse pr. dag for midlertidigt EET ved at dividere periodetotalbeløbet med kalenderdage', () => {
    const row: OffentligeYdelserRow = {
      ...baseRow,
      fraDato: '2024-01-01',
      tilDato: '2024-01-10',
      ydelsestype: 'midlertidigt_eet',
      ydelse: asAmountValue(1000),
    };

    const result = deriveOffentligeYdelserRow(row);
    expect(result.antalDage).toBe(10);
    expect(result.ydelsePerDag).toBe(100);
  });
});
