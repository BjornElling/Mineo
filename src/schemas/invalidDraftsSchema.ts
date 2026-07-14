import { z } from 'zod';
import { PERSISTED_SECTION_KEYS } from '../config/persistenceRegistry';
import type { StorageKey } from '../config/storageManifest';

/**
 * Schema for `invalidDrafts`-recovery-kanalen (afsluttet ugyldigt input).
 *
 * Form: `invalidDrafts[pageKey][fieldPath] = råstreng (ikke-tom)`.
 *
 * Dette er IKKE en `persistenceRegistry`-sektion — det er en separat persisteret store-slice
 * (jf. `persistence-contract.md` §11). Schemaet bruges til at validere den dedikerede
 * `sessionStorage`-nøgle ved hydrering, så ugyldigt/korrupt indhold droppes fail-closed.
 *
 * Både fieldPath-nøgler og rå-streng-værdier skal være ikke-tomme: et tomt draft betyder
 * "ingen entry" og må aldrig persisteres.
 */
const sectionInvalidDraftsSchema = z.record(z.string().min(1), z.string().min(1));

const invalidDraftsShape = Object.fromEntries(
  PERSISTED_SECTION_KEYS.map((pageKey) => [pageKey, sectionInvalidDraftsSchema] as const)
) as Record<StorageKey, typeof sectionInvalidDraftsSchema>;

/**
 * Partial pr. sektion: en ældre/nyere sessionStorage-værdi behøver ikke indeholde alle
 * sektions-nøgler. Hydrering overlejrer den parsede værdi på en tom cache.
 */
export const invalidDraftsCacheSchema = z.object(invalidDraftsShape).partial();

export type InvalidDraftsCacheInput = z.infer<typeof invalidDraftsCacheSchema>;
