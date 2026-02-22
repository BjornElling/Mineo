/**
 * PDF Hjælpefunktioner
 *
 * Fælles funktioner brugt på tværs af alle PDF-genereringer
 * Eliminerer code duplication mellem PDF-filer
 */

import {
  FONT_SIZES,
  MARGINS,
  PDF_BREVHOVED_FONT_SIZE,
  PDF_BREVHOVED_LINE_HEIGHT,
  PDF_BREVHOVED_START_Y,
  PDF_FINAL_Y_FALLBACK_HEIGHT,
  PDF_FONT_FAMILY,
  PDF_FONT_STYLES,
  PDF_FOOTER_FONT_SIZE,
  PDF_FOOTER_MARGIN_MM,
  PDF_FOOTER_TEXT_COLOR,
  PDF_SECTION_HEADING_GAP,
  SECTION_SPACER,
} from './pdfConfig';
import type { PdfDocumentAdapter } from './pdfDocumentAdapter';
import { VERSION } from '../../config/version';
import type { ISODateString } from '../../types/branded';

import { formatIsoDateLong } from '../dateFormatting';
import { formatAsAmount, formatPercent as formatPercentUtil } from '../formatUtils';

export const PDF_BASE_LINE_HEIGHT_MM = 5;
export const PDF_TITLE_BOTTOM_SPACING_MM = 15;

export const applyNormalTextStyle = (doc: PdfDocumentAdapter): void => {
  doc.setFont(PDF_FONT_FAMILY, PDF_FONT_STYLES.normal);
  doc.setFontSize(FONT_SIZES.normal);
};

export const applyBoldTextStyle = (doc: PdfDocumentAdapter, fontSize: number): void => {
  doc.setFont(PDF_FONT_FAMILY, PDF_FONT_STYLES.bold);
  doc.setFontSize(fontSize);
};

/**
 * Brevhoved-data til PDF-dokumenter
 */
export type BrevhovedData = Readonly<{
  journalnr?: string;
  dagsDatoISO: ISODateString;
  advokat?: string;
  sagsbehandler?: string;
}>;

export const addSectionHeading = (doc: PdfDocumentAdapter, title: string, startY: number): number => {
  applyBoldTextStyle(doc, FONT_SIZES.normal);
  doc.text(title, MARGINS.left, startY);
  applyNormalTextStyle(doc);
  return startY + PDF_BASE_LINE_HEIGHT_MM + PDF_SECTION_HEADING_GAP;
};

export const ensurePdfPageSpace = (
  doc: PdfDocumentAdapter,
  startY: number,
  requiredSpace: number
): number => {
  const contentBottom = doc.getPageHeight() - MARGINS.bottom;
  if (startY + requiredSpace <= contentBottom) return startY;
  doc.addPage();
  return MARGINS.top;
};

export const resolvePdfSectionEndY = (
  finalY: number,
  startY: number,
  options?: Readonly<{ fallbackHeight?: number; spacer?: number }>
): number => {
  const fallbackHeight = options?.fallbackHeight ?? PDF_FINAL_Y_FALLBACK_HEIGHT;
  const spacer = options?.spacer ?? SECTION_SPACER;
  const resolvedY = Number.isFinite(finalY) ? finalY : startY + fallbackHeight;
  return resolvedY + spacer;
};

/**
 * Tilføj footer med versionsnummer på alle sider
 */
export const addFooter = (doc: PdfDocumentAdapter): void => {
  const pageHeight = doc.getPageHeight();
  const pageWidth = doc.getPageWidth();
  const totalPages = doc.getNumberOfPages();

  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont(PDF_FONT_FAMILY, PDF_FONT_STYLES.normal);
    doc.setFontSize(PDF_FOOTER_FONT_SIZE);
    doc.setTextColor(...PDF_FOOTER_TEXT_COLOR);

    const footerText = `Mineo.dk // ${VERSION}`;
    doc.text(footerText, pageWidth - PDF_FOOTER_MARGIN_MM, pageHeight - PDF_FOOTER_MARGIN_MM, { angle: 90 });
  }
};

/**
 * Formaterer beløb til dansk format med tusindtalsseparator
 */
export const formatAmount = (amount: number | null | undefined): string => {
  if (amount === null || amount === undefined || !Number.isFinite(amount)) {
    return '0,00';
  }
  return formatAsAmount(amount, 2);
};

/**
 * Formaterer procent til dansk format
 */
export const formatPercent = (percent: number | null | undefined): string => {
  if (percent === null || percent === undefined || !Number.isFinite(percent)) {
    return '0,00 %';
  }
  return formatPercentUtil(percent);
};

const formatISODateReadable = (isoDate: ISODateString | undefined): string => formatIsoDateLong(isoDate);

/**
 * Tilføj brevhoved til PDF-dokument
 *
 * Indsætter et brevhoved øverst til højre på dokumentet med:
 * - Journalnummer-linje (højre-aligneret) når journalnr findes
 * - Dato-linje (højre-aligneret) altid
 *
 * VIGTIGT: Brevhovedet er et overlay - det påvirker IKKE placeringen af hovedindholdet.
 * Funktionen returnerer altid MARGINS.top uanset om brevhoved indsættes eller ej.
 */
export const addBrevhoved = (doc: PdfDocumentAdapter, data: BrevhovedData): number => {
  const { journalnr, dagsDatoISO, advokat, sagsbehandler } = data;
  const trimmedJournalnr = typeof journalnr === 'string' ? journalnr.trim() : '';
  const resolvedDatoText = formatISODateReadable(dagsDatoISO);
  if (!resolvedDatoText) {
    throw new Error('CRITICAL: Brevhoved kræver en gyldig dagsDatoISO');
  }
  const hasJournalnr = trimmedJournalnr !== '';
  const trimmedAdvokat = typeof advokat === 'string' ? advokat.trim() : '';
  const trimmedSagsbehandler = typeof sagsbehandler === 'string' ? sagsbehandler.trim() : '';
  const hasAdvokat = trimmedAdvokat !== '';
  const hasSagsbehandler = trimmedSagsbehandler !== '';

  const rightX = doc.getPageWidth() - MARGINS.right;
  let currentY = PDF_BREVHOVED_START_Y;

  if (hasJournalnr) {
    const roleSuffix = hasAdvokat && hasSagsbehandler
      ? ` ${trimmedAdvokat}/${trimmedSagsbehandler}`
      : hasAdvokat
        ? ` ${trimmedAdvokat}`
        : hasSagsbehandler
          ? ` ${trimmedSagsbehandler}`
          : '';
    doc.setFont(PDF_FONT_FAMILY, PDF_FONT_STYLES.normal);
    doc.setFontSize(PDF_BREVHOVED_FONT_SIZE);
    doc.text(`J.nr. ${trimmedJournalnr}${roleSuffix}`, rightX, currentY, { align: 'right' });
    currentY += PDF_BREVHOVED_LINE_HEIGHT;
  }

  doc.setFont(PDF_FONT_FAMILY, PDF_FONT_STYLES.normal);
  doc.setFontSize(PDF_BREVHOVED_FONT_SIZE);
  doc.text(resolvedDatoText, rightX, currentY, { align: 'right' });

  // Eksplicit font reset — undgå implicit afhængighed af applyNormalTextStyle
  doc.setFont(PDF_FONT_FAMILY, PDF_FONT_STYLES.normal);
  doc.setFontSize(FONT_SIZES.normal);

  return MARGINS.top;
};
