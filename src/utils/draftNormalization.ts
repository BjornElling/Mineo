/**
 * Hjælpere til draft-normalisering (kun ved commit).
 *
 * Alle hjælpere er deterministiske og uafhængige af locale/tidszone.
 * Unicode-sikre: al tegninspektion sker på fulde code points.
 */

/**
 * Opdel streng i Unicode-code points én gang for at undgå UTF-16-faldgruber.
 */
const toCodePoints = (s: string): readonly string[] => Array.from(s);

/**
 * Unicode-bogstav eller -ciffer.
 */
const isLetterOrDigit = (ch: string): boolean =>
  /[\p{L}\p{N}]/u.test(ch);

/**
 * Unicode-ciffer.
 */
const isDigit = (ch: string): boolean =>
  /[\p{N}]/u.test(ch);

/**
 * Tegn der behandles som minustegn (single source of truth).
 *
 * Alle disse normaliseres til ASCII '-' i output.
 */
const MINUS_REGEX_CLASS = '\u002D\u2212\u2013\u2014\u2011';

const MINUS_CHARS = new Set(
  Array.from(MINUS_REGEX_CLASS)
);

const LEADING_MINUS_REGEX = new RegExp(`^[${MINUS_REGEX_CLASS}]+`);

const isMinusChar = (ch: string): boolean =>
  MINUS_CHARS.has(ch);

/**
 * Fjern whitespace før det første tegn og efter det sidste tegn.
 */
export const trimWhitespaceEdges = (draft: string): string => {
  return draft.trim();
};

/**
 * Fjern alt før det første bogstav/ciffer og alt efter det sidste bogstav/ciffer.
 *
 * Hvis strengen ikke indeholder bogstaver/cifre, returneres "".
 */
export const trimToAlphanumericEdges = (draft: string): string => {
  if (draft === '') return draft;

  const chars = toCodePoints(draft);

  let start = -1;
  for (let i = 0; i < chars.length; i += 1) {
    if (isLetterOrDigit(chars[i]!)) {
      start = i;
      break;
    }
  }
  if (start === -1) return '';

  let end = -1;
  for (let i = chars.length - 1; i >= 0; i -= 1) {
    if (isLetterOrDigit(chars[i]!)) {
      end = i;
      break;
    }
  }
  if (end === -1) return '';

  return chars.slice(start, end + 1).join('');
};

/**
 * Normalisering af beløbsfelt.
 *
 * Regler:
 * - Udtrækker den numeriske kerne mellem første og sidste ciffer.
 * - Bevarer et enkelt foranstillet minus (ethvert Unicode-minus/bindestreg), hvis det optræder
 *   et eller andet sted før det første ciffer.
 * - Bevarer et foranstillet decimalkomma (",50", "-,50").
 * - Hvis der ikke er nogen cifre, returneres "".
 *
 * Normalisering:
 * - Ethvert genkendt minustegn normaliseres til ASCII '-'.
 */
export const trimToNumericEdgesPreserveLeadingMinus = (draft: string): string => {
  if (draft === '') return draft;

  const chars = toCodePoints(draft);

  let firstDigit = -1;
  for (let i = 0; i < chars.length; i += 1) {
    if (isDigit(chars[i]!)) {
      firstDigit = i;
      break;
    }
  }
  if (firstDigit === -1) return '';

  let lastDigit = -1;
  for (let i = chars.length - 1; i >= 0; i -= 1) {
    if (isDigit(chars[i]!)) {
      lastDigit = i;
      break;
    }
  }
  if (lastDigit === -1) return '';

  // Find ethvert minustegn før det første ciffer
  let hasLeadingMinus = false;
  for (let i = 0; i < firstDigit; i += 1) {
    if (isMinusChar(chars[i]!)) {
      hasLeadingMinus = true;
      break;
    }
  }

  // Find foranstillet decimalkomma direkte før det første ciffer
  const hasLeadingComma =
    firstDigit > 0 && chars[firstDigit - 1] === ',';

  const start =
    hasLeadingMinus && hasLeadingComma
      ? firstDigit - 2
      : hasLeadingMinus || hasLeadingComma
      ? firstDigit - 1
      : firstDigit;

  const safeStart = Math.max(0, start);

  let core = chars.slice(safeStart, lastDigit + 1).join('');

  // Normalisér ethvert minustegn til ASCII '-'
  if (hasLeadingMinus) {
    core = `-${core.replace(LEADING_MINUS_REGEX, '')}`;
  }

  return core;
};

/**
 * Hvis den committede draft starter med et decimalkomma, sættes et nul foran.
 *
 * Eksempler:
 * - ",50"  -> "0,50"
 * - "-,50" -> "-0,50"
 */
export const prefixZeroBeforeLeadingComma = (draft: string): string => {
  if (draft.startsWith(',')) {
    return `0${draft}`;
  }
  if (draft.startsWith('-,') && draft.length >= 2) {
    return `-0${draft.slice(1)}`;
  }
  return draft;
};

/**
 * Fjern grupperingsseparatorer (tusind-punktummer) fra beløbs-drafts.
 *
 * Dette er bevidst aggressivt.
 * Input antages udelukkende at være dansk-formateret.
 */
export const stripAmountGroupingSeparators = (draft: string): string => {
  if (draft === '') return draft;
  return draft.replace(/\./g, '');
};
