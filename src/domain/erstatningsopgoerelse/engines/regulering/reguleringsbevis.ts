import { z } from 'zod';
import { isoDateString } from '../../../../schemas/formSchemas/baseSchemas';
import { formulaComponentsSchema, roundReguleringDeltaPct } from '../reguleringFormulaUtils';

/** Motorens evaluerede grundlag. Visninger formatterer dette uden nye satsvalg. */
export const reguleringsbevisSchema = z.object({
  kind: z.enum(['pakke', 'indeks', 'procentsats', 'klLoenaftaler', 'ingen']),
  sourceKind: z.enum(['statistik', 'krl', 'asl']).optional(),
  referenceValue: z.number().finite().positive(),
  periodValue: z.number().finite().positive(),
  rawFactor: z.number().finite().positive(),
  rawDeltaPct: z.number().finite(),
  appliedDeltaPct: z.number().finite(),
  referenceDate: isoDateString.optional(),
  periodRateDate: isoDateString.optional(),
  referenceComponents: formulaComponentsSchema.optional(),
  periodComponents: formulaComponentsSchema.optional(),
  displayDecimals: z.number().int().nonnegative().optional(),
  /** Synlige kildekolonner; deres tilstedeværelse kan afhænge af kilderækker uden for TAF-segmentet. */
  sourceColumns: z.array(z.enum(['feriePct', 'shSoPct', 'fritvalgPct', 'storeBededagPct', 'pensionPct'])).optional(),
  referenceWageBaseValue: z.number().finite().optional(),
  referenceWageSupplement: z.number().finite().optional(),
  wageBaseValue: z.number().finite().optional(),
  wageSupplement: z.number().finite().optional(),
  periodePct: z.number().finite().optional(),
}).strict().superRefine((bevis, ctx) => {
  if (bevis.kind === 'pakke') {
    if (!bevis.referenceComponents || !bevis.periodComponents) {
      ctx.addIssue({ code: 'custom', message: 'En lønpakke skal bære begge evaluerede sæt formelkomponenter' });
    }
  } else if (bevis.referenceComponents || bevis.periodComponents) {
    ctx.addIssue({ code: 'custom', message: 'Formelkomponenter må kun tilhøre en lønpakke' });
  }
});

export type Reguleringsbevis = Readonly<z.infer<typeof reguleringsbevisSchema>>;

export const buildReguleringsbevis = (
  referenceValue: number,
  periodValue: number,
  detail: Omit<Reguleringsbevis, 'referenceValue' | 'periodValue' | 'rawFactor' | 'rawDeltaPct' | 'appliedDeltaPct'> & Readonly<{ rawDeltaPct?: number }>,
): Reguleringsbevis => {
  const rawFactor = periodValue / referenceValue;
  // Den oprindelige procentberegning skal bevares: algebraisk ens omskrivninger kan flytte en halvgrænse.
  const rawDeltaPct = detail.rawDeltaPct ?? (rawFactor - 1) * 100;
  return reguleringsbevisSchema.parse({
    ...detail, referenceValue, periodValue, rawFactor, rawDeltaPct,
    appliedDeltaPct: roundReguleringDeltaPct(rawDeltaPct),
  });
};
