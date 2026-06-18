/// <reference types="vitest/globals" />

import { PDF_CONTENT_WIDTH_MM, TABLE_STYLES } from '../../../document/layout/pdfConfig';
import {
  createDocumentDistributedColumnStyles,
  createDocumentTableCell,
  createDocumentTableFormattedTotalRow,
  createDocumentTableSummedTotalRow,
} from '../../../document/layout/documentTableRenderer';

type PdfTableTestCell = { content?: string; colSpan?: number; styles?: { cellPadding?: number } };

describe('createDocumentDistributedColumnStyles', () => {
  it('fordeler fuld tabelbredde ligeligt når ingen kolonner er låst', () => {
    const styles = createDocumentDistributedColumnStyles(5);

    expect(Object.keys(styles)).toHaveLength(5);
    expect(styles[0]?.cellWidth).toBeCloseTo(PDF_CONTENT_WIDTH_MM / 5, 6);
    expect(styles[4]?.cellWidth).toBeCloseTo(PDF_CONTENT_WIDTH_MM / 5, 6);
  });

  it('fordeler restbredden mellem ulåste kolonner når enkelte kolonner er låst', () => {
    const styles = createDocumentDistributedColumnStyles(4, {
      fixedColumns: {
        1: 25,
        3: { cellWidth: 35, halign: 'right' },
      },
    });

    const expectedAutoWidth = (PDF_CONTENT_WIDTH_MM - 25 - 35) / 2;

    expect(styles[0]?.cellWidth).toBeCloseTo(expectedAutoWidth, 6);
    expect(styles[2]?.cellWidth).toBeCloseTo(expectedAutoWidth, 6);
    expect(styles[1]?.cellWidth).toBe(25);
    expect(styles[3]?.cellWidth).toBe(35);
    expect(styles[3]?.halign).toBe('right');
  });

  it('afviser manuelle bredder der overstiger den samlede tabelbredde', () => {
    expect(() =>
      createDocumentDistributedColumnStyles(3, {
        fixedColumns: {
          0: 100,
          1: 80,
        },
      })
    ).toThrow(/overstiger eller udfylder hele tabelbredden/i);
  });

  it('afviser når alle kolonner er låst uden at udfylde den samlede bredde præcist', () => {
    expect(() =>
      createDocumentDistributedColumnStyles(3, {
        fixedColumns: {
          0: 40,
          1: 40,
          2: 40,
        },
      })
    ).toThrow(/skal udfylde hele tabelbredden/i);
  });
});

describe('createDocumentTableSummedTotalRow', () => {
  it('udvider totalbeløbet mod venstre for at give maksimal plads', () => {
    const result = createDocumentTableSummedTotalRow('I alt', [10, 20], {
      columnCount: 4,
      valueColumnIndex: 3,
      formatValue: (total) => `${total} kr.`,
      valueHasKrSuffix: true,
    });

    expect(result).not.toBeNull();
    expect(result?.valueCellColumnIndex).toBe(1);
    expect(result?.valueCellColSpan).toBe(3);

    const row = result?.row as PdfTableTestCell[];
    expect(row).toHaveLength(2);
    expect(row[0]?.content).toBe('I alt');
    expect(row[1]?.content).toBe('30 kr.');
    expect(row[1]?.colSpan).toBe(3);
    expect(row[1]?.styles?.cellPadding).toBe(TABLE_STYLES.cellPadding);
  });

  it('bevarer 2-kolonne-tabeller uden at forsøge ekstra sammenfletning', () => {
    const result = createDocumentTableSummedTotalRow('I alt', [1, 2], {
      columnCount: 2,
      valueColumnIndex: 1,
      formatValue: (total) => String(total),
    });

    expect(result).not.toBeNull();
    expect(result?.valueCellColumnIndex).toBe(1);
    expect(result?.valueCellColSpan).toBe(1);

    const row = result?.row as PdfTableTestCell[];
    expect(row).toHaveLength(2);
    expect(row[1]?.colSpan).toBe(1);
  });

  it('kan fastholde totalværdien i den angivne værdikolonne', () => {
    const result = createDocumentTableSummedTotalRow('I alt', [1, 2], {
      columnCount: 4,
      valueColumnIndex: 3,
      formatValue: (total) => String(total),
      preserveValueColumn: true,
    });

    expect(result).not.toBeNull();
    expect(result?.valueCellColumnIndex).toBe(3);
    expect(result?.valueCellColSpan).toBe(1);

    const row = result?.row as PdfTableTestCell[];
    expect(row).toHaveLength(4);
    expect(row[0]?.content).toBe('I alt');
    expect(row[1]?.content).toBe('');
    expect(row[2]?.content).toBe('');
    expect(row[3]?.content).toBe('3');
    expect(row[3]?.colSpan).toBe(1);
    expect(row[3]?.styles?.cellPadding).toBe(TABLE_STYLES.cellPadding);
  });

  it('bevarer kr.-suffix når den summerede kolonne viser kr.', () => {
    const result = createDocumentTableSummedTotalRow('I alt', [10, 20], {
      columnCount: 4,
      valueColumnIndex: 3,
      formatValue: (total) => `${total} kr.`,
      valueHasKrSuffix: true,
    });

    expect(result?.formattedValue).toBe('30 kr.');
  });

  it('fjerner kr.-suffix når den summerede kolonne ikke viser kr.', () => {
    const result = createDocumentTableSummedTotalRow('I alt', [10, 20], {
      columnCount: 4,
      valueColumnIndex: 3,
      formatValue: (total) => `${total} kr.`,
      valueHasKrSuffix: false,
    });

    expect(result?.formattedValue).toBe('30');
  });

  it('bevarer ikke-brydende mellemrum for ikke-højrejusteret totalværdi med kr.-suffix', () => {
    const result = createDocumentTableSummedTotalRow('I alt', [10, 20], {
      columnCount: 4,
      valueColumnIndex: 3,
      formatValue: (total) => `${total} kr.`,
      valueHasKrSuffix: true,
      valueAlign: 'center',
    });

    expect(result?.formattedValue).toBe('30\u00A0kr.');
  });
});

describe('buildPdfTotalRow (via createDocumentTableFormattedTotalRow) — invariant-guards', () => {
  // De fem fail-closed guards i buildPdfTotalRow må aldrig producere en stille
  // forkert total-række i et tillidskritisk dokument; de skal kaste.

  it('afviser ugyldigt kolonneantal (<= 1 eller ikke-heltal)', () => {
    expect(() =>
      createDocumentTableFormattedTotalRow('I alt', '30', { columnCount: 1, valueColumnIndex: 0 })
    ).toThrow(/Ugyldigt kolonneantal/i);

    expect(() =>
      createDocumentTableFormattedTotalRow('I alt', '30', { columnCount: 2.5, valueColumnIndex: 1 })
    ).toThrow(/Ugyldigt kolonneantal/i);
  });

  it('afviser label-kolonneindex uden for [0, columnCount)', () => {
    expect(() =>
      createDocumentTableFormattedTotalRow('I alt', '30', {
        columnCount: 4,
        valueColumnIndex: 3,
        labelColumnIndex: -1,
      })
    ).toThrow(/Ugyldigt label-kolonneindex/i);

    expect(() =>
      createDocumentTableFormattedTotalRow('I alt', '30', {
        columnCount: 4,
        valueColumnIndex: 3,
        labelColumnIndex: 4,
      })
    ).toThrow(/Ugyldigt label-kolonneindex/i);
  });

  it('afviser værdi-kolonneindex uden for [0, columnCount)', () => {
    expect(() =>
      createDocumentTableFormattedTotalRow('I alt', '30', { columnCount: 4, valueColumnIndex: 4 })
    ).toThrow(/Ugyldigt værdi-kolonneindex/i);

    expect(() =>
      createDocumentTableFormattedTotalRow('I alt', '30', { columnCount: 4, valueColumnIndex: -1 })
    ).toThrow(/Ugyldigt værdi-kolonneindex/i);
  });

  it('afviser ugyldigt værdi-colSpan (<= 0 eller ikke-heltal)', () => {
    expect(() =>
      createDocumentTableFormattedTotalRow('I alt', '30', {
        columnCount: 4,
        valueColumnIndex: 1,
        valueColSpan: 0,
      })
    ).toThrow(/Ugyldigt værdi-colSpan/i);
  });

  it('afviser når værdi-cellen rækker ud over tabellens kolonner', () => {
    expect(() =>
      createDocumentTableFormattedTotalRow('I alt', '30', {
        columnCount: 4,
        valueColumnIndex: 3,
        valueColSpan: 2,
      })
    ).toThrow(/rækker ud over tabellens kolonner/i);
  });

  it('afviser når label-kolonnen ikke ligger til venstre for værdi-kolonnen', () => {
    expect(() =>
      createDocumentTableFormattedTotalRow('I alt', '30', {
        columnCount: 4,
        valueColumnIndex: 1,
        labelColumnIndex: 1,
      })
    ).toThrow(/til venstre for værdi-kolonnen/i);

    expect(() =>
      createDocumentTableFormattedTotalRow('I alt', '30', {
        columnCount: 4,
        valueColumnIndex: 1,
        labelColumnIndex: 2,
      })
    ).toThrow(/til venstre for værdi-kolonnen/i);
  });
});

describe('createDocumentTableCell', () => {
  it('normaliserer højrejusteret kr.-tekst til almindeligt mellemrum', () => {
    const cell = createDocumentTableCell('123,45\u00A0kr.', { halign: 'right' });

    expect(cell.content).toBe('123,45 kr.');
  });

  it('bevarer ikke-brydende mellemrum i ikke-højrejusterede celler', () => {
    const cell = createDocumentTableCell('123,45\u00A0kr.', { halign: 'center' });

    expect(cell.content).toBe('123,45\u00A0kr.');
  });
});
