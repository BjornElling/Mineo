import {
  DEFAULT_AMOUNT_PRECISION,
  MAX_AMOUNT_INPUT_INTEGER_DIGITS,
  MAX_AMOUNT_RAW_LENGTH,
} from './amountInputUtils';
import { DEFAULT_FRACTION_MAX_DIGITS, isFractionDraftAllowed } from './fraction';
import {
  isAmountExpressionDraftAllowed,
  isPercentDraftAllowed,
} from './numericDraftAdmission';
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
 * Normaliserer clipboard-tekst for fritekstfelter uden at trimme den.
 *
 * Paste skal ikke kunne gemme browserens forskellige whitespace-tegn eller CR-linjeslutninger i sagen.
 * Trimning hører fortsat til det fælles settle, så en åben draft ikke ændrer brugerens ydre mellemrum.
 */
export const normalizeClipboardText = (
  raw: string,
  options: Readonly<{ preservesLineBreaks?: boolean }> = {}
): string => {
  const lineEndingsNormalized = raw.replace(/\r\n?/gu, '\n');
  const whitespaceNormalized = lineEndingsNormalized
    .replace(/[\u00a0\u202f\u2007\u2000-\u200a\t]/gu, ' ')
    .replace(/[\u200b\ufeff\u00ad]/gu, '');
  const lineBreaksNormalized = options.preservesLineBreaks === true
    ? whitespaceNormalized
    : whitespaceNormalized.replace(/\n/gu, ' ');
  return lineBreaksNormalized.replace(/ {2,}/gu, ' ');
};

/**
 * Behandler den indsatte tekst som på hinanden følgende tastetryk fra et tomt felt.
 * Tegn, der ikke passer feltets aktuelle tekst, springes over, mens resten fortsætter.
 */
const filterPasteCharacters = (
  text: string,
  isDraftAllowed: (draft: string) => boolean,
  maxLength?: number
): string => {
  let result = '';
  for (const character of text) {
    const candidate = `${result}${character}`;
    if ((maxLength === undefined || candidate.length <= maxLength) && isDraftAllowed(candidate)) {
      result = candidate;
    }
  }
  return result;
};

/**
 * Filtrerer dato-paste efter cifferlængde og tegnfølge — aldrig efter kalender-værdi.
 *
 * Et ciffer, der overskrider dag/måned/år-segmentets længde, springes over, men afbryder ikke resten af
 * pasten. Det er vigtigt, at fx `32-12-2020` når frem til settle som netop den ugyldige dato, så en
 * kalenderfejl ikke tavst reduceres til `3`. Separatorer før første tal ignoreres, og gentagne separatorer
 * kollapses ved at springe alle efter den første over (§1.2a og §2.1).
 */
export const normalizeDatePaste = (text: string): string => {
  const segmentMaxLengths = [2, 2, 4] as const;
  const digitGroups = text.match(/[0-9]+/g) ?? [];
  let segmentIndex = 0;
  let result = '';

  for (const [groupIndex, group] of digitGroups.entries()) {
    if (segmentIndex >= segmentMaxLengths.length) break;

    // Den første sammenhængende ciffergruppe kan være en separatorfri dato (`17121956`) og fylder
    // derfor flere komponenter. Efterfølgende grupper er allerede adskilt af mindst ét ugyldigt tegn;
    // de hører kun til den næste komponent. Det springer både gentagne separatorer og overskydende
    // cifre over uden at afbryde resten af paste-handlingen (`12-345-2020` → `12-34-2020`).
    const available = segmentMaxLengths[segmentIndex];
    const accepted = groupIndex === 0
      ? group.slice(0, segmentMaxLengths.slice(segmentIndex).reduce((sum, max) => sum + max, 0))
      : group.slice(0, available);
    let offset = 0;
    while (offset < accepted.length && segmentIndex < segmentMaxLengths.length) {
      const segment = accepted.slice(offset, offset + segmentMaxLengths[segmentIndex]);
      if (segment !== '') {
        if (result !== '') result += '-';
        result += segment;
        offset += segment.length;
        segmentIndex += 1;
      }
    }

  }

  return result;
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
  const allowNegative = options.allowNegative === true;
  const maxDigits = options.maxDigits;
  return filterPasteCharacters(text, (draft) => {
    const unsigned = draft.startsWith('-') ? draft.slice(1) : draft;
    return (allowNegative ? /^-?\d*$/ : /^\d*$/).test(draft)
      && (maxDigits === undefined || unsigned.length <= maxDigits);
  });
};

export const normalizeAmountPaste = (
  text: string,
  options: AmountPasteOptions = {}
): string => {
  const allowDecimals = options.allowDecimals !== false;
  const maxIntegerDigits = normalizePositiveIntegerOption(
    options.maxIntegerDigits,
    MAX_AMOUNT_INPUT_INTEGER_DIGITS
  );
  const maxDecimalDigits = normalizeNonNegativeIntegerOption(
    options.maxDecimalDigits,
    DEFAULT_AMOUNT_PRECISION
  );
  const maxRawLength = normalizePositiveIntegerOption(options.maxRawLength, MAX_AMOUNT_RAW_LENGTH);
  return filterPasteCharacters(
    text,
    (draft) => isAmountExpressionDraftAllowed(draft, {
      allowNegative: options.allowNegative,
      allowDecimals,
      maxIntegerDigits,
      maxDecimalDigits,
    }),
    maxRawLength
  );
};

export const normalizePercentPaste = (
  text: string,
  options: NumericPasteOptions = {}
): string => {
  const allowDecimals = options.allowDecimals === true;
  const maxIntegerDigits = normalizePositiveIntegerOption(options.maxIntegerDigits, 3);
  const maxDecimalDigits = normalizeNonNegativeIntegerOption(options.maxDecimalDigits, 2);
  return filterPasteCharacters(text, (draft) => isPercentDraftAllowed(draft, {
    allowNegative: options.allowNegative,
    allowDecimals,
    maxIntegerDigits,
    maxDecimalDigits,
  }));
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
  return filterPasteCharacters(text, (draft) =>
    (options.requireIntegerFraction !== true || !draft.includes(','))
    && isFractionDraftAllowed(draft, { maxDigits, allowNegative: options.allowNegative })
  );
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
