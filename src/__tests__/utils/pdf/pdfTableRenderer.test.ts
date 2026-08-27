// @vitest-environment jsdom
/// <reference types="vitest/globals" />

import { PDF_CONTENT_WIDTH_MM } from '../../../document/layout/pdfConfig';
import {
  createDocumentDistributedColumnStyles,
  createDocumentTableCell,
} from '../../../pdf/infrastructure/pdfDocumentTableRenderer';
import {
  buildFormattedTotalRowSpec,
  buildSummedTotalRowSpec,
} from '../../../document/layout/tableSpec';
import { round2 } from '../../../utils/roundingShortcuts';

const preserveDisplayedValue = (value: number): number => value;

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

describe('buildSummedTotalRowSpec', () => {
  it('udvider totalbeløbet mod venstre for at give maksimal plads', () => {
    const result = buildSummedTotalRowSpec('I alt', [10, 20], {
      columnCount: 4,
      valueColumnIndex: 3,
      formatValue: (total) => `${total} kr.`,
      roundDisplayedValue: preserveDisplayedValue,
      valueHasKrSuffix: true,
    });

    expect(result).toMatchObject({
      kind: 'total',
      cells: [
        { text: 'I alt', align: 'left', bold: true },
        { text: '30\u00A0kr.', align: 'right', bold: true, colSpan: 3, separatorAbove: true },
      ],
    });
  });

  it('bevarer 2-kolonne-tabeller uden at forsøge ekstra sammenfletning', () => {
    const result = buildSummedTotalRowSpec('I alt', [1, 2], {
      columnCount: 2,
      valueColumnIndex: 1,
      formatValue: (total) => String(total),
      roundDisplayedValue: preserveDisplayedValue,
    });

    expect(result?.cells).toHaveLength(2);
    expect(result?.cells[1]).toMatchObject({ text: '3', colSpan: 1, separatorAbove: true });
  });

  it('kan fastholde totalværdien i den angivne værdikolonne', () => {
    const result = buildSummedTotalRowSpec('I alt', [1, 2], {
      columnCount: 4,
      valueColumnIndex: 3,
      formatValue: (total) => String(total),
      roundDisplayedValue: preserveDisplayedValue,
      preserveValueColumn: true,
    });

    expect(result?.cells).toEqual([
      { text: 'I alt', align: 'left', bold: true },
      { text: '' },
      { text: '' },
      { text: '3', align: 'right', bold: true, colSpan: 1, separatorAbove: true },
    ]);
  });

  it('bevarer kr.-suffix når den summerede kolonne viser kr.', () => {
    const result = buildSummedTotalRowSpec('I alt', [10, 20], {
      columnCount: 4,
      valueColumnIndex: 3,
      formatValue: (total) => `${total} kr.`,
      roundDisplayedValue: preserveDisplayedValue,
      valueHasKrSuffix: true,
    });

    expect(result?.cells[1]?.text).toBe('30\u00A0kr.');
  });

  it('fjerner kr.-suffix når den summerede kolonne ikke viser kr.', () => {
    const result = buildSummedTotalRowSpec('I alt', [10, 20], {
      columnCount: 4,
      valueColumnIndex: 3,
      formatValue: (total) => `${total} kr.`,
      roundDisplayedValue: preserveDisplayedValue,
      valueHasKrSuffix: false,
    });

    expect(result?.cells[1]?.text).toBe('30');
  });

  it('bevarer ikke-brydende mellemrum for ikke-højrejusteret totalværdi med kr.-suffix', () => {
    const result = buildSummedTotalRowSpec('I alt', [10, 20], {
      columnCount: 4,
      valueColumnIndex: 3,
      formatValue: (total) => `${total} kr.`,
      roundDisplayedValue: preserveDisplayedValue,
      valueHasKrSuffix: true,
      valueAlign: 'center',
    });

    expect(result?.cells[1]?.text).toBe('30\u00A0kr.');
  });

  it('summerer de afrundede dataceller frem for at afrunde råsummen', () => {
    const result = buildSummedTotalRowSpec('I alt', [1.494, 2.494], {
      columnCount: 2,
      valueColumnIndex: 1,
      formatValue: (total) => total.toFixed(2),
      roundDisplayedValue: round2,
    });

    // 1,49 + 2,49 = 3,98, mens round2(1,494 + 2,494) fejlagtigt ville være 3,99.
    expect(result?.cells[1]?.text).toBe('3.98');
  });

  it('udelader totalrækken når der ikke er mindst to værdier', () => {
    expect(buildSummedTotalRowSpec('I alt', [10], {
      columnCount: 2,
      valueColumnIndex: 1,
      formatValue: String,
      roundDisplayedValue: preserveDisplayedValue,
    })).toBeNull();
  });
});

describe('buildFormattedTotalRowSpec – invariant-guards', () => {
  // De fail-closed guards må aldrig producere en stille
  // forkert total-række i et tillidskritisk dokument; de skal kaste.

  it('afviser ugyldigt kolonneantal (<= 1 eller ikke-heltal)', () => {
    expect(() =>
      buildFormattedTotalRowSpec('I alt', '30', { columnCount: 1, valueColumnIndex: 0 })
    ).toThrow(/Ugyldigt kolonneantal/i);

    expect(() =>
      buildFormattedTotalRowSpec('I alt', '30', { columnCount: 2.5, valueColumnIndex: 1 })
    ).toThrow(/Ugyldigt kolonneantal/i);
  });

  it('afviser label-kolonneindex uden for [0, columnCount)', () => {
    expect(() =>
      buildFormattedTotalRowSpec('I alt', '30', {
        columnCount: 4,
        valueColumnIndex: 3,
        labelColumnIndex: -1,
      })
    ).toThrow(/Ugyldigt label-kolonneindex/i);

    expect(() =>
      buildFormattedTotalRowSpec('I alt', '30', {
        columnCount: 4,
        valueColumnIndex: 3,
        labelColumnIndex: 4,
      })
    ).toThrow(/Ugyldigt label-kolonneindex/i);
  });

  it('afviser værdi-kolonneindex uden for [0, columnCount)', () => {
    expect(() =>
      buildFormattedTotalRowSpec('I alt', '30', { columnCount: 4, valueColumnIndex: 4 })
    ).toThrow(/Ugyldigt værdi-kolonneindex/i);

    expect(() =>
      buildFormattedTotalRowSpec('I alt', '30', { columnCount: 4, valueColumnIndex: -1 })
    ).toThrow(/Ugyldigt værdi-kolonneindex/i);
  });

  it('afviser ugyldigt værdi-colSpan (<= 0 eller ikke-heltal)', () => {
    expect(() =>
      buildFormattedTotalRowSpec('I alt', '30', {
        columnCount: 4,
        valueColumnIndex: 1,
        valueColSpan: 0,
      })
    ).toThrow(/Ugyldigt værdi-colSpan/i);
  });

  it('afviser når værdi-cellen rækker ud over tabellens kolonner', () => {
    expect(() =>
      buildFormattedTotalRowSpec('I alt', '30', {
        columnCount: 4,
        valueColumnIndex: 3,
        valueColSpan: 2,
      })
    ).toThrow(/rækker ud over tabellens kolonner/i);
  });

  it('afviser når label-kolonnen ikke ligger til venstre for værdi-kolonnen', () => {
    expect(() =>
      buildFormattedTotalRowSpec('I alt', '30', {
        columnCount: 4,
        valueColumnIndex: 1,
        labelColumnIndex: 1,
      })
    ).toThrow(/til venstre for værdi-kolonnen/i);

    expect(() =>
      buildFormattedTotalRowSpec('I alt', '30', {
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
