import { z } from 'zod';
import { isoDateString } from '../../../../schemas/formSchemas/baseSchemas';
import { formulaComponentsSchema, roundReguleringDeltaPct } from '../reguleringFormulaUtils';

/** Motorens evaluerede grundlag. Visninger formatterer dette uden nye satsvalg. */
export const reguleringsbevisSchema = z.object({
  kind: z.enum(['pakke', 'indeks', 'procentsats', 'klLoenaftaler', 'ingen']),
  sourceKind: z.enum(['statistik', 'krl', 'asl']).optional(),
  referenceValue: z.number().finite().nonnegative(),
  periodValue: z.number().finite().nonnegative(),
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
  if (bevis.referenceValue === 0 || bevis.periodValue === 0) {
    if (!isKlNulbasis(bevis) || bevis.rawFactor !== 1 || bevis.rawDeltaPct !== 0 || bevis.appliedDeltaPct !== 0) {
      ctx.addIssue({ code: 'custom', message: 'Kun KL-lønaftaler med nulbasis må have nulværdier og skal bære neutral regulering' });
    }
  }
  if (bevis.kind === 'pakke') {
    if (!bevis.referenceComponents || !bevis.periodComponents) {
      ctx.addIssue({ code: 'custom', message: 'En lønpakke skal bære begge evaluerede sæt formelkomponenter' });
    }
  } else if (bevis.referenceComponents || bevis.periodComponents) {
    ctx.addIssue({ code: 'custom', message: 'Formelkomponenter må kun tilhøre en lønpakke' });
  }
});

export type Reguleringsbevis = Readonly<z.infer<typeof reguleringsbevisSchema>>;

/** KL-resolverens afrundede nulbasis forbliver nul gennem alle reguleringstrin. */
export const isKlNulbasis = (bevis: Readonly<{ kind: string; referenceValue: number; periodValue: number }>): boolean =>
  bevis.kind === 'klLoenaftaler' && bevis.referenceValue === 0 && bevis.periodValue === 0;

export const buildReguleringsbevis = (
  referenceValue: number,
  periodValue: number,
  detail: Omit<Reguleringsbevis, 'referenceValue' | 'periodValue' | 'rawFactor' | 'rawDeltaPct' | 'appliedDeltaPct'> & Readonly<{ rawDeltaPct?: number }>,
): Reguleringsbevis => {
  // Godkendt 2026-10-15: en løn afrundet til nul beregnes som nul. Beviset registrerer de faktiske
  // nulbeløb og resolverens neutrale regulering i stedet for at danne 0/0.
  const rawFactor = isKlNulbasis({ kind: detail.kind, referenceValue, periodValue }) ? 1 : periodValue / referenceValue;
  // Den oprindelige procentberegning skal bevares: algebraisk ens omskrivninger kan flytte en halvgrænse.
  const rawDeltaPct = detail.rawDeltaPct ?? (rawFactor - 1) * 100;
  return reguleringsbevisSchema.parse({
    ...detail, referenceValue, periodValue, rawFactor, rawDeltaPct,
    appliedDeltaPct: roundReguleringDeltaPct(rawDeltaPct),
  });
};
