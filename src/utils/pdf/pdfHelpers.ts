/**
 * PDF Hjælpefunktioner
 *
 * Fælles funktioner brugt på tværs af alle PDF-genereringer
 * Eliminerer code duplication mellem PDF-filer
 */

import { FONT_SIZES, MARGINS } from './pdfConfig';
import { VERSION } from '../../config/version';
import type { DanishDateString, ISODateString } from '../../types/branded';
import { isoToDanish } from '../../types/branded';
import { formatDanishDate as formatDanishDateStrict, parseDanishDate as parseDanishDateStrict } from '../dateUtils';

/**
 * Brevhoved-data til PDF-dokumenter
 */
export type BrevhovedData = Readonly<{
  skadelidte?: string;
  skadestype?: string;
  skadesdato?: ISODateString;
  journalnr?: string;
}>;

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

/**
 * Formaterer ISO-dato til læsbar dansk tekst (d. måned åååå)
 */
const formatISODateReadable = (isoDate: ISODateString | undefined): string => {
  if (!isoDate) return '';

  const danish = isoToDanish(isoDate);
  if (!danish) return '';

  // Konverter dd-mm-yyyy til d. måned yyyy
  const [day, month, year] = danish.split('-');
  const d = parseInt(day, 10);
  const m = parseInt(month, 10) - 1;

  const monthNames = [
    'januar', 'februar', 'marts', 'april', 'maj', 'juni',
    'juli', 'august', 'september', 'oktober', 'november', 'december'
  ];

  return `${d}. ${monthNames[m]} ${year}`;
};

/**
 * Tilføj brevhoved til PDF-dokument
 *
 * Indsætter et brevhoved øverst til højre på dokumentet med:
 * - Skadelidtes navn (fed, højre-aligneret)
 * - Skadestype og skadesdato (højre-aligneret)
 * - Journalnummer (højre-aligneret)
 *
 * VIGTIGT: Brevhovedet er et overlay - det påvirker IKKE placeringen af hovedindholdet.
 * Funktionen returnerer altid MARGINS.top uanset om brevhoved indsættes eller ej.
 *
 * @param {jsPDF} doc - PDF-dokumentet
 * @param {BrevhovedData} data - Brevhoved-data
 * @returns {number} Altid MARGINS.top (brevhoved er overlay)
 */
export const addBrevhoved = (doc, data: BrevhovedData): number => {
  const { skadelidte, skadestype, skadesdato, journalnr } = data;

  // Hvis ingen data, returner standard startposition (ingen overlay)
  if (!skadelidte && !skadestype && !skadesdato && !journalnr) {
    return MARGINS.top;
  }

  // Brevhoved-overlay setup
  const pageWidth = doc.internal.pageSize.width;
  const rightX = pageWidth - MARGINS.right;
  const lineHeight = 5;
  let currentY = 15; // Start højere oppe end normal margin

  doc.setFontSize(FONT_SIZES.normal - 1); // 1px mindre end normal (9 i stedet for 10)

  // Skadelidtes navn (fed, højre-aligneret)
  if (skadelidte) {
    doc.setFont('helvetica', 'bold');
    doc.text(skadelidte, rightX, currentY, { align: 'right' });
    currentY += lineHeight;
  }

  // Skadestype og skadesdato (normal, højre-aligneret)
  doc.setFont('helvetica', 'normal');
  if (skadestype && skadesdato) {
    const datoTekst = formatISODateReadable(skadesdato);
    const erErhvervssygdom = skadestype === 'Erhvervssygdom';
    const anmeldt = erErhvervssygdom ? 'anmeldt ' : '';
    doc.text(`${skadestype} ${anmeldt}${datoTekst}`, rightX, currentY, { align: 'right' });
    currentY += lineHeight;
  } else if (skadestype) {
    doc.text(skadestype, rightX, currentY, { align: 'right' });
    currentY += lineHeight;
  } else if (skadesdato) {
    const datoTekst = formatISODateReadable(skadesdato);
    doc.text(`Skadesdato: ${datoTekst}`, rightX, currentY, { align: 'right' });
    currentY += lineHeight;
  }

  // Halv linjes afstand mellem skadestype-linje og journalnummer
  currentY += lineHeight / 2;

  // Journalnummer (højre-aligneret)
  if (journalnr) {
    doc.text(`Sagsnr.: ${journalnr}`, rightX, currentY, { align: 'right' });
  }

  // Returner ALTID MARGINS.top - brevhoved er overlay og påvirker ikke hovedindholdet
  return MARGINS.top;
};
