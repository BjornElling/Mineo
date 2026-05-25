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
  skadedato: optionalIsoDateString,
}).strict().superRefine((value, ctx) => {
  if (
    value.skadelidteFodselsdato !== undefined &&
    value.skadedato !== undefined &&
    value.skadedato < value.skadelidteFodselsdato
  ) {
    const message = 'Skadedato er før fødselsdato.';
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['skadedato'], message });
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['skadelidteFodselsdato'], message });
  }
});

export type StamdataValues = z.infer<typeof stamdataSchema>;
