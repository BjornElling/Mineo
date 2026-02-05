import { formatAsAmount } from './formatUtils';
import { containsAnyDigit, normalizeTrailingSeparator, normalizeZero, truncateToScale } from './amountInputUtils';
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
  | { type: 'number'; value: number; normalized: string }
  | { type: 'op'; op: '+' | '-' | '*' | '/' }
  | { type: 'paren'; value: '(' | ')' };

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

const parseNumberToken = (
  raw: string,
  precision: number,
  maxIntegerDigits?: number
): { ok: true; value: number; normalized: string } | { ok: false; error: ExpressionError } => {
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
  const truncatedDecimal =
    decimalRaw !== undefined && precision >= 0 ? decimalRaw.slice(0, precision) : decimalRaw;

  const normalized =
    truncatedDecimal !== undefined && truncatedDecimal !== ''
      ? `${normalizedIntegerDigits},${truncatedDecimal}`
      : normalizedIntegerDigits;
  const numericValue = Number.parseFloat(normalized.replace(',', '.'));
  if (!Number.isFinite(numericValue)) {
    return { ok: false, error: { code: 'INVALID_OPERATOR_SEQUENCE', message: 'Ugyldig operatorfølge' } };
  }

  return { ok: true, value: truncateToScale(numericValue, precision), normalized };
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
      tokens.push({ type: 'number', value: parsed.value, normalized: parsed.normalized });
      normalizedExpression += parsed.normalized;
      continue;
    }

    return { ok: false, error: { code: 'INVALID_CHAR', message: 'Ugyldigt tegn' } };
  }

  return { ok: true, tokens, normalizedExpression };
};

const evaluateExpressionTokens = (tokens: Token[]): { ok: true; value: number } | { ok: false; error: ExpressionError } => {
  let index = 0;

  const peek = (): Token | undefined => tokens[index];
  const consume = (): Token | undefined => {
    const token = tokens[index];
    index += 1;
    return token;
  };

  const fail = (error: ExpressionError): { ok: false; error: ExpressionError } => ({ ok: false, error });

  const parseFactor = (): { ok: true; value: number } | { ok: false; error: ExpressionError } => {
    const token = peek();
    if (!token) {
      return fail({ code: 'INVALID_OPERATOR_SEQUENCE', message: 'Ugyldig operatorfølge' });
    }

    if (token.type === 'op') {
      if (token.op === '-') {
        consume();
        const next = parseFactor();
        if (!next.ok) return next;
        return { ok: true, value: -next.value };
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

  const parseTerm = (): { ok: true; value: number } | { ok: false; error: ExpressionError } => {
    let left = parseFactor();
    if (!left.ok) return left;

    while (true) {
      const token = peek();
      if (!token || token.type !== 'op' || (token.op !== '*' && token.op !== '/')) break;
      consume();
      const right = parseFactor();
      if (!right.ok) return right;

      if (token.op === '/') {
        if (right.value === 0) {
          return fail({ code: 'DIVISION_BY_ZERO', message: 'Division med 0' });
        }
        left = { ok: true, value: left.value / right.value };
      } else {
        left = { ok: true, value: left.value * right.value };
      }

      if (!Number.isFinite(left.value)) {
        return fail({ code: 'INVALID_OPERATOR_SEQUENCE', message: 'Ugyldig operatorfølge' });
      }
    }

    return left;
  };

  const parseExpression = (): { ok: true; value: number } | { ok: false; error: ExpressionError } => {
    let left = parseTerm();
    if (!left.ok) return left;

    while (true) {
      const token = peek();
      if (!token || token.type !== 'op' || (token.op !== '+' && token.op !== '-')) break;
      consume();
      const right = parseTerm();
      if (!right.ok) return right;
      left = { ok: true, value: token.op === '+' ? left.value + right.value : left.value - right.value };
      if (!Number.isFinite(left.value)) {
        return fail({ code: 'INVALID_OPERATOR_SEQUENCE', message: 'Ugyldig operatorfølge' });
      }
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

  return parsed;
};

/**
 * Parse amount input deterministically.
 *
 * Invariants:
 * - Trims surrounding whitespace.
 * - Removes trailing decimal separator (e.g. "18," -> "18").
 * - Truncates all decimals beyond `precision` (no rounding).
 * - Normalizes -0 to 0.
 * - Returns undefined when input contains no digits.
 */
/**
 * Parser for beløb/udtryk.
 *
 * Invariants:
 * - Normalisering (trailing separator, tomme/ikke-ciffer input) sker her.
 * - Alle numeriske resultater afskæres til `precision` (ingen afrunding),
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
      value: { kind: 'number', value: normalizeZero(truncateToScale(signed, options.precision)) },
      isExpression: false,
    };
  }

  const tokenized = tokenizeExpression(trimmed, options.precision, options.maxIntegerDigits);
  if (!tokenized.ok) {
    return { ok: false, error: { kind: 'expression', message: tokenized.error.message } };
  }

  const evaluated = evaluateExpressionTokens(tokenized.tokens);
  if (!evaluated.ok) {
    return { ok: false, error: { kind: 'expression', message: evaluated.error.message } };
  }

  const truncated = truncateToScale(evaluated.value, options.precision);
  const normalizedValue = normalizeZero(truncated);
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
