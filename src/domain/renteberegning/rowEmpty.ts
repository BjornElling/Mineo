import type { RentekravRow } from '../../schemas/formSchemas';
import { rentekravRowSchema } from '../../schemas/formSchemas/sections/renteberegningSchemas';
import { nonIdKeysFromSchema, isEmptyByKeys } from '../../utils/schemaRowEmpty';

// 'enhed=dage' er required default og udgør ikke alene reel brugerinput. Et aktivt fravalg af
// defaulten er derimod brugerinput og skal holde rækken synlig, flytbar og sletbar.
const RENTEKRAV_CONTENT_KEYS = nonIdKeysFromSchema(rentekravRowSchema).filter(
  (k): k is Exclude<keyof RentekravRow, 'id' | 'enhed'> => k !== 'enhed'
);

export const isRentekravRowEmpty = (row: RentekravRow): boolean => {
  return row.enhed === 'dage' && isEmptyByKeys(row, RENTEKRAV_CONTENT_KEYS);
};
