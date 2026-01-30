import { z } from 'zod';

export const amountNumberSchema = z
  .object({
    kind: z.literal('number'),
    value: z
      .number()
      .refine(Number.isFinite, 'Skal v\u00e6re et endeligt tal'),
  })
  .strict();

export const amountExpressionSchema = z
  .object({
    kind: z.literal('expression'),
    expression: z.string().min(1, 'Ugyldigt udtryk'),
    value: z
      .number()
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
  return Number.isFinite(num) ? num : undefined;
};

export const coerceToAmountValue = (value: unknown): unknown => {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'number') return { kind: 'number', value };
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
