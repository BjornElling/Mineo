/**
 * Zod-baserede type guards
 *
 * VIGTIGT: Disse type guards bruger Zod schemas direkte som SSoT,
 * så de aldrig kan divergere fra schema-definitionerne.
 *
 * Brug disse i stedet for manuelle type guards.
 */

import { loenperiodeSchema, loenPaaHelligdageSchema } from '../schemas/formSchemas';
import type { Loenperiode, LoenPaaHelligdage } from '../types/common';

/**
 * Type guard for Loenperiode (valideret via Zod schema)
 *
 * @param value - Værdi at validere
 * @returns true hvis værdien er en gyldig Loenperiode
 */
export const isLoenperiodeValue = (value: unknown): value is Loenperiode => {
  const result = loenperiodeSchema.safeParse(value);
  return result.success;
};

/**
 * Type guard for LoenPaaHelligdage (valideret via Zod schema)
 *
 * @param value - Værdi at validere
 * @returns true hvis værdien er en gyldig LoenPaaHelligdage
 */
export const isLoenPaaHelligdageValue = (value: unknown): value is LoenPaaHelligdage => {
  const result = loenPaaHelligdageSchema.safeParse(value);
  return result.success;
};
