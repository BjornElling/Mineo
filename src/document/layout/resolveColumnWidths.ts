/**
 * Ren kolonnebredde-fordeling for dokument-tabeller (#15 TableSpec-udredning).
 *
 * Udtrukket fra PDF-rendereren som en ren, unit-testbar funktion uden
 * jsPDF-runtime-afhængighed: tekstmåling injiceres som `ColumnTextMeasurer` (PDF-kanalen
 * wrapper jsPDF's `getTextWidth`; en degraderet jsPDF sender `null` → statisk fordeling).
 * Semantikken er bevaret 1:1 fra den tidligere `resolveAdaptiveDistributedColumnStyles`
 * + `resolveGrowColumnStyles` + omfordelings-hjælperen – bevist byte-identisk af
 * `pdfTableRenderer.layout.test.ts` og tabel-kanal-paritet-golden-nettet.
 *
 * Kolonne-intentionen (fixed/flex/grow) bæres af `PDF_COLUMN_LAYOUT_META`, som
 * kolonnestil-builderne i `pdfDocumentTableRenderer.ts` hæfter på styles-objektet.
 */

import { TABLE_STYLES } from './pdfConfig';
import { DOCUMENT_TABLE_FONT_SIZE_PT } from './tableSpec';

export type PdfCellAlign = 'left' | 'center' | 'right';

export type PdfColumnStyle = Readonly<{ cellWidth: number | 'auto'; halign?: PdfCellAlign }>;

export type PdfDistributedColumnLayoutMeta = Readonly<{
  tableWidth: number;
  fixedColumnIndices: readonly number[];
  distributedColumnIndices: readonly number[];
  // Valgfri "grow-column"-tilstand: én kolonne (typisk en formel-/tekstkolonne med
  // meget varierende indhold) skal fylde så meget plads, den kan få, mens de øvrige
  // kolonner kun garanteres deres indholdsbestemte min-bredde. Er der plads til overs
  // (grow-kolonnens indhold er kortere end den ledige plads), fordeles overskuddet
  // ligeligt mellem ALLE kolonner. Uden dette felt bruges standard-surplus-overførslen.
  growColumnIndex?: number;
}>;

export const PDF_COLUMN_LAYOUT_META = Symbol('pdfColumnLayoutMeta');

// IMPORTANT:
// Symbol-metadataen er bevidst knyttet direkte til det returnerede styles-objekt.
// Hvis en call-site kopierer `columnStyles` via spread/Object.assign/JSON, tabes
// metadataen og den adaptive omfordeling deaktiveres lydløst. Det er et fail-closed
// valg: tabellen falder tilbage til den statiske fordelingsbredde frem for at gætte.
export type PdfColumnStylesWithMeta = Record<number, PdfColumnStyle> & Readonly<{
  [PDF_COLUMN_LAYOUT_META]?: PdfDistributedColumnLayoutMeta;
}>;

export type PdfColumnStyleMap = Record<number, PdfColumnStyle>;

// Injiceret tekstmåling: returnerer bredden i mm af `text` med den givne skrifttype.
// PDF-kanalen wrapper jsPDF; `null` ved en degraderet jsPDF → ingen måling.
export type ColumnTextMeasurer = (
  text: string,
  options: Readonly<{ fontSize: number; fontStyle: 'normal' | 'bold'; halign?: PdfCellAlign }>
) => number;

type CellStyles = Readonly<{
  halign?: PdfCellAlign;
  fontStyle?: string;
  fontSize?: number;
  cellPadding?: number | readonly number[] | Readonly<{ left?: number; right?: number }>;
}>;

// Generisk celle-padding for alle Mineo-tabeller. Samme kilde som renderer-laget
// (pdfConfig) – indgår i min-bredde-estimatet, så den SKAL matche renderingen 1:1.
const TABLE_CELL_PADDING = TABLE_STYLES.cellPadding;
const TABLE_FONT_SIZE = DOCUMENT_TABLE_FONT_SIZE_PT;
const PDF_TEXT_MEASUREMENT_BUFFER_MM = 0.8;
const PDF_WIDTH_EPSILON = 1e-4;

export const attachPdfColumnLayoutMeta = (
  styles: PdfColumnStyleMap,
  meta: PdfDistributedColumnLayoutMeta
): PdfColumnStyleMap => {
  Object.defineProperty(styles, PDF_COLUMN_LAYOUT_META, {
    value: meta,
    enumerable: false,
    configurable: false,
    writable: false,
  });
  return styles;
};

export const resolvePdfColumnLayoutMeta = (
  columnStyles?: PdfColumnStyleMap
): PdfDistributedColumnLayoutMeta | null => {
  const maybeWithMeta = columnStyles as PdfColumnStylesWithMeta | undefined;
  return maybeWithMeta?.[PDF_COLUMN_LAYOUT_META] ?? null;
};

const isPdfTableCell = (value: unknown): value is Readonly<{ content: unknown; colSpan?: unknown; styles?: unknown }> => {
  return typeof value === 'object' && value !== null && 'content' in value;
};

const resolvePdfCellTextContent = (cell: unknown): string => {
  if (isPdfTableCell(cell)) {
    return typeof cell.content === 'string' ? cell.content : String(cell.content ?? '');
  }
  return typeof cell === 'string' ? cell : String(cell ?? '');
};

const resolvePdfCellColSpan = (cell: unknown): number => {
  if (!isPdfTableCell(cell)) return 1;
  return typeof cell.colSpan === 'number' && Number.isInteger(cell.colSpan) && cell.colSpan > 1 ? cell.colSpan : 1;
};

const resolvePdfCellStyles = (cell: unknown): CellStyles | undefined => {
  return isPdfTableCell(cell) ? (cell.styles as CellStyles | undefined) : undefined;
};

const resolveHorizontalCellPadding = (styles?: CellStyles): number => {
  const padding = styles?.cellPadding;
  if (typeof padding === 'number' && Number.isFinite(padding)) {
    return padding * 2;
  }

  if (Array.isArray(padding)) {
    const right = typeof padding[1] === 'number' && Number.isFinite(padding[1]) ? padding[1] : 0;
    const left = typeof padding[3] === 'number' && Number.isFinite(padding[3]) ? padding[3] : right;
    return left + right;
  }

  if (padding && typeof padding === 'object') {
    const record = padding as Readonly<{ left?: number; right?: number }>;
    const left = typeof record.left === 'number' && Number.isFinite(record.left) ? record.left : 0;
    const right = typeof record.right === 'number' && Number.isFinite(record.right) ? record.right : 0;
    return left + right;
  }

  return TABLE_CELL_PADDING * 2;
};

const resolvePdfColumnRedistributionTargetIndex = (
  distributedColumnIndices: readonly number[],
  nextStyles: PdfColumnStyleMap,
  requiredWidths: ReadonlyMap<number, number>,
  residualWidth: number
): number | null => {
  if (distributedColumnIndices.length === 0) return null;

  if (residualWidth >= 0) {
    return distributedColumnIndices.reduce<number | null>((selectedIndex, index) => {
      const currentWidth = Number(nextStyles[index]?.cellWidth ?? -Infinity);
      const requiredWidth = requiredWidths.get(index) ?? 0;
      const slack = currentWidth - requiredWidth;

      if (selectedIndex === null) {
        return index;
      }

      const selectedWidth = Number(nextStyles[selectedIndex]?.cellWidth ?? -Infinity);
      const selectedRequired = requiredWidths.get(selectedIndex) ?? 0;
      const selectedSlack = selectedWidth - selectedRequired;
      return slack > selectedSlack ? index : selectedIndex;
    }, null);
  }

  return distributedColumnIndices.reduce<number | null>((selectedIndex, index) => {
    const currentWidth = Number(nextStyles[index]?.cellWidth ?? 0);
    const requiredWidth = requiredWidths.get(index) ?? 0;
    const slack = currentWidth - requiredWidth;

    if (slack + residualWidth < -PDF_WIDTH_EPSILON) {
      return selectedIndex;
    }

    if (selectedIndex === null) {
      return index;
    }

    const selectedWidth = Number(nextStyles[selectedIndex]?.cellWidth ?? 0);
    const selectedRequired = requiredWidths.get(selectedIndex) ?? 0;
    const selectedSlack = selectedWidth - selectedRequired;
    return slack > selectedSlack ? index : selectedIndex;
  }, null);
};

// Grow-column-fordeling: giv de øvrige kolonner deres indholdsbestemte min-bredde og
// lad grow-kolonnen fylde resten. Har grow-kolonnen ikke brug for al den ledige plads,
// fordeles overskuddet ligeligt mellem alle kolonner. Bevarer eventuelle halign-styles
// og tabellens samlede bredde. Falder fail-closed tilbage til de originale styles, hvis
// de øvrige kolonners min-bredder alene overstiger tabelbredden (grow-kolonnen ville da
// få ≤ 0 mm – vi gætter hellere ikke en fordeling end at rendere en umulig tabel).
const resolveGrowColumnStyles = (
  columnStyles: PdfColumnStyleMap,
  layoutMeta: PdfDistributedColumnLayoutMeta,
  growColumnIndex: number,
  requiredWidths: ReadonlyMap<number, number>
): PdfColumnStyleMap => {
  const indices = layoutMeta.distributedColumnIndices;
  if (!indices.includes(growColumnIndex)) {
    return columnStyles;
  }

  const otherIndices = indices.filter((index) => index !== growColumnIndex);
  const othersRequiredTotal = otherIndices.reduce((sum, index) => sum + (requiredWidths.get(index) ?? 0), 0);
  const remainingForGrow = layoutMeta.tableWidth - othersRequiredTotal;
  if (remainingForGrow <= PDF_WIDTH_EPSILON) {
    // De øvrige kolonners indhold fylder alene hele tabelbredden – ingen meningsfuld
    // plads at give grow-kolonnen. Behold de statiske styles.
    return columnStyles;
  }

  const growRequired = requiredWidths.get(growColumnIndex) ?? 0;
  const resolvedWidths = new Map<number, number>();
  if (growRequired <= remainingForGrow) {
    // Grow-kolonnen har plads til alt sit indhold. Fordel resten ligeligt mellem alle.
    const share = (remainingForGrow - growRequired) / indices.length;
    for (const index of otherIndices) {
      resolvedWidths.set(index, (requiredWidths.get(index) ?? 0) + share);
    }
    resolvedWidths.set(growColumnIndex, growRequired + share);
  } else {
    // Grow-kolonnens indhold er bredere end den ledige plads – den får al resten og
    // ombryder inde i kolonnen; de øvrige holdes på deres min-bredde.
    for (const index of otherIndices) {
      resolvedWidths.set(index, requiredWidths.get(index) ?? 0);
    }
    resolvedWidths.set(growColumnIndex, remainingForGrow);
  }

  const nextStyles: PdfColumnStyleMap = {};
  for (const [rawIndex, style] of Object.entries(columnStyles)) {
    const index = Number(rawIndex);
    nextStyles[index] = {
      cellWidth: resolvedWidths.get(index) ?? (typeof style?.cellWidth === 'number' ? style.cellWidth : 0),
      ...(style?.halign ? { halign: style.halign } : {}),
    };
  }

  return attachPdfColumnLayoutMeta(nextStyles, layoutMeta);
};

/**
 * Fordeler kolonnebredder adaptivt ud fra det målte indhold.
 *
 * Kræver at `columnStyles` bærer `PDF_COLUMN_LAYOUT_META` (ellers returneres input
 * uændret) og at `measure` ikke er `null` (degraderet jsPDF → statisk fordeling).
 * Fail-closed: enhver situation hvor en meningsfuld omfordeling ikke kan garanteres
 * (deficit > surplus, residual ville presse en kolonne under dens krav, …) returnerer
 * de originale, umodificerede styles.
 */
export const resolveColumnWidths = (
  measure: ColumnTextMeasurer | null,
  body: readonly unknown[],
  columnStyles: PdfColumnStyleMap | undefined,
  hasHeaderRow: boolean
): PdfColumnStyleMap | undefined => {
  const layoutMeta = resolvePdfColumnLayoutMeta(columnStyles);
  if (!layoutMeta || !columnStyles) {
    return columnStyles;
  }
  if (!measure) {
    return columnStyles;
  }

  const currentWidths = new Map<number, number>();
  for (const [rawIndex, style] of Object.entries(columnStyles)) {
    const index = Number(rawIndex);
    if (!Number.isInteger(index)) continue;
    if (typeof style?.cellWidth !== 'number' || !Number.isFinite(style.cellWidth) || style.cellWidth <= 0) {
      return columnStyles;
    }
    currentWidths.set(index, style.cellWidth);
  }

  if (currentWidths.size === 0 || layoutMeta.distributedColumnIndices.length === 0) {
    return columnStyles;
  }

  const requiredWidths = new Map<number, number>();
  for (const index of currentWidths.keys()) {
    requiredWidths.set(index, 0);
  }

  for (const [rowIndex, row] of body.entries()) {
    if (!Array.isArray(row)) continue;

    let columnIndex = 0;
    const isHeaderRow = hasHeaderRow && rowIndex === 0;

    for (const cell of row) {
      const colSpan = resolvePdfCellColSpan(cell);
      // ColSpan-celler driver ikke minimumsbreddeestimatet.
      // Det er en bevidst invariant: headers i de kendte standardtabeller er 1:1
      // med kolonner, mens body-colSpan typisk bruges til totaler og må ikke tvinge
      // ekstra bredde på tværs af flere kolonner.
      if (colSpan === 1) {
        const styles = resolvePdfCellStyles(cell);
        const fontStyle = styles?.fontStyle === 'bold' || isHeaderRow ? 'bold' : 'normal';
        const fontSize = typeof styles?.fontSize === 'number' ? styles.fontSize : TABLE_FONT_SIZE;
        const halign = styles?.halign;
        const requiredWidth =
          measure(resolvePdfCellTextContent(cell), { fontSize, fontStyle, halign }) +
          resolveHorizontalCellPadding(styles) +
          PDF_TEXT_MEASUREMENT_BUFFER_MM;

        const previous = requiredWidths.get(columnIndex) ?? 0;
        if (requiredWidth > previous) {
          requiredWidths.set(columnIndex, requiredWidth);
        }
      }

      columnIndex += colSpan;
    }
  }

  // Grow-column-tilstand (jf. PdfDistributedColumnLayoutMeta.growColumnIndex):
  // de øvrige kolonner får deres indholdsbestemte min-bredde, grow-kolonnen får al
  // den resterende plads. Er grow-kolonnens indhold smallere end den ledige plads,
  // fordeles overskuddet ligeligt mellem alle kolonner. Beregnet separat fra
  // surplus-overførslen nedenfor, fordi intentionen er en anden: her prioriteres én
  // kolonne bevidst, i stedet for at balancere alle distribuerede kolonner ligeligt.
  if (typeof layoutMeta.growColumnIndex === 'number') {
    return resolveGrowColumnStyles(columnStyles, layoutMeta, layoutMeta.growColumnIndex, requiredWidths);
  }

  const deficits = layoutMeta.distributedColumnIndices
    .map((index) => {
      const current = currentWidths.get(index) ?? 0;
      const required = requiredWidths.get(index) ?? 0;
      return { index, current, required, delta: required - current };
    })
    .filter((entry) => entry.delta > PDF_WIDTH_EPSILON);

  if (deficits.length === 0) {
    return columnStyles;
  }

  const donors = layoutMeta.distributedColumnIndices
    .map((index) => {
      const current = currentWidths.get(index) ?? 0;
      const required = requiredWidths.get(index) ?? 0;
      return { index, current, required, surplus: current - required };
    })
    .filter((entry) => entry.surplus > PDF_WIDTH_EPSILON);

  const totalDeficit = deficits.reduce((sum, entry) => sum + entry.delta, 0);
  const totalSurplus = donors.reduce((sum, entry) => sum + entry.surplus, 0);
  if (totalDeficit > totalSurplus + PDF_WIDTH_EPSILON) {
    return columnStyles;
  }

  const nextStyles: PdfColumnStyleMap = {};
  for (const [rawIndex, style] of Object.entries(columnStyles)) {
    const index = Number(rawIndex);
    nextStyles[index] = {
      cellWidth: currentWidths.get(index) ?? 0,
      ...(style?.halign ? { halign: style.halign } : {}),
    };
  }

  for (const deficit of deficits) {
    nextStyles[deficit.index] = {
      ...nextStyles[deficit.index],
      cellWidth: deficit.required,
    };
  }

  for (const donor of donors) {
    const share = totalSurplus <= PDF_WIDTH_EPSILON ? 0 : (donor.surplus / totalSurplus) * totalDeficit;
    nextStyles[donor.index] = {
      ...nextStyles[donor.index],
      cellWidth: donor.current - share,
    };
  }

  const resolvedTotalWidth = Object.values(nextStyles).reduce((sum, style) => {
    return sum + (typeof style.cellWidth === 'number' ? style.cellWidth : 0);
  }, 0);
  const residualWidth = layoutMeta.tableWidth - resolvedTotalWidth;
  if (Math.abs(residualWidth) > PDF_WIDTH_EPSILON) {
    const targetIndex = resolvePdfColumnRedistributionTargetIndex(
      layoutMeta.distributedColumnIndices,
      nextStyles,
      requiredWidths,
      residualWidth
    );
    if (targetIndex === null) {
      // `nextStyles` kasseres bevidst her og vi falder fail-closed tilbage til
      // de originale, umodificerede styles.
      return columnStyles;
    }

    const currentWidth = Number(nextStyles[targetIndex]?.cellWidth ?? 0);
    const nextWidth = currentWidth + residualWidth;
    const requiredWidth = requiredWidths.get(targetIndex) ?? 0;
    if (nextWidth + PDF_WIDTH_EPSILON < requiredWidth) {
      // `nextStyles` kasseres bevidst her og vi falder fail-closed tilbage til
      // de originale, umodificerede styles.
      return columnStyles;
    }

    nextStyles[targetIndex] = {
      ...nextStyles[targetIndex],
      cellWidth: nextWidth,
    };
  }

  return attachPdfColumnLayoutMeta(nextStyles, layoutMeta);
};
