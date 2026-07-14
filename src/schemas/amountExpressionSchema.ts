import { z } from 'zod';
import { parseAmountInput } from '../utils/expressionAmount';
import { roundByMethod } from '../utils/rounding';
import { isSafeCanonicalDecimal } from '../utils/numericSafety';
import {
  DEFAULT_AMOUNT_PRECISION,
  MAX_AMOUNT_INTEGER_DIGITS,
  MAX_AMOUNT_RAW_LENGTH,
} from '../utils/amountInputUtils';

const AMOUNT_SCHEMA_PRECISION = DEFAULT_AMOUNT_PRECISION;

const normalizeAmountToTwoDecimals = (value: number): number => {
  if (!Number.isFinite(value)) return value;
  const raw = value.toString();
  if (/[eE]/.test(raw)) {
    if (import.meta.env.DEV) {
      console.warn(
        'Amount schema-normalisering modtog videnskabelig notation; falder tilbage til numerisk afrunding.',
        { value: raw, precision: AMOUNT_SCHEMA_PRECISION }
      );
    }
    return roundByMethod(value, AMOUNT_SCHEMA_PRECISION, 'halfAwayFromZero');
  }
  const normalizedDraft = raw.replace('.', ',');
  const parsed = parseAmountInput(normalizedDraft, {
    precision: AMOUNT_SCHEMA_PRECISION,
    allowNegative: true,
  });
  if (!parsed.ok || !parsed.value) return roundByMethod(value, AMOUNT_SCHEMA_PRECISION, 'halfAwayFromZero');
  return parsed.value.value;
};

export const amountNumberSchema = z
  .object({
    kind: z.literal('number'),
    value: z
      .number()
      .transform((v) => normalizeAmountToTwoDecimals(v))
      .refine(Number.isFinite, 'Skal v\u00e6re et endeligt tal')
      .refine(
        (value) => isSafeCanonicalDecimal(value, AMOUNT_SCHEMA_PRECISION),
        'Beløbet er for stort til at kunne gemmes præcist'
      ),
  })
  .strict();

export const amountExpressionSchema = z
  .object({
    kind: z.literal('expression'),
    expression: z.string().min(1, 'Ugyldigt udtryk'),
    value: z
      .number()
      .refine(Number.isFinite, 'Skal v\u00e6re et endeligt tal')
      .refine(
        (value) => isSafeCanonicalDecimal(value, AMOUNT_SCHEMA_PRECISION),
        'Beløbet er for stort til at kunne gemmes præcist'
      ),
  })
  .strict()
  .superRefine((amount, context) => {
    const reparsed = parseAmountInput(amount.expression, {
      precision: AMOUNT_SCHEMA_PRECISION,
      allowNegative: true,
      allowDecimals: true,
      maxIntegerDigits: MAX_AMOUNT_INTEGER_DIGITS,
      maxRawLength: MAX_AMOUNT_RAW_LENGTH,
    });

    if (!reparsed.ok || reparsed.value?.kind !== 'expression') {
      context.addIssue({
        code: 'custom',
        path: ['expression'],
        message: 'Ugyldigt canonical beløbsudtryk',
      });
      return;
    }

    if (reparsed.normalizedExpression !== amount.expression) {
      context.addIssue({
        code: 'custom',
        path: ['expression'],
        message: 'Beløbsudtrykket er ikke canonical',
      });
    }
    if (!Object.is(reparsed.value.value, amount.value)) {
      context.addIssue({
        code: 'custom',
        path: ['value'],
        message: 'Beløbsudtrykket matcher ikke den gemte værdi',
      });
    }
  });

export const amountValueSchema = z.union([amountNumberSchema, amountExpressionSchema]);

export type AmountValue = z.infer<typeof amountValueSchema>;

export const coerceToAmountValue = (value: unknown): unknown => {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'number') return { kind: 'number', value: normalizeAmountToTwoDecimals(value) };
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') return undefined;
    const parsed = parseAmountInput(trimmed, {
      precision: AMOUNT_SCHEMA_PRECISION,
      allowNegative: true,
      allowDecimals: true,
      maxIntegerDigits: MAX_AMOUNT_INTEGER_DIGITS,
      maxRawLength: MAX_AMOUNT_RAW_LENGTH,
    });
    if (parsed.ok && parsed.value !== undefined) return parsed.value;
    // Bevar malformed ikke-tom tekst, så Zod fail-closer i stedet for at rydde feltet.
    return value;
  }
  return value;
};

export const optionalAmountValueSchema = z.preprocess(coerceToAmountValue, amountValueSchema.optional());
