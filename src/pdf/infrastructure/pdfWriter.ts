/**
 * PDF Writer Infrastructure
 *
 * Shared cursor/writer abstraction for all PDF generators.
 * Extracted from erstatningsopgoerelsePdf.ts for reuse.
 *
 * Import-kæde: pdfWriter → pdfConfig + pdfHelpers (begge pure, ingen domain-logik).
 */

import jsPDF from 'jspdf';
import { FONT_SIZES, MARGINS, PDF_BASE_LINE_HEIGHT_MM, PDF_FONT_FAMILY, PDF_FONT_STYLES, PDF_LINE_BOTTOM_SPACING_MM, PDF_SUBHEADER_BOTTOM_SPACING_MM, PDF_TITLE_BOTTOM_SPACING_MM } from './pdfConfig';
import {
  addFooter,
  addBrevhoved,
  applyNormalTextStyle,
  type BrevhovedData,
} from '../shared/pdfHelpers';
import { createJsPdfAdapter } from './jsPdfAdapter';
import { normalizeRightAlignedTextForPdf, normalizeTextForPdf } from '../shared/pdfTextUtils';

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

type PdfCursor = Readonly<{
  setDisplayMode: (mode: string) => void;
  setProperties: (props: Parameters<jsPDF['setProperties']>[0]) => void;
  setFontSize: (size: number) => void;
  setFont: (fontName: string, fontStyle: string) => void;
  applyNormalStyle: () => void;
  getDoc: () => jsPDF;
  getY: () => number;
  setY: (nextY: number) => void;
  ensureSpace: (height: number) => void;
  advanceY: (delta: number) => void;
  writeWrappedText: (text: string, maxWidth?: number, x?: number) => void;
  writeStyledWrappedText: (
    text: string,
    options?: Readonly<{
      maxWidth?: number;
      x?: number;
      fontStyle?: 'normal' | 'bold';
      fontSize?: number;
      trailingSpacing?: number;
    }>
  ) => void;
  writeWrappedTextContinued: (
    text: string,
    maxWidth?: number,
    x?: number,
    options?: Readonly<{
      fontStyle?: 'normal' | 'bold';
      fontSize?: number;
    }>
  ) => void;
  writeNormalThenBoldLine: (normalPart: string, boldPart: string) => void;
  writeLeftRightText: (
    leftText: string,
    rightText: string,
    x: number,
    rightPadding: number,
    options?: Readonly<{
      leftFontStyle?: 'normal' | 'bold';
      rightFontStyle?: 'normal' | 'bold';
      lineAboveRightWidth?: number;
      lineAboveRightOffset?: number;
      leftNoWrap?: boolean;
      minRightColumnWidth?: number;
      fontSize?: number;
    }>
  ) => void;
  writeUnderlinedSubheader: (text: string, x: number) => void;
  writeSignatureBlock: (dateLine: string, sigLine: string, dateX: number, sigX: number, skadelidteNavn: string) => void;
  writeBrevhoved: (brevhovedData: BrevhovedData) => void;
  addUdkastWatermark: () => void;
  splitWrappedLines: (text: string, maxWidth: number) => string[];
  measureWrappedTextHeight: (
    text: string,
    options?: Readonly<{
      maxWidth?: number;
      fontStyle?: 'normal' | 'bold';
      fontSize?: number;
      trailingSpacing?: number;
    }>
  ) => number;
  getTextWidth: (text: string) => number;
  fitTextToWidth: (text: string, maxWidth: number) => string;
  getFullWidth: () => number;
  addPage: () => void;
  getPageContentHeight: () => number;
  getRemainingSpace: () => number;
  renderAtomicBlock: (estimatedHeight: number, render: () => void) => void;
  addFooter: () => void;
  save: (filename: string) => void;
}>;

const createPdfCursor = (params: Readonly<{
  lineHeight: number;
  visUdkastStempel: boolean;
  onLayoutFallback: (params: Readonly<{ message: string; label: string }>) => void;
}>): PdfCursor => {
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
  let activeFontSize = FONT_SIZES.normal;

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

  const splitWrappedLinesWithStyle = (
    text: string,
    maxWidth: number,
    options?: Readonly<{
      fontStyle?: 'normal' | 'bold';
      fontSize?: number;
    }>
  ): string[] => {
    let lines: string[] = [];
    withTextStyle({
      fontStyle: options?.fontStyle ?? (activeFont.fontStyle as 'normal' | 'bold'),
      fontSize: options?.fontSize ?? activeFontSize,
      fn: () => {
        lines = splitWrappedLines(text, maxWidth);
      },
    });
    return lines;
  };

  const setFont = (fontName: string, fontStyle: string) => {
    doc.setFont(fontName, fontStyle);
    activeFont = { fontName, fontStyle };
  };

  const setFontSize = (size: number) => {
    doc.setFontSize(size);
    activeFontSize = size;
  };

  const resolveLineHeightForFontSize = (fontSize: number) => {
    return lineHeight * (fontSize / FONT_SIZES.normal);
  };

  const withTextStyle = (params: Readonly<{
    fontStyle: 'normal' | 'bold';
    fontSize: number;
    fn: () => void;
  }>) => {
    const previousFont = activeFont;
    const previousFontSize = activeFontSize;
    setFont(previousFont.fontName, params.fontStyle);
    setFontSize(params.fontSize);
    try {
      params.fn();
    } finally {
      setFont(previousFont.fontName, previousFont.fontStyle);
      setFontSize(previousFontSize);
    }
  };

  const writeStyledWrappedText = (
    text: string,
    options?: Readonly<{
      maxWidth?: number;
      x?: number;
      fontStyle?: 'normal' | 'bold';
      fontSize?: number;
      trailingSpacing?: number;
    }>
  ) => {
    const maxWidth = options?.maxWidth ?? fullWidth;
    const x = options?.x ?? MARGINS.left;
    const fontStyle = options?.fontStyle ?? (activeFont.fontStyle as 'normal' | 'bold');
    const fontSize = options?.fontSize ?? activeFontSize;
    const trailingSpacing = options?.trailingSpacing ?? PDF_LINE_BOTTOM_SPACING_MM;
    const resolvedLineHeight = resolveLineHeightForFontSize(fontSize);
    const lines = splitWrappedLinesWithStyle(text, maxWidth, { fontStyle, fontSize });

    withTextStyle({
      fontStyle,
      fontSize,
      fn: () => {
        lines.forEach((line, index) => {
          const isLast = index === lines.length - 1;
          const step = isLast ? resolvedLineHeight + trailingSpacing : resolvedLineHeight;
          ensureSpace(step);
          doc.text(line, x, y);
          y += step;
        });
      },
    });
  };

  const writeWrappedText = (text: string, maxWidth = fullWidth, x = MARGINS.left) => {
    writeStyledWrappedText(text, { maxWidth, x });
  };

  // Som writeWrappedText, men uden afsluttende spacing — bruges når næste kald
  // er en fortsættelse af samme logiske linje (fx writeLeftRightText i en formel).
  const writeWrappedTextContinued = (
    text: string,
    maxWidth = fullWidth,
    x = MARGINS.left,
    options?: Readonly<{
      fontStyle?: 'normal' | 'bold';
      fontSize?: number;
    }>
  ) => {
    const fontStyle = options?.fontStyle ?? (activeFont.fontStyle as 'normal' | 'bold');
    const fontSize = options?.fontSize ?? activeFontSize;
    const resolvedLineHeight = resolveLineHeightForFontSize(fontSize);
    const lines = splitWrappedLinesWithStyle(text, maxWidth, { fontStyle, fontSize });

    withTextStyle({
      fontStyle,
      fontSize,
      fn: () => {
        for (const line of lines) {
          ensureSpace(resolvedLineHeight);
          doc.text(line, x, y);
          y += resolvedLineHeight;
        }
      },
    });
  };

  const writeLeftRightText = (
    leftText: string,
    rightText: string,
    x: number,
    rightPadding: number,
    options?: Readonly<{
      leftFontStyle?: 'normal' | 'bold';
      rightFontStyle?: 'normal' | 'bold';
      lineAboveRightWidth?: number;
      lineAboveRightOffset?: number;
      leftNoWrap?: boolean;
      minRightColumnWidth?: number;
      fontSize?: number;
    }>
  ) => {
    const explicitRightLines = rightText.split('\n');
    if (explicitRightLines.length > 1) {
      explicitRightLines.forEach((line, index) => {
        if (index > 0) {
          y -= PDF_LINE_BOTTOM_SPACING_MM;
        }
        writeLeftRightText(
          index === 0 ? leftText : '',
          line,
          x,
          rightPadding,
          index === 0
            ? options
            : {
                ...options,
                leftNoWrap: true,
              }
        );
      });
      return;
    }

    const pageWidth = adapter.getPageWidth();
    const leftFontStyle = options?.leftFontStyle ?? 'normal';
    const rightFontStyle = options?.rightFontStyle ?? 'bold';
    const fontSize = options?.fontSize ?? FONT_SIZES.normal;
    const normalizedRightText = normalizeRightAlignedTextForPdf(rightText);
    const maxRightDrawableWidth = Math.max(10, pageWidth - x - rightPadding - 5);
    const actualRightWidth = (() => {
      let measured = 0;
      withTextStyle({
        fontStyle: rightFontStyle,
        fontSize,
        fn: () => {
          measured = doc.getTextWidth(normalizedRightText);
        },
      });
      return measured;
    })();
    const minRightWidth = options?.minRightColumnWidth ?? 0;
    const rightWidth = Math.max(actualRightWidth, minRightWidth);
    const columnGap = (() => {
      let measuredGap = 0;
      withTextStyle({
        fontStyle: 'normal',
        fontSize,
        fn: () => {
          measuredGap = doc.getTextWidth('   ');
        },
      });
      return Math.max(6, measuredGap);
    })();
    const hasRightOverflow = rightWidth > maxRightDrawableWidth;
    const leftMaxWidth = hasRightOverflow
      ? Math.max(30, pageWidth - x - rightPadding - 5)
      : Math.max(30, pageWidth - x - rightPadding - rightWidth - columnGap);
    const leftLines = options?.leftNoWrap
      ? [normalizeTextForPdf(leftText)]
      : splitWrappedLinesWithStyle(leftText, leftMaxWidth, { fontStyle: leftFontStyle, fontSize });
    const resolvedLineHeight = resolveLineHeightForFontSize(fontSize);

    if (hasRightOverflow) {
      onLayoutFallback({ message: 'højre kolonne er bredere end tilgængelig plads; flytter beløb til egen linje.', label: leftText });
      withTextStyle({
        fontStyle: leftFontStyle,
        fontSize,
        fn: () => {
          for (const line of leftLines) {
            ensureSpace(resolvedLineHeight);
            doc.text(line, x, y);
            y += resolvedLineHeight;
          }
        },
      });

      const rightLines = splitWrappedLinesWithStyle(normalizedRightText, maxRightDrawableWidth, {
        fontStyle: rightFontStyle,
        fontSize,
      });
      rightLines.forEach((line, index) => {
        const isLast = index === rightLines.length - 1;
        const step = isLast ? resolvedLineHeight + PDF_LINE_BOTTOM_SPACING_MM : resolvedLineHeight;
        ensureSpace(step);
        withTextStyle({
          fontStyle: rightFontStyle,
          fontSize,
          fn: () => {
            doc.text(line, pageWidth - rightPadding, y, { align: 'right' });
          },
        });
        y += step;
      });

      if (options?.lineAboveRightWidth) {
        const lineWidth = options.lineAboveRightWidth;
        const lineEnd = pageWidth - rightPadding;
        const lineStart = lineEnd - lineWidth;
        const offset = options.lineAboveRightOffset ?? 2;
        doc.setLineWidth(0.2);
        doc.line(lineStart, y - resolvedLineHeight - PDF_LINE_BOTTOM_SPACING_MM - offset, lineEnd, y - resolvedLineHeight - PDF_LINE_BOTTOM_SPACING_MM - offset);
      }
      return;
    }

    leftLines.forEach((line, index) => {
      const isLastLine = index === leftLines.length - 1;
      const step = isLastLine ? resolvedLineHeight + PDF_LINE_BOTTOM_SPACING_MM : resolvedLineHeight;
      ensureSpace(step);
      withTextStyle({
        fontStyle: leftFontStyle,
        fontSize,
        fn: () => {
          doc.text(line, x, y);
        },
      });
      if (isLastLine) {
        withTextStyle({
          fontStyle: rightFontStyle,
          fontSize,
          fn: () => {
            doc.text(normalizedRightText, pageWidth - rightPadding, y, { align: 'right' });
          },
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

  const writeUnderlinedSubheader = (text: string, x: number) => {
    const normalized = normalizeTextForPdf(text).replace(/\n/g, ' ');
    const fontSize = FONT_SIZES.normal;
    const resolvedLineHeight = resolveLineHeightForFontSize(fontSize);
    withTextStyle({
      fontStyle: 'normal',
      fontSize,
      fn: () => {
        doc.text(normalized, x, y);
        const labelWidth = doc.getTextWidth(normalized);
        doc.setLineWidth(0.2);
        doc.line(x, y + 1, x + labelWidth, y + 1);
      },
    });
    y += resolvedLineHeight + PDF_LINE_BOTTOM_SPACING_MM + PDF_SUBHEADER_BOTTOM_SPACING_MM;
  };

  const writeSignatureBlock = (dateLine: string, sigLine: string, dateX: number, sigX: number, skadelidteNavn: string) => {
    const fontSize = FONT_SIZES.normal;
    const resolvedLineHeight = resolveLineHeightForFontSize(fontSize);
    let dateCenterX = dateX;
    let sigCenterX = sigX;
    ensureSpace(resolvedLineHeight);
    withTextStyle({
      fontStyle: 'normal',
      fontSize,
      fn: () => {
        doc.text(dateLine, dateX, y);
        doc.text(sigLine, sigX, y);
        dateCenterX = dateX + doc.getTextWidth(dateLine) / 2;
        sigCenterX = sigX + doc.getTextWidth(sigLine) / 2;
      },
    });
    y += resolvedLineHeight;
    ensureSpace(resolvedLineHeight);
    withTextStyle({
      fontStyle: 'normal',
      fontSize,
      fn: () => {
        doc.text('Dato', dateCenterX, y, { align: 'center' });
        doc.text(skadelidteNavn, sigCenterX, y, { align: 'center' });
      },
    });
    y += resolvedLineHeight;
  };

  const measureWrappedTextHeight = (
    text: string,
    options?: Readonly<{
      maxWidth?: number;
      fontStyle?: 'normal' | 'bold';
      fontSize?: number;
      trailingSpacing?: number;
    }>
  ) => {
    const maxWidth = options?.maxWidth ?? fullWidth;
    const fontStyle = options?.fontStyle ?? (activeFont.fontStyle as 'normal' | 'bold');
    const fontSize = options?.fontSize ?? activeFontSize;
    const trailingSpacing = options?.trailingSpacing ?? PDF_LINE_BOTTOM_SPACING_MM;
    const lines = splitWrappedLinesWithStyle(text, maxWidth, { fontStyle, fontSize });
    return resolveLineHeightForFontSize(fontSize) * lines.length + trailingSpacing;
  };

  // Skriver én linje med normal tekst efterfulgt af bold tekst på samme Y-position.
  // Beregner X til bold-delen ud fra bredden af normal-delen.
  // Afslutter med lineHeight + PDF_LINE_BOTTOM_SPACING_MM (som writeWrappedText).
  const writeNormalThenBoldLine = (normalPart: string, boldPart: string) => {
    const fontSize = FONT_SIZES.normal;
    const resolvedLineHeight = resolveLineHeightForFontSize(fontSize);
    ensureSpace(resolvedLineHeight + PDF_LINE_BOTTOM_SPACING_MM);
    let normalWidth = 0;
    withTextStyle({
      fontStyle: 'normal',
      fontSize,
      fn: () => {
        normalWidth = doc.getTextWidth(normalizeTextForPdf(normalPart));
        doc.text(normalizeTextForPdf(normalPart), MARGINS.left, y);
      },
    });
    withTextStyle({
      fontStyle: 'bold',
      fontSize,
      fn: () => {
        doc.text(normalizeTextForPdf(boldPart), MARGINS.left + normalWidth, y);
      },
    });
    y += resolvedLineHeight + PDF_LINE_BOTTOM_SPACING_MM;
  };

  return {
    setDisplayMode: (mode: string) => doc.setDisplayMode(mode),
    setProperties: (props: Parameters<jsPDF['setProperties']>[0]) => doc.setProperties(props),
    setFontSize,
    setFont,
    applyNormalStyle: () => {
      setFont(PDF_FONT_FAMILY, PDF_FONT_STYLES.normal);
      setFontSize(FONT_SIZES.normal);
    },
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
    writeStyledWrappedText,
    writeWrappedTextContinued,
    writeNormalThenBoldLine,
    writeLeftRightText,
    writeUnderlinedSubheader,
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
  setNormalTextStyle: () => void;
  getDoc: () => jsPDF;
  ensureSpace: (height: number) => void;
  getY: () => number;
  setY: (nextY: number) => void;
  addSpacer: (height: number) => void;
  addSectionSpacer: () => void;
  advanceY: (delta: number) => void;
  writeWrappedText: (text: string) => void;
  writeBoldWrappedText: (text: string) => void;
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
      leftFontStyle?: 'normal' | 'bold';
      rightFontStyle?: 'normal' | 'bold';
      lineAboveRightWidth?: number;
      lineAboveRightOffset?: number;
      leftNoWrap?: boolean;
      minRightColumnWidth?: number;
    }>
  ) => void;
  writeSectionHeader: (text: string, nextLineHeight?: number) => void;
  writeTitle: (text: string) => void;
  writeBoldSubheader: (
    text: string,
    nextLineHeight?: number,
    options?: Readonly<{ addTopSpacing?: boolean }>
  ) => void;
  writeBoldSubheaderIfContent: (params: Readonly<{
    text: string;
    nextLineHeight?: number;
    hasContent: boolean;
    renderContent: () => void;
    options?: Readonly<{ addTopSpacing?: boolean }>;
  }>) => boolean;
  writeBoldSubheaderWithWrappedText: (subheaderText: string, bodyText: string) => void;
  writeAtomicTableChunks: <T>(params: Readonly<{
    rows: readonly T[];
    renderHeader: () => void;
    renderRow: (row: T) => void;
    estimateRowHeight: number;
    headerHeight: number;
  }>) => void;
  writeUnderlinedSubheader: (text: string, x?: number) => void;
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
  onLayoutFallback: (params: Readonly<{ message: string; label: string }>) => void;
}>): PdfWriter => {
  const { lineHeight, visUdkastStempel, onLayoutFallback } = params;
  const cursor = createPdfCursor({ lineHeight, visUdkastStempel, onLayoutFallback });
  let previousBlockWasSectionHeader = false;
  // Bruges kun til spacing-logik: positiv manuel Y-flytning må ikke akkumulere før første content-blok på siden.
  let hasRenderedContent = false;
  // Tracker kun eksplicit addSpacer/advanceY-spacing — ikke trailing line-spacing.
  // Bruges af writeBoldSubheader til at undgå dobbelt spacing fra addSpacer-kald.
  let explicitSpacingSinceLastContent = 0;
  const canonicalSubheaderTopSpacing = lineHeight;
  const canonicalSubheaderBottomSpacing = PDF_LINE_BOTTOM_SPACING_MM + PDF_SUBHEADER_BOTTOM_SPACING_MM;
  const minimumHeaderFollowupHeight = lineHeight + canonicalSubheaderBottomSpacing;
  const minimumHeaderChainFollowupHeight = minimumHeaderFollowupHeight + lineHeight;

  const resolveSubheaderTopSpacing = (
    options?: Readonly<{ addTopSpacing?: boolean }>
  ): number => {
    if (options?.addTopSpacing === false) {
      return 0;
    }

    if (previousBlockWasSectionHeader && options?.addTopSpacing !== true) {
      return 0;
    }

    return Math.max(0, canonicalSubheaderTopSpacing - explicitSpacingSinceLastContent);
  };

  const writeSectionHeader = (text: string, nextLineHeight = PDF_BASE_LINE_HEIGHT_MM) => {
    const topSpacing = lineHeight * 2;
    // Sektionsoverskrifter skal have mere luft under sig end brødtekst, så næste blok
    // læses som et tydeligt nyt hovedafsnit frem for en fortsættelse af samme tekstflow.
    const bottomSpacing = lineHeight;
    const headerTextHeight = cursor.measureWrappedTextHeight(text, {
      fontStyle: 'bold',
      fontSize: FONT_SIZES.header,
      trailingSpacing: bottomSpacing,
    });
    const followupHeight = Math.max(nextLineHeight, minimumHeaderChainFollowupHeight);
    cursor.ensureSpace(topSpacing + headerTextHeight + followupHeight);
    cursor.advanceY(topSpacing);
    cursor.writeStyledWrappedText(text, {
      fontStyle: 'bold',
      fontSize: FONT_SIZES.header,
      trailingSpacing: bottomSpacing,
    });
    previousBlockWasSectionHeader = true;
    hasRenderedContent = true;
    explicitSpacingSinceLastContent = 0;
  };

  const writeTitle = (text: string) => {
    const titleBlockHeight = cursor.measureWrappedTextHeight(text, {
      fontStyle: 'bold',
      fontSize: FONT_SIZES.title,
      trailingSpacing: PDF_TITLE_BOTTOM_SPACING_MM,
    });
    cursor.ensureSpace(titleBlockHeight);
    cursor.writeStyledWrappedText(text, {
      fontStyle: 'bold',
      fontSize: FONT_SIZES.title,
      trailingSpacing: PDF_TITLE_BOTTOM_SPACING_MM,
    });
    cursor.applyNormalStyle();
    previousBlockWasSectionHeader = true;
    hasRenderedContent = true;
    explicitSpacingSinceLastContent = 0;
  };

  const writeBoldSubheader = (
    text: string,
    nextLineHeight = PDF_BASE_LINE_HEIGHT_MM,
    options?: Readonly<{ addTopSpacing?: boolean }>
  ) => {
    const topSpacing = resolveSubheaderTopSpacing(options);
    const headerHeight = cursor.measureWrappedTextHeight(text) + topSpacing;
    const followupHeight = Math.max(nextLineHeight, minimumHeaderChainFollowupHeight);
    cursor.ensureSpace(headerHeight + followupHeight);
    cursor.advanceY(topSpacing);
    cursor.writeStyledWrappedText(text, {
      fontStyle: 'bold',
      fontSize: FONT_SIZES.normal,
    });
    cursor.advanceY(PDF_SUBHEADER_BOTTOM_SPACING_MM);
    previousBlockWasSectionHeader = false;
    hasRenderedContent = true;
    explicitSpacingSinceLastContent = 0;
  };

  const writeBoldSubheaderIfContent = (params: Readonly<{
    text: string;
    nextLineHeight?: number;
    hasContent: boolean;
    renderContent: () => void;
    options?: Readonly<{ addTopSpacing?: boolean }>;
  }>): boolean => {
    if (!params.hasContent) return false;
    writeBoldSubheader(params.text, params.nextLineHeight, params.options);
    params.renderContent();
    return true;
  };

  const writeBoldSubheaderWithWrappedText = (subheaderText: string, bodyText: string) => {
    const bodyHeight = cursor.measureWrappedTextHeight(bodyText);
    writeBoldSubheaderIfContent({
      text: subheaderText,
      nextLineHeight: bodyHeight,
      hasContent: bodyText.trim() !== '',
      renderContent: () => {
        cursor.writeStyledWrappedText(bodyText, {
          fontStyle: 'normal',
          fontSize: FONT_SIZES.normal,
        });
      },
    });
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

  const writeUnderlinedSubheader = (text: string, x = MARGINS.left) => {
    let topSpacing = resolveSubheaderTopSpacing();
    const beforeEnsureY = cursor.getY();
    cursor.ensureSpace(topSpacing + minimumHeaderFollowupHeight + minimumHeaderChainFollowupHeight);
    if (cursor.getY() < beforeEnsureY) {
      // Ny side betyder at tidligere eksplicit spacing er bortfaldet; genbrug canonical spacing,
      // medmindre underoverskriften står direkte efter en section header på den nye side.
      topSpacing = previousBlockWasSectionHeader ? 0 : canonicalSubheaderTopSpacing;
    }
    if (topSpacing > 0) {
      cursor.advanceY(topSpacing);
    }
    cursor.writeUnderlinedSubheader(text, x);
    previousBlockWasSectionHeader = false;
    hasRenderedContent = true;
    explicitSpacingSinceLastContent = 0;
  };

  return {
    setDisplayMode: cursor.setDisplayMode,
    setProperties: cursor.setProperties,
    setNormalTextStyle: () => cursor.applyNormalStyle(),
    getDoc: cursor.getDoc,
    ensureSpace: cursor.ensureSpace,
    getY: cursor.getY,
    setY: (nextY) => {
      const previousY = cursor.getY();
      const delta = nextY - previousY;
      cursor.setY(nextY);
      previousBlockWasSectionHeader = false;
      if (delta > 0 && hasRenderedContent) {
        explicitSpacingSinceLastContent += delta;
        return;
      }
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
      explicitSpacingSinceLastContent += advance;
    },
    addSectionSpacer: () => {
      const advance = Math.min(PDF_BASE_LINE_HEIGHT_MM, cursor.getRemainingSpace());
      if (advance <= 0) {
        previousBlockWasSectionHeader = false;
        return;
      }
      cursor.advanceY(advance);
      previousBlockWasSectionHeader = false;
      explicitSpacingSinceLastContent += advance;
    },
    advanceY: (delta) => {
      cursor.advanceY(delta);
      previousBlockWasSectionHeader = false;
      if (delta > 0) {
        explicitSpacingSinceLastContent += delta;
      }
    },
    writeWrappedText: (text) => {
      cursor.writeStyledWrappedText(text, {
        fontStyle: 'normal',
        fontSize: FONT_SIZES.normal,
      });
      previousBlockWasSectionHeader = false;
      hasRenderedContent = true;
      explicitSpacingSinceLastContent = 0;
    },
    writeBoldWrappedText: (text) => {
      cursor.writeStyledWrappedText(text, {
        fontStyle: 'bold',
        fontSize: FONT_SIZES.normal,
      });
      previousBlockWasSectionHeader = false;
      hasRenderedContent = true;
      explicitSpacingSinceLastContent = 0;
    },
    writeWrappedTextContinued: (text, maxWidth, x) => {
      cursor.writeWrappedTextContinued(text, maxWidth, x, {
        fontStyle: 'normal',
        fontSize: FONT_SIZES.normal,
      });
      previousBlockWasSectionHeader = false;
      hasRenderedContent = true;
      explicitSpacingSinceLastContent = 0;
    },
    writeNormalThenBoldLine: (normalPart, boldPart) => {
      cursor.writeNormalThenBoldLine(normalPart, boldPart);
      previousBlockWasSectionHeader = false;
      hasRenderedContent = true;
      explicitSpacingSinceLastContent = 0;
    },
    writeLeftRightText: (leftText, rightText, options) => {
      cursor.writeLeftRightText(leftText, rightText, MARGINS.left, MARGINS.right, {
        ...options,
        fontSize: FONT_SIZES.normal,
      });
      previousBlockWasSectionHeader = false;
      hasRenderedContent = true;
      explicitSpacingSinceLastContent = 0;
    },
    writeSectionHeader,
    writeTitle,
    writeBoldSubheader,
    writeBoldSubheaderIfContent,
    writeBoldSubheaderWithWrappedText,
    writeAtomicTableChunks,
    writeUnderlinedSubheader: (text, x) => {
      writeUnderlinedSubheader(text, x);
    },
    writeSignatureBlock: (...args) => {
      cursor.writeSignatureBlock(...args);
    },
    writeBrevhoved: cursor.writeBrevhoved,
    addUdkastWatermark: cursor.addUdkastWatermark,
    getTextWidth: cursor.getTextWidth,
    fitTextToWidth: cursor.fitTextToWidth,
    getPageWidth: () => MARGINS.left + cursor.getFullWidth() + MARGINS.right,
    addPage: () => {
      cursor.addPage();
      previousBlockWasSectionHeader = false;
      hasRenderedContent = false;
      explicitSpacingSinceLastContent = 0;
    },
    addFooter: cursor.addFooter,
    save: cursor.save,
  };
};

export const createStandardPdfWriter = (params?: Readonly<{
  visUdkastStempel?: boolean;
  onLayoutFallback?: (params: Readonly<{ message: string; label: string }>) => void;
}>): PdfWriter => {
  const visUdkastStempel = params?.visUdkastStempel ?? false;
  const onLayoutFallback = params?.onLayoutFallback ?? (() => {});
  return createPdfWriter({
    lineHeight: PDF_BASE_LINE_HEIGHT_MM,
    visUdkastStempel,
    onLayoutFallback,
  });
};
