import { sanitizeFilenamePart } from '../pdf/shared/pdfFormatUtils';
import type { DocumentDownloadFormat } from './documentFormat';

const DOCUMENT_EXTENSION_BY_FORMAT: Readonly<Record<DocumentDownloadFormat, 'pdf' | 'docx'>> = {
  pdf: 'pdf',
  word: 'docx',
};

export const resolveDocumentFileName = (
  baseTitle: string,
  isDraft: boolean,
  format: DocumentDownloadFormat,
  journalnr?: string
): string => {
  const safeJournalnr = typeof journalnr === 'string' ? sanitizeFilenamePart(journalnr.trim()) : '';
  const prefix = safeJournalnr !== '' ? `${safeJournalnr} - ` : '';
  const safeTitle = sanitizeFilenamePart(baseTitle);
  const extension = DOCUMENT_EXTENSION_BY_FORMAT[format];
  return `${prefix}${safeTitle}${isDraft ? ' (udkast)' : ''}.${extension}`;
};
