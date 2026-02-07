/**
 * PDF Hjælpefunktioner
 *
 * Fælles funktioner brugt på tværs af alle PDF-genereringer
 * Eliminerer code duplication mellem PDF-filer
 */

import jsPDF from 'jspdf';
import { FONT_SIZES, MARGINS } from './pdfConfig';
import { VERSION } from '../../config/version';
import type { DanishDateString, ISODateString } from '../../types/branded';
 
import { formatDanishDate as formatDanishDateStrict, parseDanishDate as parseDanishDateStrict } from '../dateUtils';
import { formatIsoDateLong } from '../dateFormatting';

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
  doc.setFontSize(FONT_SIZES.title);
  doc.setFont('helvetica', 'bold');
  doc.text(title, MARGINS.left, startY);

  return startY + 15;
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
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(200, 200, 200);

    const footerText = `Mineo.dk // ${VERSION}`;
    const x = pageWidth - 5;
    const y = pageHeight - 5;

    doc.text(footerText, x, y, { angle: 90 });
  }
};

/**
 * Parser dansk datoformat (dd-mm-åååå) til Date-objekt
 *
 * @param {string} dateStr - Dato i dansk format (dd-mm-åååå)
 * @returns {Date|null} Date-objekt eller null hvis ugyldig
 */
export const parseDanishDate = (dateStr: DanishDateString | string): Date | null => {
  return parseDanishDateStrict(dateStr);
};

/**
 * Formaterer Date-objekt til dansk format (dd-mm-åååå)
 *
 * @param {Date} date - Date-objekt
 * @returns {string} Formateret dato (dd-mm-åååå)
 */
export const formatDanishDate = (date: Date): string => {
  if (!date) return '';
  return formatDanishDateStrict(date);
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

  return amount.toLocaleString('da-DK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
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
  return `${percent.toFixed(2).replace('.', ',')} %`;
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
    doc.setFont('helvetica', 'normal');
    doc.text(`J.nr. ${trimmedJournalnr}${roleSuffix}`, rightX, currentY, { align: 'right' });
    currentY += lineHeight;
  }

  // Dato (normal, højre-aligneret)
  doc.setFont('helvetica', 'normal');
  doc.text(resolvedDatoText, rightX, currentY, { align: 'right' });

  // Reset font-size til normal for at undgå lækage
  doc.setFontSize(FONT_SIZES.normal);

  // Returner ALTID MARGINS.top - brevhoved er overlay og påvirker ikke hovedindholdet
  return MARGINS.top;
};
