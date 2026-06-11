import React from 'react';
import { useNavigate } from 'react-router-dom';
import { formPersistenceStore } from '../stores/formPersistenceStore';
import { type HistoryFrame, type HistoryTransitionPlan, undoRedoStore } from '../stores/undoRedoStore';
import { atomicWritePersistenceSections } from '../utils/persistenceSnapshotStorage';
import { scheduleHistoryTargetRestore } from '../utils/historyTargetRestore';
import { setActiveTabForPage } from './usePersistedActiveTab';
import { routeToPageId } from '../config/pageNavigation';
import {
  captureStoreRollbackSnapshot,
  captureUndoRedoRollbackSnapshot,
  restoreStoreRollbackSnapshot,
  restoreUndoRedoRollbackSnapshot,
} from '../utils/persistenceStoreRollback';

const restorePlannedTransition = (plan: HistoryTransitionPlan | null): HistoryFrame | null => {
  if (!plan) return null;
  const store = undoRedoStore.getState();
  if (!store.canCommitPlannedTransition(plan)) return null;

  // atomicWritePersistenceSections garanterer kun sessionStorage-rollback. Hvis commit-callbacken
  // muterer formPersistenceStore (restoreHistoryFrame) og derefter kaster, skal BÅDE store og
  // undo/redo-historik rulles tilbage, så de ikke divergerer fra den tilbagerullede sessionStorage
  // (persistence-contract §8.5, undo-redo-contract §4). Snapshots tages før mutationen.
  atomicWritePersistenceSections(plan.target.sections, () => {
    const storeRollback = captureStoreRollbackSnapshot();
    const undoRollback = captureUndoRedoRollbackSnapshot();
    try {
      if (!undoRedoStore.getState().canCommitPlannedTransition(plan)) {
        throw new Error('Undo/redo-history blev ændret før gendannelse kunne fuldføres.');
      }
      formPersistenceStore.getState().restoreHistoryFrame(
        plan.target.sections,
        plan.target.sectionRevisions,
        plan.target.fieldErrors,
        plan.target.fieldErrorRevisions,
        plan.target.invalidDrafts,
        plan.target.invalidDraftRevisions,
        plan.target.meta,
        Date.now()
      );
      if (!undoRedoStore.getState().commitPlannedTransition(plan)) {
        throw new Error('Undo/redo-history kunne ikke committes efter gendannelse.');
      }
    } catch (error) {
      restoreStoreRollbackSnapshot(storeRollback);
      restoreUndoRedoRollbackSnapshot(undoRollback);
      throw error; // lader atomicWritePersistenceSections rulle sessionStorage tilbage
    }
  }, plan.target.invalidDrafts);

  return plan.target;
};

const getUndoRedoAvailabilitySnapshot = (): number => {
  const state = undoRedoStore.getState();
  return (state.canUndo() ? 1 : 0) | (state.canRedo() ? 2 : 0);
};

export const useUndoRedo = () => {
  const navigate = useNavigate();
  const availability = React.useSyncExternalStore(
    undoRedoStore.subscribe,
    getUndoRedoAvailabilitySnapshot,
    getUndoRedoAvailabilitySnapshot
  );

  const applyHistoryFrame = React.useCallback((frame: HistoryFrame | null) => {
    if (!frame) return;
    if (frame.origin.tabKey !== null) {
      setActiveTabForPage(routeToPageId(frame.origin.route), frame.origin.tabKey);
    }
    navigate(frame.origin.route);
    scheduleHistoryTargetRestore(frame);
  }, [navigate]);

  // En fejlende restore er rullet fail-closed tilbage i restorePlannedTransition. Vi fanger her, så
  // en (i praksis uopnåelig) fejl ikke bliver en uncaught exception i keydown-handleren og ikke
  // udløser navigation/fokus-restore på et mislykket frame (undo-redo-contract §4).
  const undo = React.useCallback(() => {
    try {
      applyHistoryFrame(restorePlannedTransition(undoRedoStore.getState().planUndo()));
    } catch (error) {
      console.error('Undo kunne ikke gennemføres; tilstanden er uændret.', error);
    }
  }, [applyHistoryFrame]);

  const redo = React.useCallback(() => {
    try {
      applyHistoryFrame(restorePlannedTransition(undoRedoStore.getState().planRedo()));
    } catch (error) {
      console.error('Redo kunne ikke gennemføres; tilstanden er uændret.', error);
    }
  }, [applyHistoryFrame]);

  return {
    canUndo: (availability & 1) !== 0,
    canRedo: (availability & 2) !== 0,
    undo,
    redo,
  };
};
