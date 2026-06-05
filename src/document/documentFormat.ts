import { z } from 'zod';

export const documentDownloadFormatSchema = z.enum(['pdf', 'word']);

export type DocumentDownloadFormat = z.infer<typeof documentDownloadFormatSchema>;

export const DOCUMENT_DOWNLOAD_FORMAT_OPTIONS = documentDownloadFormatSchema.options;
export const DEFAULT_DOCUMENT_DOWNLOAD_FORMAT: DocumentDownloadFormat = 'pdf';

export const isDocumentDownloadFormat = (value: string): value is DocumentDownloadFormat => {
  return (DOCUMENT_DOWNLOAD_FORMAT_OPTIONS as readonly string[]).includes(value);
};

export const getDocumentFormatLabel = (format: DocumentDownloadFormat): 'PDF' | 'Word' => {
  switch (format) {
    case 'pdf':
      return 'PDF';
    case 'word':
      return 'Word';
  }
};
