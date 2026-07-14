import {
  DEFAULT_AMOUNT_PRECISION,
  MAX_AMOUNT_INTEGER_DIGITS,
  MAX_AMOUNT_RAW_LENGTH,
  normalizePastedAmount,
} from './amountInputUtils';
import { parseAmountInput } from './expressionAmount';
import { DEFAULT_FRACTION_MAX_DIGITS } from './fraction';
import { hasSafeDecimalDigits } from './numericSafety';
import { resolveYearFromToken, type TwoDigitYearPolicy } from './yearDraftCore';

const findNextDigitIndex = (text: string, start: number): number => {
  for (let index = Math.max(0, start); index < text.length; index += 1) {
    const char = text[index];
    if (char !== undefined && /\d/.test(char)) {
      return index;
    }
  }
  return -1;
};

const hasNegativeMarkerBeforeIndex = (text: string, index: number): boolean => {
  for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
    const char = text[cursor];
    if (char === undefined) break;
    if (/\s/.test(char)) continue;
    return char === '-';
  }
  return false;
};

const extractBoundedDateComponent = (
  text: string,
  start: number,
  maxValue: number
): Readonly<{ value: string; nextIndex: number; overflow: boolean }> => {
  const firstDigitIndex = findNextDigitIndex(text, start);
  if (firstDigitIndex === -1) {
    return { value: '', nextIndex: text.length, overflow: false };
  }

  const firstDigit = text[firstDigitIndex] ?? '';
  const secondChar = text[firstDigitIndex + 1];
  if (secondChar !== undefined && /\d/.test(secondChar)) {
    const twoDigits = `${firstDigit}${secondChar}`;
    const twoDigitValue = Number.parseInt(twoDigits, 10);
    if (twoDigitValue >= 1 && twoDigitValue <= maxValue) {
      return { value: twoDigits, nextIndex: firstDigitIndex + 2, overflow: false };
    }

    const oneDigitValue = Number.parseInt(firstDigit, 10);
    if (oneDigitValue >= 1 && oneDigitValue <= maxValue) {
      return { value: firstDigit, nextIndex: firstDigitIndex + 1, overflow: true };
    }

    return {
      value: '',
      nextIndex: firstDigitIndex,
      overflow: true,
    };
  }

  const oneDigitValue = Number.parseInt(firstDigit, 10);
  if (oneDigitValue < 1 || oneDigitValue > maxValue) {
    return { value: '', nextIndex: firstDigitIndex, overflow: true };
  }

  return {
    value: firstDigit,
    nextIndex: firstDigitIndex + 1,
    overflow: false,
  };
};

const extractContiguousDigits = (
  text: string,
  start: number,
  maxDigits: number
): Readonly<{ value: string; nextIndex: number }> => {
  const firstDigitIndex = findNextDigitIndex(text, start);
  if (firstDigitIndex === -1) {
    return { value: '', nextIndex: text.length };
  }

  let end = firstDigitIndex;
  while (end < text.length && /\d/.test(text[end] ?? '') && end - firstDigitIndex < maxDigits) {
    end += 1;
  }

  return {
    value: text.slice(firstDigitIndex, end),
    nextIndex: end,
  };
};

type NumericPasteOptions = Readonly<{
  allowNegative?: boolean;
  allowDecimals?: boolean;
  maxIntegerDigits?: number;
  maxDecimalDigits?: number;
  minValue?: number;
  maxValue?: number;
}>;

type AmountPasteOptions = NumericPasteOptions & Readonly<{
  maxRawLength?: number;
}>;

const NUMERIC_GROUPING_PATTERN = /[\s\u00A0\u202F'’`]/g;

const hasGroupedTriplets = (parts: readonly string[]): boolean => {
  if (parts.length < 2 || !/^\d{1,3}$/.test(parts[0] ?? '')) return false;
  return parts.slice(1).every((part) => /^\d{3}$/.test(part));
};

const extractNumericToken = (text: string, start = 0): Readonly<{
  integerDigits: string;
  decimalDigits: string;
  firstDigitIndex: number;
}> => {
  const firstDigitIndex = findNextDigitIndex(text, start);
  if (firstDigitIndex === -1) {
    return { integerDigits: '', decimalDigits: '', firstDigitIndex };
  }

  let end = firstDigitIndex;
  while (end < text.length && /[\d.,\s\u00A0\u202F'’`]/.test(text[end] ?? '')) {
    end += 1;
  }

  const token = text.slice(firstDigitIndex, end).trim().replace(NUMERIC_GROUPING_PATTERN, '');
  const lastComma = token.lastIndexOf(',');
  const lastDot = token.lastIndexOf('.');
  let decimalIndex = -1;

  if (lastComma >= 0 && lastDot >= 0) {
    decimalIndex = Math.max(lastComma, lastDot);
  } else if (lastComma >= 0) {
    const parts = token.split(',');
    // Komma er dansk decimalseparator. Kun flere entydige 3-ciffergrupper behandles
    // som et internationalt grupperet heltal.
    if (parts.length <= 2 || !hasGroupedTriplets(parts)) decimalIndex = lastComma;
  } else if (lastDot >= 0) {
    const parts = token.split('.');
    if (!hasGroupedTriplets(parts)) decimalIndex = lastDot;
  }

  const integerSource = decimalIndex === -1 ? token : token.slice(0, decimalIndex);
  const decimalSource = decimalIndex === -1 ? '' : token.slice(decimalIndex + 1);
  return {
    integerDigits: integerSource.replace(/[^0-9]/g, ''),
    decimalDigits: decimalSource.replace(/[^0-9]/g, ''),
    firstDigitIndex,
  };
};

const normalizePositiveIntegerOption = (value: number | undefined, fallback: number): number => {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.trunc(value)
    : fallback;
};

const normalizeNonNegativeIntegerOption = (value: number | undefined, fallback: number): number => {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? Math.trunc(value)
    : fallback;
};

const isWithinBounds = (value: number, minValue: number | undefined, maxValue: number | undefined): boolean => {
  return (typeof minValue !== 'number' || !Number.isFinite(minValue) || value >= minValue)
    && (typeof maxValue !== 'number' || !Number.isFinite(maxValue) || value <= maxValue);
};

/**
 * Paste behandles ens i alle numeriske felter: start ved første tal, behold kun feltets
 * tilladte format, og afkort fra højre til det længste præfiks der overholder intervallet.
 * Decimaldelen er dermed altid det første, der forsvinder ved en overskridelse.
 */
const normalizeNumericPaste = (text: string, options: NumericPasteOptions): string => {
  const token = extractNumericToken(text);
  if (token.integerDigits === '') return '';

  const isNegative = options.allowNegative === true
    && hasNegativeMarkerBeforeIndex(text, token.firstDigitIndex);
  const maxIntegerDigits = normalizePositiveIntegerOption(
    options.maxIntegerDigits,
    token.integerDigits.length
  );
  const maxDecimalDigits = normalizeNonNegativeIntegerOption(options.maxDecimalDigits, 2);
  const integerDigits = token.integerDigits.slice(0, maxIntegerDigits);
  const decimalDigits = options.allowDecimals === true
    ? token.decimalDigits.slice(0, maxDecimalDigits)
    : '';
  const sign = isNegative ? '-' : '';
  let candidate = `${sign}${integerDigits}${decimalDigits === '' ? '' : `,${decimalDigits}`}`;

  while (candidate !== '' && candidate !== '-') {
    const unsigned = candidate.startsWith('-') ? candidate.slice(1) : candidate;
    const [candidateIntegerDigits, candidateDecimalDigits = ''] = unsigned.split(',') as [string, string?];
    const value = Number(candidate.replace(',', '.'));
    if (
      hasSafeDecimalDigits(
        candidateIntegerDigits,
        candidateDecimalDigits,
        options.allowDecimals === true ? maxDecimalDigits : 0
      )
      && Number.isFinite(value)
      && isWithinBounds(value, options.minValue, options.maxValue)
    ) {
      return candidate;
    }

    candidate = candidate.slice(0, -1);
    if (candidate.endsWith(',')) candidate = candidate.slice(0, -1);
  }

  return '';
};

export const normalizeDatePaste = (
  text: string,
  options: Readonly<{ twoDigitYearPolicy?: TwoDigitYearPolicy }> = {}
): string => {
  const day = extractBoundedDateComponent(text, 0, 31);
  if (day.value === '') return '';
  if (day.overflow) return day.value;

  const month = extractBoundedDateComponent(text, day.nextIndex, 12);
  if (month.value === '') return day.value;
  if (month.overflow) return `${day.value}-${month.value}`;

  const year = normalizeYearPaste(text.slice(month.nextIndex), options);
  if (year === '') return `${day.value}-${month.value}`;

  return `${day.value}-${month.value}-${year}`;
};

export const normalizeIntegerPaste = (
  text: string,
  options: Readonly<{
    maxDigits?: number;
    minValue?: number;
    maxValue?: number;
    allowNegative?: boolean;
  }> = {}
): string => {
  return normalizeNumericPaste(text, {
    allowNegative: options.allowNegative,
    allowDecimals: false,
    maxIntegerDigits: options.maxDigits,
    minValue: options.minValue,
    maxValue: options.maxValue,
  });
};

export const normalizeAmountPaste = (
  text: string,
  options: AmountPasteOptions = {}
): string => {
  const allowDecimals = options.allowDecimals !== false;
  const maxIntegerDigits = normalizePositiveIntegerOption(
    options.maxIntegerDigits,
    MAX_AMOUNT_INTEGER_DIGITS
  );
  const maxDecimalDigits = normalizeNonNegativeIntegerOption(
    options.maxDecimalDigits,
    DEFAULT_AMOUNT_PRECISION
  );
  const maxRawLength = normalizePositiveIntegerOption(options.maxRawLength, MAX_AMOUNT_RAW_LENGTH);
  const normalized = normalizePastedAmount(text);
  const firstDigitIndex = findNextDigitIndex(normalized, 0);
  if (firstDigitIndex === -1) return '';
  const prefix = normalized.slice(0, firstDigitIndex).trimEnd();
  const numericStart = prefix.endsWith('-') ? firstDigitIndex - 1 : firstDigitIndex;
  let candidate = normalized
    .slice(Math.max(0, numericStart))
    .replace(/X/g, 'x')
    .replace(/(\d(?:[\d.,\s\u00A0\u202F'’`]*\d)?|\d)/g, (token) => normalizeNumericPaste(token, {
      allowDecimals,
      maxIntegerDigits,
      maxDecimalDigits,
    }))
    .slice(0, maxRawLength)
    .trim();

  if (options.allowNegative !== true) {
    // Minus efter start, parentes eller en operator er unært og fjernes; binær subtraktion bevares.
    candidate = candidate.replace(/(^|[+*/x(])\s*-\s*/g, '$1');
  }

  while (candidate !== '') {
    const parsed = parseAmountInput(candidate, {
      precision: maxDecimalDigits,
      allowNegative: options.allowNegative === true,
      allowDecimals,
      maxIntegerDigits,
      maxRawLength,
    });
    if (
      parsed.ok
      && parsed.value !== undefined
      && isWithinBounds(parsed.value.value, options.minValue, options.maxValue)
    ) {
      return candidate;
    }

    candidate = candidate.slice(0, -1).trimEnd();
  }

  return '';
};

export const normalizePercentPaste = (
  text: string,
  options: NumericPasteOptions = {}
): string => {
  return normalizeNumericPaste(text, {
    ...options,
    allowDecimals: options.allowDecimals === true,
  });
};

export const normalizeFractionPaste = (
  text: string,
  options: Readonly<{
    maxDigits?: number;
    allowNegative?: boolean;
    requireIntegerFraction?: boolean;
  }> = {}
): string => {
  const maxDigits = normalizePositiveIntegerOption(options.maxDigits, DEFAULT_FRACTION_MAX_DIGITS);
  const numerator = normalizeNumericPaste(text, {
    allowNegative: options.allowNegative,
    allowDecimals: options.requireIntegerFraction !== true,
    maxIntegerDigits: maxDigits,
    maxDecimalDigits: maxDigits,
  });
  if (numerator === '') return '';

  const firstDigitIndex = findNextDigitIndex(text, 0);
  const slashIndex = text.indexOf('/', Math.max(0, firstDigitIndex));
  if (slashIndex === -1) {
    return numerator;
  }

  const denominator = normalizeNumericPaste(text.slice(slashIndex + 1), {
    allowNegative: options.allowNegative,
    allowDecimals: options.requireIntegerFraction !== true,
    maxIntegerDigits: maxDigits,
    maxDecimalDigits: maxDigits,
  });
  return `${numerator}/${denominator}`;
};

export const normalizeWeekPaste = (
  text: string,
  options: Readonly<{
    minYear?: number;
    maxYear?: number;
    twoDigitYearPolicy?: TwoDigitYearPolicy;
    maxDraftLength?: number;
  }> = {}
): string => {
  const firstDigitIndex = findNextDigitIndex(text, 0);
  if (firstDigitIndex === -1) return '';

  const firstDigit = text[firstDigitIndex] ?? '';
  if (firstDigit === '0') return '';
  let weekValue = firstDigit;
  let nextIndex = firstDigitIndex + 1;

  const secondChar = text[firstDigitIndex + 1];
  if (secondChar !== undefined && /\d/.test(secondChar)) {
    const twoDigitWeek = `${firstDigit}${secondChar}`;
    const numericWeek = Number.parseInt(twoDigitWeek, 10);
    if (Number.isFinite(numericWeek) && numericWeek <= 53) {
      weekValue = twoDigitWeek;
      nextIndex = firstDigitIndex + 2;
    } else {
      // Andet ciffer overskrider ugeformatets maksimum; resten af pasten afskæres.
      return weekValue;
    }
  }

  const year = normalizeYearPaste(text.slice(nextIndex), options);
  const combined = year === '' ? weekValue : `${weekValue}/${year}`;
  const maxDraftLength = normalizePositiveIntegerOption(options.maxDraftLength, combined.length);
  const truncated = combined.slice(0, maxDraftLength);
  return truncated.endsWith('/') ? truncated.slice(0, -1) : truncated;
};

export const normalizeYearPaste = (
  text: string,
  options: Readonly<{
    minYear?: number;
    maxYear?: number;
    twoDigitYearPolicy?: TwoDigitYearPolicy;
  }> = {}
): string => {
  const digits = extractContiguousDigits(text, 0, 4).value;
  const policy = options.twoDigitYearPolicy ?? 'infer';

  for (let length = digits.length; length >= 1; length -= 1) {
    const candidate = digits.slice(0, length);
    const year = resolveYearFromToken(candidate, policy);
    if (year !== null && isWithinBounds(year, options.minYear, options.maxYear)) {
      return candidate;
    }
  }

  return '';
};
