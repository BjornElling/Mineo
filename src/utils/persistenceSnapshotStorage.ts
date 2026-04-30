import { PERSISTED_DATA_VERSION } from '../config/persistenceVersion';
import { persistenceSchemas } from '../config/persistenceRegistry';
import { getStorageKey, type StorageKey } from '../config/storageManifest';
import type { PersistedData } from '../types/persistence';
import type { FormPersistenceSections } from '../stores/formPersistenceStore';
import { nullToUndefinedDeep } from './nullToUndefinedDeep';
import { serializeFormValues } from './serialization';
import {
  readSessionStorageValue,
  removeSessionStorageValue,
  writeSessionStorageValue,
} from './safeSessionStorage';

type SessionStorageBackup = Map<string, string | null>;

const formatZodIssues = (issues: Array<{ path: PropertyKey[]; message: string }>, max: number): string => {
  return issues
    .slice(0, max)
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join('.') : '(root)';
      return `${path}: ${issue.message}`;
    })
    .join('\n');
};

const createSessionStorageBackup = (): SessionStorageBackup => {
  const keys = Object.keys(persistenceSchemas) as StorageKey[];
  const backup = new Map<string, string | null>();

  for (const pageKey of keys) {
    const storageKey = getStorageKey(pageKey);
    backup.set(storageKey, readSessionStorageValue(storageKey));
  }

  return backup;
};

const restoreSessionStorageBackup = (backup: SessionStorageBackup): void => {
  for (const [storageKey, value] of backup.entries()) {
    if (value === null) {
      removeSessionStorageValue(storageKey);
    } else {
      writeSessionStorageValue(storageKey, value);
    }
  }
};

const buildPersistenceSectionWrites = (sections: FormPersistenceSections): {
  toWrite: Array<{ storageKey: string; value: string }>;
  toRemove: string[];
} => {
  const keys = Object.keys(persistenceSchemas) as StorageKey[];
  const toWrite: Array<{ storageKey: string; value: string }> = [];
  const toRemove: string[] = [];
  const now = Date.now();

  for (const pageKey of keys) {
    const storageKey = getStorageKey(pageKey);
    const raw = sections[pageKey];
    if (raw === null) {
      toRemove.push(storageKey);
      continue;
    }

    const schema = persistenceSchemas[pageKey];
    const validated = schema.safeParse(nullToUndefinedDeep(raw));
    if (!validated.success) {
      const issues = formatZodIssues(validated.error.issues, 2);
      throw new Error(`Kan ikke skrive history-snapshot: '${pageKey}' matcher ikke schema.\n${issues}`);
    }

    const persistedSectionData = serializeFormValues(validated.data);
    const postSerializeValidated = schema.safeParse(nullToUndefinedDeep(persistedSectionData));
    if (!postSerializeValidated.success) {
      const issues = formatZodIssues(postSerializeValidated.error.issues, 2);
      throw new Error(`Kan ikke skrive history-snapshot: '${pageKey}' fejler efter serialisering.\n${issues}`);
    }

    const persistedData: PersistedData = {
      version: PERSISTED_DATA_VERSION,
      timestamp: now,
      data: persistedSectionData,
    };
    toWrite.push({ storageKey, value: JSON.stringify(persistedData) });
  }

  return { toWrite, toRemove };
};

export const writePersistenceSectionsToSessionStorage = (sections: FormPersistenceSections): void => {
  const backup = createSessionStorageBackup();
  const { toWrite, toRemove } = buildPersistenceSectionWrites(sections);

  try {
    for (const storageKey of toRemove) {
      removeSessionStorageValue(storageKey);
    }
    for (const { storageKey, value } of toWrite) {
      writeSessionStorageValue(storageKey, value);
    }
  } catch (error) {
    restoreSessionStorageBackup(backup);
    const message = error instanceof Error ? error.message : 'Ukendt fejl';
    throw new Error(`Kunne ikke skrive history-snapshot atomisk: ${message}`);
  }
};

export const writePersistenceSectionsToSessionStorageWithRollback = (
  sections: FormPersistenceSections,
  afterWrite: () => void
): void => {
  const backup = createSessionStorageBackup();
  const { toWrite, toRemove } = buildPersistenceSectionWrites(sections);

  try {
    for (const storageKey of toRemove) {
      removeSessionStorageValue(storageKey);
    }
    for (const { storageKey, value } of toWrite) {
      writeSessionStorageValue(storageKey, value);
    }
    afterWrite();
  } catch (error) {
    restoreSessionStorageBackup(backup);
    const message = error instanceof Error ? error.message : 'Ukendt fejl';
    throw new Error(`Kunne ikke gendanne history-snapshot atomisk: ${message}`);
  }
};
