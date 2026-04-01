/**
 * jsPDF Concrete Adapter
 *
 * Eneste sted i kodebasen der må bruge jsPDF.internal.pageSize direkte.
 * Alle helpers og generatorer modtager PdfDocumentAdapter — ikke jsPDF.
 *
 * NOTE: jsPDF eksponerer sidebredde/-højde via internal.pageSize.
 * Dette er bevidst isoleret her for at forhindre internal-coupling
 * i at lække ud i resten af systemet. Hvis jsPDF introducerer et
 * offentligt API (f.eks. getWidth()/getHeight()), kan dette rettes ét sted.
 */

import jsPDF from 'jspdf';
import type { PdfDocumentAdapter, PdfImageCompression, PdfImageFormat, PdfTextOptions } from './pdfDocumentAdapter';
import type { PdfFontFamily, PdfFontStyle } from './pdfConfig';

const getPageSize = (doc: jsPDF): { width: number; height: number } => {
  // NOTE: Bevidst brug af internal API — se modulkommentar
  const pageSize = doc.internal?.pageSize;
  if (!pageSize || typeof pageSize.width !== 'number' || typeof pageSize.height !== 'number') {
    throw new Error('jsPDF internal.pageSize er ikke tilgængeligt eller har ugyldig struktur — mulig version-inkompatibilitet');
  }
  return pageSize;
};

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
    // Slår pageSize op pr. kald — undgår stale cached reference ved dynamiske sideskift
    getPageWidth: () => getPageSize(doc).width,
    getPageHeight: () => getPageSize(doc).height,
  };
};
