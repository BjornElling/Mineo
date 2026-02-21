/**
 * PDF Hjælpefunktioner
 *
 * Fælles funktioner brugt på tværs af alle PDF-genereringer
 * Eliminerer code duplication mellem PDF-filer
 */

import jsPDF from 'jspdf';
import {
  FONT_SIZES,
  MARGINS,
  PDF_FINAL_Y_FALLBACK_HEIGHT,
  PDF_FONT_FAMILY,
  PDF_FONT_STYLES,
  PDF_SECTION_HEADING_GAP,
  SECTION_SPACER,
} from './pdfConfig';
import { VERSION } from '../../config/version';
import type { ISODateString } from '../../types/branded';
 
import { formatIsoDateLong } from '../dateFormatting';
import { formatAsAmount, formatPercent as formatPercentUtil } from '../formatUtils';

export const PDF_BASE_LINE_HEIGHT_MM = 5;

export const applyNormalTextStyle = (doc: jsPDF): void => {
  doc.setFontSize(FONT_SIZES.normal);
  doc.setFont(PDF_FONT_FAMILY, PDF_FONT_STYLES.normal);
};

export const applyBoldTextStyle = (doc: jsPDF, fontSize: number): void => {
  doc.setFontSize(fontSize);
  doc.setFont(PDF_FONT_FAMILY, PDF_FONT_STYLES.bold);
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

/**
 * Tilføj titel til dokumentet
 *
 * @param {jsPDF} doc - PDF-dokumentet
 * @param {string} title - Titel-tekst
 * @param {number} startY - Start Y-position
 * @returns {number} Ny Y-position efter titel
 */
export const addTitle = (doc: jsPDF, title: string, startY: number): number => {
  applyBoldTextStyle(doc, FONT_SIZES.title);
  doc.text(title, MARGINS.left, startY);

  return startY + 15;
};

export const addSectionHeading = (doc: jsPDF, title: string, startY: number): number => {
  applyBoldTextStyle(doc, FONT_SIZES.header);
  doc.text(title, MARGINS.left, startY);
  applyNormalTextStyle(doc);
  return startY + PDF_BASE_LINE_HEIGHT_MM + PDF_SECTION_HEADING_GAP;
};

export const ensurePdfPageSpace = (
  doc: jsPDF,
  startY: number,
  requiredSpace: number
): number => {
  const pageHeight = doc.internal.pageSize.height;
  const contentBottom = pageHeight - MARGINS.bottom;
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
 *
 * @param {jsPDF} doc - PDF-dokumentet
 */
export const addFooter = (doc: jsPDF): void => {
  const pageHeight = doc.internal.pageSize.height;
  const pageWidth = doc.internal.pageSize.width;
  const totalPages = typeof doc.getNumberOfPages === 'function' ? doc.getNumberOfPages() : 1;

  // Gennemgå alle sider og tilføj footer
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    doc.setFontSize(6);
    doc.setFont(PDF_FONT_FAMILY, PDF_FONT_STYLES.normal);
    doc.setTextColor(200, 200, 200);

    const footerText = `Mineo.dk // ${VERSION}`;
    const x = pageWidth - 5;
    const y = pageHeight - 5;

    doc.text(footerText, x, y, { angle: 90 });
  }
};

/**
 * Formaterer beløb til dansk format med tusindtalsseparator
 *
 * @param {number} amount - Beløb at formatere
 * @returns {string} Formateret beløb (fx "1.234,56")
 */
export const formatAmount = (amount: number | null | undefined): string => {
  if (amount === null || amount === undefined || !Number.isFinite(amount)) {
    return '0,00';
  }
  return formatAsAmount(amount, 2);
};

/**
 * Formaterer procent til dansk format
 *
 * @param {number} percent - Procentværdi
 * @returns {string} Formateret procent (fx "12,50 %")
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
 *
 * @param {jsPDF} doc - PDF-dokumentet
 * @param {BrevhovedData} data - Brevhoved-data
 * @returns {number} Altid MARGINS.top (brevhoved er overlay)
 */
export const addBrevhoved = (doc: jsPDF, data: BrevhovedData): number => {
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

  // Brevhoved-overlay setup
  const pageWidth = doc.internal.pageSize.width;
  const rightX = pageWidth - MARGINS.right;
  const lineHeight = 5;
  let currentY = 15; // Start højere oppe end normal margin

  doc.setFontSize(FONT_SIZES.normal - 1); // 1px mindre end normal (9 i stedet for 10)

  // Sagsnummer (normal, højre-aligneret)
  if (hasJournalnr) {
    const roleSuffix = hasAdvokat && hasSagsbehandler
      ? ` ${trimmedAdvokat}/${trimmedSagsbehandler}`
      : hasAdvokat
        ? ` ${trimmedAdvokat}`
        : hasSagsbehandler
          ? ` ${trimmedSagsbehandler}`
          : '';
    doc.setFont(PDF_FONT_FAMILY, PDF_FONT_STYLES.normal);
    doc.text(`J.nr. ${trimmedJournalnr}${roleSuffix}`, rightX, currentY, { align: 'right' });
    currentY += lineHeight;
  }

  // Dato (normal, højre-aligneret)
  doc.setFont(PDF_FONT_FAMILY, PDF_FONT_STYLES.normal);
  doc.text(resolvedDatoText, rightX, currentY, { align: 'right' });

  // Reset font-stil til normal for at undgå lækage
  applyNormalTextStyle(doc);

  // Returner ALTID MARGINS.top - brevhoved er overlay og påvirker ikke hovedindholdet
  return MARGINS.top;
};
