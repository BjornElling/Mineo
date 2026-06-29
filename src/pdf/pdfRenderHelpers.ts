/**
 * PDF-render-hjælpefunktioner (jsPDF-kanal)
 *
 * Adapter-afhængige tegne-helpers der KUN giver mening på PDF-kanalen: font-styling,
 * sektionsoverskrift via rå adapter, sidebryd-sikring og footer-rendering (canvas →
 * billede). Word-kanalen bruger dem ikke (Word styrer selv sideflow og typografi).
 *
 * De format-agnostiske helpers (beløbsformat, section-end-Y, brand, BrevhovedData)
 * lever i `src/document/layout/documentLayoutHelpers.ts`.
 */

import {
  FONT_SIZES,
  MARGINS,
  PDF_BASE_LINE_HEIGHT_MM,
  PDF_FONT_FAMILY,
  PDF_FONT_STYLES,
  PDF_FOOTER_FONT_SIZE,
  PDF_FOOTER_MARGIN_MM,
  PDF_FOOTER_RIGHT_MARGIN_MM,
  PDF_FOOTER_TEXT_COLOR,
  PDF_SECTION_HEADING_GAP,
} from '../document/layout/pdfConfig';
import type { PdfDocumentAdapter } from './infrastructure/pdfDocumentAdapter';
import {
  buildDocumentFooterText,
  getDocumentFooterImage,
} from '../document/layout/documentFooterImage';

const FOOTER_IMAGE_ALIAS = 'mineo_footer_version';

// Cache-rydning til tests lever sammen med billed-bygningen i den kanal-neutrale kerne.
export { clearDocumentFooterImageCacheForTests as clearFooterImageCacheForTests } from '../document/layout/documentFooterImage';

export const applyNormalTextStyle = (doc: PdfDocumentAdapter): void => {
  doc.setFont(PDF_FONT_FAMILY, PDF_FONT_STYLES.normal);
  doc.setFontSize(FONT_SIZES.normal);
};

export const applyBoldTextStyle = (doc: PdfDocumentAdapter): void => {
  doc.setFont(PDF_FONT_FAMILY, PDF_FONT_STYLES.bold);
  doc.setFontSize(FONT_SIZES.normal);
};

export const addSectionHeading = (doc: PdfDocumentAdapter, title: string, startY: number): number => {
  applyBoldTextStyle(doc);
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

/**
 * Tilføj footer med versionsnummer på alle sider
 */
export const addFooter = (doc: PdfDocumentAdapter): void => {
  const pageHeight = doc.getPageHeight();
  const pageWidth = doc.getPageWidth();
  const totalPages = doc.getNumberOfPages();
  const footerText = buildDocumentFooterText();
  const footerImage = getDocumentFooterImage(footerText);

  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    if (footerImage) {
      doc.addImage(
        footerImage.dataUrl,
        footerImage.format,
        pageWidth - PDF_FOOTER_RIGHT_MARGIN_MM - footerImage.widthMm,
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
    doc.text(footerText, pageWidth - PDF_FOOTER_RIGHT_MARGIN_MM, pageHeight - PDF_FOOTER_MARGIN_MM, { angle: 90 });
  }
};
