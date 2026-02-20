import { formatAsAmount } from './formatUtils';
import { containsAnyDigit, normalizeTrailingSeparator, normalizeZero } from './amountInputUtils';
import type { AmountValue } from '../schemas/amountExpressionSchema';

export type ExpressionErrorCode =
  | 'INVALID_CHAR'
  | 'UNBALANCED_PAREN'
  | 'INVALID_OPERATOR_SEQUENCE'
  | 'DIVISION_BY_ZERO'
  | 'EMPTY_EXPRESSION';

export type ExpressionError = Readonly<{
  code: ExpressionErrorCode;
  message: string;
}>;

export type AmountParseError = Readonly<{
  kind: 'expression' | 'number';
  message: string;
}>;

export type AmountParseResult =
  | {
      ok: true;
      value: AmountValue | undefined;
      isExpression: boolean;
      normalizedExpression?: string;
    }
  | { ok: false; error: AmountParseError };

export type AmountParseOptions = Readonly<{
  precision: number;
  allowNegative: boolean;
  maxIntegerDigits?: number;
  maxRawLength?: number;
}>;

const EXPRESSION_ERROR_PREFIX = 'Fejl i funktion:';

type Token =
  | { type: 'number'; value: Rational; normalized: string }
  | { type: 'op'; op: '+' | '-' | '*' | '/' }
  | { type: 'paren'; value: '(' | ')' };

type Rational = Readonly<{
  numerator: bigint;
  denominator: bigint;
}>;

const isWhitespace = (ch: string): boolean => /\s/.test(ch);

const hasExpressionOperators = (input: string): boolean => {
  const compact = input.replace(/\s+/g, '');
  if (compact === '') return false;
  for (let i = 0; i < compact.length; i += 1) {
    const ch = compact[i];
    if (ch === '+' || ch === '*' || ch === '/' || ch === 'x' || ch === '(' || ch === ')') {
      return true;
    }
    if (ch === '-' && i > 0) return true;
  }
  return false;
};

const absBigInt = (value: bigint): bigint => (value < 0n ? -value : value);

const gcdBigInt = (a: bigint, b: bigint): bigint => {
  let x = absBigInt(a);
  let y = absBigInt(b);
  while (y !== 0n) {
    const t = x % y;
    x = y;
    y = t;
  }
  return x === 0n ? 1n : x;
};

const normalizeRational = (numerator: bigint, denominator: bigint): Rational => {
  if (denominator < 0n) {
    return normalizeRational(-numerator, -denominator);
  }
  const divisor = gcdBigInt(numerator, denominator);
  return {
    numerator: numerator / divisor,
    denominator: denominator / divisor,
  };
};

const toScaleFactor = (precision: number): bigint => {
  const safePrecision = Math.max(0, Math.trunc(precision));
  return 10n ** BigInt(safePrecision);
};

const scaledToNumber = (scaledValue: bigint, precision: number): number => {
  const safePrecision = Math.max(0, Math.trunc(precision));
  const factor = 10 ** safePrecision;
  return Number(scaledValue) / factor;
};

const roundRationalToScale = (value: Rational, precision: number): bigint => {
  const scaleFactor = toScaleFactor(precision);
  const scaledNumerator = value.numerator * scaleFactor;
  const quotient = scaledNumerator / value.denominator;
  const remainder = absBigInt(scaledNumerator % value.denominator);
  const denominatorAbs = absBigInt(value.denominator);

  if (remainder * 2n < denominatorAbs) {
    return quotient;
  }
  if (quotient >= 0n) {
    return quotient + 1n;
  }
  return quotient - 1n;
};

const parseNumberToken = (
  raw: string,
  precision: number,
  maxIntegerDigits?: number
): { ok: true; value: number; exact: Rational; normalized: string } | { ok: false; error: ExpressionError } => {
  if (raw === '' || raw === ',' || raw === '.') {
    return { ok: false, error: { code: 'INVALID_OPERATOR_SEQUENCE', message: 'Ugyldig operatorfølge' } };
  }

  const commaCount = (raw.match(/,/g) ?? []).length;
  if (commaCount > 1) {
    return { ok: false, error: { code: 'INVALID_OPERATOR_SEQUENCE', message: 'Ugyldig operatorfølge' } };
  }

  const [integerRaw, decimalRaw] = raw.split(',') as [string, string | undefined];
  if (decimalRaw === '') {
    return { ok: false, error: { code: 'INVALID_OPERATOR_SEQUENCE', message: 'Ugyldig operatorfølge' } };
  }

  if (integerRaw !== '' && integerRaw.includes('.')) {
    if (!/^\d{1,3}(\.\d{3})*$/.test(integerRaw)) {
      return { ok: false, error: { code: 'INVALID_OPERATOR_SEQUENCE', message: 'Ugyldig operatorfølge' } };
    }
  } else if (integerRaw !== '' && /[^0-9]/.test(integerRaw)) {
    return { ok: false, error: { code: 'INVALID_OPERATOR_SEQUENCE', message: 'Ugyldig operatorfølge' } };
  }

  if (decimalRaw !== undefined) {
    if (/[^0-9]/.test(decimalRaw)) {
      return { ok: false, error: { code: 'INVALID_OPERATOR_SEQUENCE', message: 'Ugyldig operatorfølge' } };
    }
  }

  const integerDigits = integerRaw === '' ? '0' : integerRaw.replace(/\./g, '');
  if (maxIntegerDigits !== undefined && integerDigits.length > maxIntegerDigits) {
    return { ok: false, error: { code: 'INVALID_OPERATOR_SEQUENCE', message: 'Beløb er for stort' } };
  }

  const normalizedIntegerDigits = integerDigits.replace(/^0+(?=\d)/, '');
  const safePrecision = Math.max(0, Math.trunc(precision));
  const normalizedDecimal = decimalRaw;

  const normalized =
    normalizedDecimal !== undefined && normalizedDecimal !== ''
      ? `${normalizedIntegerDigits},${normalizedDecimal}`
      : normalizedIntegerDigits;
  const decimalDigits = normalizedDecimal ?? '';
  const exactScaleFactor = 10n ** BigInt(decimalDigits.length);
  const exactScaledLiteral = `${normalizedIntegerDigits}${decimalDigits}`;
  const exactScaledValue = BigInt(exactScaledLiteral === '' ? '0' : exactScaledLiteral);
  const exact = normalizeRational(exactScaledValue, exactScaleFactor);
  const roundedScaled = roundRationalToScale(exact, safePrecision);
  const numericValue = scaledToNumber(roundedScaled, safePrecision);
  if (!Number.isFinite(numericValue)) {
    return { ok: false, error: { code: 'INVALID_OPERATOR_SEQUENCE', message: 'Ugyldig operatorfølge' } };
  }

  return { ok: true, value: numericValue, exact, normalized };
};

const tokenizeExpression = (
  input: string,
  precision: number,
  maxIntegerDigits?: number
): { ok: true; tokens: Token[]; normalizedExpression: string } | { ok: false; error: ExpressionError } => {
  const trimmed = input.trim();
  if (trimmed === '') {
    return { ok: false, error: { code: 'EMPTY_EXPRESSION', message: 'Tomt udtryk' } };
  }

  const tokens: Token[] = [];
  let normalizedExpression = '';

  let index = 0;
  while (index < trimmed.length) {
    const ch = trimmed[index];
    if (isWhitespace(ch)) {
      // Bevar whitespace for læsbarhed i normalizedExpression.
      normalizedExpression += ch;
      index += 1;
      continue;
    }

    if (ch === '+' || ch === '-' || ch === '*' || ch === '/' || ch === 'x') {
      const op = ch === 'x' ? '*' : ch;
      tokens.push({ type: 'op', op });
      normalizedExpression += ch;
      index += 1;
      continue;
    }

    if (ch === '(' || ch === ')') {
      tokens.push({ type: 'paren', value: ch });
      normalizedExpression += ch;
      index += 1;
      continue;
    }

    if (/[0-9,.]/.test(ch)) {
      const start = index;
      while (index < trimmed.length && /[0-9,.]/.test(trimmed[index])) {
        index += 1;
      }
      const rawNumber = trimmed.slice(start, index);
      const parsed = parseNumberToken(rawNumber, precision, maxIntegerDigits);
      if (!parsed.ok) return parsed;
      tokens.push({ type: 'number', value: parsed.exact, normalized: parsed.normalized });
      normalizedExpression += parsed.normalized;
      continue;
    }

    return { ok: false, error: { code: 'INVALID_CHAR', message: 'Ugyldigt tegn' } };
  }

  return { ok: true, tokens, normalizedExpression };
};

const evaluateExpressionTokens = (
  tokens: Token[],
  precision: number
): { ok: true; value: number } | { ok: false; error: ExpressionError } => {
  let index = 0;

  const peek = (): Token | undefined => tokens[index];
  const consume = (): Token | undefined => {
    const token = tokens[index];
    index += 1;
    return token;
  };

  const fail = (error: ExpressionError): { ok: false; error: ExpressionError } => ({ ok: false, error });

  const parseFactor = (): { ok: true; value: Rational } | { ok: false; error: ExpressionError } => {
    const token = peek();
    if (!token) {
      return fail({ code: 'INVALID_OPERATOR_SEQUENCE', message: 'Ugyldig operatorfølge' });
    }

    if (token.type === 'op') {
      if (token.op === '-') {
        consume();
        const next = parseFactor();
        if (!next.ok) return next;
        return { ok: true, value: normalizeRational(-next.value.numerator, next.value.denominator) };
      }
      return fail({ code: 'INVALID_OPERATOR_SEQUENCE', message: 'Ugyldig operatorfølge' });
    }

    if (token.type === 'number') {
      consume();
      return { ok: true, value: token.value };
    }

    if (token.type === 'paren') {
      if (token.value === ')') {
        return fail({ code: 'UNBALANCED_PAREN', message: 'Manglende startparentes' });
      }
      consume();
      const inner = parseExpression();
      if (!inner.ok) return inner;
      const next = consume();
      if (!next || next.type !== 'paren' || next.value !== ')') {
        return fail({ code: 'UNBALANCED_PAREN', message: 'Manglende slutparentes' });
      }
      return inner;
    }

    return fail({ code: 'INVALID_OPERATOR_SEQUENCE', message: 'Ugyldig operatorfølge' });
  };

  const parseTerm = (): { ok: true; value: Rational } | { ok: false; error: ExpressionError } => {
    let left = parseFactor();
    if (!left.ok) return left;

    while (true) {
      const token = peek();
      if (!token || token.type !== 'op' || (token.op !== '*' && token.op !== '/')) break;
      consume();
      const right = parseFactor();
      if (!right.ok) return right;

      if (token.op === '/') {
        if (right.value.numerator === 0n) {
          return fail({ code: 'DIVISION_BY_ZERO', message: 'Division med 0' });
        }
        left = {
          ok: true,
          value: normalizeRational(
            left.value.numerator * right.value.denominator,
            left.value.denominator * right.value.numerator
          ),
        };
      } else {
        left = {
          ok: true,
          value: normalizeRational(
            left.value.numerator * right.value.numerator,
            left.value.denominator * right.value.denominator
          ),
        };
      }
    }

    return left;
  };

  const parseExpression = (): { ok: true; value: Rational } | { ok: false; error: ExpressionError } => {
    let left = parseTerm();
    if (!left.ok) return left;

    while (true) {
      const token = peek();
      if (!token || token.type !== 'op' || (token.op !== '+' && token.op !== '-')) break;
      consume();
      const right = parseTerm();
      if (!right.ok) return right;
      left =
        token.op === '+'
          ? {
              ok: true,
              value: normalizeRational(
                left.value.numerator * right.value.denominator + right.value.numerator * left.value.denominator,
                left.value.denominator * right.value.denominator
              ),
            }
          : {
              ok: true,
              value: normalizeRational(
                left.value.numerator * right.value.denominator - right.value.numerator * left.value.denominator,
                left.value.denominator * right.value.denominator
              ),
            };
    }

    return left;
  };

  const parsed = parseExpression();
  if (!parsed.ok) return parsed;

  if (index < tokens.length) {
    const leftover = tokens[index];
    if (leftover.type === 'paren' && leftover.value === ')') {
      return fail({ code: 'UNBALANCED_PAREN', message: 'Manglende startparentes' });
    }
    return fail({ code: 'INVALID_OPERATOR_SEQUENCE', message: 'Ugyldig operatorfølge' });
  }

  const scaledRounded = roundRationalToScale(parsed.value, precision);
  const numericValue = scaledToNumber(scaledRounded, precision);
  if (!Number.isFinite(numericValue)) {
    return fail({ code: 'INVALID_OPERATOR_SEQUENCE', message: 'Ugyldig operatorfølge' });
  }

  return { ok: true, value: numericValue };
};

/**
 * Parser for beløb/udtryk.
 *
 * Normativ reference:
 * - calculation-architecture.md §9.1 (BigInt/rationel evaluering for deterministisk numerik)
 *
 * Invariants:
 * - Normalisering (trailing separator, tomme/ikke-ciffer input) sker her.
 * - Alle numeriske slutresultater afrundes til `precision`,
 *   både for rene tal og udtryksresultater.
 */
export const parseAmountInput = (draft: string, options: AmountParseOptions): AmountParseResult => {
  const trimmed = normalizeTrailingSeparator(draft);
  if (trimmed === '') {
    return { ok: true, value: undefined, isExpression: false };
  }
  if (!containsAnyDigit(trimmed)) {
    return { ok: true, value: undefined, isExpression: false };
  }
  if (options.maxRawLength !== undefined && trimmed.length > options.maxRawLength) {
    return { ok: false, error: { kind: 'number', message: 'Ugyldigt beløb' } };
  }

  const isExpression = hasExpressionOperators(trimmed);

  if (!isExpression) {
    const compact = trimmed.replace(/\s+/g, '');
    if (compact.startsWith('+')) {
      return { ok: false, error: { kind: 'number', message: 'Ugyldigt beløb' } };
    }
    const isNegative = compact.startsWith('-');
    const unsigned = isNegative ? compact.slice(1) : compact;
    if (unsigned.includes('-')) {
      return { ok: false, error: { kind: 'number', message: 'Ugyldigt beløb' } };
    }

    const parsed = parseNumberToken(unsigned, options.precision, options.maxIntegerDigits);
    if (!parsed.ok) {
      return { ok: false, error: { kind: 'number', message: parsed.error.message } };
    }

    const signed = isNegative ? -parsed.value : parsed.value;
    if (!options.allowNegative && signed < 0) {
      return { ok: false, error: { kind: 'number', message: 'Beløb kan ikke være negativt' } };
    }

    return {
      ok: true,
      value: { kind: 'number', value: normalizeZero(signed) },
      isExpression: false,
    };
  }

  const tokenized = tokenizeExpression(trimmed, options.precision, options.maxIntegerDigits);
  if (!tokenized.ok) {
    return { ok: false, error: { kind: 'expression', message: tokenized.error.message } };
  }

  const evaluated = evaluateExpressionTokens(tokenized.tokens, options.precision);
  if (!evaluated.ok) {
    return { ok: false, error: { kind: 'expression', message: evaluated.error.message } };
  }

  const normalizedValue = normalizeZero(evaluated.value);
  if (!options.allowNegative && normalizedValue < 0) {
    return { ok: false, error: { kind: 'expression', message: 'Beløb kan ikke være negativt' } };
  }

  return {
    ok: true,
    value: { kind: 'expression', expression: tokenized.normalizedExpression, value: normalizedValue },
    isExpression: true,
    normalizedExpression: tokenized.normalizedExpression,
  };
};

export const amountValueToNumber = (value: AmountValue | undefined): number | undefined => {
  if (!value) return undefined;
  return Number.isFinite(value.value) ? value.value : undefined;
};

export const amountValueToDisplayString = (value: AmountValue | undefined, precision: number): string => {
  if (!value) return '';
  return formatAsAmount(value.value, precision);
};

export const amountValueToDraftString = (value: AmountValue | undefined, precision: number): string => {
  if (!value) return '';
  if (value.kind === 'expression') return value.expression;
  return formatAsAmount(value.value, precision);
};

export const isExpressionErrorMessage = (message: string | undefined): boolean => {
  if (!message) return false;
  return message.startsWith(EXPRESSION_ERROR_PREFIX);
};

export const formatExpressionErrorMessage = (message: string): string => {
  return `${EXPRESSION_ERROR_PREFIX} ${message}`;
};
