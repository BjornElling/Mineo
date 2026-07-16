import React from 'react';
import { executeInputTransaction } from '../input/inputTransactionRunner';
import { redoInput, undoInput } from '../input/inputCommands';
import { inputRuntimeStore, type HistoryFrame } from '../stores/inputRuntimeStore';
import { scheduleHistoryTargetRestore } from '../utils/historyTargetRestore';
import { setActiveTabForPage } from './usePersistedActiveTab';
import { routeToPageId } from '../config/pageNavigation';

const getAvailability = (): number => {
  const history = inputRuntimeStore.getState().history;
  return (history.past.length > 0 ? 1 : 0) | (history.future.length > 0 ? 2 : 0);
};

export type UndoRedoNavigate = (route: string) => void;

export const useUndoRedo = (navigate: UndoRedoNavigate) => {
  const availability = React.useSyncExternalStore(
    inputRuntimeStore.subscribe,
    getAvailability,
    getAvailability
  );

  const applyFrame = React.useCallback((frame: HistoryFrame | null) => {
    if (frame === null) return;
    if (frame.origin.tabKey !== null) {
      setActiveTabForPage(routeToPageId(frame.origin.route), frame.origin.tabKey);
    }
    navigate(frame.origin.route);
    scheduleHistoryTargetRestore(frame);
  }, [navigate]);

  const run = React.useCallback((kind: 'undo' | 'redo') => {
    try {
      applyFrame(executeInputTransaction(kind === 'undo' ? undoInput() : redoInput()).restoredFrame);
    } catch (error) {
      console.error(`${kind === 'undo' ? 'Undo' : 'Redo'} kunne ikke gennemføres; tilstanden er uændret.`, error);
    }
  }, [applyFrame]);

  return {
    canUndo: (availability & 1) !== 0,
    canRedo: (availability & 2) !== 0,
    undo: React.useCallback(() => run('undo'), [run]),
    redo: React.useCallback(() => run('redo'), [run]),
  };
};
