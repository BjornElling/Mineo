import { z } from 'zod';

export const documentDownloadFormatSchema = z.enum(['pdf', 'word']);

export type DocumentDownloadFormat = z.infer<typeof documentDownloadFormatSchema>;

export const DOCUMENT_DOWNLOAD_FORMAT_OPTIONS = documentDownloadFormatSchema.options;
export const DEFAULT_DOCUMENT_DOWNLOAD_FORMAT: DocumentDownloadFormat = 'pdf';

export const getDocumentFormatLabel = (format: DocumentDownloadFormat): 'PDF' | 'Word' => {
  switch (format) {
    case 'pdf':
      return 'PDF';
    case 'word':
      return 'Word';
  }
};

/**
 * Kanonisk, kort tooltip for en deaktiveret download-knap. Bruges ÉT sted, så alle download-knapper
 * der ikke har en mere specifik årsag (fx EO-beregningens detaljerede gate-årsager) viser den samme
 * besked i stedet for den vildledende "Download som PDF", når knappen åbenlyst er slået fra.
 */
export const DOWNLOAD_DISABLED_TOOLTIP = 'Indtastning mangler';
