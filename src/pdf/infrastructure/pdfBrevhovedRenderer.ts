import {
  FONT_SIZES,
  MARGINS,
  PDF_BREVHOVED_FONT_SIZE,
  PDF_BREVHOVED_LINE_HEIGHT,
  PDF_BREVHOVED_START_Y,
  PDF_FONT_FAMILY,
  PDF_FONT_STYLES,
} from './pdfConfig';
import type { PdfDocumentAdapter } from './pdfDocumentAdapter';
import type { BrevhovedData } from '../shared/pdfHelpers';
import { formatIsoDateLong } from '../../utils/dateFormatting';

export const renderBrevhoved = (doc: PdfDocumentAdapter, data: BrevhovedData): number => {
  const { journalnr, dagsDatoISO, advokat, sagsbehandler } = data;
  const trimmedJournalnr = typeof journalnr === 'string' ? journalnr.trim() : '';
  const resolvedDatoText = formatIsoDateLong(dagsDatoISO);
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

  doc.setFont(PDF_FONT_FAMILY, PDF_FONT_STYLES.normal);
  doc.setFontSize(PDF_BREVHOVED_FONT_SIZE);

  if (hasJournalnr) {
    const roleSuffix = hasAdvokat && hasSagsbehandler
      ? ` ${trimmedAdvokat}/${trimmedSagsbehandler}`
      : hasAdvokat
        ? ` ${trimmedAdvokat}`
        : hasSagsbehandler
          ? ` ${trimmedSagsbehandler}`
          : '';
    doc.text(`J.nr. ${trimmedJournalnr}${roleSuffix}`, rightX, currentY, { align: 'right' });
    currentY += PDF_BREVHOVED_LINE_HEIGHT;
  }

  doc.text(resolvedDatoText, rightX, currentY, { align: 'right' });

  doc.setFont(PDF_FONT_FAMILY, PDF_FONT_STYLES.normal);
  doc.setFontSize(FONT_SIZES.normal);

  return MARGINS.top;
};
