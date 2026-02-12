import type { AmountValue } from '../../../schemas/amountExpressionSchema';
import { parseAmountInput } from '../../../utils/expressionAmount';
import { formatAsAmount } from '../../../utils/formatUtils';
import { danishToISO } from '../../../types/branded';
import {
  EMPTY_AMOUNT_FINGERPRINT,
  EMPTY_DATE_FINGERPRINT,
  EMPTY_INTEGER_FINGERPRINT,
  EMPTY_PERCENT_FINGERPRINT,
  makeAmountFingerprintFromCanonical,
  makeDateFingerprintFromCanonical,
  makeIntegerFingerprintFromCanonical,
  makePercentFingerprintFromCanonical,
  type AmountFingerprint,
  type DateFingerprint,
  type IntegerFingerprint,
  type ParserSpec,
  type PercentFingerprint,
} from './parserSpec';

const amountCanonicalFromModel = (value: AmountValue | undefined, precision: number): string => {
  if (!value) return '';
  if (value.kind === 'expression') return `e:${value.expression}|${value.value.toFixed(precision)}`;
  return `n:${value.value.toFixed(precision)}`;
};

export const createAmountParserSpec = (
  options: Readonly<{ precision: number; allowNegative: boolean; maxIntegerDigits: number; maxRawLength: number }>
): ParserSpec<AmountValue | undefined, string, AmountFingerprint> => {
  const empty = {
    model: undefined,
    canonical: '',
    fingerprint: EMPTY_AMOUNT_FINGERPRINT,
  } as const;

  return {
    empty,
    parse: (raw) => {
      const parsed = parseAmountInput(raw, {
        precision: options.precision,
        allowNegative: options.allowNegative,
        maxIntegerDigits: options.maxIntegerDigits,
        maxRawLength: options.maxRawLength,
      });
      if (!parsed.ok) {
        return { kind: 'invalid', raw, errorCode: parsed.error.kind };
      }
      const canonical = amountCanonicalFromModel(parsed.value, options.precision);
      return {
        kind: 'ok',
        model: parsed.value,
        canonical,
        fingerprint: makeAmountFingerprintFromCanonical(canonical),
      };
    },
  };
};

export const createIntegerParserSpec = (
  options: Readonly<{ minValue?: number; maxValue?: number }>
): ParserSpec<string, string, IntegerFingerprint> => {
  const empty = {
    model: '',
    canonical: '',
    fingerprint: EMPTY_INTEGER_FINGERPRINT,
  } as const;

  return {
    empty,
    parse: (raw) => {
      const trimmed = raw.trim();
      if (trimmed === '') {
        return {
          kind: 'ok',
          model: empty.model,
          canonical: empty.canonical,
          fingerprint: empty.fingerprint,
        };
      }
      if (/[^0-9]/.test(trimmed)) return { kind: 'invalid', raw, errorCode: 'invalid-format' };
      const value = Number.parseInt(trimmed, 10);
      if (!Number.isFinite(value)) return { kind: 'invalid', raw, errorCode: 'invalid-format' };
      if (typeof options.minValue === 'number' && value < options.minValue) return { kind: 'invalid', raw, errorCode: 'below-min' };
      if (typeof options.maxValue === 'number' && value > options.maxValue) return { kind: 'invalid', raw, errorCode: 'above-max' };
      const canonical = String(value);
      return {
        kind: 'ok',
        model: canonical,
        canonical,
        fingerprint: makeIntegerFingerprintFromCanonical(canonical),
      };
    },
  };
};

export const createPercentParserSpec = (
  options: Readonly<{ allowNegative: boolean; precision: number; minValue?: number; maxValue?: number }>
): ParserSpec<string, string, PercentFingerprint> => {
  const empty = {
    model: '',
    canonical: '',
    fingerprint: EMPTY_PERCENT_FINGERPRINT,
  } as const;

  return {
    empty,
    parse: (raw) => {
      const trimmed = raw.trim();
      if (trimmed === '') {
        return {
          kind: 'ok',
          model: empty.model,
          canonical: empty.canonical,
          fingerprint: empty.fingerprint,
        };
      }

      const compact = trimmed.replace(/\s+/g, '');
      const isNegative = compact.startsWith('-');
      if (isNegative && !options.allowNegative) return { kind: 'invalid', raw, errorCode: 'negative-not-allowed' };

      const unsigned = isNegative ? compact.slice(1) : compact;
      const parts = unsigned.split(',');
      if (parts.length > 2) return { kind: 'invalid', raw, errorCode: 'invalid-format' };
      const integerPart = parts[0] ?? '';
      const decimalPart = parts[1];
      if (!/^\d+$/.test(integerPart)) return { kind: 'invalid', raw, errorCode: 'invalid-format' };
      if (decimalPart !== undefined && !/^\d*$/.test(decimalPart)) return { kind: 'invalid', raw, errorCode: 'invalid-format' };
      if ((decimalPart?.length ?? 0) > options.precision) return { kind: 'invalid', raw, errorCode: 'too-many-decimals' };

      const numeric = Number.parseFloat(`${integerPart}.${decimalPart ?? ''}`);
      if (!Number.isFinite(numeric)) return { kind: 'invalid', raw, errorCode: 'invalid-format' };
      const signed = isNegative ? -numeric : numeric;
      if (typeof options.minValue === 'number' && signed < options.minValue) return { kind: 'invalid', raw, errorCode: 'below-min' };
      if (typeof options.maxValue === 'number' && signed > options.maxValue) return { kind: 'invalid', raw, errorCode: 'above-max' };

      const canonical = signed.toFixed(options.precision);
      return {
        kind: 'ok',
        model: formatAsAmount(signed, options.precision),
        canonical,
        fingerprint: makePercentFingerprintFromCanonical(canonical),
      };
    },
  };
};

export const createDateParserSpec = (): ParserSpec<string, string, DateFingerprint> => {
  const empty = {
    model: '',
    canonical: '',
    fingerprint: EMPTY_DATE_FINGERPRINT,
  } as const;

  return {
    empty,
    parse: (raw) => {
      const trimmed = raw.trim();
      if (trimmed === '') {
        return {
          kind: 'ok',
          model: empty.model,
          canonical: empty.canonical,
          fingerprint: empty.fingerprint,
        };
      }

      const normalized = trimmed.replace(/[ .:/]/g, '-').replace(/-+/g, '-');
      const match = normalized.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
      if (!match) return { kind: 'invalid', raw, errorCode: 'invalid-format' };
      const day = match[1].padStart(2, '0');
      const month = match[2].padStart(2, '0');
      const year = match[3];
      const canonical = `${day}-${month}-${year}`;
      const iso = danishToISO(canonical);
      if (!iso) return { kind: 'invalid', raw, errorCode: 'invalid-date' };
      return {
        kind: 'ok',
        model: canonical,
        canonical,
        fingerprint: makeDateFingerprintFromCanonical(iso),
      };
    },
  };
};
