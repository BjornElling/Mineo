import type { DocumentDownloadFormat } from './documentFormat';

const replaceControlChars = (value: string): string => {
  let out = '';
  for (let i = 0; i < value.length; i += 1) {
    const ch = value[i];
    const code = ch.charCodeAt(0);
    out += code <= 31 ? '_' : ch;
  }
  return out;
};

/**
 * Saniterer en filnavns-bestanddel for Windows-ulovlige tegn (`< > : " / \ | ? *`)
 * og kontroltegn, kollapser whitespace og trimmer. Format-agnostisk – bruges af
 * både PDF- og Word-filnavne via den fælles `resolveDocumentFileName`.
 */
export const sanitizeFilenamePart = (value: string): string => {
  return replaceControlChars(value)
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, ' ')
    .trim();
};

const DOCUMENT_EXTENSION_BY_FORMAT: Readonly<Record<DocumentDownloadFormat, 'pdf' | 'docx'>> = {
  pdf: 'pdf',
  word: 'docx',
};

/**
 * Kanonisk filnavnsregel for alle dokument-downloads (PDF og Word).
 *
 * Reglen er fælles for begge formater; kun endelsen adskiller sig (jf.
 * `document-format-contract.md` §4.4). Resultat:
 * - `{journalnr} - {baseTitle}.{ext}` når journalnr er udfyldt
 * - `{baseTitle}.{ext}` når journalnr er tomt
 * - ` (udkast)` indsættes lige før endelsen når `isDraft=true`
 *
 * Både `journalnr` og `baseTitle` saniteres altid via `sanitizeFilenamePart`.
 */
export const resolveDocumentFileName = (
  baseTitle: string,
  isDraft: boolean,
  format: DocumentDownloadFormat,
  journalnr?: string
): string => resolveSagsFilnavn(
  `${baseTitle}${isDraft ? ' (udkast)' : ''}`,
  DOCUMENT_EXTENSION_BY_FORMAT[format],
  journalnr
);

/**
 * Filnavnsreglen for alt, der hentes til en sag: `{journalnr} - {titel}.{endelse}`, eller `{titel}.{endelse}` uden
 * journalnr. Dokumenterne bruger den gennem {@link resolveDocumentFileName}; kontroltabellens CSV-fil bruger den
 * direkte, så filen kan genfindes på sagen (BB-382) – før hed den altid «kontroltabel.csv».
 */
export const resolveSagsFilnavn = (titel: string, extension: string, journalnr?: string): string => {
  const safeJournalnr = typeof journalnr === 'string' ? sanitizeFilenamePart(journalnr.trim()) : '';
  const prefix = safeJournalnr !== '' ? `${safeJournalnr} - ` : '';
  return `${prefix}${sanitizeFilenamePart(titel)}.${extension}`;
};
