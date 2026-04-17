/// <reference types="vitest/globals" />

import { PDF_CONTENT_WIDTH_MM, TABLE_STYLES } from '../../../pdf/infrastructure/pdfConfig';
import { createPdfDistributedColumnStyles, createPdfTableCell, createPdfTableSummedTotalRow } from '../../../pdf/shared/pdfTableRenderer';

describe('createPdfDistributedColumnStyles', () => {
  it('fordeler fuld tabelbredde ligeligt når ingen kolonner er låst', () => {
    const styles = createPdfDistributedColumnStyles(5);

    expect(Object.keys(styles)).toHaveLength(5);
    expect(styles[0]?.cellWidth).toBeCloseTo(PDF_CONTENT_WIDTH_MM / 5, 6);
    expect(styles[4]?.cellWidth).toBeCloseTo(PDF_CONTENT_WIDTH_MM / 5, 6);
  });

  it('fordeler restbredden mellem ulåste kolonner når enkelte kolonner er låst', () => {
    const styles = createPdfDistributedColumnStyles(4, {
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
      createPdfDistributedColumnStyles(3, {
        fixedColumns: {
          0: 100,
          1: 80,
        },
      })
    ).toThrow(/overstiger eller udfylder hele tabelbredden/i);
  });

  it('afviser når alle kolonner er låst uden at udfylde den samlede bredde præcist', () => {
    expect(() =>
      createPdfDistributedColumnStyles(3, {
        fixedColumns: {
          0: 40,
          1: 40,
          2: 40,
        },
      })
    ).toThrow(/skal udfylde hele tabelbredden/i);
  });
});

describe('createPdfTableSummedTotalRow', () => {
  it('udvider totalbeløbet mod venstre for at give maksimal plads', () => {
    const result = createPdfTableSummedTotalRow('I alt', [10, 20], {
      columnCount: 4,
      valueColumnIndex: 3,
      formatValue: (total) => `${total} kr.`,
      valueHasKrSuffix: true,
    });

    expect(result).not.toBeNull();
    expect(result?.valueCellColumnIndex).toBe(1);
    expect(result?.valueCellColSpan).toBe(3);

    const row = result?.row as Array<{ content?: string; colSpan?: number }>;
    expect(row).toHaveLength(2);
    expect(row[0]?.content).toBe('I alt');
    expect(row[1]?.content).toBe('30 kr.');
    expect(row[1]?.colSpan).toBe(3);
    expect(row[1]?.styles?.cellPadding).toBe(TABLE_STYLES.cellPadding);
  });

  it('bevarer 2-kolonne-tabeller uden at forsøge ekstra sammenfletning', () => {
    const result = createPdfTableSummedTotalRow('I alt', [1, 2], {
      columnCount: 2,
      valueColumnIndex: 1,
      formatValue: (total) => String(total),
    });

    expect(result).not.toBeNull();
    expect(result?.valueCellColumnIndex).toBe(1);
    expect(result?.valueCellColSpan).toBe(1);

    const row = result?.row as Array<{ content?: string; colSpan?: number }>;
    expect(row).toHaveLength(2);
    expect(row[1]?.colSpan).toBe(1);
  });

  it('kan fastholde totalværdien i den angivne værdikolonne', () => {
    const result = createPdfTableSummedTotalRow('I alt', [1, 2], {
      columnCount: 4,
      valueColumnIndex: 3,
      formatValue: (total) => String(total),
      preserveValueColumn: true,
    });

    expect(result).not.toBeNull();
    expect(result?.valueCellColumnIndex).toBe(3);
    expect(result?.valueCellColSpan).toBe(1);

    const row = result?.row as Array<{ content?: string; colSpan?: number }>;
    expect(row).toHaveLength(4);
    expect(row[0]?.content).toBe('I alt');
    expect(row[1]?.content).toBe('');
    expect(row[2]?.content).toBe('');
    expect(row[3]?.content).toBe('3');
    expect(row[3]?.colSpan).toBe(1);
    expect(row[3]?.styles?.cellPadding).toBe(TABLE_STYLES.cellPadding);
  });

  it('bevarer kr.-suffix når den summerede kolonne viser kr.', () => {
    const result = createPdfTableSummedTotalRow('I alt', [10, 20], {
      columnCount: 4,
      valueColumnIndex: 3,
      formatValue: (total) => `${total} kr.`,
      valueHasKrSuffix: true,
    });

    expect(result?.formattedValue).toBe('30 kr.');
  });

  it('fjerner kr.-suffix når den summerede kolonne ikke viser kr.', () => {
    const result = createPdfTableSummedTotalRow('I alt', [10, 20], {
      columnCount: 4,
      valueColumnIndex: 3,
      formatValue: (total) => `${total} kr.`,
      valueHasKrSuffix: false,
    });

    expect(result?.formattedValue).toBe('30');
  });

  it('bevarer ikke-brydende mellemrum for ikke-højrejusteret totalværdi med kr.-suffix', () => {
    const result = createPdfTableSummedTotalRow('I alt', [10, 20], {
      columnCount: 4,
      valueColumnIndex: 3,
      formatValue: (total) => `${total} kr.`,
      valueHasKrSuffix: true,
      valueAlign: 'center',
    });

    expect(result?.formattedValue).toBe('30\u00A0kr.');
  });
});

describe('createPdfTableCell', () => {
  it('normaliserer højrejusteret kr.-tekst til almindeligt mellemrum', () => {
    const cell = createPdfTableCell('123,45\u00A0kr.', { halign: 'right' });

    expect(cell.content).toBe('123,45 kr.');
  });

  it('bevarer ikke-brydende mellemrum i ikke-højrejusterede celler', () => {
    const cell = createPdfTableCell('123,45\u00A0kr.', { halign: 'center' });

    expect(cell.content).toBe('123,45\u00A0kr.');
  });
});
