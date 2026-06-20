import { z } from 'zod';
import { coerceToWholeNumberOrUndefined, optionalIsoDateString, normalizeEmptyToUndefined } from '../baseSchemas';
import { koenEnum } from '../enumSchemas';
import { SKAERING_2015_03_01 } from '../../../domain/erhvervsevnetab/eetSkaeringsdatoer';

export const forsoergertabSchema = z.object({
  efterladteFodselsdato: optionalIsoDateString,
  beregningsdato: optionalIsoDateString,
  virkningsdato: optionalIsoDateString,
  // Kanonisk optional-enum-mønster: '' → undefined før enum-validering, så et persisteret
  // tomt køn ikke dropper hele forsørgertab-sektionen.
  koen: z.preprocess(normalizeEmptyToUndefined, koenEnum.optional()),
  tilkendtForPeriodeAar: z.preprocess(
    coerceToWholeNumberOrUndefined,
    z.number({ error: 'Tilkendt for periode skal være et heltal' })
      .int('Tilkendt for periode skal være et heltal')
      .min(1, 'Tilkendt for periode skal være mindst 1 år')
      .max(10, 'Tilkendt for periode må højst være 10 år')
      .optional()
  ),
}).strict().superRefine((value, ctx) => {
  if (
    value.beregningsdato !== undefined &&
    value.virkningsdato !== undefined &&
    value.beregningsdato < value.virkningsdato
  ) {
    // ISO-formatet YYYY-MM-DD har samme leksikografiske og kronologiske orden.
    const message = 'Beregningsdato er før virkningsdato.';
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['beregningsdato'], message });
  }

  if (value.beregningsdato !== undefined && value.beregningsdato < SKAERING_2015_03_01 && value.koen === undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['koen'],
      message: 'Ved beregning før 1. marts 2015 skal køn angives.',
    });
  }
});

export type ForsoergertabValues = z.infer<typeof forsoergertabSchema>;
