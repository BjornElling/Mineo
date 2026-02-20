import type { z } from 'zod';
import { loenPaaHelligdageSchema, loenperiodeSchema } from '../schemas/formSchemas';

export type Loenperiode = z.infer<typeof loenperiodeSchema>;

export const LOENPERIODE = {
  MAANED: 'maaned' as const,
  UGE: 'uge' as const,
  DAG: 'dag' as const,
} satisfies Record<string, Loenperiode>;

export type LoenPaaHelligdage = z.infer<typeof loenPaaHelligdageSchema>;

export const LOEN_PAA_HELLIGDAGE = {
  ALMINDELIG: 'Almindelig løn' as const,
  SH_UDBETALING: 'SH-udbetaling' as const,
  INGEN: 'Ingen' as const,
} satisfies Record<string, LoenPaaHelligdage>;
