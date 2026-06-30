import type { z } from 'zod';
import { persistenceSchemas, type PersistedSectionMap } from '../config/persistenceRegistry';
import type { StorageKey } from '../config/storageManifest';
import { migratePersistedSectionValue, type PersistenceMigrationIssue } from './persistenceMigrations';
import { sanitizePersistedValueForSchema } from './persistenceLoadSanitization';

type SanitizeResult = ReturnType<typeof sanitizePersistedValueForSchema>;
type UnknownPath = SanitizeResult['unknownPaths'][number];

/**
 * Det fælles, kontrakt-bestemte inbound-transform-resultat: migrator → sanitize → schema-parse.
 * Caller'en ejer rapporteringen (preflight-tabsoptælling vs. session-hydrerings-kategorisering),
 * men selve transformen er den samme for alle inbound-kilder.
 */
export type InboundPersistedSectionResult<K extends StorageKey> = Readonly<{
  /** Migrator-output (kontrakt-rækkefølge §3.1a: nullToUndefinedDeep → migrator). Bruges til tabsoptælling. */
  migratedValue: unknown;
  /** Eventuelle migrator-bemærkninger (tom i dag; migratorer er endnu data-bevarende). */
  migrationIssues: readonly PersistenceMigrationIssue[];
  /** Strippede stier til ukendte felter (gemt data denne version ikke kender). */
  unknownPaths: readonly UnknownPath[];
}> & (
  | { ok: true; data: PersistedSectionMap[K] }
  | { ok: false; error: z.ZodError }
);

/**
 * Det ENESTE sted der parser en INDKOMMENDE persisteret sektion (rå .eo-fil-data ELLER
 * sessionStorage-data) til schema-valideret current-struktur.
 *
 * Kører den trust-kritiske inbound-kæde fra schema-evolution.md §3.1a:
 *   migratePersistedSectionValue (nullToUndefinedDeep → migrator) → sanitizePersistedValueForSchema
 *   (strip ukendte felter) → schema.safeParse.
 *
 * `.eo`-load (`fileLoad.ts`) og session-hydrering (`persistenceSessionHydration.ts`) byggede tidligere
 * denne kæde hver for sig. Selv om rapporteringen omkring dem er bevidst forskellig (preflight med
 * felt-baseret tabsoptælling vs. coarse korrupt/inkompatibel-kategorisering), MÅ selve transformen
 * aldrig afvige mellem kilderne — ellers kunne samme rå sektionsdata blive behandlet forskelligt
 * afhængigt af, om den kom fra en fil eller fra sessionStorage. Den deles derfor her (modstykket til
 * `buildPersistedSection` på outbound-siden).
 */
export const parseInboundPersistedSection = <K extends StorageKey>(
  pageKey: K,
  rawValue: unknown
): InboundPersistedSectionResult<K> => {
  const schema = persistenceSchemas[pageKey];
  const migrated = migratePersistedSectionValue(pageKey, rawValue);
  const stripped = sanitizePersistedValueForSchema(schema, migrated.value);
  const parsed = schema.safeParse(stripped.sanitized);

  const common = {
    migratedValue: migrated.value,
    migrationIssues: migrated.issues,
    unknownPaths: stripped.unknownPaths,
  } as const;

  if (parsed.success) {
    return { ...common, ok: true, data: parsed.data as PersistedSectionMap[K] };
  }
  return { ...common, ok: false, error: parsed.error };
};
