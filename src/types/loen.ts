import type { z } from 'zod';
import { loenPaaHelligdageEnum, loenperiodeEnum, tillaegAngivesSomEnum } from '../schemas/formSchemas';

export type Loenperiode = z.infer<typeof loenperiodeEnum>;

export const LOENPERIODE = {
  MAANED: 'maaned' as const,
  UGE: 'uge' as const,
  DAG: 'dag' as const,
} satisfies Record<string, Loenperiode>;

export type TillaegAngivesSom = z.infer<typeof tillaegAngivesSomEnum>;

export const TILLAEG_ANGIVES_SOM = {
  PROCENT: 'procent' as const,
  BELOEB: 'beloeb' as const,
} satisfies Record<string, TillaegAngivesSom>;

export type LoenPaaHelligdage = z.infer<typeof loenPaaHelligdageEnum>;

export const LOEN_PAA_HELLIGDAGE = {
  ALMINDELIG: 'Almindelig løn' as const,
  SH_UDBETALING: 'SH-udbetaling' as const,
  INGEN: 'Ingen' as const,
} satisfies Record<string, LoenPaaHelligdage>;
