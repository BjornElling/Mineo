import { z } from 'zod';
import { coerceToIntegerOrUndefined, optionalIsoDateString, stripTopLevelKey } from '../baseSchemas';

const forsoergertabInnerSchema = z.object({
  beregningsdato: optionalIsoDateString,
  virkningsdato: optionalIsoDateString,
  tilkendtForPeriodeAar: z.preprocess(
    coerceToIntegerOrUndefined,
    z.number()
      .int('Tilkendt for periode skal være et heltal')
      .min(1, 'Tilkendt for periode skal være mindst 1 år')
      .max(10, 'Tilkendt for periode må højst være 10 år')
      .optional()
  ),
}).strict();

export const forsoergertabSchema = z.preprocess(
  (value) => stripTopLevelKey(value, 'activeTab'),
  forsoergertabInnerSchema
);

export type ForsoergertabValues = z.infer<typeof forsoergertabSchema>;
