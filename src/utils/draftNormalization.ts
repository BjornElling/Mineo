/**
 * Draft normalization helpers (commit-time only).
 *
 * All helpers are deterministic and locale/timezone independent.
 * Unicode-safe: all character inspection is done on full code points.
 */

/**
 * Split string into Unicode code points once, to avoid UTF-16 pitfalls.
 */
const toCodePoints = (s: string): readonly string[] => Array.from(s);

/**
 * Unicode letter or digit.
 */
const isLetterOrDigit = (ch: string): boolean =>
  /[\p{L}\p{N}]/u.test(ch);

/**
 * Unicode digit.
 */
const isDigit = (ch: string): boolean =>
  /[\p{N}]/u.test(ch);

/**
 * Characters that are treated as minus signs (single source of truth).
 *
 * All of these are normalized to ASCII '-' in output.
 */
const MINUS_REGEX_CLASS = '\u002D\u2212\u2013\u2014\u2011';

const MINUS_CHARS = new Set(
  Array.from(MINUS_REGEX_CLASS)
);

const LEADING_MINUS_REGEX = new RegExp(`^[${MINUS_REGEX_CLASS}]+`);

const isMinusChar = (ch: string): boolean =>
  MINUS_CHARS.has(ch);

/**
 * Remove whitespace before the first character and after the last character.
 */
export const trimWhitespaceEdges = (draft: string): string => {
  return draft.trim();
};

/**
 * Remove everything before the first letter/digit and everything after the last letter/digit.
 *
 * If the string contains no letters/digits, returns "".
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
 * Amount-field normalization.
 *
 * Rules:
 * - Extracts the numeric core between first and last digit.
 * - Preserves a single leading minus (any Unicode minus/hyphen) if it appears
 *   anywhere before the first digit.
 * - Preserves a leading decimal comma (",50", "-,50").
 * - If no digits are present, returns "".
 *
 * Normalization:
 * - Any recognized minus character is normalized to ASCII '-'.
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

  // Detect any minus character before the first digit
  let hasLeadingMinus = false;
  for (let i = 0; i < firstDigit; i += 1) {
    if (isMinusChar(chars[i]!)) {
      hasLeadingMinus = true;
      break;
    }
  }

  // Detect leading decimal comma directly before the first digit
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

  // Normalize any minus character to ASCII '-'
  if (hasLeadingMinus) {
    core = `-${core.replace(LEADING_MINUS_REGEX, '')}`;
  }

  return core;
};

/**
 * If the committed draft starts with a decimal comma, prefix a zero.
 *
 * Examples:
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
 * Strip grouping separators (thousands dots) from amount drafts.
 *
 * This is intentionally aggressive.
 * Input is assumed to be Danish-formatted only.
 */
export const stripAmountGroupingSeparators = (draft: string): string => {
  if (draft === '') return draft;
  return draft.replace(/\./g, '');
};
