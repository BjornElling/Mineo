import { assertValidTableSpec, type TableSpec } from '../../../document/layout/tableSpec';

const validSpec = (): TableSpec => ({
  columns: [
    { width: { kind: 'flex' } },
    { width: { kind: 'fixed', mm: 30 }, align: 'right' },
  ],
  rows: [
    { kind: 'header', cells: [{ text: 'Navn' }, { text: 'Beløb' }] },
    { cells: [{ text: 'Post' }, { text: '1.000 kr.' }] },
  ],
  hasHeaderRow: true,
});

describe('assertValidTableSpec', () => {
  it('accepterer en komplet semantisk tabel', () => {
    expect(() => assertValidTableSpec(validSpec())).not.toThrow();
  });

  it('afviser tomme tabeller og rækker med forkert kolonnefylde', () => {
    expect(() => assertValidTableSpec({
      columns: [{ width: { kind: 'flex' } }],
      rows: [],
      hasHeaderRow: false,
    })).toThrow(/tomme rækker/i);

    expect(() => assertValidTableSpec({
      ...validSpec(),
      rows: [{ cells: [{ text: 'Mangler værdicelle' }] }],
    })).toThrow(/fylder 1 kolonner, men tabellen har 2/i);
  });

  it('afviser ugyldige fysiske mål og colSpan', () => {
    expect(() => assertValidTableSpec({
      ...validSpec(),
      columns: [
        { width: { kind: 'fixed', mm: 0 } },
        { width: { kind: 'flex' } },
      ],
    })).toThrow(/positivt, endeligt tal/i);

    expect(() => assertValidTableSpec({
      ...validSpec(),
      rows: [{ cells: [{ text: 'Ugyldig', colSpan: 0 }, { text: 'Værdi' }] }],
    })).toThrow(/ugyldigt colSpan/i);
  });
});
