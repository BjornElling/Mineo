import type { OevrigeKravRow, SvieSmertePeriodeRow, TafPeriodeRow, FerieperiodeRow } from '../../schemas/formSchemas';
import {
  ferieperiodeRowSchema,
  oevrigeKravRowSchema,
  svieSmertePeriodeRowSchema,
  tafPeriodeRowSchema,
} from '../../schemas/formSchemas';
import type { ZodObject, ZodRawShape } from 'zod';

const nonIdKeysFromSchema = (schema: ZodObject<ZodRawShape>): readonly string[] => {
  return Object.keys(schema.shape).filter((k) => k !== 'id');
};

const isEmptyByKeys = (row: Record<string, unknown>, keys: readonly string[]): boolean => {
  for (const key of keys) {
    if (row[key] !== undefined) return false;
  }
  return true;
};

const SVIE_KEYS = nonIdKeysFromSchema(svieSmertePeriodeRowSchema);
const TAF_KEYS = nonIdKeysFromSchema(tafPeriodeRowSchema);
const FERIE_KEYS = nonIdKeysFromSchema(ferieperiodeRowSchema);
const OEVRIGE_KRAV_KEYS = nonIdKeysFromSchema(oevrigeKravRowSchema);

export const isSvieSmerteRowEmpty = (row: SvieSmertePeriodeRow): boolean => {
  return isEmptyByKeys(row as unknown as Record<string, unknown>, SVIE_KEYS);
};

export const isTafRowEmpty = (row: TafPeriodeRow): boolean => {
  return isEmptyByKeys(row as unknown as Record<string, unknown>, TAF_KEYS);
};

export const isFerieRowEmpty = (row: FerieperiodeRow): boolean => {
  return isEmptyByKeys(row as unknown as Record<string, unknown>, FERIE_KEYS);
};

export const isOevrigeKravRowEmpty = (row: OevrigeKravRow): boolean => {
  return isEmptyByKeys(row as unknown as Record<string, unknown>, OEVRIGE_KRAV_KEYS);
};

