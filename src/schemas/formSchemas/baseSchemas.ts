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

export const isoDateString = z.string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Skal være ISO-format: åååå-mm-dd')
  .refine(isISODateString, 'Ikke en gyldig dato')
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

export const coerceToWholeNumberOrUndefined = (value: unknown): unknown => {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') return undefined;
    return /^-?\d+$/.test(trimmed) ? Number.parseInt(trimmed, 10) : value;
  }
  return value;
};

export const nonNegativeAmountValue = optionalAmountValueSchema
  .refine((v) => v === undefined || v.value >= 0, 'Kan ikke være negativ')
  .refine((v) => v === undefined || !Object.is(v.value, -0), 'Kan ikke være -0');

export const positiveAmountValue = optionalAmountValueSchema
  .refine((v) => v === undefined || v.value > 0, 'Skal være større end 0')
  .refine((v) => v === undefined || !Object.is(v.value, -0), 'Kan ikke være -0');

// Note: z.number() afviser selv Infinity/NaN i Zod 4 (verificeret), og der er ingen
// transform mellem number-checket og .optional(), så en .refine(Number.isFinite) ville
// være død kode her. Den load-bearende finiteness-guard ligger i amountExpressionSchema,
// hvor refinet sidder EFTER en transform der kan producere non-finite.
export const nonNegativeInteger = z.preprocess(coerceToIntegerOrUndefined, z.number()
  .int()
  .min(0, 'Kan ikke være negativ')
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
  .optional());

export const positiveWholePercentage = (label: string) => z.preprocess(
  coerceToWholeNumberOrUndefined,
  z.number({ error: `${label} skal være et heltal` })
    .int(`${label} skal være et heltal`)
    .min(1, `${label} skal være mindst 1`)
    .max(100, `${label} må højst være 100`)
    .optional()
);

export const optionalString = z.preprocess(
  normalizeEmptyToUndefined,
  z.string().optional()
);

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
    const coerced = coerceToISODateString(trimmed);
    if (coerced) return coerced;
    // Bevar ugyldigt ikke-tomt input, så schemaet fejler fail-closed i stedet for stiltiende at droppe gemte data.
    return trimmed;
  }
  return val;
}, isoDateString.optional());

export const tableAmountCellValue = optionalAmountValueSchema;
