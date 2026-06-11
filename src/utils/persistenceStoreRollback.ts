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
