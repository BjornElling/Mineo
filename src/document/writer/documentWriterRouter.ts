/**
 * Format-agnostisk writer-router
 *
 * `createStandardPdfWriter` instantierer den writer der passer til det aktive
 * dokumentformat. Routeren er kanal-agnostisk: den importerer hverken PDF- eller
 * Word-kanalen statisk, men henter den writer-fabrik, som download-stien har
 * injiceret i `documentGenerationContext` (PDF-fabrik for 'pdf', Word-fabrik for
 * 'word'). Det holder dokument-kernen fri for statiske kant til `src/pdf`/`src/docx`.
 *
 * Generatorer kalder denne router og skriver mod `DocumentWriter` uden at vide,
 * hvilken kanal de ender i (jf. document-format-contract §3).
 */

import { getActiveDocumentWriterFactory } from '../documentGenerationContext';
import type { DocumentWriter } from './documentWriter';

export const createStandardPdfWriter = (params?: Readonly<{
  visUdkastStempel?: boolean;
  orientation?: 'portrait' | 'landscape';
  onLayoutFallback?: (params: Readonly<{ message: string; label: string }>) => void;
}>): DocumentWriter => {
  const createWriter = getActiveDocumentWriterFactory();
  if (!createWriter) {
    throw new Error('Dokument-generering kræver en præindlæst writer-fabrik (PDF eller Word) i den aktive documentGenerationContext.');
  }
  return createWriter({
    visUdkastStempel: params?.visUdkastStempel ?? false,
    orientation: params?.orientation ?? 'portrait',
    onLayoutFallback: params?.onLayoutFallback,
  });
};
