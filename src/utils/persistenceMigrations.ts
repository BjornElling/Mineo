import type { PersistedSectionKey } from '../config/persistenceRegistry';
import { PERSISTED_DATA_VERSION } from '../config/persistenceVersion';
import { nullToUndefinedDeep } from './nullToUndefinedDeep';

export type PersistenceMigrationResult = {
  value: unknown;
};

type PersistenceMigrationStep = Readonly<{
  toVersion: typeof PERSISTED_DATA_VERSION;
  migrate: (value: unknown) => PersistenceMigrationResult;
}>;

export type PersistenceMigrationRegistry = Readonly<Partial<Record<
  PersistedSectionKey,
  Readonly<Record<string, PersistenceMigrationStep>>
>>>;

type PersistedSectionMigrator = (
  pageKey: PersistedSectionKey,
  value: unknown,
  sourceVersion: string
) => PersistenceMigrationResult;

/**
 * Bygger en versionsbåret sektionsmigrator. Hver entry beskriver én entydig
 * `fromVersion -> current`-overgang; ukendte versioner forbliver urørte og går
 * videre til validering mod det aktuelle schema.
 */
export const createPersistenceMigrator = (
  registry: PersistenceMigrationRegistry
): PersistedSectionMigrator => (pageKey, value, sourceVersion) => {
  const normalized = nullToUndefinedDeep(value);
  const step = registry[pageKey]?.[sourceVersion];
  if (!step) return { value: normalized };
  // Gør `toVersion` load-bearing: en entry hvis mål ikke er den aktuelle version er en
  // fejlkonfigureret migration (kun single-hop `fromVersion -> current` er tilladt). Stop
  // fail-closed; inputtet må ikke fortsætte som en tavs identity-migration.
  if (step.toVersion !== PERSISTED_DATA_VERSION) {
    throw new Error(
      `Migration for '${pageKey}' fra version ${sourceVersion} har toVersion ${step.toVersion}, ` +
      `forventet ${PERSISTED_DATA_VERSION}.`
    );
  }
  return step.migrate(normalized);
};

// Registrér kun konkrete, kendte schema-overgange. Et versionsmismatch uden en
// entry valideres fortsat mod det aktuelle schema; shape-gæt er bevidst forbudt.
const PERSISTENCE_MIGRATIONS = {} satisfies PersistenceMigrationRegistry;

/**
 * Eksplicit migrator-dispatcher pr. persisted sektion.
 *
 * Kontrakt-rækkefølge (schema-evolution.md §3.1a): nullToUndefinedDeep → migrator →
 * stripUnknownFieldsBySchema → schema.safeParse. Vi anvender derfor `nullToUndefinedDeep`
 * her, FØR en eventuel sektion-migrator kører, så fremtidige migratorer altid får
 * input på den kontrakt-lovede normaliserede form — uanset om kalderen (fil-load vs.
 * session-hydrering) selv har normaliseret. Dette gør de to load-stier konsistente.
 *
 * Migratorer må kun mappe KENDTE gamle strukturer til aktuel struktur; de må ikke gætte
 * domæneværdier. Dispatcheren er et extension point, ikke en generel bagudkompat-forpligtelse.
 */
export const migratePersistedSectionValue = createPersistenceMigrator(PERSISTENCE_MIGRATIONS);
