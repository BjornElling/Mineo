import { createStore } from 'zustand/vanilla';
import {
  formPersistenceStore,
  type FieldErrorCache,
  type FieldErrorRevisionMap,
  type FormPersistenceMeta,
  type FormPersistenceSections,
  type SectionRevisionMap,
} from './formPersistenceStore';
const MAX_HISTORY_STEPS = 50;

export type HistoryFrameOrigin = {
  route: string;
  tabKey: string | null;
  sectionKey: keyof FormPersistenceSections;
  fieldPath: string | null;
  focusToken: string | null;
};

export type HistoryFrame = {
  id: string;
  timestamp: number;
  sections: FormPersistenceSections;
  sectionRevisions: SectionRevisionMap;
  authoritativeSnapshotEpoch: number;
  fieldErrors: FieldErrorCache;
  fieldErrorRevisions: FieldErrorRevisionMap;
  meta: FormPersistenceMeta;
  origin: HistoryFrameOrigin;
};

export type HistoryTransitionPlan = {
  kind: 'undo' | 'redo';
  target: HistoryFrame;
  current: HistoryFrame;
  expectedFrameSequence: number;
};

type UndoRedoStoreState = {
  past: HistoryFrame[];
  future: HistoryFrame[];
  frameSequence: number;
  canUndo: () => boolean;
  canRedo: () => boolean;
  capture: (origin: HistoryFrameOrigin) => void;
  planUndo: () => HistoryTransitionPlan | null;
  planRedo: () => HistoryTransitionPlan | null;
  canCommitPlannedTransition: (plan: HistoryTransitionPlan) => boolean;
  commitPlannedTransition: (plan: HistoryTransitionPlan) => boolean;
  clear: () => void;
};

const cloneSnapshot = <T>(value: T): T => structuredClone(value);

const createFrame = (origin: HistoryFrameOrigin, sequence: number): HistoryFrame => {
  const state = formPersistenceStore.getState();
  return {
    id: `history-${sequence}`,
    timestamp: Date.now(),
    sections: cloneSnapshot(state.sections),
    sectionRevisions: cloneSnapshot(state.sectionRevisions),
    authoritativeSnapshotEpoch: state.authoritativeSnapshotEpoch,
    fieldErrors: cloneSnapshot(state.fieldErrors),
    fieldErrorRevisions: cloneSnapshot(state.fieldErrorRevisions),
    meta: cloneSnapshot(state.meta),
    origin,
  };
};

const appendPastFrame = (past: HistoryFrame[], frame: HistoryFrame): HistoryFrame[] => {
  const next = [...past, frame];
  return next.length > MAX_HISTORY_STEPS ? next.slice(next.length - MAX_HISTORY_STEPS) : next;
};

export const undoRedoStore = createStore<UndoRedoStoreState>((set, get) => ({
  past: [],
  future: [],
  frameSequence: 0,
  canUndo: () => get().past.length > 0,
  canRedo: () => get().future.length > 0,
  capture: (origin) => {
    set((state) => ({
      past: appendPastFrame(state.past, createFrame(origin, state.frameSequence + 1)),
      future: [],
      frameSequence: state.frameSequence + 1,
    }));
  },
  planUndo: () => {
    const state = get();
    const target = state.past.at(-1);
    if (!target) return null;

    return {
      kind: 'undo',
      target,
      // Tag et snapshot af nuværende committed state, før kalderen gendanner `target`.
      // Transitionens oprindelse bliver hos undo/redo-handlingen, ikke hos den nuværende rute.
      current: createFrame(target.origin, state.frameSequence + 1),
      expectedFrameSequence: state.frameSequence,
    };
  },
  planRedo: () => {
    const state = get();
    const target = state.future[0];
    if (!target) return null;

    return {
      kind: 'redo',
      target,
      // Tag et snapshot af nuværende committed state, før kalderen gendanner `target`.
      // Transitionens oprindelse bliver hos undo/redo-handlingen, ikke hos den nuværende rute.
      current: createFrame(target.origin, state.frameSequence + 1),
      expectedFrameSequence: state.frameSequence,
    };
  },
  canCommitPlannedTransition: (plan) => {
    const state = get();
    if (state.frameSequence !== plan.expectedFrameSequence) return false;
    if (plan.kind === 'undo') {
      return state.past.at(-1)?.id === plan.target.id;
    }
    return state.future[0]?.id === plan.target.id;
  },
  commitPlannedTransition: (plan) => {
    let committed = false;
    set((state) => {
      if (state.frameSequence !== plan.expectedFrameSequence) return state;

      if (plan.kind === 'undo') {
        const target = state.past.at(-1);
        if (!target || target.id !== plan.target.id) return state;
        committed = true;
        return {
          past: state.past.slice(0, -1),
          future: [plan.current, ...state.future],
          frameSequence: state.frameSequence + 1,
        };
      }

      const [target, ...remainingFuture] = state.future;
      if (!target || target.id !== plan.target.id) return state;
      committed = true;
      return {
        past: appendPastFrame(state.past, plan.current),
        future: remainingFuture,
        frameSequence: state.frameSequence + 1,
      };
    });
    return committed;
  },
  clear: () => {
    set({ past: [], future: [], frameSequence: 0 });
  },
}));

export const __UNDO_REDO_MAX_HISTORY_STEPS = MAX_HISTORY_STEPS;

export const __resetUndoRedoStoreForTests = (): void => {
  undoRedoStore.setState({ past: [], future: [], frameSequence: 0 });
};
