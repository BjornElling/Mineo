/**
 * PDF Writer Infrastructure
 *
 * Shared cursor/writer abstraction for all PDF generators.
 * Extracted from erstatningsopgoerelsePdf.ts for reuse.
 *
 * Import-kæde: pdfWriter → pdfConfig + pdfHelpers (begge pure, ingen domain-logik).
 */

import jsPDF from 'jspdf';
import { FONT_SIZES, MARGINS, PDF_BASE_LINE_HEIGHT_MM, PDF_FONT_FAMILY, PDF_FONT_STYLES, PDF_LINE_BOTTOM_SPACING_MM, PDF_SUBHEADER_BOTTOM_SPACING_MM, PDF_TITLE_BOTTOM_SPACING_MM, PDF_UNDERLINED_LABEL_TOP_SPACING_MM, type PdfFontFamily, type PdfFontStyle } from './pdfConfig';
import {
  addFooter,
  addBrevhoved,
  applyNormalTextStyle,
  type BrevhovedData,
} from './pdfHelpers';
import { createJsPdfAdapter } from './jsPdfAdapter';
import { normalizeRightAlignedTextForPdf, normalizeTextForPdf } from './pdfTextUtils';

const fitTextToWidth = (doc: jsPDF, text: string, maxWidth: number): string => {
  if (doc.getTextWidth(text) <= maxWidth) return text;
  const ellipsis = '...';
  const ellipsisWidth = doc.getTextWidth(ellipsis);
  if (ellipsisWidth >= maxWidth) return '';
  let trimmed = text;
  while (trimmed.length > 0 && doc.getTextWidth(trimmed) + ellipsisWidth > maxWidth) {
    trimmed = trimmed.slice(0, -1);
  }
  return trimmed.length > 0 ? `${trimmed}${ellipsis}` : '';
};

// ============================================================================
// UDKAST WATERMARK
// ============================================================================

const udkastWatermarkCache = new Map<string, string | null>();

const getUdkastWatermarkPngDataUrl = (pageWidth: number, pageHeight: number): string | null => {
  const cacheKey = `${pageWidth.toFixed(3)}x${pageHeight.toFixed(3)}`;
  const cached = udkastWatermarkCache.get(cacheKey);
  if (cached !== undefined) return cached;

  if (typeof document === 'undefined') {
    udkastWatermarkCache.set(cacheKey, null);
    return null;
  }

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(400, Math.round(pageWidth));
  canvas.height = Math.max(560, Math.round(pageHeight));
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    udkastWatermarkCache.set(cacheKey, null);
    return null;
  }

  // Transparent image with only watermark text to keep content selectable and avoid opaque overlays.
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((-45 * Math.PI) / 180);
  const fontSize = Math.round(Math.min(canvas.width, canvas.height) * 0.20);
  ctx.font = `700 ${fontSize}px Arial, sans-serif`;
  ctx.fillStyle = 'rgba(225,225,225,0.42)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('UDKAST', 0, 0);

  const dataUrl = canvas.toDataURL('image/png');
  udkastWatermarkCache.set(cacheKey, dataUrl);
  return dataUrl;
};

const addUdkastWatermark = (doc: jsPDF): void => {
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const watermarkDataUrl = getUdkastWatermarkPngDataUrl(pageWidth, pageHeight);
  if (watermarkDataUrl) {
    doc.addImage(watermarkDataUrl, 'PNG', 0, 0, pageWidth, pageHeight, undefined, 'FAST');
    return;
  }

  // Fallback if canvas is unavailable at runtime.
  const text = 'UDKAST';
  const centerX = pageWidth / 2 + 18;
  const centerY = pageHeight / 2 - 80;
  doc.setFont(PDF_FONT_FAMILY, PDF_FONT_STYLES.bold);
  doc.setFontSize(130);
  doc.setTextColor(235);
  doc.text(text, centerX, centerY, { align: 'center', angle: -45 });
  doc.setTextColor(0);
  doc.setFont(PDF_FONT_FAMILY, PDF_FONT_STYLES.normal);
  doc.setFontSize(FONT_SIZES.normal);
};

// ============================================================================
// PDF CURSOR (intern – styrer Y-position, sideskift, tekst-rendering)
// ============================================================================

const createPdfCursor = (params: Readonly<{
  lineHeight: number;
  visUdkastStempel: boolean;
  onLayoutFallback: (message: string) => void;
}>) => {
  const { lineHeight, visUdkastStempel, onLayoutFallback } = params;
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });
  const adapter = createJsPdfAdapter(doc);
  applyNormalTextStyle(adapter);

  const pageHeight = adapter.getPageHeight();
  const contentBottom = pageHeight - MARGINS.bottom;
  const fullWidth = adapter.getPageWidth() - MARGINS.left - MARGINS.right;
  const pageContentHeight = contentBottom - MARGINS.top;
  let y = MARGINS.top;
  let activeFont: { fontName: string; fontStyle: string } = { fontName: PDF_FONT_FAMILY, fontStyle: PDF_FONT_STYLES.normal };

  const addPage = () => {
    doc.addPage();
    y = MARGINS.top;
    if (visUdkastStempel) {
      addUdkastWatermark(doc);
    }
  };

  const ensureSpace = (height: number) => {
    if (y + height > contentBottom) {
      addPage();
    }
  };

  const splitWrappedLines = (text: string, maxWidth: number): string[] => {
    return doc.splitTextToSize(normalizeTextForPdf(text), maxWidth) as string[];
  };

  const setFont = (fontName: string, fontStyle: string) => {
    doc.setFont(fontName, fontStyle);
    activeFont = { fontName, fontStyle };
  };

  const withFontStyle = (fontStyle: 'normal' | 'bold', fn: () => void) => {
    const previous = activeFont;
    setFont(previous.fontName, fontStyle);
    try {
      fn();
    } finally {
      setFont(previous.fontName, previous.fontStyle);
    }
  };

  const measureTextWidthWithFont = (text: string, fontStyle: 'normal' | 'bold'): number => {
    let measured = 0;
    withFontStyle(fontStyle, () => {
      measured = doc.getTextWidth(text);
    });
    return measured;
  };

  const writeWrappedText = (text: string, maxWidth = fullWidth, x = MARGINS.left) => {
    const lines = splitWrappedLines(text, maxWidth);
    lines.forEach((line, index) => {
      const isLast = index === lines.length - 1;
      const step = isLast ? lineHeight + PDF_LINE_BOTTOM_SPACING_MM : lineHeight;
      ensureSpace(step);
      doc.text(line, x, y);
      y += step;
    });
  };

  // Som writeWrappedText, men uden afsluttende spacing — bruges når næste kald
  // er en fortsættelse af samme logiske linje (fx writeLeftRightText i en formel).
  const writeWrappedTextContinued = (text: string, maxWidth = fullWidth, x = MARGINS.left) => {
    const lines = splitWrappedLines(text, maxWidth);
    for (const line of lines) {
      ensureSpace(lineHeight);
      doc.text(line, x, y);
      y += lineHeight;
    }
  };

  const writeLeftRightText = (
    leftText: string,
    rightText: string,
    x: number,
    rightPadding: number,
    options?: Readonly<{
      rightFontStyle?: 'normal' | 'bold';
      lineAboveRightWidth?: number;
      lineAboveRightOffset?: number;
      leftNoWrap?: boolean;
      minRightColumnWidth?: number;
    }>
  ) => {
    const pageWidth = adapter.getPageWidth();
    const rightFontStyle = options?.rightFontStyle ?? 'bold';
    const normalizedRightText = normalizeRightAlignedTextForPdf(rightText);
    const maxRightDrawableWidth = Math.max(10, pageWidth - x - rightPadding - 5);
    const actualRightWidth = measureTextWidthWithFont(normalizedRightText, rightFontStyle);
    const minRightWidth = options?.minRightColumnWidth ?? 0;
    const rightWidth = Math.max(actualRightWidth, minRightWidth);
    const wrapPadding = doc.getTextWidth('000000');
    const hasRightOverflow = rightWidth > maxRightDrawableWidth;
    const leftMaxWidth = hasRightOverflow
      ? Math.max(30, pageWidth - x - rightPadding - 5)
      : Math.max(30, pageWidth - x - rightPadding - rightWidth - 5 - wrapPadding);
    const leftLines = options?.leftNoWrap ? [normalizeTextForPdf(leftText)] : splitWrappedLines(leftText, leftMaxWidth);

    if (hasRightOverflow) {
      onLayoutFallback('højre kolonne er bredere end tilgængelig plads; flytter beløb til egen linje.');
      for (const line of leftLines) {
        ensureSpace(lineHeight);
        doc.text(line, x, y);
        y += lineHeight;
      }

      const rightLines = splitWrappedLines(normalizedRightText, maxRightDrawableWidth);
      rightLines.forEach((line, index) => {
        const isLast = index === rightLines.length - 1;
        const step = isLast ? lineHeight + PDF_LINE_BOTTOM_SPACING_MM : lineHeight;
        ensureSpace(step);
        withFontStyle(rightFontStyle, () => {
          doc.text(line, pageWidth - rightPadding, y, { align: 'right' });
        });
        y += step;
      });

      if (options?.lineAboveRightWidth) {
        const lineWidth = options.lineAboveRightWidth;
        const lineEnd = pageWidth - rightPadding;
        const lineStart = lineEnd - lineWidth;
        const offset = options.lineAboveRightOffset ?? 2;
        doc.setLineWidth(0.2);
        doc.line(lineStart, y - lineHeight - PDF_LINE_BOTTOM_SPACING_MM - offset, lineEnd, y - lineHeight - PDF_LINE_BOTTOM_SPACING_MM - offset);
      }
      return;
    }

    leftLines.forEach((line, index) => {
      const isLastLine = index === leftLines.length - 1;
      const step = isLastLine ? lineHeight + PDF_LINE_BOTTOM_SPACING_MM : lineHeight;
      ensureSpace(step);
      doc.text(line, x, y);
      if (isLastLine) {
        withFontStyle(rightFontStyle, () => {
          doc.text(normalizedRightText, pageWidth - rightPadding, y, { align: 'right' });
        });
        if (options?.lineAboveRightWidth) {
          const lineWidth = options.lineAboveRightWidth;
          const lineEnd = pageWidth - rightPadding;
          const lineStart = lineEnd - lineWidth;
          const offset = options.lineAboveRightOffset ?? 2;
          doc.setLineWidth(0.2);
          doc.line(lineStart, y - offset, lineEnd, y - offset);
        }
      }
      y += step;
    });
  };

  const writeUnderlinedLabel = (text: string, x: number) => {
    const normalized = normalizeTextForPdf(text).replace(/\n/g, ' ');
    doc.text(normalized, x, y);
    const labelWidth = doc.getTextWidth(normalized);
    doc.setLineWidth(0.2);
    doc.line(x, y + 1, x + labelWidth, y + 1);
    y += lineHeight + PDF_LINE_BOTTOM_SPACING_MM;
  };

  const writeSignatureBlock = (dateLine: string, sigLine: string, dateX: number, sigX: number, skadelidteNavn: string) => {
    ensureSpace(lineHeight);
    doc.text(dateLine, dateX, y);
    doc.text(sigLine, sigX, y);
    y += lineHeight;
    ensureSpace(lineHeight);
    const dateCenterX = dateX + doc.getTextWidth(dateLine) / 2;
    const sigCenterX = sigX + doc.getTextWidth(sigLine) / 2;
    doc.text('Dato', dateCenterX, y, { align: 'center' });
    doc.text(skadelidteNavn, sigCenterX, y, { align: 'center' });
    y += lineHeight;
  };

  const measureWrappedTextHeight = (text: string) => {
    const lines = splitWrappedLines(text, fullWidth);
    return lineHeight * lines.length + PDF_LINE_BOTTOM_SPACING_MM;
  };

  // Skriver én linje med normal tekst efterfulgt af bold tekst på samme Y-position.
  // Beregner X til bold-delen ud fra bredden af normal-delen.
  // Afslutter med lineHeight + PDF_LINE_BOTTOM_SPACING_MM (som writeWrappedText).
  const writeNormalThenBoldLine = (normalPart: string, boldPart: string) => {
    ensureSpace(lineHeight + PDF_LINE_BOTTOM_SPACING_MM);
    const normalWidth = doc.getTextWidth(normalizeTextForPdf(normalPart));
    doc.text(normalizeTextForPdf(normalPart), MARGINS.left, y);
    withFontStyle('bold', () => {
      doc.text(normalizeTextForPdf(boldPart), MARGINS.left + normalWidth, y);
    });
    y += lineHeight + PDF_LINE_BOTTOM_SPACING_MM;
  };

  return {
    setDisplayMode: (mode: string) => doc.setDisplayMode(mode),
    setProperties: (props: Parameters<jsPDF['setProperties']>[0]) => doc.setProperties(props),
    setFontSize: (size: number) => doc.setFontSize(size),
    setFont,
    applyNormalStyle: () => applyNormalTextStyle(adapter),
    getDoc: () => doc,
    getY: () => y,
    setY: (nextY: number) => {
      y = nextY;
    },
    ensureSpace,
    advanceY: (delta: number) => {
      y += delta;
    },
    writeWrappedText,
    writeWrappedTextContinued,
    writeNormalThenBoldLine,
    writeLeftRightText,
    writeUnderlinedLabel,
    writeSignatureBlock,
    writeBrevhoved: (brevhovedData: BrevhovedData) => {
      y = addBrevhoved(adapter, brevhovedData);
    },
    addUdkastWatermark: () => {
      if (visUdkastStempel) {
        addUdkastWatermark(doc);
      }
    },
    splitWrappedLines,
    measureWrappedTextHeight,
    getTextWidth: (text: string) => doc.getTextWidth(text),
    fitTextToWidth: (text: string, maxWidth: number) => fitTextToWidth(doc, text, maxWidth),
    getFullWidth: () => fullWidth,
    addPage,
    getPageContentHeight: () => pageContentHeight,
    getRemainingSpace: () => Math.max(0, contentBottom - y),
    renderAtomicBlock: (estimatedHeight: number, render: () => void) => {
      ensureSpace(estimatedHeight);
      render();
    },
    addFooter: () => addFooter(adapter),
    save: (filename: string) => doc.save(filename),
  };
};

// ============================================================================
// PDF WRITER TYPE
// ============================================================================

export type PdfWriter = {
  setDisplayMode: (mode: string) => void;
  setProperties: (props: Parameters<jsPDF['setProperties']>[0]) => void;
  setFontSize: (size: number) => void;
  setFont: (fontName: PdfFontFamily, fontStyle: PdfFontStyle) => void;
  setNormalTextStyle: () => void;
  getDoc: () => jsPDF;
  ensureSpace: (height: number) => void;
  getY: () => number;
  setY: (nextY: number) => void;
  addSpacer: (height: number) => void;
  advanceY: (delta: number) => void;
  writeWrappedText: (text: string) => void;
  writeWrappedTextContinued: (text: string, maxWidth?: number, x?: number) => void;
  writeNormalThenBoldLine: (normalPart: string, boldPart: string) => void;
  /**
   * Kanonisk valg til alle linjer med venstre/højre-kolonne.
   * Venstretekst wrapper altid til næste linje ved pladsmangel — ingen trunkering.
   */
  writeLeftRightText: (
    leftText: string,
    rightText: string,
    options?: Readonly<{
      rightFontStyle?: 'normal' | 'bold';
      lineAboveRightWidth?: number;
      lineAboveRightOffset?: number;
      leftNoWrap?: boolean;
      minRightColumnWidth?: number;
    }>
  ) => void;
  writeSectionHeader: (text: string, nextLineHeight: number) => void;
  writeTitle: (text: string) => void;
  writeSubheader: (
    text: string,
    nextLineHeight: number,
    options?: Readonly<{ addTopSpacing?: boolean }>
  ) => void;
  writeSubheaderWithWrappedText: (subheaderText: string, bodyText: string) => void;
  writeAtomicTableChunks: <T>(params: Readonly<{
    rows: readonly T[];
    renderHeader: () => void;
    renderRow: (row: T) => void;
    estimateRowHeight: number;
    headerHeight: number;
  }>) => void;
  writeUnderlinedLabel: (text: string, x: number) => void;
  writeSignatureBlock: (dateLine: string, sigLine: string, dateX: number, sigX: number, skadelidteNavn: string) => void;
  writeBrevhoved: (brevhovedData: BrevhovedData) => void;
  addUdkastWatermark: () => void;
  getTextWidth: (text: string) => number;
  fitTextToWidth: (text: string, maxWidth: number) => string;
  getPageWidth: () => number;
  addPage: () => void;
  addFooter: () => void;
  save: (filename: string) => void;
};

// ============================================================================
// PDF WRITER (public – wraps cursor with higher-level operations)
// ============================================================================

export const createPdfWriter = (params: Readonly<{
  lineHeight: number;
  visUdkastStempel: boolean;
  onLayoutFallback: (message: string) => void;
}>): PdfWriter => {
  const { lineHeight, visUdkastStempel, onLayoutFallback } = params;
  const cursor = createPdfCursor({ lineHeight, visUdkastStempel, onLayoutFallback });
  let previousBlockWasSectionHeader = false;
  let manualSpacingSinceLastContent = 0;
  // Tracker kun eksplicit addSpacer/advanceY-spacing — ikke trailing line-spacing.
  // Bruges af writeSubheader til at undgå dobbelt spacing fra addSpacer-kald.
  let explicitSpacingSinceLastContent = 0;

  const writeSectionHeader = (text: string, nextLineHeight: number) => {
    const topSpacing = lineHeight * 2;
    const bottomSpacing = lineHeight;
    const headerTextHeight = cursor.measureWrappedTextHeight(text);
    cursor.ensureSpace(topSpacing + headerTextHeight + bottomSpacing + nextLineHeight);
    cursor.advanceY(topSpacing);
    cursor.setFont(PDF_FONT_FAMILY, PDF_FONT_STYLES.bold);
    cursor.setFontSize(FONT_SIZES.header);
    cursor.writeWrappedText(text);
    cursor.setFont(PDF_FONT_FAMILY, PDF_FONT_STYLES.normal);
    cursor.setFontSize(FONT_SIZES.normal);
    cursor.advanceY(bottomSpacing);
    previousBlockWasSectionHeader = true;
    manualSpacingSinceLastContent = 0;
    explicitSpacingSinceLastContent = 0;
  };

  const writeTitle = (text: string) => {
    cursor.ensureSpace(PDF_TITLE_BOTTOM_SPACING_MM);
    cursor.setFont(PDF_FONT_FAMILY, PDF_FONT_STYLES.bold);
    cursor.setFontSize(FONT_SIZES.title);
    cursor.writeWrappedText(text);
    cursor.setFont(PDF_FONT_FAMILY, PDF_FONT_STYLES.normal);
    cursor.setFontSize(FONT_SIZES.normal);
    cursor.advanceY(PDF_TITLE_BOTTOM_SPACING_MM - lineHeight);
    previousBlockWasSectionHeader = true;
    manualSpacingSinceLastContent = 0;
    explicitSpacingSinceLastContent = 0;
  };

  const writeSubheader = (
    text: string,
    nextLineHeight: number,
    options?: Readonly<{ addTopSpacing?: boolean }>
  ) => {
    // Altid præcis 1× lineHeight over underoverskriften — uanset hvad der gik forud.
    // Allerede akkumuleret manuel spacing (via addSpacer/advanceY) modregnes, så
    // det samlede mellemrum aldrig overstiger 1× lineHeight.
    // addTopSpacing = false undertrykker spacing eksplicit (fx første underoverskrift
    // direkte under en sektionsoverskrift).
    const topSpacing = options?.addTopSpacing === false
      ? 0
      : options?.addTopSpacing === true
        ? Math.max(0, lineHeight - explicitSpacingSinceLastContent)
        : previousBlockWasSectionHeader
          ? 0
          : Math.max(0, lineHeight - explicitSpacingSinceLastContent);
    const headerHeight = cursor.measureWrappedTextHeight(text) + topSpacing;
    cursor.ensureSpace(headerHeight + nextLineHeight);
    cursor.advanceY(topSpacing);
    cursor.setFont(PDF_FONT_FAMILY, PDF_FONT_STYLES.bold);
    cursor.setFontSize(FONT_SIZES.normal);
    cursor.writeWrappedText(text);
    cursor.setFont(PDF_FONT_FAMILY, PDF_FONT_STYLES.normal);
    cursor.advanceY(PDF_SUBHEADER_BOTTOM_SPACING_MM);
    previousBlockWasSectionHeader = false;
    manualSpacingSinceLastContent = PDF_LINE_BOTTOM_SPACING_MM + PDF_SUBHEADER_BOTTOM_SPACING_MM;
    explicitSpacingSinceLastContent = 0;
  };

  const writeSubheaderWithWrappedText = (subheaderText: string, bodyText: string) => {
    const bodyHeight = cursor.measureWrappedTextHeight(bodyText);
    writeSubheader(subheaderText, bodyHeight);
    cursor.writeWrappedText(bodyText);
    manualSpacingSinceLastContent = 0;
  };

  const writeAtomicTableChunks = <T,>(params: Readonly<{
    rows: readonly T[];
    renderHeader: () => void;
    renderRow: (row: T) => void;
    estimateRowHeight: number;
    headerHeight: number;
  }>) => {
    const { rows, renderHeader, renderRow, estimateRowHeight, headerHeight } = params;
    if (rows.length === 0) {
      cursor.renderAtomicBlock(headerHeight, () => {
        renderHeader();
      });
      return;
    }

    // Keep only the heading and the first row together.
    cursor.renderAtomicBlock(headerHeight + estimateRowHeight, () => {
      renderHeader();
      renderRow(rows[0]);
    });

    for (let i = 1; i < rows.length; i += 1) {
      renderRow(rows[i]);
    }
    manualSpacingSinceLastContent = 0;
  };

  const writeUnderlinedLabel = (text: string, x: number) => {
    const targetTopSpacing = PDF_UNDERLINED_LABEL_TOP_SPACING_MM;
    const excessTopSpacing = Math.max(0, manualSpacingSinceLastContent - targetTopSpacing);
    if (excessTopSpacing > 0) {
      cursor.advanceY(-excessTopSpacing);
      manualSpacingSinceLastContent -= excessTopSpacing;
    }

    const existingTopSpacing = Math.min(targetTopSpacing, manualSpacingSinceLastContent);
    let topSpacing = targetTopSpacing - existingTopSpacing;
    const beforeEnsureY = cursor.getY();
    cursor.ensureSpace(topSpacing + lineHeight + lineHeight);
    if (cursor.getY() < beforeEnsureY) {
      // Ny side betyder at tidligere spacing er bortfaldet; start med standard top spacing.
      topSpacing = lineHeight;
    }
    if (topSpacing > 0) {
      cursor.advanceY(topSpacing);
    }
    cursor.writeUnderlinedLabel(text, x);
    previousBlockWasSectionHeader = false;
    manualSpacingSinceLastContent = 0;
  };

  return {
    setDisplayMode: cursor.setDisplayMode,
    setProperties: cursor.setProperties,
    setFontSize: cursor.setFontSize,
    setFont: cursor.setFont,
    setNormalTextStyle: () => cursor.applyNormalStyle(),
    getDoc: cursor.getDoc,
    ensureSpace: cursor.ensureSpace,
    getY: cursor.getY,
    setY: (nextY) => {
      cursor.setY(nextY);
      previousBlockWasSectionHeader = false;
      manualSpacingSinceLastContent = 0;
      explicitSpacingSinceLastContent = 0;
    },
    addSpacer: (height: number) => {
      if (height <= 0) {
        previousBlockWasSectionHeader = false;
        return;
      }
      const remaining = cursor.getRemainingSpace();
      const advance = Math.min(height, remaining);
      cursor.advanceY(advance);
      previousBlockWasSectionHeader = false;
      manualSpacingSinceLastContent += advance;
      explicitSpacingSinceLastContent += advance;
    },
    advanceY: (delta) => {
      cursor.advanceY(delta);
      previousBlockWasSectionHeader = false;
      if (delta > 0) {
        manualSpacingSinceLastContent += delta;
        explicitSpacingSinceLastContent += delta;
      }
    },
    writeWrappedText: (text) => {
      cursor.writeWrappedText(text);
      previousBlockWasSectionHeader = false;
      manualSpacingSinceLastContent = PDF_LINE_BOTTOM_SPACING_MM;
      explicitSpacingSinceLastContent = 0;
    },
    writeWrappedTextContinued: (text, maxWidth, x) => {
      cursor.writeWrappedTextContinued(text, maxWidth, x);
      previousBlockWasSectionHeader = false;
      manualSpacingSinceLastContent = 0;
      explicitSpacingSinceLastContent = 0;
    },
    writeNormalThenBoldLine: (normalPart, boldPart) => {
      cursor.writeNormalThenBoldLine(normalPart, boldPart);
      previousBlockWasSectionHeader = false;
      manualSpacingSinceLastContent = PDF_LINE_BOTTOM_SPACING_MM;
      explicitSpacingSinceLastContent = 0;
    },
    writeLeftRightText: (leftText, rightText, options) => {
      cursor.writeLeftRightText(leftText, rightText, MARGINS.left, MARGINS.right, options);
      previousBlockWasSectionHeader = false;
      manualSpacingSinceLastContent = PDF_LINE_BOTTOM_SPACING_MM;
      explicitSpacingSinceLastContent = 0;
    },
    writeSectionHeader,
    writeTitle,
    writeSubheader,
    writeSubheaderWithWrappedText,
    writeAtomicTableChunks,
    writeUnderlinedLabel,
    writeSignatureBlock: cursor.writeSignatureBlock,
    writeBrevhoved: cursor.writeBrevhoved,
    addUdkastWatermark: cursor.addUdkastWatermark,
    getTextWidth: cursor.getTextWidth,
    fitTextToWidth: cursor.fitTextToWidth,
    getPageWidth: () => MARGINS.left + cursor.getFullWidth() + MARGINS.right,
    addPage: () => {
      cursor.addPage();
      previousBlockWasSectionHeader = false;
      manualSpacingSinceLastContent = 0;
      explicitSpacingSinceLastContent = 0;
    },
    addFooter: cursor.addFooter,
    save: cursor.save,
  };
};

export const createStandardPdfWriter = (params?: Readonly<{
  visUdkastStempel?: boolean;
  onLayoutFallback?: (message: string) => void;
}>): PdfWriter => {
  const visUdkastStempel = params?.visUdkastStempel ?? false;
  const onLayoutFallback = params?.onLayoutFallback ?? (() => {});
  return createPdfWriter({
    lineHeight: PDF_BASE_LINE_HEIGHT_MM,
    visUdkastStempel,
    onLayoutFallback,
  });
};
