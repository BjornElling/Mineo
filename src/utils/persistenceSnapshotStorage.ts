import { PERSISTED_DATA_VERSION } from '../config/persistenceVersion';
import { PERSISTED_SECTION_KEYS, persistenceSchemas } from '../config/persistenceRegistry';
import { getStorageKey } from '../config/storageManifest';
import type { PersistedData } from '../types/persistence';
import type { FormPersistenceSections } from '../stores/formPersistenceStore';
import { nullToUndefinedDeep } from './nullToUndefinedDeep';
import { serializeFormValues } from './serialization';
import {
  readSessionStorageValue,
  removeSessionStorageValue,
  writeSessionStorageValue,
} from './safeSessionStorage';
import { formatZodIssues } from './zodIssueFormatting';

type SessionStorageBackup = Map<string, string | null>;
const createSessionStorageBackup = (): SessionStorageBackup => {
  const backup = new Map<string, string | null>();

  for (const pageKey of PERSISTED_SECTION_KEYS) {
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
  const toWrite: Array<{ storageKey: string; value: string }> = [];
  const toRemove: string[] = [];
  const now = Date.now();

  for (const pageKey of PERSISTED_SECTION_KEYS) {
    const storageKey = getStorageKey(pageKey);
    const raw = sections[pageKey];
    if (raw === null) {
      toRemove.push(storageKey);
      continue;
    }

    const schema = persistenceSchemas[pageKey];
    // This is defensive pre-save normalization of already committed store data,
    // not load-sanitization. Unknown fields must still fail schema validation here.
    const validated = schema.safeParse(nullToUndefinedDeep(raw));
    if (!validated.success) {
      const issues = formatZodIssues(validated.error.issues, 2);
      throw new Error(`Kan ikke forberede persistence-snapshot: '${pageKey}' matcher ikke schema.\n${issues}`);
    }

    const persistedSectionData = serializeFormValues(validated.data);
    const postSerializeValidated = schema.safeParse(nullToUndefinedDeep(persistedSectionData));
    if (!postSerializeValidated.success) {
      const issues = formatZodIssues(postSerializeValidated.error.issues, 2);
      throw new Error(`Kan ikke forberede persistence-snapshot: '${pageKey}' fejler efter serialisering.\n${issues}`);
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

export const atomicWritePersistenceSections = (
  sections: FormPersistenceSections,
  commit: () => void
): void => {
  const { toWrite, toRemove } = buildPersistenceSectionWrites(sections);
  let backup: SessionStorageBackup;
  try {
    backup = createSessionStorageBackup();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ukendt fejl';
    throw new Error(`Browserens midlertidige lager kunne ikke aflæses; snapshot-skrivning blev annulleret. ${message}`);
  }

  try {
    for (const storageKey of toRemove) {
      removeSessionStorageValue(storageKey);
    }
    for (const { storageKey, value } of toWrite) {
      writeSessionStorageValue(storageKey, value);
    }
    commit();
  } catch (error) {
    restoreSessionStorageBackup(backup);
    const message = error instanceof Error ? error.message : 'Ukendt fejl';
    throw new Error(`Kunne ikke skrive persistence-snapshot atomisk: ${message}`);
  }
};
