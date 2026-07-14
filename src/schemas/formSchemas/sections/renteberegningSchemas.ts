import { z } from 'zod';
import {
  amountValue,
  wholeNumber,
  entityId,
  optionalIsoDateString,
  optionalString,
} from '../baseSchemas';
import { tillaegstidEnhedEnum } from '../enumSchemas';

export const rentekravRowSchema = z.object({
  id: entityId(),
  belob: amountValue,
  renterFra: optionalIsoDateString,
  tillaegstid: wholeNumber,
  enhed: tillaegstidEnhedEnum,
}).strict();

export type RentekravRow = z.infer<typeof rentekravRowSchema>;

export const renteberegningSchema = z.object({
  beregningsdato: optionalIsoDateString,
  kommentarer: optionalString,
  // En tom collection er canonical brugerinput. Krav om mindst én udfyldt række
  // er en domæne-/handlingsgate og må ikke gøre en ellers gyldig sag ulæsbar.
  rentekravRows: z.array(rentekravRowSchema),
}).strict();

export type RenteberegningValues = z.infer<typeof renteberegningSchema>;
