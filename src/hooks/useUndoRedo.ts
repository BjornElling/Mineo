import React from 'react';
import { useNavigate } from 'react-router-dom';
import { formPersistenceStore } from '../stores/formPersistenceStore';
import { type HistoryFrame, type HistoryTransitionPlan, undoRedoStore } from '../stores/undoRedoStore';
import { atomicWritePersistenceSections } from '../utils/persistenceSnapshotStorage';
import { scheduleHistoryTargetRestore } from '../utils/historyTargetRestore';
import { setActiveTabForPage } from './usePersistedActiveTab';

const routeToPageId = (route: string): string => route.replace(/^\/+/, '') || 'stamdata';

const restorePlannedTransition = (plan: HistoryTransitionPlan | null): HistoryFrame | null => {
  if (!plan) return null;
  const store = undoRedoStore.getState();
  if (!store.canCommitPlannedTransition(plan)) return null;

  atomicWritePersistenceSections(plan.target.sections, () => {
    if (!undoRedoStore.getState().canCommitPlannedTransition(plan)) {
      throw new Error('Undo/redo-history blev ændret før gendannelse kunne fuldføres.');
    }
    formPersistenceStore.getState().restoreHistoryFrame(
      plan.target.sections,
      plan.target.sectionRevisions,
      plan.target.fieldErrors,
      plan.target.fieldErrorRevisions,
      plan.target.meta,
      Date.now()
    );
    if (!undoRedoStore.getState().commitPlannedTransition(plan)) {
      throw new Error('Undo/redo-history kunne ikke committes efter gendannelse.');
    }
  });

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

  const undo = React.useCallback(() => {
    applyHistoryFrame(restorePlannedTransition(undoRedoStore.getState().planUndo()));
  }, [applyHistoryFrame]);

  const redo = React.useCallback(() => {
    applyHistoryFrame(restorePlannedTransition(undoRedoStore.getState().planRedo()));
  }, [applyHistoryFrame]);

  return {
    canUndo: (availability & 1) !== 0,
    canRedo: (availability & 2) !== 0,
    undo,
    redo,
  };
};
