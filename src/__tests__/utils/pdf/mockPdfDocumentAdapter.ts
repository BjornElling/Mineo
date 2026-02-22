/// <reference types="vitest/globals" />

import type { Mocked } from 'vitest';
import type { PdfDocumentAdapter } from '../../../utils/pdf/pdfDocumentAdapter';

/**
 * Fælles test-factory for PdfDocumentAdapter mocks.
 *
 * Returnerer Mocked<PdfDocumentAdapter> så .mock.calls og .mockReturnValue
 * er tilgængelige direkte uden casts i test-filer.
 *
 * vi.fn() er parameterannoteret mod PdfDocumentAdapter-signaturer
 * så TypeScript fejler ved kontraktbrud — ikke kun ved runtime.
 */
export const createMockPdfDocumentAdapter = (): Mocked<PdfDocumentAdapter> => ({
  text: vi.fn<PdfDocumentAdapter['text']>(),
  setFont: vi.fn<PdfDocumentAdapter['setFont']>(),
  setFontSize: vi.fn<PdfDocumentAdapter['setFontSize']>(),
  setTextColor: vi.fn<PdfDocumentAdapter['setTextColor']>(),
  addPage: vi.fn<PdfDocumentAdapter['addPage']>(),
  setPage: vi.fn<PdfDocumentAdapter['setPage']>(),
  getNumberOfPages: vi.fn<PdfDocumentAdapter['getNumberOfPages']>(() => 1),
  getPageWidth: vi.fn<PdfDocumentAdapter['getPageWidth']>(() => 210),
  getPageHeight: vi.fn<PdfDocumentAdapter['getPageHeight']>(() => 297),
});
