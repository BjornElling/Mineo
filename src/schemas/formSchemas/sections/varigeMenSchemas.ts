import { z } from 'zod';
import { optionalIsoDateString, wholeNumber } from '../baseSchemas';

export const varigeMenSchema = z.object({
  // 1..120 er en domænegrænse og valideres af den afledte issue-model, ikke persistence-schemaet.
  mengrad: wholeNumber,
  beregningsdato: optionalIsoDateString,
}).strict();

export type VarigeMenValues = z.infer<typeof varigeMenSchema>;
