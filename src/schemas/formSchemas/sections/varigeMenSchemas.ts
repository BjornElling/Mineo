import { z } from 'zod';
import { coerceToWholeNumberOrUndefined, optionalIsoDateString } from '../baseSchemas';

/**
 * Bevidst domænegrænse: méngraden kan overstige 100 %, men højst være 120 %.
 * Samme konstant bruges af schema, UI og engine, så de tre grænser ikke kan drive.
 */
export const VARIGE_MEN_MAX_MENGRAD = 120;

// Méngraden er et heltal i [1, 120]: 0 er ikke en meningsfuld méngrad. 0 (og alt uden for
// intervallet) afvises allerede i feltet via StyledPercentField's enforceRange + minValue={1}
// (rød ring + tooltip, samme kanoniske vej som >120), så en ugyldig værdi aldrig committes
// eller når persistens. Schema-grænsen matcher feltets grænse, så de ikke kan drive fra hinanden.
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
