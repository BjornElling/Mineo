import { z } from 'zod';
import { coerceToISODateString, isISODateString, type ISODateString } from '../../types/branded';
import { optionalAmountValueSchema } from '../amountExpressionSchema';
import { isSafeCanonicalDecimal } from '../../utils/numericSafety';
import { parseDanishNumberString } from '../../utils/numberParsing';

export const normalizeEmptyToUndefined = (value: unknown): unknown => {
  if (value === null) {
    return undefined;
  }
  if (typeof value === 'string' && value.trim() === '') {
    return undefined;
  }
  return value;
};

/** Stabil persisted entity-identitet; samme regel bruges af schemas og det strukturelle inputkatalog. */
export const entityId = (label = 'Række-ID') => z.string()
  .min(1, `${label} må ikke være tomt`)
  .refine((value) => value.trim() === value, `${label} må ikke have ydre mellemrum`);

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

    return parseDanishNumberString(trimmed) ?? value;
  }

  return value;
};

export const coerceToWholeNumberOrUndefined = (value: unknown): unknown => {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') return value;

  const trimmed = value.trim();
  if (trimmed === '') return undefined;
  // Et heltals-schema må ikke acceptere en skrevet decimaldel, heller ikke når
  // den kun består af nuller. Punktum forbliver tilladt som dansk tusindtalsseparator.
  if (trimmed.includes(',')) return value;
  return parseDanishNumberString(trimmed, { precision: 0 }) ?? value;
};

/**
 * Persisted beløbssyntaks. Fortegn og øvrige domænegrænser afledes som issues fra
 * feltdefinitionen; de må ikke gøre en ellers canonical beløbsværdi urepræsenterbar.
 */
export const amountValue = optionalAmountValueSchema;

// Note: z.number() afviser selv Infinity/NaN i Zod 4 (verificeret), og der er ingen
// transform mellem number-checket og .optional(), så en .refine(Number.isFinite) ville
// være død kode her. Den load-bearende finiteness-guard ligger i amountExpressionSchema,
// hvor refinet sidder EFTER en transform der kan producere non-finite.
/** Persisted heltalssyntaks; decimaler afvises uden implicit trunkering. */
export const wholeNumber = z.preprocess(coerceToWholeNumberOrUndefined, z.number({ error: 'Skal være et heltal' })
  .int('Skal være et heltal')
  .refine(Number.isSafeInteger, 'Tallet er for stort til at kunne gemmes præcist')
  .optional());

/** Persisted decimalsyntaks. Procent- og øvrige bounds hører til afledte issues. */
export const decimalNumber = z.preprocess(coerceToNumberOrUndefined, z.number()
  .refine(
    (value) => isSafeCanonicalDecimal(value, 2),
    'Tallet er for stort til at kunne gemmes præcist'
  )
  .optional());

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
