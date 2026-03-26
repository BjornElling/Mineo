import type { OevrigeKravRow, SvieSmertePeriodeRow, TafPeriodeRow, FerieperiodeRow } from '../../schemas/formSchemas';
import {
  ferieperiodeRowSchema,
  oevrigeKravRowSchema,
  svieSmertePeriodeRowSchema,
  tafPeriodeRowSchema,
} from '../../schemas/formSchemas';
import { nonIdKeysFromSchema, isEmptyByKeys } from '../../utils/schemaRowEmpty';

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

