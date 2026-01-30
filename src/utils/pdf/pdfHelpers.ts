/**
 * PDF Hjælpefunktioner
 *
 * Fælles funktioner brugt på tværs af alle PDF-genereringer
 * Eliminerer code duplication mellem PDF-filer
 */

import { FONT_SIZES, MARGINS } from './pdfConfig';
import { VERSION } from '../../config/version';
import type { DanishDateString } from '../../types/branded';
import { formatDanishDate as formatDanishDateStrict, parseDanishDate as parseDanishDateStrict } from '../dateUtils';

/**
 * Tilføj titel til dokumentet
 *
 * @param {jsPDF} doc - PDF-dokumentet
 * @param {string} title - Titel-tekst
 * @param {number} startY - Start Y-position
 * @returns {number} Ny Y-position efter titel
 */
export const addTitle = (doc, title: string, startY: number): number => {
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
export const addFooter = (doc): void => {
  const pageHeight = doc.internal.pageSize.height;
  const pageWidth = doc.internal.pageSize.width;
  const totalPages = doc.internal.getNumberOfPages();

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
export const formatAmount = (amount) => {
  if (amount === null || amount === undefined || isNaN(amount)) {
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
export const formatPercent = (percent) => {
  return `${percent.toFixed(2).replace('.', ',')} %`;
};
