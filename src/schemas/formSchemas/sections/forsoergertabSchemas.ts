import { z } from 'zod';
import { optionalIsoDateString, normalizeEmptyToUndefined, wholeNumber } from '../baseSchemas';
import { koenEnum } from '../enumSchemas';

export const forsoergertabSchema = z.object({
  efterladteFodselsdato: optionalIsoDateString,
  beregningsdato: optionalIsoDateString,
  virkningsdato: optionalIsoDateString,
  // Kanonisk optional-enum-mønster: '' → undefined før enum-validering, så et persisteret
  // tomt køn ikke dropper hele forsørgertab-sektionen.
  koen: z.preprocess(normalizeEmptyToUndefined, koenEnum.optional()),
  tilkendtForPeriodeAar: wholeNumber,
}).strict();

export type ForsoergertabValues = z.infer<typeof forsoergertabSchema>;
