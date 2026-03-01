import { z } from 'zod';
import { optionalIsoDateString, percentageDecimal, stripTopLevelKey } from '../baseSchemas';

const varigeMenInnerSchema = z.object({
  mengrad: percentageDecimal.refine(
    (value) => value === undefined || Number.isInteger(value),
    'Méngrad skal være et heltal'
  ),
  beregningsdato: optionalIsoDateString,
}).strict();

export const varigeMenSchema = z.preprocess((value) => stripTopLevelKey(value, 'activeTab'), varigeMenInnerSchema);

export type VarigeMenValues = z.infer<typeof varigeMenSchema>;
