import { z } from 'zod';
import { optionalIsoDateString, positiveWholePercentage } from '../baseSchemas';

export const varigeMenSchema = z.object({
  mengrad: positiveWholePercentage('Méngrad'),
  beregningsdato: optionalIsoDateString,
}).strict();

export type VarigeMenValues = z.infer<typeof varigeMenSchema>;
