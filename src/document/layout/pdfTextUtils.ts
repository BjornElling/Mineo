/**
 * PDF Tekst-hjælpefunktioner
 *
 * Pure string-transformationer til PDF-rendering.
 * Ingen jsPDF-afhængighed — kan importeres frit af sektioner og generatorer.
 */

const NBSP = '\u00A0';
const PDF_ASCII_FALLBACKS: ReadonlyArray<readonly [RegExp, string]> = [
  [/\u2212/g, '-'],   // U+2212 MINUS SIGN
  [/\u2013/g, '-'],   // U+2013 EN DASH
  [/\u2014/g, '-'],   // U+2014 EM DASH
  [/\u2019/g, "'"],   // U+2019 RIGHT SINGLE QUOTATION MARK
  [/\u201C/g, '"'],   // U+201C LEFT DOUBLE QUOTATION MARK
  [/\u201D/g, '"'],   // U+201D RIGHT DOUBLE QUOTATION MARK
  [/\u2022/g, '-'],   // U+2022 BULLET
  [/\u2026/g, '...'], // U+2026 HORIZONTAL ELLIPSIS
  [/\u2264/g, '<='],  // U+2264 LESS-THAN OR EQUAL TO
  [/\u2265/g, '>='],  // U+2265 GREATER-THAN OR EQUAL TO
  [/\u2260/g, '!='],  // U+2260 NOT EQUAL TO
  [/\u2248/g, '~='],  // U+2248 ALMOST EQUAL TO
  [/\u2190/g, '<-'],  // U+2190 LEFTWARDS ARROW
  [/\u2192/g, '->'],  // U+2192 RIGHTWARDS ARROW
  [/\u2194/g, '<->'], // U+2194 LEFT RIGHT ARROW
];

const replacePdfUnsafeUnicode = (value: string): string => {
  let normalized = value;
  for (const [pattern, replacement] of PDF_ASCII_FALLBACKS) {
    normalized = normalized.replace(pattern, replacement);
  }
  return normalized;
};

/**
 * Indsætter ikke-brydende mellemrum (NBSP) mellem et tal og efterfølgende "kr.",
 * uanset om adskillelsen er mellemrum, tab eller linjeskift — forhindrer linjebrud
 * midt i et beløb i PDF-output. En eventuel adskillelse på flere whitespace-tegn
 * normaliseres til ét NBSP.
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
export const normalizeTextForDocument = (value: string): string => {
  return ensureNonBreakingKr(
    replacePdfUnsafeUnicode(
      value.replace(/\r\n/g, '\n')
    )
  );
};

/**
 * Højrejusteret tekst i writer-sporet brydes aldrig over flere logiske ord.
 * NBSP mellem tal og "kr." er derfor unødvendigt og kan give forkert
 * breddeberegning i jsPDF's align:right-layout.
 */
export const normalizeRightAlignedTextForDocument = (value: string): string => {
  return normalizeTextForDocument(value).replace(/\u00A0/g, ' ');
};
