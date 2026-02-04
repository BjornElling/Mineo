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

const addWrappedText = (
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  lineHeight: number,
  maxWidth: number
): number => {
  const safeText = ensureNonBreakingKr(text);
  const lines = doc.splitTextToSize(safeText, maxWidth);
  doc.text(lines, x, y);
  return y + lineHeight * lines.length;
};

const addLeftRightText = (
  doc: jsPDF,
  leftText: string,
  rightText: string,
  x: number,
  y: number,
  lineHeight: number,
  rightPadding: number,
  maxRightWidth: number,
  options?: Readonly<{
    rightFontStyle?: 'normal' | 'bold';
    lineAboveRightWidth?: number;
    lineAboveRightOffset?: number;
    leftNoWrap?: boolean;
  }>
): number => {
  const pageWidth = doc.internal.pageSize.width;
  const rightWidth = Math.min(maxRightWidth, doc.getTextWidth(rightText));
  const wrapPadding = doc.getTextWidth('000000');
  const leftMaxWidth = Math.max(30, pageWidth - x - rightPadding - rightWidth - 5 - wrapPadding);
  const leftLines = options?.leftNoWrap ? [ensureNonBreakingKr(leftText)] : doc.splitTextToSize(ensureNonBreakingKr(leftText), leftMaxWidth);
  doc.text(leftLines, x, y);
  const rightY = y + lineHeight * (leftLines.length - 1);
  const rightFontStyle = options?.rightFontStyle ?? 'bold';
  doc.setFont('helvetica', rightFontStyle);
  doc.text(rightText, pageWidth - rightPadding, rightY, { align: 'right' });
  if (options?.lineAboveRightWidth) {
    const lineWidth = options.lineAboveRightWidth;
    const lineEnd = pageWidth - rightPadding;
    const lineStart = lineEnd - lineWidth;
    const offset = options.lineAboveRightOffset ?? 2;
    doc.setLineWidth(0.2);
    doc.line(lineStart, rightY - offset, lineEnd, rightY - offset);
  }
  doc.setFont('helvetica', 'normal');
  return y + lineHeight * leftLines.length;
};

const addLeftRightTextSingleLine = (
  doc: jsPDF,
  leftText: string,
  rightText: string,
  x: number,
  y: number,
  lineHeight: number,
  rightPadding: number,
  options?: Readonly<{
    rightFontStyle?: 'normal' | 'bold';
    lineAboveRightWidth?: number;
    lineAboveRightOffset?: number;
  }>
): number => {
  const pageWidth = doc.internal.pageSize.width;
  doc.text(ensureNonBreakingKr(leftText), x, y);
  const rightFontStyle = options?.rightFontStyle ?? 'bold';
  doc.setFont('helvetica', rightFontStyle);
  doc.text(rightText, pageWidth - rightPadding, y, { align: 'right' });
  if (options?.lineAboveRightWidth) {
    const lineWidth = options.lineAboveRightWidth;
    const lineEnd = pageWidth - rightPadding;
    const lineStart = lineEnd - lineWidth;
    const offset = options.lineAboveRightOffset ?? 2;
    doc.setLineWidth(0.2);
    doc.line(lineStart, y - offset, lineEnd, y - offset);
  }
  doc.setFont('helvetica', 'normal');
  return y + lineHeight;
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

const addSectionHeader = (
  doc: jsPDF,
  text: string,
  currentY: number,
  lineHeight: number,
  doubleLineHeight: number,
  maxWidth: number
): number => {
  let nextY = currentY + doubleLineHeight;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(FONT_SIZES.header);
  nextY = addWrappedText(doc, text, MARGINS.left, nextY, lineHeight, maxWidth);
  nextY += lineHeight;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(FONT_SIZES.normal);
  return nextY;
};

const addSubheader = (
  doc: jsPDF,
  text: string,
  currentY: number,
  lineHeight: number,
  maxWidth: number,
  options?: Readonly<{ addTopSpacing?: boolean }>
): number => {
  const addTopSpacing = options?.addTopSpacing ?? true;
  let nextY = addTopSpacing ? currentY + lineHeight : currentY;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(FONT_SIZES.normal);
  nextY = addWrappedText(doc, text, MARGINS.left, nextY, lineHeight, maxWidth);
  doc.setFont('helvetica', 'normal');
  return nextY;
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

const formatPercentFixed2 = (value: number): string => {
  if (!Number.isFinite(value)) return '-';
  return `${value.toLocaleString('da-DK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %`;
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
  _selectedElements: SelectedElements,
  options: ErstatningsopgoerelsePdfOptions = {}
) => {
  const { visBrevhoved = false } = options;
  const afsluttesMed = options.erstatningsopgoerelseAfsluttesMed;
  const lineHeight = 5;
  const doubleLineHeight = lineHeight * 2;
  const model = buildErstatningsopgoerelsePdfModel(stamdataValues, eoValues, { dagsDatoISO: TODAY });

  // Opret nyt PDF-dokument (A4, portrait)
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });
  doc.setDisplayMode('100%');

  const titel = model.titel;

  // Dokumentets metadata
  doc.setProperties({
    title: titel,
    subject: 'Erstatningsberegning',
    author: 'MINEO',
    creator: 'MINEO',
  });

  let currentY = MARGINS.top;
  const pageHeight = doc.internal.pageSize.height;
  const contentBottom = pageHeight - MARGINS.bottom;
  const pageContentHeight = contentBottom - MARGINS.top;

  const ensureSpace = (height: number) => {
    if (currentY + height > contentBottom) {
      doc.addPage();
      currentY = MARGINS.top;
    }
  };

  const renderAtomicBlock = (estimatedHeight: number, render: () => void) => {
    ensureSpace(estimatedHeight);
    render();
  };

  const renderSectionHeader = (text: string, nextLineHeight: number) => {
    const estimatedHeaderHeight = doubleLineHeight + lineHeight;
    ensureSpace(estimatedHeaderHeight + nextLineHeight);
    currentY = addSectionHeader(doc, text, currentY, lineHeight, doubleLineHeight, fullWidth);
  };

  const renderSubheader = (text: string, nextLineHeight: number, options?: Readonly<{ addTopSpacing?: boolean }>) => {
    const addTopSpacing = options?.addTopSpacing ?? true;
    const headerHeight = measureWrappedTextHeight(text) + (addTopSpacing ? lineHeight : 0);
    ensureSpace(headerHeight + nextLineHeight);
    currentY = addSubheader(doc, text, currentY, lineHeight, fullWidth, options);
  };

  const safeAddWrappedText = (text: string) => {
    const lines = doc.splitTextToSize(ensureNonBreakingKr(text), fullWidth);
    const estimatedHeight = lineHeight * lines.length;
    ensureSpace(estimatedHeight);
    currentY = addWrappedText(doc, text, MARGINS.left, currentY, lineHeight, fullWidth);
  };

  const measureWrappedTextHeight = (text: string) => {
    const lines = doc.splitTextToSize(ensureNonBreakingKr(text), fullWidth);
    return lineHeight * lines.length;
  };

  const renderSubheaderWithWrappedText = (subheaderText: string, bodyText: string) => {
    const bodyHeight = measureWrappedTextHeight(bodyText);
    renderSubheader(subheaderText, bodyHeight);
    safeAddWrappedText(bodyText);
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
    const pageWidth = doc.internal.pageSize.width;
    const rightWidth = Math.min(rightMaxWidth, doc.getTextWidth(rightText));
    const wrapPadding = doc.getTextWidth('000000');
    const leftMaxWidth = Math.max(30, pageWidth - MARGINS.left - MARGINS.right - rightWidth - 5 - wrapPadding);
    const leftLines = options?.leftNoWrap
      ? [ensureNonBreakingKr(leftText)]
      : doc.splitTextToSize(ensureNonBreakingKr(leftText), leftMaxWidth);
    const estimatedHeight = lineHeight * leftLines.length;
    ensureSpace(estimatedHeight);
    currentY = addLeftRightText(
      doc,
      leftText,
      rightText,
      MARGINS.left,
      currentY,
      lineHeight,
      MARGINS.right,
      rightMaxWidth,
      options
    );
  };

  const renderAtomicTableChunks = <T,>(params: Readonly<{
    rows: readonly T[];
    renderHeader: () => void;
    renderRow: (row: T) => void;
    estimateRowHeight: number;
    maxContentHeight: number;
    headerHeight: number;
  }>) => {
    const { rows, renderHeader, renderRow, estimateRowHeight, maxContentHeight, headerHeight } = params;
    const rowsPerChunk = Math.max(1, Math.floor((maxContentHeight - headerHeight) / estimateRowHeight));
    for (let i = 0; i < rows.length; i += rowsPerChunk) {
      const chunk = rows.slice(i, i + rowsPerChunk);
      const estimatedChunkHeight = headerHeight + estimateRowHeight * chunk.length;
      renderAtomicBlock(estimatedChunkHeight, () => {
        renderHeader();
        chunk.forEach((row) => renderRow(row));
      });
    }
  };

  // Tilføj brevhoved hvis aktiveret
  if (visBrevhoved && model.brevhoved) {
    const brevhovedData: BrevhovedData = {
      journalnr: model.brevhoved.journalnr,
      advokat: model.brevhoved.advokat,
      sagsbehandler: model.brevhoved.sagsbehandler,
      // UND TAGELSE: EOberegning-tab bruger "Opgørelse lavet den" i stedet for dags dato.
      dagsDatoISO: model.brevhoved.dagsDatoISO,
    };
    currentY = addBrevhoved(doc, brevhovedData);
  }

  // Tilføj titel (fed skrift)
  doc.setFontSize(FONT_SIZES.title);
  doc.setFont('helvetica', 'bold');
  const fullWidth = doc.internal.pageSize.width - MARGINS.left - MARGINS.right;
  currentY = addWrappedText(doc, titel, MARGINS.left, currentY, lineHeight, fullWidth);

  // Tilføj erstatningsperiode-datoer direkte under titel
  doc.setFontSize(FONT_SIZES.normal);
  doc.setFont('helvetica', 'normal');
  if (model.periodeDisplay) {
    currentY = addWrappedText(
      doc,
      model.periodeDisplay,
      MARGINS.left,
      currentY,
      lineHeight,
      fullWidth
    );
    currentY += lineHeight;
  }

  // Tilføj skadelidtes navn (fed skrift)
  doc.setFont('helvetica', 'bold');
  if (model.skadelidteNavn) {
    currentY = addWrappedText(doc, model.skadelidteNavn, MARGINS.left, currentY, lineHeight, fullWidth);
  }

  // Tilføj skadestype og skadesdato (normal skrift)
  doc.setFont('helvetica', 'normal');
  if (model.skadestypeLinje) {
    currentY = addWrappedText(doc, model.skadestypeLinje, MARGINS.left, currentY, lineHeight, fullWidth);
    currentY += lineHeight;
  }

  // ============================================================================
  // SVIE- OG SMERTEGODTGØRELSE SEKTION
  // ============================================================================

  renderSectionHeader('Svie- og smertegodtgørelse', lineHeight);

  renderSubheader('Status', lineHeight, { addTopSpacing: false });

  // Normal skrift for resten
  doc.setFont('helvetica', 'normal');

    for (const line of model.svieSmerte.statusLinjer) {
      currentY = addWrappedText(doc, line, MARGINS.left, currentY, lineHeight, fullWidth);
    }

  renderSubheader(model.svieSmerte.periodeHeading, lineHeight);
  if (!model.svieSmerte.beregnes) {
    currentY = addWrappedText(doc, 'Ingen', MARGINS.left, currentY, lineHeight, fullWidth);
  } else if (!model.svieSmerte.harPerioder) {
    currentY = addWrappedText(doc, 'Ingen', MARGINS.left, currentY, lineHeight, fullWidth);
  } else {
    for (const line of model.svieSmerte.periodeLinjer) {
      currentY = addWrappedText(doc, line, MARGINS.left, currentY, lineHeight, fullWidth);
    }

    renderSubheader('Beregningsgrundlag', lineHeight);
    const satserAar = model.svieSmerte.satserAar !== null ? String(model.svieSmerte.satserAar) : '-';
    currentY = addWrappedText(
      doc,
      `Beregningen af godtgørelse foretages ud fra satserne i år ${satserAar}.`,
      MARGINS.left,
      currentY,
      lineHeight,
      fullWidth
    );

    const perDagDisplayWithKr = renderMoneyWithKr(model.svieSmerte.satserPerDag);
    const maxDisplayWithKr = renderMoneyWithKr(model.svieSmerte.satserMax);
    currentY = addWrappedText(
      doc,
      `Taksten udgør ${perDagDisplayWithKr} pr. sygedag, dog højst ${maxDisplayWithKr}`,
      MARGINS.left,
      currentY,
      lineHeight,
      fullWidth
    );

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
        currentY = addWrappedText(doc, tekst, MARGINS.left, currentY, lineHeight, fullWidth);
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

    const pageWidth = doc.internal.pageSize.width;
    const beloebDisplay = formatMoneyOreWithKr(model.svieSmerte.totalOre);
    const beloebWidth = doc.getTextWidth(beloebDisplay);
    const wrapPadding = doc.getTextWidth('0000000000');
    const leftMaxWidth = Math.max(30, pageWidth - MARGINS.left - MARGINS.right - beloebWidth - 5 - wrapPadding);
    const leftLines = doc.splitTextToSize(ensureNonBreakingKr(lineLeft), leftMaxWidth);
    doc.text(leftLines, MARGINS.left, currentY);
    const beloebY = currentY + lineHeight * (leftLines.length - 1);
    doc.setFont('helvetica', 'bold');
    doc.text(beloebDisplay, pageWidth - MARGINS.right, beloebY, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    currentY += lineHeight * leftLines.length;
  }
  // ============================================================================
  // TABT ARBEJDSFORTJENESTE SEKTION
  // ============================================================================

  renderSectionHeader('Tabt arbejdsfortjeneste', lineHeight);

  renderSubheader('Status', lineHeight, { addTopSpacing: false });

  // Normal skrift for resten
  doc.setFont('helvetica', 'normal');

    for (const line of model.tabtArbejdsfortjeneste.statusLinjer) {
      currentY = addWrappedText(doc, line, MARGINS.left, currentY, lineHeight, fullWidth);
    }

    for (const line of model.tabtArbejdsfortjeneste.eetLinjer) {
      currentY = addWrappedText(doc, line, MARGINS.left, currentY, lineHeight, fullWidth);
    }

  if (model.tabtArbejdsfortjeneste.differencekravLinje) {
    currentY = addWrappedText(
      doc,
      model.tabtArbejdsfortjeneste.differencekravLinje,
      MARGINS.left,
      currentY,
      lineHeight,
      fullWidth
    );
  }

  // TAF-perioder
  renderSubheader('Erstatningsperiode, hvor der beregnes tabt arbejdsfortjeneste', lineHeight);

  const tafPerioderLines = model.tabtArbejdsfortjeneste.tafPerioderLinjer;
  const hasTafPerioder = model.tabtArbejdsfortjeneste.harTafPerioder;

  if (!hasTafPerioder) {
    currentY = addWrappedText(doc, 'Ingen', MARGINS.left, currentY, lineHeight, fullWidth);
  } else {
    for (const line of tafPerioderLines) {
      currentY = addWrappedText(doc, line, MARGINS.left, currentY, lineHeight, fullWidth);
    }
    // Kun hvis der ER TAF-perioder, vis resten af indholdet
    renderSubheader('Indkomst på skadestidspunktet', lineHeight);
    const indkomst = model.tabtArbejdsfortjeneste.indkomstSkadestidspunkt;
    if (indkomst?.beregningsperiodeLabel) {
      currentY = addWrappedText(doc, indkomst.beregningsperiodeLabel, MARGINS.left, currentY, lineHeight, fullWidth);
      currentY += lineHeight;
    }

    if (indkomst?.beregnesUdFra === 'Beregningsperiode') {
      for (const arbejdssted of indkomst.arbejdssteder) {
        doc.text(arbejdssted.navn, MARGINS.left, currentY);
        const nameWidth = doc.getTextWidth(arbejdssted.navn);
        doc.setLineWidth(0.2);
        doc.line(MARGINS.left, currentY + 1, MARGINS.left + nameWidth, currentY + 1);
        currentY += lineHeight;

        currentY = addLeftRightText(
          doc,
          'Ferieberettiget indkomst i beregningsperioden',
          formatMoneyOreWithKr(arbejdssted.breakdown.ferieberetOre),
          MARGINS.left,
          currentY,
          lineHeight,
          MARGINS.right,
          doc.getTextWidth('000.000.000,00'),
          { rightFontStyle: 'normal' }
        );

        currentY = addLeftRightText(
          doc,
          arbejdssted.fpLabel,
          formatMoneyOreWithKr(arbejdssted.breakdown.fpFvShSoOre),
          MARGINS.left,
          currentY,
          lineHeight,
          MARGINS.right,
          doc.getTextWidth('000.000.000,00'),
          { rightFontStyle: 'normal' }
        );

        currentY = addLeftRightText(
          doc,
          arbejdssted.pensionLabel,
          formatMoneyOreWithKr(arbejdssted.breakdown.pensionOre),
          MARGINS.left,
          currentY,
          lineHeight,
          MARGINS.right,
          doc.getTextWidth('000.000.000,00'),
          { rightFontStyle: 'normal' }
        );

        currentY = addLeftRightText(
          doc,
          'Arbejdsgivers ATP-bidrag og anden indkomst uden tillæg',
          formatMoneyOreWithKr(arbejdssted.breakdown.atpOre),
          MARGINS.left,
          currentY,
          lineHeight,
          MARGINS.right,
          doc.getTextWidth('000.000.000,00'),
          { rightFontStyle: 'normal' }
        );

        currentY = addLeftRightText(
          doc,
          'I alt:',
          formatMoneyOreWithKr(arbejdssted.breakdown.samletOre),
          MARGINS.left,
          currentY,
          lineHeight,
          MARGINS.right,
          doc.getTextWidth('000.000.000,00'),
          { rightFontStyle: 'normal', lineAboveRightWidth: 33.125, lineAboveRightOffset: 4 }
        );
        currentY += lineHeight;
      }

      if (indkomst.totalBreakdown && indkomst.maaneder) {
        const maanederText = formatMaanederTrimmed(indkomst.maaneder);
        const arbejdsgiverTotals = indkomst.arbejdssteder.map((arbejdssted) =>
          formatCurrencyFromOre(arbejdssted.breakdown.samletOre)
        );
        const basisText = arbejdsgiverTotals.length > 1
          ? `Månedsløn (${arbejdsgiverTotals.join(' + ')}${NBSP}kr.) / ${maanederText} måneder =`
          : `Månedsløn: ${formatMoneyOreWithKr(indkomst.totalBreakdown.samletOre)} / ${maanederText} måneder =`;
        safeAddLeftRightText(
          basisText,
          renderMoneyWithKr(indkomst.maanedsloen),
          doc.getTextWidth('000.000.000,00'),
          { rightFontStyle: 'normal' }
        );
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

          const pageWidth = doc.internal.pageSize.width;
          const beloebWidth = doc.getTextWidth(beloebDisplay);
          const wrapPadding = doc.getTextWidth('0000000000');
          const leftMaxWidth = Math.max(30, pageWidth - MARGINS.left - MARGINS.right - beloebWidth - 5 - wrapPadding);
          const leftLines = doc.splitTextToSize(ensureNonBreakingKr(leftText), leftMaxWidth);
          doc.text(leftLines, MARGINS.left, currentY);
          const beloebY = currentY + lineHeight * (leftLines.length - 1);
          doc.setFont('helvetica', 'bold');
          doc.text(beloebDisplay, pageWidth - MARGINS.right, beloebY, { align: 'right' });
          doc.setFont('helvetica', 'normal');
          currentY += lineHeight * leftLines.length;
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

          const pageWidth = doc.internal.pageSize.width;
          const beloebWidth = doc.getTextWidth(beloebDisplay);
          const wrapPadding = doc.getTextWidth('0000000000');
          const leftMaxWidth = Math.max(30, pageWidth - MARGINS.left - MARGINS.right - beloebWidth - 5 - wrapPadding);
          const leftLines = doc.splitTextToSize(ensureNonBreakingKr(leftText), leftMaxWidth);
          doc.text(leftLines, MARGINS.left, currentY);
          const beloebY = currentY + lineHeight * (leftLines.length - 1);
          doc.setFont('helvetica', 'bold');
          doc.text(beloebDisplay, pageWidth - MARGINS.right, beloebY, { align: 'right' });
          doc.setFont('helvetica', 'normal');
          currentY += lineHeight * leftLines.length;
        }
      }
    }

    // Indkomst, hvis skaden ikke var indtrådt
    renderSubheaderWithWrappedText(
      'Indkomst, hvis skaden ikke var indtrådt',
      'Opgøres som lønnen på skadesdatoen tillagt efterfølgende lønstigninger.'
    );

    const loenudvikling = model.tabtArbejdsfortjeneste.loenudvikling;
    if (loenudvikling) {
      safeAddWrappedText(`Lønudvikling beregnes ud fra ${loenudvikling.loenudviklingLabel}.`);
      currentY += lineHeight;

      if (loenudvikling.loenudviklingTotal.status !== 'ok') {
        safeAddWrappedText('Lønudvikling kan ikke beregnes for den valgte opsætning.');
      } else {
        const rightMaxWidth = doc.getTextWidth('000.000.000,00');
        for (const segment of loenudvikling.beregnedeSegmenter) {
          const roundedDeltaPct = Math.round(segment.deltaPct * 100) / 100;
          const roundedMaaneder = Math.round(segment.maaneder * 10000) / 10000;
          const factorText = Math.abs(roundedDeltaPct) < 0.00001
            ? ''
            : ` x (100 % ${roundedDeltaPct >= 0 ? '+' : '-'} ${formatPercentDelta(roundedDeltaPct)} %)`;
          const maanederText = formatMaanederTrimmed(roundedMaaneder);
          const maanedsloenText = formatCurrencyFromOre(segment.maanedsloenOre);
          const fraDisplay = formatDateShort(segment.fra);
          const tilDisplay = formatDateShort(segment.til);
          const leftText = `${fraDisplay} - ${tilDisplay}: ${maanederText} måneder á ${maanedsloenText}${NBSP}kr.${factorText} =`;
          const rightText = formatMoneyOreWithKr(segment.amountOre);
          safeAddLeftRightText(leftText, rightText, rightMaxWidth, { rightFontStyle: 'normal' });
        }

        safeAddLeftRightText(
          'I alt',
          formatMoneyOreWithKr(loenudvikling.loenudviklingTotal.value),
          rightMaxWidth,
          { rightFontStyle: 'normal', lineAboveRightWidth: 33.125, lineAboveRightOffset: 4 }
        );
      }
    }

    // Indtægter i erstatningsperioden (TAF-perioden)
    const tafIndtaegter = model.tabtArbejdsfortjeneste.tafIndtaegter;
    if (tafIndtaegter) {
      renderSubheader('Indtægter i erstatningsperioden', lineHeight);
      const rightMaxWidth = doc.getTextWidth('000.000.000,00');
      for (const entry of tafIndtaegter.entries) {
        currentY = addLeftRightText(
          doc,
          entry.label,
          formatMoneyOreWithKr(entry.amountOre),
          MARGINS.left,
          currentY,
          lineHeight,
          MARGINS.right,
          rightMaxWidth,
          { rightFontStyle: 'normal' }
        );
      }

      if (tafIndtaegter.entries.length === 0) {
        currentY = addWrappedText(doc, 'Ingen', MARGINS.left, currentY, lineHeight, fullWidth);
      } else if (tafIndtaegter.entries.length > 1 && tafIndtaegter.total.status === 'ok') {
        currentY = addLeftRightText(
          doc,
          'I alt',
          formatMoneyOreWithKr(tafIndtaegter.total.value),
          MARGINS.left,
          currentY,
          lineHeight,
          MARGINS.right,
          rightMaxWidth,
          { rightFontStyle: 'normal', lineAboveRightWidth: 33.125, lineAboveRightOffset: 4 }
        );
      } else if (tafIndtaegter.entries.length > 1) {
        currentY = addLeftRightText(
          doc,
          'I alt',
          '—',
          MARGINS.left,
          currentY,
          lineHeight,
          MARGINS.right,
          rightMaxWidth,
          { rightFontStyle: 'normal', lineAboveRightWidth: 33.125, lineAboveRightOffset: 4 }
        );
      }
    }

    const loenudviklingTotal = model.tabtArbejdsfortjeneste.loenudvikling?.loenudviklingTotal ?? null;
    const tafTotal = model.tabtArbejdsfortjeneste.tafIndtaegter?.total ?? null;
    if (loenudviklingTotal && tafTotal && loenudviklingTotal.status === 'ok' && tafTotal.status === 'ok') {
      renderSubheader('Beregnet krav på tabt arbejdsfortjeneste', lineHeight);

      const rightMaxWidth = doc.getTextWidth('000.000.000,00');
      const leftText = `${formatMoneyOreWithKr(loenudviklingTotal.value)} - ${formatMoneyOreWithKr(tafTotal.value)} =`;
      const rightText = formatMoneyOreWithKr(model.tabtArbejdsfortjeneste.tabtArbejdsfortjenesteOre);
      currentY = addLeftRightText(
        doc,
        leftText,
        rightText,
        MARGINS.left,
        currentY,
        lineHeight,
        MARGINS.right,
        rightMaxWidth,
        { rightFontStyle: 'bold' }
      );
    } else if (model.tabtArbejdsfortjeneste.harTafPerioder) {
      renderSubheader('Beregnet krav på tabt arbejdsfortjeneste', lineHeight);
      const rightMaxWidth = doc.getTextWidth('000.000.000,00');
      currentY = addLeftRightText(
        doc,
        'Beregnet krav på tabt arbejdsfortjeneste',
        '—',
        MARGINS.left,
        currentY,
        lineHeight,
        MARGINS.right,
        rightMaxWidth,
        { rightFontStyle: 'bold' }
      );
    }
  }

  // Øvrige krav (chunked atomic blocks)
  const kravEntries = model.oevrigeKrav.entries;
  const kravIndentX = MARGINS.left;
  const kravPageWidth = doc.internal.pageSize.width;
  const kravRightX = kravPageWidth - MARGINS.right;
  const kravTotalMaxWidth = doc.getTextWidth('000.000.000,00');
  const kravRightMaxWidth = kravTotalMaxWidth;
  const kravLeftMaxWidth = Math.max(30, kravRightX - kravTotalMaxWidth - kravIndentX - 5);
  const kravHeaderHeight = lineHeight * 4;

  if (kravEntries.length === 0) {
    renderSectionHeader('Øvrige krav', lineHeight);
    currentY = addWrappedText(doc, 'Ingen', MARGINS.left, currentY, lineHeight, fullWidth);
  } else {
    renderAtomicTableChunks({
      rows: kravEntries,
      estimateRowHeight: lineHeight,
      maxContentHeight: pageContentHeight,
      headerHeight: kravHeaderHeight,
      renderHeader: () => {
        renderSectionHeader('Øvrige krav', lineHeight);
      },
      renderRow: (entry) => {
        const udgiftText = entry.udgiftTil !== '' ? entry.udgiftTil : '-';
        const dateSuffix = entry.dateText !== '' ? `, ${entry.dateText}` : '';
        const amountText = formatMoneyOreWithKr(entry.amountOre);
        const leftText = fitTextToWidth(
          doc,
          ensureNonBreakingKr(`${udgiftText}${dateSuffix}`),
          kravLeftMaxWidth
        );
        currentY = addLeftRightTextSingleLine(
          doc,
          leftText,
          amountText,
          kravIndentX,
          currentY,
          lineHeight,
          MARGINS.right,
          { rightFontStyle: 'normal' }
        );
      },
    });

    if (kravEntries.length > 1) {
      ensureSpace(lineHeight * 2);
      currentY = addLeftRightText(
        doc,
        'I alt',
        formatMoneyOreWithKr(model.oevrigeKrav.totalOre),
        MARGINS.left,
        currentY,
        lineHeight,
        MARGINS.right,
        kravRightMaxWidth,
        { rightFontStyle: 'bold', lineAboveRightWidth: 33.125, lineAboveRightOffset: 4 }
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
  currentY = addWrappedText(doc, periodeText, MARGINS.left, currentY, lineHeight, fullWidth);
  currentY += lineHeight;

  const summaryRightMaxWidth = doc.getTextWidth('000.000.000,00');
  currentY = addLeftRightText(
    doc,
    'Svie- og smertegodtgørelse',
    formatMoneyOreWithKr(model.samlet.svieSmerteOre),
    MARGINS.left,
    currentY,
    lineHeight,
    MARGINS.right,
    summaryRightMaxWidth,
    { rightFontStyle: 'normal' }
  );
  currentY = addLeftRightText(
    doc,
    'Tabt arbejdsfortjeneste',
    formatMoneyOreWithKr(model.samlet.tabtArbejdsfortjenesteOre),
    MARGINS.left,
    currentY,
    lineHeight,
    MARGINS.right,
    summaryRightMaxWidth,
    { rightFontStyle: 'normal' }
  );
  currentY = addLeftRightText(
    doc,
    'Øvrige krav',
    formatMoneyOreWithKr(model.samlet.oevrigeKravOre),
    MARGINS.left,
    currentY,
    lineHeight,
    MARGINS.right,
    summaryRightMaxWidth,
    { rightFontStyle: 'normal' }
  );
  doc.setFont('helvetica', 'bold');
  currentY = addLeftRightText(
    doc,
    'Erstatningskrav i alt',
    formatMoneyOreWithKr(model.samlet.totalOre),
    MARGINS.left,
    currentY,
    lineHeight,
    MARGINS.right,
    summaryRightMaxWidth,
    { rightFontStyle: 'bold', lineAboveRightWidth: 33.125, lineAboveRightOffset: 4 }
  );
  doc.setFont('helvetica', 'normal');
  // TODO: Tilføj resten af PDF-indholdet baseret på selectedElements
  const saerligeKommentarer = model.saerligeKommentarer;
  if (saerligeKommentarer) {
    renderSectionHeader('Særlige bemærkninger', lineHeight);
    currentY = addWrappedText(doc, saerligeKommentarer, MARGINS.left, currentY, lineHeight, fullWidth);
  }
  currentY += doubleLineHeight;
  if (afsluttesMed === 'Bekræftet godkendt') {
    currentY = addWrappedText(
      doc,
      'Opgørelsen er gennemgået af skadelidte, som har bekræftet, at oplysningerne i opgørelsen er korrekte og retvisende, samt at erstatningskravene er opgjort i overensstemmelse med samtlige relevant oplysninger, som skadelidte er bekendt med.',
      MARGINS.left,
      currentY,
      lineHeight,
      fullWidth
    );
  } else {
    currentY = addWrappedText(
      doc,
      'Opgørelsen er gennemgået af skadelidte, som ved sin underskrift nedenfor bekræfter, at oplysningerne i opgørelsen er korrekte og retvisende, samt at erstatningskravene er opgjort i overensstemmelse med samtlige relevant oplysninger, som skadelidte er bekendt med.',
      MARGINS.left,
      currentY,
      lineHeight,
      fullWidth
    );
    currentY += lineHeight * 2;
    const skadelidteNavn = (stamdataValues.skadelidte ?? '').trim() || '*skadelidtes navn*';
    const dateX = MARGINS.left;
    const dateLine = '____ / ____ - ____________';
    const sigX = MARGINS.left + 90;
    const sigLine = '________________________________________';
    doc.text(dateLine, dateX, currentY);
    doc.text(sigLine, sigX, currentY);
    currentY += lineHeight;
    const dateCenterX = dateX + doc.getTextWidth(dateLine) / 2;
    const sigCenterX = sigX + doc.getTextWidth(sigLine) / 2;
    doc.text('Dato', dateCenterX, currentY, { align: 'center' });
    doc.text(skadelidteNavn, sigCenterX, currentY, { align: 'center' });
  }

  // Tilføj footer med versionsnummer
  addFooter(doc);

  // Download PDF
  doc.save(`${titel}.pdf`);
};

