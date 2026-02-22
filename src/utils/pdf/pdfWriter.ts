/**
 * PDF Writer Infrastructure
 *
 * Shared cursor/writer abstraction for all PDF generators.
 * Extracted from erstatningsopgoerelsePdf.ts for reuse.
 *
 * Import-kæde: pdfWriter → pdfConfig + pdfHelpers (begge pure, ingen domain-logik).
 */

import jsPDF from 'jspdf';
import { FONT_SIZES, MARGINS, PDF_FONT_FAMILY, PDF_FONT_STYLES, type PdfFontFamily, type PdfFontStyle } from './pdfConfig';
import {
  addFooter,
  addBrevhoved,
  applyNormalTextStyle,
  PDF_TITLE_BOTTOM_SPACING_MM,
  type BrevhovedData,
} from './pdfHelpers';
import { createJsPdfAdapter } from './jsPdfAdapter';
import { normalizeTextForPdf } from './pdfTextUtils';

const fitTextToWidth = (doc: jsPDF, text: string, maxWidth: number): string => {
  if (doc.getTextWidth(text) <= maxWidth) return text;
  const ellipsis = '…';
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
  const pxScale = 1;
  canvas.width = Math.max(400, Math.round(pageWidth * pxScale));
  canvas.height = Math.max(560, Math.round(pageHeight * pxScale));
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
    const maxRightDrawableWidth = Math.max(10, pageWidth - x - rightPadding - 5);
    const actualRightWidth = measureTextWidthWithFont(rightText, rightFontStyle);
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

      const rightLines = splitWrappedLines(rightText, maxRightDrawableWidth);
      for (const line of rightLines) {
        ensureSpace(lineHeight);
        withFontStyle(rightFontStyle, () => {
          doc.text(line, pageWidth - rightPadding, y, { align: 'right' });
        });
        y += lineHeight;
      }

      if (options?.lineAboveRightWidth) {
        const lineWidth = options.lineAboveRightWidth;
        const lineEnd = pageWidth - rightPadding;
        const lineStart = lineEnd - lineWidth;
        const offset = options.lineAboveRightOffset ?? 2;
        doc.setLineWidth(0.2);
        doc.line(lineStart, y - lineHeight - offset, lineEnd, y - lineHeight - offset);
      }
      return;
    }

    leftLines.forEach((line, index) => {
      ensureSpace(lineHeight);
      doc.text(line, x, y);
      const isLastLine = index === leftLines.length - 1;
      if (isLastLine) {
        withFontStyle(rightFontStyle, () => {
          doc.text(rightText, pageWidth - rightPadding, y, { align: 'right' });
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
      y += lineHeight;
    });
  };

  const writeLeftRightTextSingleLine = (
    leftText: string,
    rightText: string,
    x: number,
    rightPadding: number,
    options?: Readonly<{
      rightFontStyle?: 'normal' | 'bold';
      lineAboveRightWidth?: number;
      lineAboveRightOffset?: number;
    }>
  ) => {
    writeLeftRightText(leftText, rightText, x, rightPadding, { ...options, leftNoWrap: true });
  };

  const writeUnderlinedLabel = (text: string, x: number) => {
    ensureSpace(lineHeight * 2);
    y += lineHeight;
    const normalized = normalizeTextForPdf(text).replace(/\n/g, ' ');
    doc.text(normalized, x, y);
    const labelWidth = doc.getTextWidth(normalized);
    doc.setLineWidth(0.2);
    doc.line(x, y + 1, x + labelWidth, y + 1);
    y += lineHeight;
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
    return lineHeight * lines.length;
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
    writeLeftRightText,
    writeLeftRightTextSingleLine,
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
  writeLeftRightTextSingleLine: (
    leftText: string,
    rightText: string,
    options?: Readonly<{
      rightFontStyle?: 'normal' | 'bold';
      lineAboveRightWidth?: number;
      lineAboveRightOffset?: number;
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
  doubleLineHeight: number;
  visUdkastStempel: boolean;
  onLayoutFallback: (message: string) => void;
}>): PdfWriter => {
  const { lineHeight, visUdkastStempel, onLayoutFallback } = params;
  const cursor = createPdfCursor({ lineHeight, visUdkastStempel, onLayoutFallback });
  let previousBlockWasSectionHeader = false;

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
  };

  const writeSubheader = (
    text: string,
    nextLineHeight: number,
    options?: Readonly<{ addTopSpacing?: boolean }>
  ) => {
    const topSpacing = options?.addTopSpacing === undefined
      ? (previousBlockWasSectionHeader ? 0 : lineHeight)
      : (options.addTopSpacing ? lineHeight : 0);
    const headerHeight = cursor.measureWrappedTextHeight(text) + topSpacing;
    cursor.ensureSpace(headerHeight + nextLineHeight);
    cursor.advanceY(topSpacing);
    cursor.setFont(PDF_FONT_FAMILY, PDF_FONT_STYLES.bold);
    cursor.setFontSize(FONT_SIZES.normal);
    cursor.writeWrappedText(text);
    cursor.setFont(PDF_FONT_FAMILY, PDF_FONT_STYLES.normal);
    previousBlockWasSectionHeader = false;
  };

  const writeSubheaderWithWrappedText = (subheaderText: string, bodyText: string) => {
    const bodyHeight = cursor.measureWrappedTextHeight(bodyText);
    writeSubheader(subheaderText, bodyHeight);
    cursor.writeWrappedText(bodyText);
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
    },
    addSpacer: (height: number) => {
      if (height <= 0) {
        previousBlockWasSectionHeader = false;
        return;
      }
      const remaining = cursor.getRemainingSpace();
      // Spacer afkortes ved sidens kant; sideskift håndteres af efterfølgende indhold.
      const advance = Math.min(height, remaining);
      cursor.advanceY(advance);
      previousBlockWasSectionHeader = false;
    },
    advanceY: (delta) => {
      cursor.advanceY(delta);
      previousBlockWasSectionHeader = false;
    },
    writeWrappedText: (text) => {
      cursor.writeWrappedText(text);
      previousBlockWasSectionHeader = false;
    },
    writeLeftRightText: (leftText, rightText, options) => {
      cursor.writeLeftRightText(leftText, rightText, MARGINS.left, MARGINS.right, options);
      previousBlockWasSectionHeader = false;
    },
    writeLeftRightTextSingleLine: (leftText, rightText, options) => {
      cursor.writeLeftRightTextSingleLine(leftText, rightText, MARGINS.left, MARGINS.right, options);
      previousBlockWasSectionHeader = false;
    },
    writeSectionHeader,
    writeTitle,
    writeSubheader,
    writeSubheaderWithWrappedText,
    writeAtomicTableChunks,
    writeUnderlinedLabel: cursor.writeUnderlinedLabel,
    writeSignatureBlock: cursor.writeSignatureBlock,
    writeBrevhoved: cursor.writeBrevhoved,
    addUdkastWatermark: cursor.addUdkastWatermark,
    getTextWidth: cursor.getTextWidth,
    fitTextToWidth: cursor.fitTextToWidth,
    getPageWidth: () => MARGINS.left + cursor.getFullWidth() + MARGINS.right,
    addPage: () => {
      cursor.addPage();
      previousBlockWasSectionHeader = false;
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
    lineHeight: 5,
    doubleLineHeight: 10,
    visUdkastStempel,
    onLayoutFallback,
  });
};
