import type { StorageKey } from '../config/storageManifest';
import { PERSISTED_DATA_VERSION } from '../config/persistenceVersion';
import { nullToUndefinedDeep } from './nullToUndefinedDeep';

export type PersistenceMigrationIssue = {
  path: string;
  reason: string;
};

export type PersistenceMigrationResult = {
  value: unknown;
  issues: PersistenceMigrationIssue[];
};

type PersistenceMigrationStep = Readonly<{
  toVersion: typeof PERSISTED_DATA_VERSION;
  migrate: (value: unknown) => Pick<PersistenceMigrationResult, 'value' | 'issues'>;
}>;

export type PersistenceMigrationRegistry = Readonly<Partial<Record<
  StorageKey,
  Readonly<Record<string, PersistenceMigrationStep>>
>>>;

type PersistedSectionMigrator = (
  pageKey: StorageKey,
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
  return step ? step.migrate(normalized) : { value: normalized, issues: [] };
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
