import { z } from 'zod';
import { coerceToIntegerOrUndefined, optionalIsoDateString } from '../baseSchemas';
import { koenEnum } from '../enumSchemas';
import { PRE_2015_CUTOFF } from '../../../domain/shared/forsoergertabConstants';

export const forsoergertabSchema = z.object({
  efterladteFodselsdato: optionalIsoDateString,
  beregningsdato: optionalIsoDateString,
  virkningsdato: optionalIsoDateString,
  koen: koenEnum.optional(),
  tilkendtForPeriodeAar: z.preprocess(
    coerceToIntegerOrUndefined,
    z.number()
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
    const message = 'Beregningsdato må ikke være før virkningsdato.';
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['beregningsdato'], message });
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['virkningsdato'], message });
  }

  if (value.beregningsdato !== undefined && value.beregningsdato < PRE_2015_CUTOFF && value.koen === undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['koen'],
      message: 'Ved beregning før 1. marts 2015 skal køn angives.',
    });
  }
});

export type ForsoergertabValues = z.infer<typeof forsoergertabSchema>;
