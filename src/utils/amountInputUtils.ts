export const DEFAULT_AMOUNT_PLACEHOLDER = '0,00';
/**
 * Placeholder for beløbsfelter, der ikke tillader decimaler. Et felt, hvor kommaet er blokeret, må ikke
 * love en decimalhale i sin placeholder — vælg denne ud fra `allowDecimals`, ikke i hånden pr. kaldssted.
 */
export const INTEGER_AMOUNT_PLACEHOLDER = '0';
export const DEFAULT_AMOUNT_PRECISION = 2;
// Gælder hele det rå input — også flerleddede udtryk (fx "12345,67 + 89012,34 - …").
// 64 var dimensioneret til ét enkelt beløb og afviste gyldige udtryk med ~6+ led
// (10-15 led løber let op i 100-200 tegn). 512 rummer rigeligt mange led og holder
// stadig et loft mod patologisk input.
export const MAX_AMOUNT_RAW_LENGTH = 512;
export const MAX_AMOUNT_INTEGER_DIGITS = 20;

export const containsAnyDigit = (input: string): boolean => {
  return /\d/.test(input);
};

const SPACE_LIKE_PATTERN = /[\s\u00A0\u202F]/g;

const normalizePasteMinus = (text: string): string => {
  return text.replace(/\u2212/g, '-');
};

const stripCurrencyAndNoise = (text: string): string => {
  return text
    .replace(/(?:^|[\s\u00A0\u202F(])(kr\.?|dkk)(?=$|[\s\u00A0\u202F).])/gi, ' ')
    .replace(SPACE_LIKE_PATTERN, ' ')
    .trim();
};

const hasGroupedTriplets = (parts: string[]): boolean => {
  if (parts.length < 2) return false;
  if (!/^\d{1,3}$/.test(parts[0] ?? '')) return false;
  return parts.slice(1).every((part) => /^\d{3}$/.test(part));
};

const extractMoneyLikeCandidate = (text: string): string | null => {
  if (!/\d/.test(text)) return null;
  const noiseStripped = text
    .replace(/[^0-9\s\u00A0\u202F.,()\-+'’`]/g, '')
    .replace(SPACE_LIKE_PATTERN, ' ')
    .trim();

  if (!/\d/.test(noiseStripped)) return null;
  if (/^[0-9\s\u00A0\u202F.,()\-+'’`]*$/.test(noiseStripped)) {
    return noiseStripped;
  }

  const matches = Array.from(
    noiseStripped.matchAll(/(?:\(\s*)?-?\s*\d(?:[\d\s\u00A0\u202F.,'’`]*\d)?(?:\s*\))?/g)
  )
    .map((match) => match[0].trim())
    .filter((match) => /\d/.test(match));

  if (matches.length === 0) return null;

  matches.sort((left, right) => {
    const digitDelta = (right.match(/\d/g) ?? []).length - (left.match(/\d/g) ?? []).length;
    if (digitDelta !== 0) return digitDelta;
    return right.length - left.length;
  });

  return matches[0] ?? null;
};

const normalizePlainMoneyLikePaste = (text: string): string | null => {
  const normalized = stripCurrencyAndNoise(normalizePasteMinus(text));
  if (normalized === '') return '';
  if (!/\d/.test(normalized)) return '';
  if (/[*/x+]/i.test(normalized)) return null;

  const extractedCandidate = extractMoneyLikeCandidate(normalized);
  if (extractedCandidate === null) return null;

  let candidate = extractedCandidate;
  let isNegative = false;

  const wrappedInParentheses = /^\(\s*.*\s*\)$/.test(candidate);
  if (wrappedInParentheses) {
    isNegative = true;
    candidate = candidate.replace(/^\(\s*/, '').replace(/\s*\)$/, '');
  }

  const minusMatches = candidate.match(/-/g) ?? [];
  if (minusMatches.length > 1) return null;
  if (minusMatches.length === 1 && !candidate.trim().startsWith('-')) return null;
  if (minusMatches.length === 1) {
    isNegative = true;
    candidate = candidate.replace(/-/g, '');
  }

  candidate = candidate.replace(/['’`]/g, '');
  candidate = candidate.replace(SPACE_LIKE_PATTERN, '');

  if (!/^[0-9.,]*$/.test(candidate) || !/\d/.test(candidate)) {
    return null;
  }

  const lastComma = candidate.lastIndexOf(',');
  const lastDot = candidate.lastIndexOf('.');

  let integerPart = candidate;
  let decimalPart: string | undefined;

  if (lastComma >= 0 && lastDot >= 0) {
    const decimalIndex = Math.max(lastComma, lastDot);
    const decimalChar = candidate[decimalIndex];
    const otherChar = decimalChar === ',' ? '.' : ',';
    integerPart = candidate.slice(0, decimalIndex).replace(new RegExp(`\\${otherChar}`, 'g'), '');
    decimalPart = candidate.slice(decimalIndex + 1).replace(new RegExp(`\\${otherChar}`, 'g'), '');
  } else if (lastComma >= 0) {
    const parts = candidate.split(',');
    if (parts.length > 2 && hasGroupedTriplets(parts)) {
      integerPart = parts.join('');
    } else {
      integerPart = parts.slice(0, -1).join('');
      decimalPart = parts.at(-1);
    }
  } else if (lastDot >= 0) {
    const parts = candidate.split('.');
    if (hasGroupedTriplets(parts)) {
      integerPart = parts.join('');
    } else {
      integerPart = parts.slice(0, -1).join('');
      decimalPart = parts.at(-1);
    }
  }

  integerPart = integerPart.replace(/[.,]/g, '');
  decimalPart = decimalPart?.replace(/[.,]/g, '');

  if (integerPart === '' && decimalPart === undefined) return '';
  if (integerPart === '') integerPart = '0';
  if (!/^\d+$/.test(integerPart)) return null;
  if (decimalPart !== undefined && !/^\d+$/.test(decimalPart)) return null;

  const normalizedNumber = decimalPart !== undefined ? `${integerPart},${decimalPart}` : integerPart;
  if (normalizedNumber === '') return '';
  return isNegative ? `-${normalizedNumber}` : normalizedNumber;
};

export const normalizeTrailingSeparator = (input: string): string => {
  const trimmed = input.trim();
  if (/^[+-]?\d+[.,]$/.test(trimmed) || /^[+-]?\d{1,3}(?:\.\d{3})*[.,]$/.test(trimmed)) {
    return trimmed.slice(0, -1);
  }
  return trimmed;
};

export const normalizePastedAmount = (text: string): string => {
  const normalizedMoneyLike = normalizePlainMoneyLikePaste(text);
  if (normalizedMoneyLike !== null) {
    return normalizedMoneyLike;
  }
  const normalizedMinus = normalizePasteMinus(text);
  const allowed = normalizedMinus.match(/[0-9+\-*/x()., ]/gi) ?? [];
  return allowed.join('').replace(/X/g, 'x');
};

export const normalizeZero = (value: number): number => {
  return Object.is(value, -0) ? 0 : value;
};
