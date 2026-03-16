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
const FOOTER_IMAGE_WIDTH_MM = 5.2;
const FOOTER_BASE_CANVAS_WIDTH_PX = 20;
const FOOTER_RENDER_SCALE = 6;
const FOOTER_FONT_SIZE_PX = 8;
const FOOTER_CANVAS_FONT_FAMILY = 'Arial, Helvetica, sans-serif';
const FOOTER_IMAGE_ALIAS = 'mineo_footer_version';
const FOOTER_JPEG_QUALITY = 0.85;
const FOOTER_PADDING_PX = 12;
const FOOTER_MIN_HEIGHT_PX = 96;
const FOOTER_MAX_HEIGHT_PX = 220;
const footerImageCache = new Map<string, Readonly<{ dataUrl: string; format: 'JPEG'; widthMm: number; heightMm: number }> | null>();
export const clearFooterImageCacheForTests = (): void => {
  if (import.meta.env.MODE !== 'test') return;
  footerImageCache.clear();
};

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
  const footerText = `Mineo.dk // ${VERSION}`;
  const footerImage = getFooterImageData(footerText);

  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    if (footerImage) {
      doc.addImage(
        footerImage.dataUrl,
        footerImage.format,
        pageWidth - PDF_FOOTER_MARGIN_MM - footerImage.widthMm,
        pageHeight - PDF_FOOTER_MARGIN_MM - footerImage.heightMm,
        footerImage.widthMm,
        footerImage.heightMm,
        FOOTER_IMAGE_ALIAS,
        'FAST'
      );
      continue;
    }

    doc.setFont(PDF_FONT_FAMILY, PDF_FONT_STYLES.normal);
    doc.setFontSize(PDF_FOOTER_FONT_SIZE);
    doc.setTextColor(...PDF_FOOTER_TEXT_COLOR);
    doc.text(footerText, pageWidth - PDF_FOOTER_MARGIN_MM, pageHeight - PDF_FOOTER_MARGIN_MM, { angle: 90 });
  }
};

const getFooterImageData = (footerText: string): Readonly<{ dataUrl: string; format: 'JPEG'; widthMm: number; heightMm: number }> | null => {
  const cached = footerImageCache.get(footerText);
  if (cached !== undefined) return cached;

  if (typeof document === 'undefined') {
    footerImageCache.set(footerText, null);
    return null;
  }

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    footerImageCache.set(footerText, null);
    return null;
  }

  const canvasWidthPx = FOOTER_BASE_CANVAS_WIDTH_PX * FOOTER_RENDER_SCALE;
  const fontSizePx = FOOTER_FONT_SIZE_PX * FOOTER_RENDER_SCALE;
  ctx.font = `400 ${fontSizePx}px ${FOOTER_CANVAS_FONT_FAMILY}`;
  const measuredTextWidthPx = Math.ceil(ctx.measureText(footerText).width);
  canvas.width = canvasWidthPx;
  // Teksten roteres 90 grader i canvas. Derfor er målt tekstbredde (x-aksen før rotation)
  // bestemmende for canvas-højden i outputbilledet.
  const minHeightPx = FOOTER_MIN_HEIGHT_PX * FOOTER_RENDER_SCALE;
  const maxHeightPx = FOOTER_MAX_HEIGHT_PX * FOOTER_RENDER_SCALE;
  const paddedTextHeightPx = measuredTextWidthPx + FOOTER_PADDING_PX * FOOTER_RENDER_SCALE;
  canvas.height = Math.max(minHeightPx, Math.min(maxHeightPx, paddedTextHeightPx));

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((-90 * Math.PI) / 180);
  // Canvas nulstiller drawing state (inkl. font) når width/height ændres.
  // Re-applier font her, så renderingen matcher målingen.
  ctx.font = `400 ${fontSizePx}px ${FOOTER_CANVAS_FONT_FAMILY}`;
  // Opaque farve undgår skjult alpha-afhængighed ved JPEG-encoding.
  ctx.fillStyle = 'rgb(192,192,192)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(footerText, 0, 0);
  ctx.restore();

  const image = {
    dataUrl: canvas.toDataURL('image/jpeg', FOOTER_JPEG_QUALITY),
    format: 'JPEG' as const,
    widthMm: FOOTER_IMAGE_WIDTH_MM,
    heightMm: (canvas.height / canvas.width) * FOOTER_IMAGE_WIDTH_MM,
  } as const;
  footerImageCache.set(footerText, image);
  return image;
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

  // Eksplicit font reset til normal brødtekststørrelse — undgå implicit afhængighed af applyNormalTextStyle
  doc.setFontSize(FONT_SIZES.normal);

  return MARGINS.top;
};
