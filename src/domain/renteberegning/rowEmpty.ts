import type { RentekravRow } from '../../schemas/formSchemas';
import { rentekravRowSchema } from '../../schemas/formSchemas/sections/renteberegningSchemas';
import { nonIdKeysFromSchema, isEmptyByKeys } from '../erstatningsopgoerelse/rowEmpty';

// 'enhed' er en required enum med default-værdi og udgør aldrig reel brugerinput alene.
// En række med kun enhed sat betragtes derfor som tom — svarende til den hidtidige adfærd.
const RENTEKRAV_CONTENT_KEYS = nonIdKeysFromSchema(rentekravRowSchema).filter(
  (k): k is Exclude<keyof RentekravRow, 'id' | 'enhed'> => k !== 'enhed'
);

export const isRentekravRowEmpty = (row: RentekravRow): boolean => {
  return isEmptyByKeys(row, RENTEKRAV_CONTENT_KEYS);
};
