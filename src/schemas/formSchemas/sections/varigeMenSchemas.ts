import { z } from 'zod';
import { optionalIsoDateString, percentageDecimal, stripTopLevelKey } from '../baseSchemas';

const varigeMenInnerSchema = z.object({
  fodselsdato: optionalIsoDateString,
  mengrad: percentageDecimal,
  beregningsdato: optionalIsoDateString,
}).strict();

export const varigeMenSchema = z.preprocess((value) => stripTopLevelKey(value, 'activeTab'), varigeMenInnerSchema);

export type VarigeMenValues = z.infer<typeof varigeMenSchema>;
