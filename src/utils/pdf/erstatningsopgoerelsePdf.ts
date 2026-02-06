/**
 * PDF Generator for Erstatningsopgørelse
 *
 * Genererer PDF-dokument med komplet erstatningsopgørelse
 */

import jsPDF from 'jspdf';
import { FONT_SIZES, MARGINS } from './pdfConfig';
import { addFooter, addBrevhoved, type BrevhovedData } from './pdfHelpers';
import type { ISODateString } from '../../types/branded';
import { isoToDanish } from '../../types/branded';
import type { ErstatningsopgoerelseValues, StamdataValues } from '../../schemas/formSchemas';
import { buildErstatningsopgoerelsePdfModel, type MoneyOre, type Calculable } from '../../domain/erstatningsopgoerelse/eoPdfModel';
import { formatCurrency, formatPercent } from '../formatUtils';
import { TAF_BEREGNES_SOM } from '../../domain/erstatningsopgoerelse/tafBeregningsenhed';
import { TODAY } from '../../config/dateRanges';

const NBSP = '\u00A0';

const formatCurrencyFromOre = (ore: MoneyOre): string => formatCurrency(ore / 100);

const renderMoney = (value: Calculable<MoneyOre>): string => {
  return value.status === 'ok' ? formatCurrencyFromOre(value.value) : '—';
};

const renderMoneyWithKr = (value: Calculable<MoneyOre>): string => {
  const rendered = renderMoney(value);
  return rendered === '—' ? '—' : `${rendered}${NBSP}kr.`;
};

const formatMoneyOreWithKr = (ore: MoneyOre): string => `${formatCurrencyFromOre(ore)}${NBSP}kr.`;

const ensureNonBreakingKr = (value: string): string => {
  return value.replace(/(-?\d[\d.,]*)\s+kr\./g, `$1${NBSP}kr.`);
};

const normalizeTextForPdf = (value: string): string => {
  return ensureNonBreakingKr(value.replace(/\r\n/g, '\n'));
};

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


const formatMaanederTrimmed = (value: number): string => {
  const rounded = Math.round(value * 10000) / 10000;
  return rounded.toLocaleString('da-DK', { minimumFractionDigits: 0, maximumFractionDigits: 4 });
};

const formatPercentDelta = (value: number): string => {
  const abs = Math.abs(value);
  const rounded = Math.round(abs * 100) / 100;
  return rounded.toLocaleString('da-DK', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
};

export const resolveUdkastStempelValue = (value: unknown): boolean => {
  return value === 'Ja';
};

const addUdkastWatermark = (doc: jsPDF): void => {
  const text = 'UDKAST';
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const centerX = pageWidth / 2 + 18;
  const centerY = pageHeight / 2 - 80;
  const diagonal = Math.sqrt(pageWidth * pageWidth + pageHeight * pageHeight);

  const baseFontSize = 100;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(baseFontSize);
  const widthAtBase = doc.getTextWidth(text) || 1;
  const targetWidth = diagonal * 0.9;
  const computedSize = (targetWidth / widthAtBase) * baseFontSize;
  const fontSize = Math.min(170, Math.max(80, computedSize));

  doc.setFontSize(fontSize);
  doc.setTextColor(245);
  doc.text(text, centerX, centerY, { align: 'center', angle: -45 });
  doc.setTextColor(0);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(FONT_SIZES.normal);
};

/**
 * Månedsnavn på dansk (med små bogstaver)
 */
/**
 * Formaterer ISO-dato til dansk datoformat (dd-mm-yyyy)
 *
 * @param {ISODateString} isoDate - Dato i ISO-format (yyyy-mm-dd)
 * @returns {string} Formateret dato (dd-mm-yyyy)
 */
const formatDateShort = (isoDate: ISODateString | undefined): string => {
  if (!isoDate) return '';

  const danish = isoToDanish(isoDate);
  if (!danish) return '';

  // danish er allerede i dd-mm-yyyy format, så returner direkte
  return danish;
};

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

  const pageHeight = doc.internal.pageSize.height;
  const contentBottom = pageHeight - MARGINS.bottom;
  const fullWidth = doc.internal.pageSize.width - MARGINS.left - MARGINS.right;
  const pageContentHeight = contentBottom - MARGINS.top;
  let y = MARGINS.top;
  let activeFont = { fontName: 'helvetica', fontStyle: 'normal' as string };

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
    const pageWidth = doc.internal.pageSize.width;
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
    ensureSpace(lineHeight);
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
      y = addBrevhoved(doc, brevhovedData);
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
    getPageContentHeight: () => pageContentHeight,
    renderAtomicBlock: (estimatedHeight: number, render: () => void) => {
      ensureSpace(estimatedHeight);
      render();
    },
    addFooter: () => addFooter(doc),
    save: (filename: string) => doc.save(filename),
  };
};

type PdfWriter = {
  setDisplayMode: (mode: string) => void;
  setProperties: (props: Parameters<jsPDF['setProperties']>[0]) => void;
  setFontSize: (size: number) => void;
  setFont: (fontName: string, fontStyle: string) => void;
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
  addFooter: () => void;
  save: (filename: string) => void;
};

const createPdfWriter = (params: Readonly<{
  lineHeight: number;
  doubleLineHeight: number;
  visUdkastStempel: boolean;
  onLayoutFallback: (message: string) => void;
}>): PdfWriter => {
  const { lineHeight, doubleLineHeight, visUdkastStempel, onLayoutFallback } = params;
  const cursor = createPdfCursor({ lineHeight, visUdkastStempel, onLayoutFallback });

  const writeSectionHeader = (text: string, nextLineHeight: number) => {
    const estimatedHeaderHeight = doubleLineHeight + lineHeight;
    cursor.ensureSpace(estimatedHeaderHeight + nextLineHeight);
    cursor.advanceY(doubleLineHeight);
    cursor.setFont('helvetica', 'bold');
    cursor.setFontSize(FONT_SIZES.header);
    cursor.writeWrappedText(text);
    cursor.advanceY(lineHeight);
    cursor.setFont('helvetica', 'normal');
    cursor.setFontSize(FONT_SIZES.normal);
  };

  const writeSubheader = (
    text: string,
    nextLineHeight: number,
    options?: Readonly<{ addTopSpacing?: boolean }>
  ) => {
    const addTopSpacing = options?.addTopSpacing ?? true;
    const headerHeight = cursor.measureWrappedTextHeight(text) + (addTopSpacing ? lineHeight : 0);
    cursor.ensureSpace(headerHeight + nextLineHeight);
    if (addTopSpacing) {
      cursor.advanceY(lineHeight);
    }
    cursor.setFont('helvetica', 'bold');
    cursor.setFontSize(FONT_SIZES.normal);
    cursor.writeWrappedText(text);
    cursor.setFont('helvetica', 'normal');
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
    const rowsPerChunk = Math.max(
      1,
      Math.floor((cursor.getPageContentHeight() - headerHeight) / estimateRowHeight)
    );
    for (let i = 0; i < rows.length; i += rowsPerChunk) {
      const chunk = rows.slice(i, i + rowsPerChunk);
      const estimatedChunkHeight = headerHeight + estimateRowHeight * chunk.length;
      cursor.renderAtomicBlock(estimatedChunkHeight, () => {
        renderHeader();
        chunk.forEach((row) => renderRow(row));
      });
    }
  };

  return {
    setDisplayMode: cursor.setDisplayMode,
    setProperties: cursor.setProperties,
    setFontSize: cursor.setFontSize,
    setFont: cursor.setFont,
    addSpacer: (height: number) => {
      cursor.ensureSpace(height);
      cursor.advanceY(height);
    },
    advanceY: cursor.advanceY,
    writeWrappedText: cursor.writeWrappedText,
    writeLeftRightText: (leftText, rightText, options) =>
      cursor.writeLeftRightText(leftText, rightText, MARGINS.left, MARGINS.right, options),
    writeLeftRightTextSingleLine: (leftText, rightText, options) =>
      cursor.writeLeftRightTextSingleLine(leftText, rightText, MARGINS.left, MARGINS.right, options),
    writeSectionHeader,
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
    addFooter: cursor.addFooter,
    save: cursor.save,
  };
};


/**
 * Interface for valgte elementer
 */
interface SelectedElements {
  opgoerelse: boolean;
  loenindkomst: boolean;
  offentligeYdelser: boolean;
  shDage: boolean;
  regulering: boolean;
  okSatser: boolean;
  sygeferiegodtgoerelse: boolean;
}

/**
 * Options for erstatningsopgørelse PDF
 */
interface ErstatningsopgoerelsePdfOptions {
  visBrevhoved?: boolean;
  erstatningsopgoerelseAfsluttesMed?: 'Bekræftet godkendt' | 'Underskrift-linje';
  visUdkastStempel?: boolean;
}

/**
 * Generer og download PDF for erstatningsopgørelse
 *
 * @param {StamdataValues} stamdataValues - Stamdata fra FormPersistence
 * @param {ErstatningsopgoerelseValues} eoValues - EO-oplysninger fra FormPersistence
 * @param {SelectedElements} selectedElements - Valgte elementer til PDF
 * @param {ErstatningsopgoerelsePdfOptions} options - Valgfrie indstillinger
 */
export const generateErstatningsopgoerelsePdf = (
  stamdataValues: StamdataValues,
  eoValues: ErstatningsopgoerelseValues,
  selectedElements: SelectedElements,
  options: ErstatningsopgoerelsePdfOptions = {}
) => {
  if (!selectedElements.opgoerelse) {
    throw new Error('PDF-generering kræver, at elementet "Opgørelse" er valgt.');
  }

  const unsupportedSelections = [
    ['Lønindkomst', selectedElements.loenindkomst],
    ['Offentlige ydelser', selectedElements.offentligeYdelser],
    ['SH-dage', selectedElements.shDage],
    ['Regulering', selectedElements.regulering],
    ['OK-satser', selectedElements.okSatser],
    ['Sygeferiegodtgørelse', selectedElements.sygeferiegodtgoerelse],
  ].filter(([, isSelected]) => isSelected).map(([label]) => label);

  if (unsupportedSelections.length > 0) {
    throw new Error(
      `Valgte PDF-elementer er ikke understøttet endnu: ${unsupportedSelections.join(', ')}.`
    );
  }

  const { visBrevhoved = false } = options;
  const visUdkastStempel = options.visUdkastStempel ?? resolveUdkastStempelValue(eoValues.indsaetUdkastStempel);
  const afsluttesMed = options.erstatningsopgoerelseAfsluttesMed ?? eoValues.erstatningsopgoerelseAfsluttesMed;
  const lineHeight = 5;
  const doubleLineHeight = lineHeight * 2;
  const model = buildErstatningsopgoerelsePdfModel(stamdataValues, eoValues, { dagsDatoISO: TODAY });
  const titel = model.titel;

  const warnLayoutFallback = (message: string) => {
    console.warn(`PDF-layout: ${message}`);
  };

  const writer = createPdfWriter({
    lineHeight,
    doubleLineHeight,
    visUdkastStempel,
    onLayoutFallback: warnLayoutFallback,
  });
  writer.setDisplayMode('100%');

  // Dokumentets metadata
  writer.setProperties({
    title: titel,
    subject: 'Erstatningsberegning',
    author: 'MINEO',
    creator: 'MINEO',
  });

  const renderSectionHeader = (text: string, nextLineHeight: number) => {
    writer.writeSectionHeader(text, nextLineHeight);
  };

  const renderSubheader = (text: string, nextLineHeight: number, options?: Readonly<{ addTopSpacing?: boolean }>) => {
    writer.writeSubheader(text, nextLineHeight, options);
  };

  const safeAddWrappedText = (text: string) => {
    writer.writeWrappedText(text);
  };

  const renderSubheaderWithWrappedText = (subheaderText: string, bodyText: string) => {
    writer.writeSubheaderWithWrappedText(subheaderText, bodyText);
  };

  const safeAddLeftRightText = (
    leftText: string,
    rightText: string,
    rightMaxWidth: number,
    options?: Readonly<{
      rightFontStyle?: 'normal' | 'bold';
      lineAboveRightWidth?: number;
      lineAboveRightOffset?: number;
      leftNoWrap?: boolean;
    }>
  ) => {
    writer.writeLeftRightText(
      leftText,
      rightText,
      { ...options, minRightColumnWidth: rightMaxWidth }
    );
  };

  const renderAtomicTableChunks = <T,>(params: Readonly<{
    rows: readonly T[];
    renderHeader: () => void;
    renderRow: (row: T) => void;
    estimateRowHeight: number;
    headerHeight: number;
  }>) => {
    const { rows, renderHeader, renderRow, estimateRowHeight, headerHeight } = params;
    writer.writeAtomicTableChunks({ rows, renderHeader, renderRow, estimateRowHeight, headerHeight });
  };

  const assertModelInvariant = (condition: boolean, message: string) => {
    if (condition) return;
    const invariantMessage = `Inkonsekvent PDF-model: ${message}`;
    throw new Error(invariantMessage);
  };

  writer.addUdkastWatermark();

  // Tilføj brevhoved hvis aktiveret
  if (visBrevhoved && model.brevhoved) {
    const brevhovedData: BrevhovedData = {
      journalnr: model.brevhoved.journalnr,
      advokat: model.brevhoved.advokat,
      sagsbehandler: model.brevhoved.sagsbehandler,
      // UND TAGELSE: EOberegning-tab bruger "Opgørelse lavet den" i stedet for dags dato.
      dagsDatoISO: model.brevhoved.dagsDatoISO,
    };
    writer.writeBrevhoved(brevhovedData);
  }

  // Tilføj titel (fed skrift)
  writer.setFontSize(FONT_SIZES.title);
  writer.setFont('helvetica', 'bold');
  safeAddWrappedText(titel);

  // Tilføj erstatningsperiode-datoer direkte under titel
  writer.setFontSize(FONT_SIZES.normal);
  writer.setFont('helvetica', 'normal');
  if (model.periodeDisplay) {
    safeAddWrappedText(model.periodeDisplay);
    writer.advanceY(lineHeight);
  }

  // Tilføj skadelidtes navn (fed skrift)
  writer.setFont('helvetica', 'bold');
  if (model.skadelidteNavn) {
    safeAddWrappedText(model.skadelidteNavn);
  }

  // Tilføj skadestype og skadesdato (normal skrift)
  writer.setFont('helvetica', 'normal');
  if (model.skadestypeLinje) {
    safeAddWrappedText(model.skadestypeLinje);
    writer.advanceY(lineHeight);
  }

  // ============================================================================
  // SVIE- OG SMERTEGODTGØRELSE SEKTION
  // ============================================================================

  renderSectionHeader('Svie- og smertegodtgørelse', lineHeight);

  renderSubheader('Status', lineHeight, { addTopSpacing: false });

  // Normal skrift for resten
  writer.setFont('helvetica', 'normal');

    for (const line of model.svieSmerte.statusLinjer) {
      safeAddWrappedText(line);
    }

  renderSubheader(model.svieSmerte.periodeHeading, lineHeight);
  assertModelInvariant(
    model.svieSmerte.harPerioder === (model.svieSmerte.periodeLinjer.length > 0),
    'svieSmerte.harPerioder matcher ikke svieSmerte.periodeLinjer.'
  );
  if (!model.svieSmerte.beregnes) {
    safeAddWrappedText('Ingen');
  } else if (!model.svieSmerte.harPerioder) {
    safeAddWrappedText('Ingen');
  } else {
    for (const line of model.svieSmerte.periodeLinjer) {
      safeAddWrappedText(line);
    }

    renderSubheader('Beregningsgrundlag', lineHeight);
    const satserAar = model.svieSmerte.satserAar !== null ? String(model.svieSmerte.satserAar) : '-';
    safeAddWrappedText(`Beregningen af godtgørelse foretages ud fra satserne i år ${satserAar}.`);

    const perDagDisplayWithKr = renderMoneyWithKr(model.svieSmerte.satserPerDag);
    const maxDisplayWithKr = renderMoneyWithKr(model.svieSmerte.satserMax);
    safeAddWrappedText(`Taksten udgår ${perDagDisplayWithKr} pr. sygedag, dog højst ${maxDisplayWithKr}`);

    const tidligere = model.svieSmerte.tidligere;
    const aktuel = model.svieSmerte.aktuel;
    if (tidligere.status === 'ok' || aktuel.status === 'ok') {
      const tidligereDisplay = renderMoneyWithKr(tidligere);
      const aktuelDisplay = renderMoneyWithKr(aktuel);
      let tekst = '';
      if (tidligere.status === 'ok' && aktuel.status === 'ok') {
        tekst = `Der er opgjort svie- og smertegodtgørelse med ${tidligereDisplay} for tidligere perioder samt modtaget ${aktuelDisplay} for denne periode.`;
      } else if (tidligere.status === 'ok') {
        tekst = `Der er opgjort svie- og smertegodtgørelse med ${tidligereDisplay} for tidligere perioder.`;
      } else if (aktuel.status === 'ok') {
        tekst = `Der er tidligere modtaget ${aktuelDisplay} for denne periode.`;
      }
      if (tekst) {
        safeAddWrappedText(tekst);
      }
    }
    renderSubheader('Beregnet krav på svie- og smertegodtgørelse', lineHeight);
    const sygedage = model.svieSmerte.sygedage;
    const delviseSygedage = model.svieSmerte.delviseSygedage;
    const perDagOre = model.svieSmerte.satserPerDag.status === 'ok' ? model.svieSmerte.satserPerDag.value : null;
    const delvisOre = perDagOre !== null ? Math.round(perDagOre * model.svieSmerte.delvisFaktor) : null;

    const formatCount = (value: number): string => value.toLocaleString('da-DK');
    const perDagText = perDagOre !== null ? formatCurrencyFromOre(perDagOre) : '—';
    const delvisText = delvisOre !== null ? formatCurrencyFromOre(delvisOre) : '—';
    const withKr = (value: string): string => (value === '—' ? value : `${value}${NBSP}kr.`);
    const perDagTextWithKr = withKr(perDagText);
    const delvisTextWithKr = withKr(delvisText);

    const lineLeft = (() => {
      if (sygedage === 0 && delviseSygedage === 0) return '—';
      if (perDagOre === null) return '—';

      let base = '';
      if (model.svieSmerte.delvisFaktor === 1) {
        const combined = [
          sygedage > 0 ? `${formatCount(sygedage)} sygedage` : '',
          delviseSygedage > 0 ? `${formatCount(delviseSygedage)} delvise sygedage` : '',
        ].filter((part) => part !== '').join(' og ');
        base = combined === '' ? '-' : `${combined} á ${perDagTextWithKr}`;
      } else {
        const parts: string[] = [];
        if (sygedage > 0) {
          parts.push(`${formatCount(sygedage)} sygedage á ${perDagTextWithKr}`);
        }
        if (delviseSygedage > 0) {
          parts.push(`${formatCount(delviseSygedage)} delvise sygedage á ${delvisTextWithKr}`);
        }
        base = parts.join(' og ');
      }

      if (base === '' || base === '-') return '-';

      const deductions: string[] = [];
      if (aktuel.status === 'ok') {
        deductions.push(`-${NBSP}${formatMoneyOreWithKr(aktuel.value)}`);
      }
      const maxSuffix = model.svieSmerte.maxApplied ? ' (reduceret til max)' : '';
      return `${base}${deductions.length > 0 ? ` ${deductions.join(' ')}` : ''}${maxSuffix} =`;
    })();

    const beloebDisplay = formatMoneyOreWithKr(model.svieSmerte.totalOre);
    safeAddLeftRightText(lineLeft, beloebDisplay, writer.getTextWidth('000.000.000,00'), { rightFontStyle: 'bold' });
  }
  // ============================================================================
  // TABT ARBEJDSFORTJENESTE SEKTION
  // ============================================================================

  renderSectionHeader('Tabt arbejdsfortjeneste', lineHeight);

  renderSubheader('Status', lineHeight, { addTopSpacing: false });

  // Normal skrift for resten
  writer.setFont('helvetica', 'normal');

    for (const line of model.tabtArbejdsfortjeneste.statusLinjer) {
      safeAddWrappedText(line);
    }

    for (const line of model.tabtArbejdsfortjeneste.eetLinjer) {
      safeAddWrappedText(line);
    }

  if (model.tabtArbejdsfortjeneste.differencekravLinje) {
    safeAddWrappedText(model.tabtArbejdsfortjeneste.differencekravLinje);
  }

  // TAF-perioder
  renderSubheader('Erstatningsperiode, hvor der beregnes tabt arbejdsfortjeneste', lineHeight);

  const tafPerioderLines = model.tabtArbejdsfortjeneste.tafPerioderLinjer;
  const hasTafPerioder = model.tabtArbejdsfortjeneste.harTafPerioder;
  assertModelInvariant(hasTafPerioder === (tafPerioderLines.length > 0), 'harTafPerioder matcher ikke tafPerioderLinjer.');

  if (!hasTafPerioder) {
    safeAddWrappedText('Ingen');
  } else {
    for (const line of tafPerioderLines) {
      safeAddWrappedText(line);
    }
    // Kun hvis der ER TAF-perioder, vis resten af indholdet
    renderSubheader('Indkomst på skadestidspunktet', lineHeight);
    const indkomst = model.tabtArbejdsfortjeneste.indkomstSkadestidspunkt;
    if (indkomst?.beregningsperiodeLabel) {
      safeAddWrappedText(indkomst.beregningsperiodeLabel);
      writer.advanceY(lineHeight);
    }

    if (indkomst?.beregnesUdFra === 'Beregningsperiode') {
      for (const arbejdssted of indkomst.arbejdssteder) {
        writer.writeUnderlinedLabel(arbejdssted.navn, MARGINS.left);

        safeAddLeftRightText('Ferieberettiget indkomst i beregningsperioden', formatMoneyOreWithKr(arbejdssted.breakdown.ferieberetOre), writer.getTextWidth('000.000.000,00'),
          { rightFontStyle: 'normal' }
        );

        safeAddLeftRightText(arbejdssted.fpLabel, formatMoneyOreWithKr(arbejdssted.breakdown.fpFvShSoOre), writer.getTextWidth('000.000.000,00'),
          { rightFontStyle: 'normal' }
        );

        safeAddLeftRightText(arbejdssted.pensionLabel, formatMoneyOreWithKr(arbejdssted.breakdown.pensionOre), writer.getTextWidth('000.000.000,00'),
          { rightFontStyle: 'normal' }
        );

        safeAddLeftRightText('Arbejdsgivers ATP-bidrag og anden indkomst uden tillæg', formatMoneyOreWithKr(arbejdssted.breakdown.atpOre), writer.getTextWidth('000.000.000,00'),
          { rightFontStyle: 'normal' }
        );

        safeAddLeftRightText('I alt:', formatMoneyOreWithKr(arbejdssted.breakdown.samletOre), writer.getTextWidth('000.000.000,00'),
          { rightFontStyle: 'normal', lineAboveRightWidth: 33.125, lineAboveRightOffset: 4 }
        );
        writer.advanceY(lineHeight);
      }

      if (indkomst.totalBreakdown) {
        const arbejdsgiverTotals = indkomst.arbejdssteder.map((arbejdssted) =>
          formatCurrencyFromOre(arbejdssted.breakdown.samletOre)
        );
        if (indkomst.beregningsenhed === TAF_BEREGNES_SOM.ARBEJDSDAGE && indkomst.arbejdsdage) {
          const arbejdsdageText = indkomst.arbejdsdage.toLocaleString('da-DK');
          const basisText = arbejdsgiverTotals.length > 1
            ? `Dagsløn: (${arbejdsgiverTotals.join(' + ')}${NBSP}kr.) / ${arbejdsdageText} arbejdsdage =`
            : `Dagsløn: ${formatMoneyOreWithKr(indkomst.totalBreakdown.samletOre)} / ${arbejdsdageText} arbejdsdage =`;
          safeAddLeftRightText(
            basisText,
            renderMoneyWithKr(indkomst.dagsloen),
            writer.getTextWidth('000.000.000,00'),
            { rightFontStyle: 'normal' }
          );
        } else if (indkomst.maaneder) {
          const maanederText = formatMaanederTrimmed(indkomst.maaneder);
          const basisText = arbejdsgiverTotals.length > 1
            ? `Månedsløn (${arbejdsgiverTotals.join(' + ')}${NBSP}kr.) / ${maanederText} måneder =`
            : `Månedsløn: ${formatMoneyOreWithKr(indkomst.totalBreakdown.samletOre)} / ${maanederText} måneder =`;
          safeAddLeftRightText(
            basisText,
            renderMoneyWithKr(indkomst.maanedsloen),
            writer.getTextWidth('000.000.000,00'),
            { rightFontStyle: 'normal' }
          );
        }
      }
    } else if (indkomst?.beregnesUdFra === 'Angivet månedsløn') {
      if (indkomst.skadesdato) {
        const skadesdatoFormateret = formatDateShort(indkomst.skadesdato);
        if (skadesdatoFormateret) {
          const beloebDisplay = renderMoneyWithKr(indkomst.maanedsloen);

          let leftText = '';
          if (indkomst.loenBaseretPaa) {
            leftText = `Månedslønnen er på baggrund af ${indkomst.loenBaseretPaa} fastsat per ${skadesdatoFormateret} til`;
          } else {
            leftText = `Månedslønnen er fastsat per ${skadesdatoFormateret} til`;
          }

          safeAddLeftRightText(leftText, beloebDisplay, writer.getTextWidth('000.000.000,00'), { rightFontStyle: 'normal' });
        }
      }
    } else if (indkomst?.beregnesUdFra === 'Angivet dagsløn') {
      if (indkomst.skadesdato) {
        const skadesdatoFormateret = formatDateShort(indkomst.skadesdato);
        if (skadesdatoFormateret) {
          const beloebDisplay = renderMoneyWithKr(indkomst.dagsloen);

          let leftText = '';
          if (indkomst.loenBaseretPaa) {
            leftText = `Dagslønnen er på baggrund af ${indkomst.loenBaseretPaa} fastsat per ${skadesdatoFormateret} til`;
          } else {
            leftText = `Dagslønnen er fastsat per ${skadesdatoFormateret} til`;
          }

          safeAddLeftRightText(leftText, beloebDisplay, writer.getTextWidth('000.000.000,00'), { rightFontStyle: 'bold' });
        }
      }
    }

    // Indkomst, hvis skaden ikke var indtrådt
    const loenudvikling = model.tabtArbejdsfortjeneste.loenudvikling;
    const indkomstHvisSkadeIkkeIndtraadtBeskrivelse = loenudvikling?.loenudviklingLabel === 'Ingen'
      ? 'Opgøres på baggrund af lønnen på skadesdatoen.'
      : 'Opgøres som lønnen på skadesdatoen tillagt efterfølgende lønstigninger.';
    renderSubheaderWithWrappedText(
      'Indkomst, hvis skaden ikke var indtrådt',
      indkomstHvisSkadeIkkeIndtraadtBeskrivelse
    );

    if (loenudvikling) {
      if (loenudvikling.loenudviklingLabel !== 'Ingen') {
        safeAddWrappedText(`Lønudvikling beregnes ud fra ${loenudvikling.loenudviklingLabel}.`);
        writer.advanceY(lineHeight);
      }

      if (loenudvikling.loenudviklingTotal.status !== 'ok') {
        safeAddWrappedText('Lønudvikling kan ikke beregnes for den valgte opsætning.');
      } else {
        const rightMaxWidth = writer.getTextWidth('000.000.000,00');
        for (const segment of loenudvikling.beregnedeSegmenter) {
          const roundedDeltaPct = Math.round(segment.deltaPct * 100) / 100;
          const factorText = Math.abs(roundedDeltaPct) < 0.00001
            ? ''
            : ` x (100 % ${roundedDeltaPct >= 0 ? '+' : '-'} ${formatPercentDelta(roundedDeltaPct)} %)`;
          const fraDisplay = formatDateShort(segment.fra);
          const tilDisplay = formatDateShort(segment.til);
          let leftText = '';
          if (segment.kind === 'arbejdsdage') {
            const arbejdsdageText = segment.arbejdsdage.toLocaleString('da-DK');
            const dagsloenText = formatCurrencyFromOre(segment.dagsloenOre);
            leftText = `${fraDisplay} - ${tilDisplay}: ${arbejdsdageText} arbejdsdage á ${dagsloenText}${NBSP}kr.${factorText} =`;
          } else {
            const roundedMaaneder = Math.round(segment.maaneder * 10000) / 10000;
            const maanederText = formatMaanederTrimmed(roundedMaaneder);
            const maanedsloenText = formatCurrencyFromOre(segment.maanedsloenOre);
            leftText = `${fraDisplay} - ${tilDisplay}: ${maanederText} måneder á ${maanedsloenText}${NBSP}kr.${factorText} =`;
          }
          const rightText = formatMoneyOreWithKr(segment.amountOre);
          safeAddLeftRightText(leftText, rightText, rightMaxWidth, { rightFontStyle: 'normal' });
        }

        if (loenudvikling.beregnedeSegmenter.length > 1) {
          safeAddLeftRightText(
            'I alt',
            formatMoneyOreWithKr(loenudvikling.loenudviklingTotal.value),
            rightMaxWidth,
            { rightFontStyle: 'normal', lineAboveRightWidth: 33.125, lineAboveRightOffset: 4 }
          );
        }
      }
    }

    // Indtægter i erstatningsperioden (TAF-perioden)
    const tafIndtaegter = model.tabtArbejdsfortjeneste.tafIndtaegter;
    if (tafIndtaegter) {
      assertModelInvariant(
        tafIndtaegter.total.status === 'ok' || tafIndtaegter.total.status === 'not_calculable',
        'tafIndtaegter.total har en uventet status.'
      );
      renderSubheader('Indtægter i erstatningsperioden', lineHeight);
      const rightMaxWidth = writer.getTextWidth('000.000.000,00');
      for (const entry of tafIndtaegter.entries) {
        safeAddLeftRightText(entry.label, formatMoneyOreWithKr(entry.amountOre), rightMaxWidth, { rightFontStyle: 'normal' }
        );
      }

      if (tafIndtaegter.entries.length === 0) {
        safeAddWrappedText('Ingen');
      } else if (tafIndtaegter.entries.length > 1 && tafIndtaegter.total.status === 'ok') {
        safeAddLeftRightText('I alt', formatMoneyOreWithKr(tafIndtaegter.total.value), rightMaxWidth, { rightFontStyle: 'normal', lineAboveRightWidth: 33.125, lineAboveRightOffset: 4 }
        );
      } else if (tafIndtaegter.entries.length > 1) {
        safeAddLeftRightText('I alt', '—', rightMaxWidth, { rightFontStyle: 'normal', lineAboveRightWidth: 33.125, lineAboveRightOffset: 4 }
        );
      }
    }

    const loenudviklingTotal = model.tabtArbejdsfortjeneste.loenudvikling?.loenudviklingTotal ?? null;
    const tafTotal = model.tabtArbejdsfortjeneste.tafIndtaegter?.total ?? null;
    if (loenudviklingTotal && tafTotal && loenudviklingTotal.status === 'ok' && tafTotal.status === 'ok') {
      renderSubheader('Beregnet krav på tabt arbejdsfortjeneste', lineHeight);

      const rightMaxWidth = writer.getTextWidth('000.000.000,00');
      const leftText = `${formatMoneyOreWithKr(loenudviklingTotal.value)} - ${formatMoneyOreWithKr(tafTotal.value)} =`;
      const rightText = formatMoneyOreWithKr(model.tabtArbejdsfortjeneste.tabtArbejdsfortjenesteOre);
      safeAddLeftRightText(leftText, rightText, rightMaxWidth, { rightFontStyle: 'bold' }
      );
    } else if (model.tabtArbejdsfortjeneste.harTafPerioder) {
      renderSubheader('Beregnet krav på tabt arbejdsfortjeneste', lineHeight);
      const rightMaxWidth = writer.getTextWidth('000.000.000,00');
      safeAddLeftRightText('Beregnet krav på tabt arbejdsfortjeneste', '—', rightMaxWidth, { rightFontStyle: 'bold' }
      );
    }
  }

  // Øvrige krav (chunked atomic blocks)
  const kravEntries = model.oevrigeKrav.entries;
  const kravIndentX = MARGINS.left;
  const kravPageWidth = writer.getPageWidth();
  const kravRightX = kravPageWidth - MARGINS.right;
  const kravTotalMaxWidth = writer.getTextWidth('000.000.000,00');
  const kravRightMaxWidth = kravTotalMaxWidth;
  const kravLeftMaxWidth = Math.max(30, kravRightX - kravTotalMaxWidth - kravIndentX - 5);
  const kravHeaderHeight = lineHeight * 4;

  if (kravEntries.length === 0) {
    renderSectionHeader('Øvrige krav', lineHeight);
    safeAddWrappedText('Ingen');
  } else {
    renderAtomicTableChunks({
      rows: kravEntries,
      estimateRowHeight: lineHeight,
      headerHeight: kravHeaderHeight,
      renderHeader: () => {
        renderSectionHeader('Øvrige krav', lineHeight);
      },
      renderRow: (entry) => {
        const udgiftText = entry.udgiftTil !== '' ? entry.udgiftTil : '-';
        const leftLabel = entry.dateText !== '' ? `${entry.dateText}: ${udgiftText}` : udgiftText;
        const amountText = formatMoneyOreWithKr(entry.amountOre);
        const leftText = writer.fitTextToWidth(
          ensureNonBreakingKr(leftLabel),
          kravLeftMaxWidth
        );
        writer.writeLeftRightTextSingleLine(leftText, amountText, { rightFontStyle: kravEntries.length === 1 ? 'bold' : 'normal' }
        );
      },
    });

    if (kravEntries.length > 1) {
      writer.addSpacer(lineHeight * 2);
      safeAddLeftRightText('I alt', formatMoneyOreWithKr(model.oevrigeKrav.totalOre), kravRightMaxWidth, { rightFontStyle: 'bold', lineAboveRightWidth: 33.125, lineAboveRightOffset: 4 }
      );
    }
  }
  renderSectionHeader('Samlet erstatningskrav', lineHeight);

  const periodeFraKort = model.periode?.fra ? formatDateShort(model.periode.fra) : '';
  const periodeTilKort = model.periode?.til ? formatDateShort(model.periode.til) : '';
  const periodeText =
    periodeFraKort && periodeTilKort
      ? `Det samlede krav for perioden ${periodeFraKort} - ${periodeTilKort} udgør:`
      : 'Det samlede krav udgør:';
  safeAddWrappedText(periodeText);
  writer.advanceY(lineHeight);

  const summaryRightMaxWidth = writer.getTextWidth('000.000.000,00');
  safeAddLeftRightText('Svie- og smertegodtgørelse', formatMoneyOreWithKr(model.samlet.svieSmerteOre), summaryRightMaxWidth, { rightFontStyle: 'normal' }
  );
  safeAddLeftRightText('Tabt arbejdsfortjeneste', formatMoneyOreWithKr(model.samlet.tabtArbejdsfortjenesteOre), summaryRightMaxWidth, { rightFontStyle: 'normal' }
  );
  safeAddLeftRightText('Øvrige krav', formatMoneyOreWithKr(model.samlet.oevrigeKravOre), summaryRightMaxWidth, { rightFontStyle: 'normal' }
  );
  writer.setFont('helvetica', 'bold');
  safeAddLeftRightText('Erstatningskrav i alt', formatMoneyOreWithKr(model.samlet.totalOre), summaryRightMaxWidth, { rightFontStyle: 'bold', lineAboveRightWidth: 33.125, lineAboveRightOffset: 4 }
  );
  writer.setFont('helvetica', 'normal');
  // TODO: Tilføj resten af PDF-indholdet baseret på selectedElements
  const saerligeKommentarer = model.saerligeKommentarer;
  if (saerligeKommentarer) {
    renderSectionHeader('Særlige bemærkninger', lineHeight);
    safeAddWrappedText(saerligeKommentarer);
  }
  writer.advanceY(doubleLineHeight);
  if (afsluttesMed === 'Bekræftet godkendt') {
    safeAddWrappedText('Opgørelsen er gennemgået af skadelidte, som har bekræftet, at oplysningerne er korrekte og retvisende, samt at erstatningskravene er opgjort i overensstemmelse med samtlige relevant oplysninger, som skadelidte er bekendt med.');
  } else {
    safeAddWrappedText('Opgørelsen er gennemgået af skadelidte, som ved sin underskrift nedenfor bekræfter, at oplysningerne er korrekte og retvisende, samt at erstatningskravene er opgjort i overensstemmelse med samtlige relevant oplysninger, som skadelidte er bekendt med.');
    writer.advanceY(lineHeight * 2);
    const skadelidteNavn = (stamdataValues.skadelidte ?? '').trim() || '*skadelidtes navn*';
    const dateX = MARGINS.left;
    const dateLine = '____ / ____ - ____________';
    const sigX = MARGINS.left + 90;
    const sigLine = '________________________________________';
    writer.writeSignatureBlock(dateLine, sigLine, dateX, sigX, skadelidteNavn);
  }

  // Tilføj footer med versionsnummer
  writer.addFooter();

  // Download PDF
  writer.save(`${titel}.pdf`);
};





