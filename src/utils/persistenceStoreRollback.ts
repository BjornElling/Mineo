import {
  formPersistenceStore,
  type FieldErrorCache,
  type FieldErrorRevisionMap,
  type FormPersistenceMeta,
  type InvalidDraftRevisionMap,
  type InvalidDraftsCache,
  type SectionRevisionMap,
} from '../stores/formPersistenceStore';
import { undoRedoStore } from '../stores/undoRedoStore';
import type { PersistedSectionMap } from '../config/persistenceRegistry';
import type { StorageKey } from '../config/storageManifest';
import { clearResolvedFieldErrorsCache } from '../stores/formPersistenceReadModel';
import {
  readSessionStorageValue,
  removeSessionStorageValue,
  writeSessionStorageValue,
} from './safeSessionStorage';
import { asError } from './typeGuards';

/**
 * Fælles capture/restore af committed-tier runtime-state (formPersistenceStore + undoRedoStore),
 * brugt af alle atomiske skrive-/restore-flows der skal kunne fail-closed rulle tilbage
 * (persist, invalid-draft-skrivning, autoritativ replace OG undo/redo-restore).
 *
 * Tidligere lå disse helpers privat i FormPersistenceContext; undo/redo-restore manglede dem og
 * kunne efterlade storen i target-tilstand mens sessionStorage var rullet tilbage (divergens).
 * Konsolideret her, så begge stier deler præcis samme rollback-semantik.
 */

type PersistedCache = { [K in StorageKey]: PersistedSectionMap[K] | null };

export type StoreRollbackSnapshot = {
  sections: PersistedCache;
  sectionRevisions: SectionRevisionMap;
  fieldErrors: FieldErrorCache;
  fieldErrorRevisions: FieldErrorRevisionMap;
  invalidDrafts: InvalidDraftsCache;
  invalidDraftRevisions: InvalidDraftRevisionMap;
  committedChangeCounter: number;
  authoritativeSnapshotEpoch: number;
  meta: FormPersistenceMeta;
};

export type UndoRedoRollbackSnapshot = Pick<
  ReturnType<typeof undoRedoStore.getState>,
  'past' | 'future' | 'frameSequence'
>;

export const captureStoreRollbackSnapshot = (): StoreRollbackSnapshot => {
  const state = formPersistenceStore.getState();
  return {
    sections: state.sections as PersistedCache,
    sectionRevisions: state.sectionRevisions,
    fieldErrors: state.fieldErrors,
    fieldErrorRevisions: state.fieldErrorRevisions,
    invalidDrafts: state.invalidDrafts,
    invalidDraftRevisions: state.invalidDraftRevisions,
    committedChangeCounter: state.committedChangeCounter,
    authoritativeSnapshotEpoch: state.authoritativeSnapshotEpoch,
    meta: state.meta,
  };
};

export const restoreStoreRollbackSnapshot = (snapshot: StoreRollbackSnapshot): void => {
  formPersistenceStore.getState().rollbackSections(
    snapshot.sections,
    snapshot.sectionRevisions,
    snapshot.committedChangeCounter,
    snapshot.authoritativeSnapshotEpoch,
    snapshot.meta
  );
  formPersistenceStore.getState().restoreFieldErrors(snapshot.fieldErrors, snapshot.fieldErrorRevisions);
  formPersistenceStore.getState().restoreInvalidDrafts(snapshot.invalidDrafts, snapshot.invalidDraftRevisions);
  clearResolvedFieldErrorsCache();
};

export const captureUndoRedoRollbackSnapshot = (): UndoRedoRollbackSnapshot => {
  const state = undoRedoStore.getState();
  return {
    past: structuredClone(state.past),
    future: structuredClone(state.future),
    frameSequence: state.frameSequence,
  };
};

export const restoreUndoRedoRollbackSnapshot = (snapshot: UndoRedoRollbackSnapshot): void => {
  undoRedoStore.setState({
    past: snapshot.past,
    future: snapshot.future,
    frameSequence: snapshot.frameSequence,
  });
};

const restoreStorageValue = (storageKey: string, value: string | null): void => {
  if (value === null) {
    removeSessionStorageValue(storageKey);
    return;
  }
  writeSessionStorageValue(storageKey, value);
};

const attemptRollbackStep = (failures: Error[], step: () => void): void => {
  try {
    step();
  } catch (rollbackError) {
    failures.push(asError(rollbackError));
  }
};

const createRollbackError = (operation: string, originalError: unknown, rollbackFailures: readonly Error[]): Error => {
  const originalMessage = originalError instanceof Error ? originalError.message : String(originalError);
  if (rollbackFailures.length === 0) {
    return originalError instanceof Error ? originalError : new Error(originalMessage);
  }

  const rollbackMessages = rollbackFailures.map((failure) => failure.message).join(' | ');
  return new Error(`${operation} fejlede og rollback havde ${rollbackFailures.length} fejl: ${rollbackMessages}. Oprindelig fejl: ${originalMessage}`);
};

export type AtomicPersistenceMutation = {
  /** Navn brugt i den fail-closed rollback-fejlbesked. */
  operation: string;
  /** sessionStorage-nøgler der sikkerhedskopieres før mutationen og gendannes hvis den fejler. */
  affectedStorageKeys: readonly string[];
  /** Snapshot/gendan også undo/redo-historikken (kun nødvendigt når `mutate` fanger en undo-frame). */
  captureUndo?: boolean;
  /**
   * Selve mutationen: skriver sessionStorage, committer store og fanger evt. undo-frame.
   * Skal være det ENESTE der muterer committed-tier state; primitiven ejer backup/commit/rollback.
   */
  mutate: () => void;
};

/**
 * Kanonisk atomisk persistence-mutation. Sikkerhedskopierer de berørte sessionStorage-nøgler +
 * hele committed-tier store-state (og valgfrit undo/redo-historikken), kører `mutate`, og hvis den
 * kaster gendannes ALT fail-closed før en samlet rollback-fejl kastes videre.
 *
 * Erstatter de fem-seks strukturelt identiske try/catch-transaktioner i FormPersistenceContext,
 * så backup/commit/rollback-semantikken bor ét sted og ikke kan drifte pr. muterende metode.
 */
export const runAtomicPersistenceMutation = ({
  operation,
  affectedStorageKeys,
  captureUndo = false,
  mutate,
}: AtomicPersistenceMutation): void => {
  const storageBackup = new Map<string, string | null>();
  for (const key of affectedStorageKeys) {
    storageBackup.set(key, readSessionStorageValue(key));
  }
  const storeSnapshot = captureStoreRollbackSnapshot();
  const undoSnapshot = captureUndo ? captureUndoRedoRollbackSnapshot() : null;

  try {
    mutate();
  } catch (error) {
    const rollbackFailures: Error[] = [];
    for (const [key, value] of storageBackup.entries()) {
      attemptRollbackStep(rollbackFailures, () => restoreStorageValue(key, value));
    }
    attemptRollbackStep(rollbackFailures, () => restoreStoreRollbackSnapshot(storeSnapshot));
    if (undoSnapshot) {
      attemptRollbackStep(rollbackFailures, () => restoreUndoRedoRollbackSnapshot(undoSnapshot));
    }
    throw createRollbackError(operation, error, rollbackFailures);
  }
};
