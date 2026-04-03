import { z } from 'zod';
import { optionalIsoDateString, optionalString, normalizeEmptyToUndefined } from '../baseSchemas';
import { skadestypeEnum } from '../enumSchemas';

export const stamdataSchema = z.object({
  journalnr: optionalString,
  advokat: optionalString,
  sagsbehandler: optionalString,
  skadelidte: optionalString,
  skadelidteFodselsdato: optionalIsoDateString,
  skadestype: z.preprocess(normalizeEmptyToUndefined, skadestypeEnum.optional()),
  skadesdato: optionalIsoDateString,
}).strict();

export type StamdataValues = z.infer<typeof stamdataSchema>;
