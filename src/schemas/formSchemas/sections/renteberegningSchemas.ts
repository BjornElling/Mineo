import { z } from 'zod';
import {
  nonNegativeAmountValue,
  nonNegativeInteger,
  optionalIsoDateString,
  optionalString,
} from '../baseSchemas';
import { tillaegstidEnhedEnum } from '../enumSchemas';

export const rentekravRowSchema = z.object({
  id: z.string().min(1, 'Række-ID må ikke være tomt'),
  belob: nonNegativeAmountValue,
  renterFra: optionalIsoDateString,
  tillaegstid: nonNegativeInteger,
  enhed: tillaegstidEnhedEnum,
}).strict();

export type RentekravRow = z.infer<typeof rentekravRowSchema>;

export const renteberegningSchema = z.object({
  beregningsdato: optionalIsoDateString,
  kommentarer: optionalString,
  rentekravRows: z.array(rentekravRowSchema).min(1, 'Der skal være mindst én rentekravsrække'),
}).strict();

export type RenteberegningValues = z.infer<typeof renteberegningSchema>;
