import { z } from 'zod';
import { coerceToWholeNumberOrUndefined, optionalIsoDateString } from '../baseSchemas';

/**
 * Bevidst domænegrænse: méngraden kan overstige 100 %, men højst være 120 %.
 * Samme konstant bruges af schema, UI og engine, så de tre grænser ikke kan drive.
 */
export const VARIGE_MEN_MAX_MENGRAD = 120;

const mengradSchema = z.preprocess(
  coerceToWholeNumberOrUndefined,
  z.number({ error: 'Méngrad skal være et heltal' })
    .int('Méngrad skal være et heltal')
    .min(1, 'Méngrad skal være mindst 1')
    .max(VARIGE_MEN_MAX_MENGRAD, `Méngrad må højst være ${VARIGE_MEN_MAX_MENGRAD}`)
    .optional()
);

export const varigeMenSchema = z.object({
  mengrad: mengradSchema,
  beregningsdato: optionalIsoDateString,
}).strict();

export type VarigeMenValues = z.infer<typeof varigeMenSchema>;
