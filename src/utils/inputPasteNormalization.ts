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

const extractOneOrTwoDigits = (
  text: string,
  start: number
): Readonly<{ value: string; nextIndex: number }> => {
  const firstDigitIndex = findNextDigitIndex(text, start);
  if (firstDigitIndex === -1) {
    return { value: '', nextIndex: text.length };
  }

  const firstDigit = text[firstDigitIndex] ?? '';
  const secondChar = text[firstDigitIndex + 1];
  if (secondChar !== undefined && /\d/.test(secondChar)) {
    return {
      value: `${firstDigit}${secondChar}`,
      nextIndex: firstDigitIndex + 2,
    };
  }

  return {
    value: firstDigit,
    nextIndex: firstDigitIndex + 1,
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

const extractDigitRun = (text: string): string => {
  const firstDigitIndex = findNextDigitIndex(text, 0);
  if (firstDigitIndex === -1) return '';

  let end = firstDigitIndex;
  while (end < text.length && /\d/.test(text[end] ?? '')) {
    end += 1;
  }

  return text.slice(firstDigitIndex, end);
};

/**
 * Vælger det længste cifferpræfiks hvis værdi ikke overskrider `maxValue`.
 *
 * `maxValue` er pr. konvention en positiv ØVRE grænse, og denne helper er en draft-
 * pre-filter — ikke den endelige range-validering. For negative pastes (`isNegative`)
 * er enhver værdi ≤ en positiv maxValue, så hele cifferløbet beholdes; den nedre
 * grænse (minValue) ejes bevidst af feltets `enforceRange`/parse-lag, ikke her.
 */
const takeLongestNumericPrefixWithinMaxValue = (
  digits: string,
  maxValue: number | undefined,
  isNegative = false
): string => {
  if (digits === '') return '';
  if (typeof maxValue !== 'number' || !Number.isFinite(maxValue)) {
    return digits;
  }

  let best = '';
  for (let length = 1; length <= digits.length; length += 1) {
    const candidate = digits.slice(0, length);
    const unsigned = Number.parseInt(candidate, 10);
    const numeric = isNegative ? -unsigned : unsigned;
    if (Number.isFinite(numeric) && numeric <= maxValue) {
      best = candidate;
      continue;
    }
    break;
  }

  return best;
};

const extractNumberToken = (
  text: string,
  start: number
): Readonly<{ value: string; nextIndex: number }> => {
  const firstDigitIndex = findNextDigitIndex(text, start);
  if (firstDigitIndex === -1) {
    return { value: '', nextIndex: text.length };
  }

  let index = firstDigitIndex;
  while (index < text.length && /\d/.test(text[index] ?? '')) {
    index += 1;
  }

  if (text[index] === ',') {
    index += 1;
    while (index < text.length && /\d/.test(text[index] ?? '')) {
      index += 1;
    }
  }

  return {
    value: text.slice(firstDigitIndex, index),
    nextIndex: index,
  };
};

export const normalizeDatePaste = (text: string): string => {
  const day = extractOneOrTwoDigits(text, 0);
  if (day.value === '') return '';

  const month = extractOneOrTwoDigits(text, day.nextIndex);
  if (month.value === '') return day.value;

  const year = extractContiguousDigits(text, month.nextIndex, 4);
  if (year.value === '') return `${day.value}-${month.value}`;

  return `${day.value}-${month.value}-${year.value}`;
};

export const normalizeIntegerPaste = (
  text: string,
  options: Readonly<{ maxDigits?: number; maxValue?: number; allowNegative?: boolean }> = {}
): string => {
  const firstDigitIndex = findNextDigitIndex(text, 0);
  if (firstDigitIndex === -1) return '';

  const run = extractDigitRun(text);
  if (run === '') return '';
  const isNegative = options.allowNegative === true && hasNegativeMarkerBeforeIndex(text, firstDigitIndex);

  const maxDigits =
    typeof options.maxDigits === 'number' && Number.isFinite(options.maxDigits) && options.maxDigits > 0
      ? Math.trunc(options.maxDigits)
      : run.length;

  const truncated = run.slice(0, maxDigits);
  const prefix = takeLongestNumericPrefixWithinMaxValue(truncated, options.maxValue, isNegative);
  if (prefix === '') return '';
  return isNegative ? `-${prefix}` : prefix;
};

export const normalizeAmountPaste = (text: string, options: Readonly<{ allowNegative?: boolean }> = {}): string => {
  const firstDigitIndex = findNextDigitIndex(text, 0);
  if (firstDigitIndex === -1) return '';
  const isNegative = options.allowNegative === true && hasNegativeMarkerBeforeIndex(text, firstDigitIndex);

  let index = firstDigitIndex;
  let value = '';
  let sawComma = false;

  while (index < text.length) {
    const char = text[index] ?? '';
    if (/\d/.test(char)) {
      value += char;
      index += 1;
      continue;
    }

    if (!sawComma && char === '.') {
      index += 1;
      continue;
    }

    if (!sawComma && char === ',') {
      value += char;
      sawComma = true;
      index += 1;
      continue;
    }

    break;
  }

  if (value === '') return '';
  return isNegative ? `-${value}` : value;
};

export const normalizePercentPaste = (
  text: string,
  options: Readonly<{ maxIntegerDigits?: number; maxValue?: number }> = {}
): string => {
  const run = extractDigitRun(text);
  if (run === '') return '';

  const maxIntegerDigits =
    typeof options.maxIntegerDigits === 'number' &&
    Number.isFinite(options.maxIntegerDigits) &&
    options.maxIntegerDigits > 0
      ? Math.trunc(options.maxIntegerDigits)
      : run.length;
  return takeLongestNumericPrefixWithinMaxValue(
    run.slice(0, maxIntegerDigits),
    options.maxValue
  );
};

export const normalizeFractionPaste = (text: string): string => {
  const numerator = extractNumberToken(text, 0);
  if (numerator.value === '') return '';

  const slashIndex = text.indexOf('/', numerator.nextIndex);
  if (slashIndex === -1) {
    return numerator.value;
  }

  const denominator = extractNumberToken(text, slashIndex + 1);
  return `${numerator.value}/${denominator.value}`;
};

export const normalizeWeekPaste = (text: string): string => {
  const firstDigitIndex = findNextDigitIndex(text, 0);
  if (firstDigitIndex === -1) return '';

  const firstDigit = text[firstDigitIndex] ?? '';
  let weekValue = firstDigit;
  let nextIndex = firstDigitIndex + 1;

  const secondChar = text[firstDigitIndex + 1];
  if (secondChar !== undefined && /\d/.test(secondChar)) {
    const twoDigitWeek = `${firstDigit}${secondChar}`;
    const numericWeek = Number.parseInt(twoDigitWeek, 10);
    if (Number.isFinite(numericWeek) && numericWeek <= 53) {
      weekValue = twoDigitWeek;
      nextIndex = firstDigitIndex + 2;
    }
  }

  const year = extractContiguousDigits(text, nextIndex, 4);
  if (year.value === '') return weekValue;

  return `${weekValue}/${year.value}`;
};

export const normalizeYearPaste = (text: string): string => {
  return extractContiguousDigits(text, 0, 4).value;
};
