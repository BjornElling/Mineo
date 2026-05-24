import { z } from 'zod';
import { coerceToISODateString, isISODateString, type ISODateString } from '../../types/branded';
import { optionalAmountValueSchema } from '../amountExpressionSchema';

export const normalizeEmptyToUndefined = (value: unknown): unknown => {
  if (value === null) {
    return undefined;
  }
  if (typeof value === 'string' && value.trim() === '') {
    return undefined;
  }
  return value;
};

export const validateISODateFormat = (val: string): boolean => isISODateString(val);

export const isoDateString = z.string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Skal være ISO-format: åååå-mm-dd')
  .refine(validateISODateFormat, 'Ikke en gyldig dato')
  .transform(val => val as ISODateString);

export const optionalIsoDateString = z.preprocess(normalizeEmptyToUndefined, isoDateString.optional());

const coerceToNumberOrUndefined = (value: unknown): unknown => {
  if (value === undefined || value === null) return undefined;

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') return undefined;

    const cleaned = trimmed.replace(/\./g, '').replace(',', '.');
    const num = Number.parseFloat(cleaned);
    return Number.isFinite(num) ? num : value;
  }

  return value;
};

export const coerceToIntegerOrUndefined = (value: unknown): unknown => {
  const coerced = coerceToNumberOrUndefined(value);
  if (typeof coerced === 'number') {
    return Number.isFinite(coerced) ? Math.trunc(coerced) : coerced;
  }
  return coerced;
};

export const nonNegativeAmountValue = optionalAmountValueSchema
  .refine((v) => v === undefined || v.value >= 0, 'Kan ikke være negativ')
  .refine((v) => v === undefined || !Object.is(v.value, -0), 'Kan ikke være -0');

export const positiveAmountValue = optionalAmountValueSchema
  .refine((v) => v === undefined || v.value > 0, 'Skal være større end 0')
  .refine((v) => v === undefined || !Object.is(v.value, -0), 'Kan ikke være -0');

export const nonNegativeInteger = z.preprocess(coerceToIntegerOrUndefined, z.number()
  .int()
  .min(0, 'Kan ikke være negativ')
  .refine(Number.isFinite, 'Skal være et endeligt heltal')
  .optional());

export const yearInteger = z.preprocess(coerceToIntegerOrUndefined, z.number()
  .int()
  .min(1900, 'Årstal skal være mindst 1900')
  .max(2100, 'Årstal må højst være 2100')
  .optional());

export const DAY_COUNT_MAX = 366;

export const dayCount = z.preprocess(coerceToIntegerOrUndefined, z.number()
  .int()
  .min(0, 'Kan ikke være negativ')
  .max(DAY_COUNT_MAX, `Må højst være ${DAY_COUNT_MAX} dage`)
  .optional());

export const loseFeriedageCount = z.preprocess(coerceToIntegerOrUndefined, z.number()
  .int()
  .min(0, 'Kan ikke være negativ')
  .max(999, 'Må højst være 999 dage')
  .optional());

export const percentageDecimal = z.preprocess(coerceToNumberOrUndefined, z.number()
  .min(0, 'Kan ikke være negativ')
  .max(100, 'Må højst være 100%')
  .refine(Number.isFinite, 'Skal være et endeligt tal')
  .optional());

export const optionalString = z.string()
  .transform(v => v.trim() === '' ? undefined : v)
  .optional();

export const allowEmptyString = z.preprocess(
  (val) => (val === null ? undefined : val),
  z.string().optional()
);

export const tableCellString = z.preprocess((val) => {
  if (val === undefined || val === null) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'number' && Number.isFinite(val)) return String(val);
  return '';
}, z.string().optional());

export const tableIsoDateCellString = z.preprocess((val) => {
  if (val === undefined || val === null) return undefined;
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (trimmed === '') return undefined;
    if (isISODateString(trimmed)) return trimmed;
    return coerceToISODateString(trimmed) ?? trimmed;
  }
  return val;
}, isoDateString.optional());

export const tableAmountCellValue = optionalAmountValueSchema;
