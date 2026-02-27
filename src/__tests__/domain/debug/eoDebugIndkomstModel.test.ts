import { describe, expect, it } from 'vitest';
import {
  buildIndkomstSectionStatuses,
  buildOffentligeYdelserDebugRows,
} from '../../../domain/debug/eoDebugIndkomstModel';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/erstatningsopgoerelseInitialValues';
import type { AmountValue } from '../../../schemas/amountExpressionSchema';

const amount = (value: number): AmountValue => ({ kind: 'number', value });

const buildAnsForhold = () => {
  const values = createErstatningsopgoerelseInitialValues();
  return { ...values.loenindkomstAnsaettelsesforhold[0] };
};

describe('buildIndkomstSectionStatuses', () => {
  it('giver præcis warning når lønperiode er udfyldt uden beløb', () => {
    const af = buildAnsForhold();
    af.indtaegtsoplysningerTableData = [
      {
        id: 'row-1',
        col0_maaned: '1',
        col1_maaned: '2024',
      },
    ];

    const result = buildIndkomstSectionStatuses([af], undefined, 'Beregningsperiode');

    expect(result[0]?.tableStatus).toBe('warning');
    expect(result[0]?.tableMessage).toBe('Lønperiode er udfyldt uden beløb i lønfelterne');
  });

  it('markerer ikke manglende beløb når lønfelt er udfyldt med 0', () => {
    const af = buildAnsForhold();
    af.indtaegtsoplysningerTableData = [
      {
        id: 'row-1',
        col0_maaned: '1',
        col1_maaned: '2024',
        col2: amount(0),
      },
    ];

    const result = buildIndkomstSectionStatuses([af], undefined, 'Beregningsperiode');

    expect(result[0]?.tableStatus).toBe('ok');
    expect(result[0]?.tableMessage).toBe('Ok');
  });

  it('giver præcis fejltekst ved manglende periodefelt', () => {
    const af = buildAnsForhold();
    af.indtaegtsoplysningerTableData = [
      {
        id: 'row-1',
        col0_maaned: '1',
        col2: amount(100),
      },
    ];

    const result = buildIndkomstSectionStatuses([af], undefined, 'Beregningsperiode');

    expect(result[0]?.tableStatus).toBe('error');
    expect(result[0]?.tableMessage).toBe('År mangler');
  });

  it('giver præcis fejltekst ved ugyldig periodeværdi', () => {
    const af = buildAnsForhold();
    af.indtaegtsoplysningerTableData = [
      {
        id: 'row-1',
        col0_maaned: '13',
        col1_maaned: '2024',
      },
    ];

    const result = buildIndkomstSectionStatuses([af], undefined, 'Beregningsperiode');

    expect(result[0]?.tableStatus).toBe('error');
    expect(result[0]?.tableMessage).toBe('Ugyldig værdi i Måned');
  });
});

describe('buildOffentligeYdelserDebugRows', () => {
  it('viser "Ok" ved korrekt udfyldt offentlig ydelse i stedet for beregnet sum', () => {
    const rows = [
      {
        id: 'row-1',
        fraDato: '01-01-2024',
        tilDato: '31-01-2024',
        ydelsestype: 'dagpenge',
        ydelse: amount(1200),
      },
    ];

    const result = buildOffentligeYdelserDebugRows(rows);

    expect(result[0]?.status).toBe('ok');
    expect(result[0]?.message).toBe('Ok');
  });

  it('giver fejlteksten "Dato mangler" når dato ikke er fuldt udfyldt', () => {
    const rows = [
      {
        id: 'row-1',
        fraDato: '',
        tilDato: '31-01-2024',
        ydelsestype: 'dagpenge',
        ydelse: amount(1200),
      },
    ];

    const result = buildOffentligeYdelserDebugRows(rows);

    expect(result[0]?.status).toBe('error');
    expect(result[0]?.message).toBe('Dato mangler');
    expect(result[0]?.summaryDisplay).toBe('messageOnly');
  });

  it('viser Uspecificeret og fejlteksten "Ydelsestype mangler" når ydelsestype mangler', () => {
    const rows = [
      {
        id: 'row-1',
        fraDato: '01-01-2024',
        tilDato: '31-01-2024',
        ydelsestype: '',
        ydelse: amount(1200),
      },
    ];

    const result = buildOffentligeYdelserDebugRows(rows);

    expect(result[0]?.status).toBe('error');
    expect(result[0]?.label).toBe('Uspecificeret');
    expect(result[0]?.message).toBe('Ydelsestype mangler');
    expect(result[0]?.summaryDisplay).toBe('messageOnly');
  });

  it('giver præcis fejltekst ved ugyldig beløbsværdi', () => {
    const rows = [
      {
        id: 'row-1',
        fraDato: '01-01-2024',
        tilDato: '31-01-2024',
        ydelsestype: 'dagpenge',
        ydelse: { kind: 'expression' as const, value: 100, expression: '' },
      },
    ];

    const result = buildOffentligeYdelserDebugRows(rows);

    expect(result[0]?.status).toBe('error');
    expect(result[0]?.message).toBe('Ugyldig værdi i Ydelse');
    expect(result[0]?.summaryDisplay).toBe('messageOnly');
  });

  it('giver warningteksten "Beløb mangler" ved periode uden beløb', () => {
    const rows = [
      {
        id: 'row-1',
        fraDato: '01-01-2024',
        tilDato: '31-01-2024',
        ydelsestype: 'dagpenge',
      },
    ];

    const result = buildOffentligeYdelserDebugRows(rows);

    expect(result[0]?.status).toBe('warning');
    expect(result[0]?.message).toBe('Beløb mangler');
    expect(result[0]?.summaryDisplay).toBe('messageOnly');
  });

  it('behandler 0 som gyldigt beløb', () => {
    const rows = [
      {
        id: 'row-1',
        fraDato: '01-01-2024',
        tilDato: '31-01-2024',
        ydelsestype: 'dagpenge',
        ydelse: amount(0),
      },
    ];

    const result = buildOffentligeYdelserDebugRows(rows);

    expect(result[0]?.status).toBe('ok');
    expect(result[0]?.message).toBe('Ok');
  });
});
