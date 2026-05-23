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
  return { value, issues: [] };
};
