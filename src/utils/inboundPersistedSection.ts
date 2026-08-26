import type { z } from 'zod';
import { persistenceSchemas, type PersistedSectionMap } from '../config/persistenceRegistry';
import type { PersistedSectionKey } from '../config/persistenceRegistry';
import { migratePersistedSectionValue } from './persistenceMigrations';
import { sanitizePersistedValueForSchema } from './persistenceLoadSanitization';
import { isRecord } from './typeGuards';

type SanitizeResult = ReturnType<typeof sanitizePersistedValueForSchema>;
type UnknownPath = SanitizeResult['unknownPaths'][number];
type InvalidPath = UnknownPath;

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
  /** Schema-ugyldige stier, der kunne fjernes isoleret uden at kassere resten af sektionen. */
  invalidPaths: readonly InvalidPath[];
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
/** Fjerner ét ugyldigt felt. Fejl i en tabelrække fjerner hele rækken, fordi dens id/struktur er atomisk. */
const removeInvalidPath = (value: unknown, path: readonly (string | number)[]): { changed: boolean; value: unknown } => {
  if (path.length === 0) return { changed: false, value };
  const [segment, ...rest] = path;

  if (Array.isArray(value)) {
    if (typeof segment !== 'number' || segment < 0 || segment >= value.length) return { changed: false, value };
    // En array-indgang er en strukturel enhed. At rydde kun ét felt kan efterlade en halv række,
    // der senere får schema-defaults og dermed foregiver at være brugerdata.
    const next = value.slice();
    next.splice(segment, 1);
    return { changed: true, value: next };
  }

  if (!isRecord(value) || typeof segment !== 'string' || !(segment in value)) {
    return { changed: false, value };
  }

  const next = { ...value };
  if (rest.length === 0) {
    delete next[segment];
    return { changed: true, value: next };
  }

  const nested = removeInvalidPath(value[segment], rest);
  if (!nested.changed) return { changed: false, value };
  next[segment] = nested.value;
  return { changed: true, value: next };
};

/**
 * Salvager så mange schema-gyldige felter som muligt fra en filsektion. Hver fjernet sti bevares
 * til preflight, så ingen brugerdata forsvinder tavst. Current-session-hydrering afviser stadig
 * sådanne sektioner fail-closed – den har ingen preflight, hvor brugeren kan godkende tabet.
 */
const salvageInvalidFields = <K extends PersistedSectionKey>(
  schema: z.ZodType,
  sanitized: unknown,
): { data: PersistedSectionMap[K]; invalidPaths: readonly InvalidPath[] } | null => {
  let candidate = sanitized;
  const invalidPaths: InvalidPath[] = [];

  for (let attempt = 0; attempt < 100; attempt += 1) {
    const parsed = schema.safeParse(candidate);
    if (parsed.success) {
      return { data: parsed.data as PersistedSectionMap[K], invalidPaths };
    }

    let changed = false;
    for (const issue of parsed.error.issues) {
      const path = issue.path.filter((segment): segment is string | number =>
        typeof segment === 'string' || typeof segment === 'number'
      );
      const removed = removeInvalidPath(candidate, path);
      if (!removed.changed) continue;
      candidate = removed.value;
      invalidPaths.push(path);
      changed = true;
    }
    if (!changed) return null;
  }

  return null;
};

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
    return { ...common, invalidPaths: [], ok: true, data: parsed.data as PersistedSectionMap[K] };
  }

  const salvaged = salvageInvalidFields<K>(schema, stripped.sanitized);
  if (salvaged !== null) {
    return { ...common, invalidPaths: salvaged.invalidPaths, ok: true, data: salvaged.data };
  }
  return { ...common, invalidPaths: [], ok: false, error: parsed.error };
};
