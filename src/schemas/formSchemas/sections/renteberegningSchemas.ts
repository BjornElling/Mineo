import { z } from 'zod';
import {
  nonNegativeAmountValue,
  nonNegativeInteger,
  optionalIsoDateString,
  optionalString,
  stripTopLevelKey,
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

const renteberegningInnerSchema = z.object({
  beregningsdato: optionalIsoDateString,
  kommentarer: optionalString,
  rentekravRows: z.array(rentekravRowSchema),
}).strict();

export const renteberegningSchema = z.preprocess(
  (value) => stripTopLevelKey(value, 'activeTab'),
  renteberegningInnerSchema
);

export type RenteberegningValues = z.infer<typeof renteberegningSchema>;
