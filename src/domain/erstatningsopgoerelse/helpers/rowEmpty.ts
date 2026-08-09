import type {
  LoenudviklingManuelProcentsatsRow,
  LoenudviklingManuelRow,
  OffentligeYdelserRow,
  OevrigeKravRow,
  SvieSmertePeriodeRow,
  TafPeriodeRow,
  FerieperiodeRow,
} from '../../../schemas/formSchemas';
import {
  ferieperiodeRowSchema,
  oevrigeKravRowSchema,
  svieSmertePeriodeRowSchema,
  tafPeriodeRowSchema,
} from '../../../schemas/formSchemas';
import { nonIdKeysFromSchema, isEmptyByKeys } from '../../../utils/schemaRowEmpty';

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

/** Samme semantiske tomhed bruges af både tabellen og collectionens atomiske rydning. */
export const isOffentligeYdelserRowEmpty = (row: OffentligeYdelserRow): boolean =>
  row.fraDato === undefined
  && row.tilDato === undefined
  && row.ydelse === undefined
  && row.tillaeg === undefined
  && (row.ydelsestype === undefined || row.ydelsestype.trim() === '');

/** Basisrækken beskyttes af collection-descriptoren; denne regel beskriver kun rækkeindholdet. */
export const isLoenudviklingManuelRowEmpty = (row: LoenudviklingManuelRow): boolean =>
  row.dato === undefined
  && row.grundloen === undefined
  && row.feriepenge === undefined
  && row.shSoSats === undefined
  && row.fritvalg === undefined
  && row.agPension === undefined;

export const isLoenudviklingManuelProcentsatsRowEmpty = (
  row: LoenudviklingManuelProcentsatsRow
): boolean => row.dato === undefined && row.procent === undefined;
