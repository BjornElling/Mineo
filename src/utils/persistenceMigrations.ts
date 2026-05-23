import type { StorageKey } from '../config/storageManifest';

export type PersistenceMigrationIssue = {
  path: string;
  reason: string;
};

export type PersistenceMigrationResult = {
  value: unknown;
  issues: PersistenceMigrationIssue[];
};

export const migratePersistedSectionValue = (_pageKey: StorageKey, value: unknown): PersistenceMigrationResult => {
  // _pageKey is reserved for the first explicit switch/map-based migration dispatcher.
  // Register future persisted-section migrators here so .eo-load and session hydration share the same path.
  return { value, issues: [] };
};
