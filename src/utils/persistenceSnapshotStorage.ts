import { PERSISTED_SECTION_KEYS } from '../config/persistenceRegistry';
import { getInvalidDraftsStorageKey, getStorageKey } from '../config/storageManifest';
import type { FormPersistenceSections, InvalidDraftsCache } from '../stores/formPersistenceStore';
import { buildPersistedSection } from './buildPersistedSection';
import {
  readSessionStorageValue,
  removeSessionStorageValue,
  writeSessionStorageValue,
} from './safeSessionStorage';
import { serializeInvalidDraftsCache } from './invalidDraftsStorage';
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

    // Dette er defensiv pre-save-normalisering af allerede committede store-data,
    // ikke load-sanitization. Ukendte felter skal stadig fejle schema-validering her.
    const built = buildPersistedSection(pageKey, raw, now);
    if (!built.ok) {
      const issues = built.error ? formatZodIssues(built.error.issues, 2) : '';
      if (built.stage === 'post-serialize') {
        throw new Error(`Kan ikke forberede persistence-snapshot: '${pageKey}' fejler efter serialisering.\n${issues}`);
      }
      throw new Error(`Kan ikke forberede persistence-snapshot: '${pageKey}' matcher ikke schema.\n${issues}`);
    }
    toWrite.push({ storageKey, value: built.serialized });
  }

  return { toWrite, toRemove };
};

/**
 * Serialiserer + skriver persisterede sektioner (+ valgfrit invalidDrafts) til `sessionStorage`
 * atomisk, med **kun sessionStorage-rollback**. Den eneste caller er undo/redo-restore
 * (`useUndoRedo.restorePlannedTransition`), som selv snapshotter/gendanner store + undo/redo-historik
 * i sin `commit`-callback.
 *
 * Bevidst sameksistens med `runAtomicPersistenceMutation` (`persistenceStoreRollback.ts`) — de må
 * IKKE flettes sammen (jf. greenfield #41 / #33-review). To grunde:
 *   1. Denne helper ejer sektions-serialiseringen (`buildPersistenceSectionWrites`, schema-validering
 *      der fejler før nogen storage-mutation) — et ansvar `runAtomicPersistenceMutation` ikke har.
 *   2. Den har sin egen, individuelt testede danske fejl-normalisering (backup kan ikke aflæses /
 *      lager fyldt / commit-fejl). `runAtomicPersistenceMutation` læser sit storage-backup UDEN for
 *      sin try og re-wrapper fejl via `createRollbackError` — en sammenlægning ville ændre disse
 *      testede fejlbeskeder på en trust-kritisk sti uden korrektheds-gevinst.
 * Den snævrere rollback-scope er derfor et bevidst valg, ikke drift. Ændrer den ene helper
 * rollback- eller fejl-semantik, revurderes forholdet her og ved callsite.
 */
export const atomicWritePersistenceSections = (
  sections: FormPersistenceSections,
  commit: () => void,
  invalidDrafts?: InvalidDraftsCache
): void => {
  // Caller-ejet rollback-state (store-felter, undo/redo-historik, notices) skal gendannes
  // af callback-ejeren. Denne hjælper garanterer kun sessionStorage-rollback.
  const { toWrite, toRemove } = buildPersistenceSectionWrites(sections);
  const invalidDraftsStorageKey = getInvalidDraftsStorageKey();
  let backup: SessionStorageBackup;
  try {
    backup = createSessionStorageBackup();
    if (invalidDrafts !== undefined) {
      // Inkludér invalidDrafts-nøglen i backup, så restore er atomisk på tværs af sektioner + recovery-kanal.
      backup.set(invalidDraftsStorageKey, readSessionStorageValue(invalidDraftsStorageKey));
    }
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
    if (invalidDrafts !== undefined) {
      const serialized = serializeInvalidDraftsCache(invalidDrafts);
      const hasEntries = PERSISTED_SECTION_KEYS.some((pageKey) => Object.keys(invalidDrafts[pageKey]).length > 0);
      if (hasEntries) {
        writeSessionStorageValue(invalidDraftsStorageKey, serialized);
      } else {
        removeSessionStorageValue(invalidDraftsStorageKey);
      }
    }
    commit();
  } catch (error) {
    restoreSessionStorageBackup(backup);
    const message = error instanceof Error ? error.message : 'Ukendt fejl';
    throw new Error(`Kunne ikke skrive persistence-snapshot atomisk: ${message}`);
  }
};
