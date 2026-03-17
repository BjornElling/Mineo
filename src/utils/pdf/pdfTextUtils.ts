/**
 * PDF Tekst-hjælpefunktioner
 *
 * Pure string-transformationer til PDF-rendering.
 * Ingen jsPDF-afhængighed — kan importeres frit af sektioner og generatorer.
 */

const NBSP = '\u00A0';

/**
 * Erstatter linjeskift (\r\n eller \n) med ikke-brydende mellemrum mellem
 * tal og "kr." — forhindrer linjeskift midt i beløb i PDF-output.
 */
export const ensureNonBreakingKr = (value: string): string => {
  return value.replace(/(-?\d[\d.,]*)\s+kr\./g, `$1${NBSP}kr.`);
};

/**
 * Normaliserer tekst til PDF-rendering:
 * - Windows-linjeskift (\r\n) → Unix (\n)
 * - Ikke-brydende mellemrum mellem tal og "kr."
 * - Unicode-tegn uden for Latin-1 erstattes med ASCII-ækvivalenter
 *   (jsPDF's standard Helvetica-font er Latin-1; tegn uden for dette
 *   interval gengives som spredte enkeltbogstaver)
 */
export const normalizeTextForPdf = (value: string): string => {
  return ensureNonBreakingKr(
    value
      .replace(/\r\n/g, '\n')
      .replace(/\u2212/g, '-')   // U+2212 MINUS SIGN → ASCII hyphen-minus
      .replace(/\u2013/g, '-')   // U+2013 EN DASH → ASCII hyphen-minus
      .replace(/\u2014/g, '-')   // U+2014 EM DASH → ASCII hyphen-minus
      .replace(/\u2019/g, "'")   // U+2019 RIGHT SINGLE QUOTATION MARK → apostrophe
      .replace(/\u201C/g, '"')   // U+201C LEFT DOUBLE QUOTATION MARK → quote
      .replace(/\u201D/g, '"')   // U+201D RIGHT DOUBLE QUOTATION MARK → quote
  );
};

/**
 * Højrejusteret tekst i writer-sporet brydes aldrig over flere logiske ord.
 * NBSP mellem tal og "kr." er derfor unødvendigt og kan give forkert
 * breddeberegning i jsPDF's align:right-layout.
 */
export const normalizeRightAlignedTextForPdf = (value: string): string => {
  return normalizeTextForPdf(value).replace(/\u00A0/g, ' ');
};
