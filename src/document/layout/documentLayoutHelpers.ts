/**
 * Dokument-layout-hjælpefunktioner (format-agnostiske)
 *
 * Rene, kanal-neutrale helpers brugt af generatorer og den fælles tabel-renderer:
 * brevhoved-datatype, beløbs-/procentformattering, section-end-Y-udledning og
 * brand-metadata. Ingen jsPDF/adapter-afhængighed — den lever i PDF-kanalens
 * `src/pdf/pdfRenderHelpers.ts`.
 */

import { PDF_FINAL_Y_FALLBACK_HEIGHT, PDF_SECTION_HEADING_GAP, SECTION_SPACER } from './pdfConfig';
import type { ISODateString } from '../../types/branded';
import { formatAsAmount, formatPercent as formatPercentUtil } from '../../utils/formatUtils';
import { setDocumentBrand } from '../documentBrand';
export { getDocumentCreatorBrand } from '../documentBrand';

/**
 * Brevhoved-data til dokument-output (PDF og Word)
 */
export type BrevhovedData = Readonly<{
  journalnr?: string;
  dagsDatoISO: ISODateString;
  advokat?: string;
  sagsbehandler?: string;
}>;

export const resolveDocumentTableStartYAfterSectionHeading = (headingY: number): number => {
  return headingY - PDF_SECTION_HEADING_GAP;
};

export const resolveDocumentSectionEndY = (
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
 * Dokument-brand: vandmærket/footeren nederst og `creator`-metadata.
 * Standardbuildet er Mineo.dk; minprocesrente-standalone-buildet sætter
 * brandet til minprocesrente.dk ved bootstrap.
 */
export const setDocumentFooterBrand = (brand: string): void => {
  setDocumentBrand(brand);
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

// Re-eksporterede konfigurationskonstanter — beholdt her for at undgå at alle
// importerende generatorer skal ændre deres importsti fra pdfHelpers til pdfConfig.
export { PDF_BASE_LINE_HEIGHT_MM, PDF_TITLE_BOTTOM_SPACING_MM } from './pdfConfig';
