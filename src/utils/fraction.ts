import { parseDanishNumberString } from './numberParsing';
import { isSafeCanonicalNumber } from './numericSafety';

export type FractionParseOptions = Readonly<{
  maxDigits?: number;
  allowNegative?: boolean;
  allowZeroNumerator?: boolean;
  canonicalizeOnCommit?: boolean;
  requireIntegerFraction?: boolean;
}>;

export type ParsedFraction = Readonly<{
  numerator: number;
  denominator: number;
  value: string;
  factor: number;
  isIntegerFraction: boolean;
}>;

export type FractionParseFailureReason =
  | 'empty'
  | 'invalid'
  | 'zero-denominator'
  | 'zero-numerator'
  | 'negative-not-allowed'
  | 'non-integer';

export type FractionParseResult =
  | Readonly<{ ok: true; parsed: ParsedFraction }>
  | Readonly<{ ok: false; reason: FractionParseFailureReason }>;

export const DEFAULT_FRACTION_MAX_DIGITS = 10;
export const INTEGER_FRACTION_FORMAT_MESSAGE = 'Brøk skal angives som fx "1/3" (kun hele tal i tæller og nævner)';

const buildDecimalPartPattern = (maxDigits: number): string => `(?:,\\d{1,${maxDigits}})?`;

const buildTokenPattern = (maxDigits: number, allowNegative: boolean): RegExp => {
  const sign = allowNegative ? '-?' : '';
  return new RegExp(`^${sign}\\d{1,${maxDigits}}${buildDecimalPartPattern(maxDigits)}$`);
};

const buildDraftPattern = (maxDigits: number, allowNegative: boolean): RegExp => {
  const sign = allowNegative ? '-?' : '';
  return new RegExp(
    `^${sign}\\d{0,${maxDigits}}(?:,\\d{0,${maxDigits}})?(?:\\/\\d{0,${maxDigits}}(?:,\\d{0,${maxDigits}})?)?$`
  );
};

const normalizeToken = (raw: string, options: Readonly<{ maxDigits: number; allowNegative: boolean }>): string | null => {
  const trimmed = raw.trim();
  if (!buildTokenPattern(options.maxDigits, options.allowNegative).test(trimmed)) {
    return null;
  }
  return trimmed;
};

const gcd = (a: number, b: number): number => {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y !== 0) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x === 0 ? 1 : x;
};

const hasDecimalSeparator = (value: string): boolean => value.includes(',');

export const getFractionMaxLength = (maxDigits = DEFAULT_FRACTION_MAX_DIGITS, allowNegative = false): number => {
  const tokenLength = maxDigits + 1 + maxDigits;
  return (allowNegative ? 1 : 0) + tokenLength + 1 + tokenLength;
};

export const isFractionDraftAllowed = (
  value: string,
  options: Readonly<{ maxDigits?: number; allowNegative?: boolean }> = {}
): boolean => {
  const maxDigits = options.maxDigits ?? DEFAULT_FRACTION_MAX_DIGITS;
  const allowNegative = options.allowNegative === true;
  return buildDraftPattern(maxDigits, allowNegative).test(value);
};

export const parseFractionString = (
  raw: string,
  options: FractionParseOptions = {}
): FractionParseResult => {
  const maxDigits = options.maxDigits ?? DEFAULT_FRACTION_MAX_DIGITS;
  const allowNegative = options.allowNegative === true;
  const allowZeroNumerator = options.allowZeroNumerator === true;
  const canonicalizeOnCommit = options.canonicalizeOnCommit === true;
  const requireIntegerFraction = options.requireIntegerFraction === true;
  const trimmed = raw.trim();

  if (trimmed === '') return { ok: false, reason: 'empty' };

  const slashCount = (trimmed.match(/\//g) ?? []).length;
  if (slashCount !== 1) return { ok: false, reason: 'invalid' };

  const [rawNumerator, rawDenominator] = trimmed.split('/') as [string, string];
  if (rawNumerator.trim().startsWith('-') && !allowNegative) {
    return { ok: false, reason: 'negative-not-allowed' };
  }
  const numeratorToken = normalizeToken(rawNumerator, { maxDigits, allowNegative });
  const denominatorToken = normalizeToken(rawDenominator, { maxDigits, allowNegative: false });
  if (numeratorToken === null || denominatorToken === null) return { ok: false, reason: 'invalid' };

  // Brøken bevares som tekst, men dens afledte faktor må ikke bygge på skjult
  // afrunding af tæller eller nævner ved konverteringen til JavaScript-tal.
  const numerator = parseDanishNumberString(numeratorToken);
  const denominator = parseDanishNumberString(denominatorToken);
  if (numerator === undefined || denominator === undefined) return { ok: false, reason: 'invalid' };
  if (denominator === 0) return { ok: false, reason: 'zero-denominator' };
  if (numerator === 0 && !allowZeroNumerator) return { ok: false, reason: 'zero-numerator' };
  if (numerator < 0 && !allowNegative) return { ok: false, reason: 'negative-not-allowed' };

  const isIntegerFraction = !hasDecimalSeparator(numeratorToken) && !hasDecimalSeparator(denominatorToken);
  if (requireIntegerFraction && !isIntegerFraction) {
    return { ok: false, reason: 'non-integer' };
  }

  const factor = numerator / denominator;
  // Operanderne kan hver for sig være sikre, mens kvotienten bliver så stor,
  // at binary64 ikke længere kan bære et deterministisk afledt tal.
  if (!isSafeCanonicalNumber(factor)) return { ok: false, reason: 'invalid' };

  if (canonicalizeOnCommit && isIntegerFraction) {
    const divisor = gcd(numerator, denominator);
    const reducedNumerator = numerator / divisor;
    const reducedDenominator = denominator / divisor;
    return {
      ok: true,
      parsed: {
        numerator,
        denominator,
        factor,
        value: `${reducedNumerator}/${reducedDenominator}`,
        isIntegerFraction: true,
      },
    };
  }

  return {
    ok: true,
    parsed: {
      numerator,
      denominator,
      factor,
      value: `${numeratorToken}/${denominatorToken}`,
      isIntegerFraction,
    },
  };
};
