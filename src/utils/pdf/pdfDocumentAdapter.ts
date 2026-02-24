/**
 * PDF Document Adapter
 *
 * Stabil infrastruktur-kontrakt for PDF-generering i Mineo.
 * Ingen helper eller generator må importere jsPDF direkte —
 * de arbejder udelukkende mod dette interface.
 *
 * Isolationspunkt: jsPDF-specifik implementering (inkl. internal.pageSize)
 * lever udelukkende i createJsPdfAdapter() i jsPdfAdapter.ts.
 *
 * VIGTIG DESIGNBESLUTNING:
 * Kontrakten er bevidst indsnævret til de features Mineo faktisk bruger.
 * Vi spejler IKKE jsPDF's fulde API — det ville genindføre coupling.
 */

import type { PdfFontFamily, PdfFontStyle } from './pdfConfig';

export type PdfTextAlign = 'left' | 'right' | 'center';

export type PdfTextOptions = Readonly<{
  align?: PdfTextAlign;
  angle?: number;
}>;

export type PdfImageCompression = 'NONE' | 'FAST' | 'MEDIUM' | 'SLOW';
export type PdfImageFormat = 'PNG' | 'JPEG';

export interface PdfDocumentAdapter {
  text(text: string, x: number, y: number, options?: PdfTextOptions): void;
  addImage(
    imageDataUrl: string,
    format: PdfImageFormat,
    x: number,
    y: number,
    width: number,
    height: number,
    alias?: string,
    compression?: PdfImageCompression
  ): void;

  setFont(family: PdfFontFamily, style: PdfFontStyle): void;
  setFontSize(size: number): void;
  setTextColor(r: number, g: number, b: number): void;

  addPage(): void;
  setPage(pageNumber: number): void;
  getNumberOfPages(): number;

  getPageWidth(): number;
  getPageHeight(): number;
}
