import { z } from 'zod';
import { parseAmountInput } from '../utils/expressionAmount';
import { roundByMethod } from '../utils/rounding';

const AMOUNT_SCHEMA_PRECISION = 2;

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
  if (!parsed.ok || !parsed.value) return value;
  return parsed.value.value;
};

export const amountNumberSchema = z
  .object({
    kind: z.literal('number'),
    value: z
      .number()
      .transform((v) => normalizeAmountToTwoDecimals(v))
      .refine(Number.isFinite, 'Skal v\u00e6re et endeligt tal'),
  })
  .strict();

export const amountExpressionSchema = z
  .object({
    kind: z.literal('expression'),
    expression: z.string().min(1, 'Ugyldigt udtryk'),
    value: z
      .number()
      .transform((v) => normalizeAmountToTwoDecimals(v))
      .refine(Number.isFinite, 'Skal v\u00e6re et endeligt tal'),
  })
  .strict();

export const amountValueSchema = z.union([amountNumberSchema, amountExpressionSchema]);

export type AmountValue = z.infer<typeof amountValueSchema>;

const parseLegacyAmountString = (value: string): number | undefined => {
  const trimmed = value.trim();
  if (trimmed === '') return undefined;
  const clean = trimmed.replace(/\./g, '').replace(',', '.');
  const num = Number.parseFloat(clean);
  return Number.isFinite(num) ? normalizeAmountToTwoDecimals(num) : undefined;
};

export const coerceToAmountValue = (value: unknown): unknown => {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'number') return { kind: 'number', value: normalizeAmountToTwoDecimals(value) };
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') return undefined;
    const parsed = parseLegacyAmountString(trimmed);
    if (parsed !== undefined) return { kind: 'number', value: parsed };
    return value;
  }
  return value;
};

export const optionalAmountValueSchema = z.preprocess(coerceToAmountValue, amountValueSchema.optional());
