import type { OevrigeKravRow, SvieSmertePeriodeRow, TafPeriodeRow, FerieperiodeRow } from '../../schemas/formSchemas';
import {
  ferieperiodeRowSchema,
  oevrigeKravRowSchema,
  svieSmertePeriodeRowSchema,
  tafPeriodeRowSchema,
} from '../../schemas/formSchemas';
import type { ZodObject, ZodRawShape } from 'zod';

export const nonIdKeysFromSchema = <T extends ZodRawShape>(schema: ZodObject<T>): readonly (Exclude<keyof T, 'id'> & string)[] => {
  return Object.keys(schema.shape).filter((k): k is Exclude<keyof T, 'id'> & string => k !== 'id');
};

export const isEmptyByKeys = <T extends Record<string, unknown>>(row: T, keys: readonly (keyof T)[]): boolean => {
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
  return isEmptyByKeys(row, SVIE_KEYS);
};

export const isTafRowEmpty = (row: TafPeriodeRow): boolean => {
  return isEmptyByKeys(row, TAF_KEYS);
};

export const isFerieRowEmpty = (row: FerieperiodeRow): boolean => {
  return isEmptyByKeys(row, FERIE_KEYS);
};

export const isOevrigeKravRowEmpty = (row: OevrigeKravRow): boolean => {
  return isEmptyByKeys(row, OEVRIGE_KRAV_KEYS);
};

