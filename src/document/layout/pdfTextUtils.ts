/**
 * PDF Tekst-hjælpefunktioner
 *
 * Pure string-transformationer til PDF-rendering.
 * Ingen jsPDF-afhængighed – kan importeres frit af sektioner og generatorer.
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

/**
 * De tegn uden for Latin-1, som jsPDF's standardfonte (WinAnsiEncoding) faktisk kan vise
 * som ét tegn. Målt mod jsPDF: hvert af disse kodes som én byte i tekststrømmen. Et tegn
 * uden for Latin-1 og uden for denne mængde (fx Ł, ż, ő) får jsPDF i stedet til at kode
 * HELE strengen som to-byte-tegn, så linjen vises som spredte bogstaver («A u k a s z»).
 */
const WIN_ANSI_EXTRA_CODE_POINTS: ReadonlySet<number> = new Set([
  0x20ac, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021, 0x02c6, 0x2030, 0x0160, 0x2039,
  0x0152, 0x017d, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014, 0x02dc, 0x2122,
  0x0161, 0x203a, 0x0153, 0x017e, 0x0178,
]);

/**
 * Bogstaver uden kanonisk dekomposition (NFD giver dem uændret tilbage), som derfor
 * kræver en eksplicit translitteration til standardfontens tegnsæt.
 */
const STANDARD_FONT_LETTER_FALLBACKS: Readonly<Record<string, string>> = {
  'Ł': 'L', 'ł': 'l',
  'Đ': 'D', 'đ': 'd',
  'Ħ': 'H', 'ħ': 'h',
  'Ŀ': 'L', 'ŀ': 'l',
  'ı': 'i',
  'ĸ': 'k',
  'Ŋ': 'N', 'ŋ': 'n',
  'Ŧ': 'T', 'ŧ': 't',
  'Ə': 'E', 'ə': 'e',
  'ẞ': 'SS',
};

/** Erstatningstegn for et tegn, standardfonten ikke kan vise og som ikke kan translittereres. */
const UNREPRESENTABLE_REPLACEMENT = '?';

const COMBINING_MARKS = /[\u0300-\u036f]/g;
/** Usynlige formattegn (fx nul-bredde-mellemrum og BOM) har intet at vise og fjernes. */
const FORMAT_CHARACTER = /^\p{Cf}$/u;

const isStandardFontCodePoint = (codePoint: number): boolean =>
  codePoint <= 0xff || WIN_ANSI_EXTRA_CODE_POINTS.has(codePoint);

const isStandardFontText = (value: string): boolean => {
  for (const char of value) {
    if (!isStandardFontCodePoint(char.codePointAt(0) ?? 0)) return false;
  }
  return true;
};

/**
 * Oversætter ét tegn uden for standardfontens tegnsæt til den nærmeste gengivelse, fonten
 * kan vise: eksplicit translitteration, ellers dekomposition (NFD, derefter NFKD) uden
 * kombinerende accenter, ellers et synligt erstatningstegn.
 */
const toStandardFontChar = (char: string): string => {
  const explicit = STANDARD_FONT_LETTER_FALLBACKS[char];
  if (explicit !== undefined) return explicit;
  if (FORMAT_CHARACTER.test(char)) return '';

  for (const form of ['NFD', 'NFKD'] as const) {
    const decomposed = char.normalize(form).replace(COMBINING_MARKS, '').normalize('NFC');
    if (decomposed !== char && isStandardFontText(decomposed)) return decomposed;
  }
  return UNREPRESENTABLE_REPLACEMENT;
};

/**
 * Gør tekst gengivelig med jsPDF's standardfont (Helvetica, WinAnsiEncoding):
 * - typografiske tegn erstattes med de faste ASCII-fallbacks ovenfor (dokumentkonvention);
 * - alle tegn, fonten kan vise (Latin-1 inkl. æøåÆØÅ, é, ó, ü …), bevares uændret;
 * - øvrige tegn translittereres (Ł→L, ż→z, ő→o …) eller erstattes med `?`.
 *
 * Ét tegn uden for fontens tegnsæt får ellers jsPDF til at sprede hele linjen ud i
 * enkeltbogstaver, så saneringen er en forudsætning for, at linjen overhovedet kan læses.
 * Funktionen er idempotent.
 */
export const toPdfStandardFontText = (value: string): string => {
  let normalized = value.normalize('NFC');
  for (const [pattern, replacement] of PDF_ASCII_FALLBACKS) {
    normalized = normalized.replace(pattern, replacement);
  }
  if (isStandardFontText(normalized)) return normalized;

  let result = '';
  for (const char of normalized) {
    result += isStandardFontCodePoint(char.codePointAt(0) ?? 0) ? char : toStandardFontChar(char);
  }
  return result;
};

/**
 * Indsætter ikke-brydende mellemrum (NBSP) mellem et tal og efterfølgende "kr.",
 * uanset om adskillelsen er mellemrum, tab eller linjeskift – forhindrer linjebrud
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
 * - Tegn uden for standardfontens tegnsæt gøres gengivelige (`toPdfStandardFontText`)
 *
 * Teksten gengives ellers tegn for tegn: brugerens fritekst og identifikatorer (fx et
 * journalnummer «AES-2024-01-15») omformes aldrig. Datoer formateres ved kilden.
 */
export const normalizeTextForDocument = (value: string): string => {
  return ensureNonBreakingKr(toPdfStandardFontText(value.replace(/\r\n/g, '\n')));
};

/**
 * Højrejusteret tekst i writer-sporet brydes aldrig over flere logiske ord.
 * NBSP mellem tal og "kr." er derfor unødvendigt og kan give forkert
 * breddeberegning i jsPDF's align:right-layout.
 */
export const normalizeRightAlignedTextForDocument = (value: string): string => {
  return normalizeTextForDocument(value).replace(/\u00A0/g, ' ');
};
