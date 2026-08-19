/**
 * jsPDF Concrete Adapter
 *
 * Konkret jsPDF-implementering af PdfDocumentAdapter. Alle helpers og generatorer
 * modtager PdfDocumentAdapter – ikke jsPDF. Sidegeometrien (internal.pageSize)
 * læses via det fælles isolationspunkt `getJsPdfPageSize` i dokument-kernen.
 */

import jsPDF from 'jspdf';
import type { PdfDocumentAdapter, PdfImageCompression, PdfImageFormat, PdfTextOptions } from './pdfDocumentAdapter';
import type { PdfFontFamily, PdfFontStyle } from '../../document/layout/pdfConfig';
import { getJsPdfPageSize as getPageSize } from '../../document/layout/jsPdfGeometry';

export const createJsPdfAdapter = (doc: jsPDF): PdfDocumentAdapter => {
  // Defensiv check ved oprettelse: fejler hårdt ved version-inkompatibilitet
  // frem for silent undefined-behaviour ved første kald.
  getPageSize(doc);

  return {
    text: (text: string, x: number, y: number, options?: PdfTextOptions) =>
      doc.text(text, x, y, options),
    addImage: (
      imageDataUrl: string,
      format: PdfImageFormat,
      x: number,
      y: number,
      width: number,
      height: number,
      alias?: string,
      compression?: PdfImageCompression
    ) => doc.addImage(imageDataUrl, format, x, y, width, height, alias, compression),
    setFont: (family: PdfFontFamily, style: PdfFontStyle) => doc.setFont(family, style),
    setFontSize: (size: number) => doc.setFontSize(size),
    setTextColor: (r: number, g: number, b: number) => doc.setTextColor(r, g, b),
    addPage: () => { doc.addPage(); },
    setPage: (n: number) => { doc.setPage(n); },
    getNumberOfPages: () => doc.getNumberOfPages(),
    // Slår pageSize op pr. kald – undgår stale cached reference ved dynamiske sideskift
    getPageWidth: () => getPageSize(doc).width,
    getPageHeight: () => getPageSize(doc).height,
  };
};
