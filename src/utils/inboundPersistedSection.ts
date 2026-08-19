import type { z } from 'zod';
import { persistenceSchemas, type PersistedSectionMap } from '../config/persistenceRegistry';
import type { PersistedSectionKey } from '../config/persistenceRegistry';
import { migratePersistedSectionValue } from './persistenceMigrations';
import { sanitizePersistedValueForSchema } from './persistenceLoadSanitization';

type SanitizeResult = ReturnType<typeof sanitizePersistedValueForSchema>;
type UnknownPath = SanitizeResult['unknownPaths'][number];

/**
 * Det fælles, kontrakt-bestemte inbound-transform-resultat: migrator → sanitize → schema-parse.
 * Caller'en ejer rapporteringen (preflight-tabsoptælling vs. session-hydrerings-kategorisering),
 * men selve transformen er den samme for alle inbound-kilder.
 */
export type InboundPersistedSectionResult<K extends PersistedSectionKey> = Readonly<{
  /** Migrator-output (kontrakt-rækkefølge §3.1a: nullToUndefinedDeep → migrator). Bruges til tabsoptælling. */
  migratedValue: unknown;
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
 * Kilderne er `.eo`-load (`fileLoad.ts`) og current-session-hydreringen (`initializeInputRuntime.ts`).
 * Rapporteringen omkring dem er bevidst forskellig (preflight med felt-baseret tabsoptælling vs. coarse
 * korrupt/inkompatibel-kategorisering), men selve transformen MÅ aldrig afvige mellem kilderne – ellers
 * kunne samme rå sektionsdata blive behandlet forskelligt afhængigt af, om den kom fra en fil eller fra
 * sessionStorage. Den deles derfor her.
 *
 * Der findes INTET outbound-modstykke: sektionsvis persistering er ikke længere en skrivegrænse, så
 * save-vejen parser den canonical sektion og stringify'er hele aggregatet i én container/envelope. Den
 * tidligere `buildPersistedSection`-helper, som teksten her henviste til, havde nul produktionscallsites og
 * er slettet.
 *
 * `sourceVersion` skal komme fra den konkrete envelope/container og må aldrig udledes af sektionsværdien.
 */
export const parseInboundPersistedSection = <K extends PersistedSectionKey>(
  pageKey: K,
  rawValue: unknown,
  sourceVersion: string
): InboundPersistedSectionResult<K> => {
  const schema = persistenceSchemas[pageKey];
  const migrated = migratePersistedSectionValue(pageKey, rawValue, sourceVersion);
  const stripped = sanitizePersistedValueForSchema(schema, migrated.value);
  const parsed = schema.safeParse(stripped.sanitized);

  const common = {
    migratedValue: migrated.value,
    unknownPaths: stripped.unknownPaths,
  } as const;

  if (parsed.success) {
    return { ...common, ok: true, data: parsed.data as PersistedSectionMap[K] };
  }
  return { ...common, ok: false, error: parsed.error };
};
