import { z } from 'zod';
import { optionalIsoDateString, percentageDecimal } from '../baseSchemas';

export const varigeMenSchema = z.object({
  mengrad: percentageDecimal.refine(
    (value) => value === undefined || Number.isInteger(value),
    'Méngrad skal være et heltal'
  ),
  beregningsdato: optionalIsoDateString,
}).strict();

export type VarigeMenValues = z.infer<typeof varigeMenSchema>;
