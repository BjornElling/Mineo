import type { RentekravRow } from '../../schemas/formSchemas';
import { rentekravRowSchema } from '../../schemas/formSchemas/sections/renteberegningSchemas';
import { nonIdKeysFromSchema, isEmptyByKeys } from '../../utils/schemaRowEmpty';

// `enhed` er et required-choice og har altid en canonical værdi. Et valg af dage, uger eller måneder
// uden beløb, dato eller tillægstid er ikke en rentekravsrække og må hverken promovere placeholderen
// eller ende i den gemte sag.
const RENTEKRAV_CONTENT_KEYS = nonIdKeysFromSchema(rentekravRowSchema).filter(
  (k): k is Exclude<keyof RentekravRow, 'id' | 'enhed'> => k !== 'enhed'
);

export const isRentekravRowEmpty = (row: RentekravRow): boolean => isEmptyByKeys(row, RENTEKRAV_CONTENT_KEYS);
