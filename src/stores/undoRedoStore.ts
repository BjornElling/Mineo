/**
 * Midlertidig read-facade. History er ikke længere en separat store; alle værdier kommer direkte
 * fra inputRuntimeStore og alle mutationer går gennem executeInputTransaction.
 */
import {
  INPUT_HISTORY_LIMIT,
  createEmptyInputHistory,
  inputRuntimeStore,
  type HistoryFrame,
  type HistoryFrameOrigin,
} from './inputRuntimeStore';

export type { HistoryFrame, HistoryFrameOrigin } from './inputRuntimeStore';

const frame = (origin: HistoryFrameOrigin, sequence: number): HistoryFrame => ({
  id: `history-${sequence}`,
  timestamp: Date.now(),
  input: inputRuntimeStore.getState().input,
  origin,
  compatibilityFieldErrors: inputRuntimeStore.getState().fieldErrors,
  compatibilityFieldErrorRevisions: inputRuntimeStore.getState().fieldErrorRevisions,
});

const getFacadeState = () => {
  const state = inputRuntimeStore.getState();
  return {
    past: state.history.past,
    future: state.history.future,
    frameSequence: state.history.sequence,
    canUndo: () => state.history.past.length > 0,
    canRedo: () => state.history.future.length > 0,
    capture: (origin: HistoryFrameOrigin) => {
      if (process.env.NODE_ENV !== 'test') throw new Error('History-capturefacaden er kun til tests.');
      inputRuntimeStore.setState((currentState) => {
        const sequence = currentState.history.sequence + 1;
        const past = [...currentState.history.past, frame(origin, sequence)].slice(-INPUT_HISTORY_LIMIT);
        return { history: { past, future: [], sequence } };
      });
    },
    clear: () => {
      if (process.env.NODE_ENV !== 'test') throw new Error('History-clearfacaden er kun til tests.');
      inputRuntimeStore.setState({ history: createEmptyInputHistory() });
    },
  };
};

export const undoRedoStore = {
  getState: getFacadeState,
  subscribe: inputRuntimeStore.subscribe,
};

export const __UNDO_REDO_MAX_HISTORY_STEPS = INPUT_HISTORY_LIMIT;

export const __resetUndoRedoStoreForTests = (): void => {
  if (process.env.NODE_ENV !== 'test') throw new Error('History-resetfacaden er kun til tests.');
  inputRuntimeStore.setState({ history: createEmptyInputHistory() });
};

// Holder typeimporter stabile, indtil history-origin migreres til FieldRef i fase 4.
export type CompatibilityHistoryOrigin = HistoryFrameOrigin;
