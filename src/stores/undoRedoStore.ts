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

type UndoRedoStoreState = {
  past: HistoryFrame[];
  future: HistoryFrame[];
  canUndo: () => boolean;
  canRedo: () => boolean;
  capture: (origin: HistoryFrameOrigin) => void;
  undo: () => HistoryFrame | null;
  redo: () => HistoryFrame | null;
  clear: () => void;
};

let frameSequence = 0;

const cloneSnapshot = <T>(value: T): T => structuredClone(value);

const createFrame = (origin: HistoryFrameOrigin): HistoryFrame => {
  const state = formPersistenceStore.getState();
  frameSequence += 1;
  return {
    id: `history-${frameSequence}`,
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
  canUndo: () => get().past.length > 0,
  canRedo: () => get().future.length > 0,
  capture: (origin) => {
    const frame = createFrame(origin);
    set((state) => ({
      past: appendPastFrame(state.past, frame),
      future: [],
    }));
  },
  undo: () => {
    const plannedTarget = get().past.at(-1);
    if (!plannedTarget) return null;

    // Snapshot current committed state before the caller restores `target`.
    // The transition origin stays with the undoable/redoable action, not with the current route.
    const current = createFrame(plannedTarget.origin);
    let appliedTarget: HistoryFrame | null = null;
    set((state) => {
      const target = state.past.at(-1);
      if (!target || target.id !== plannedTarget.id) return state;
      appliedTarget = target;
      return {
        past: state.past.slice(0, -1),
        future: [current, ...state.future],
      };
    });
    return appliedTarget;
  },
  redo: () => {
    const plannedTarget = get().future[0];
    if (!plannedTarget) return null;

    // Snapshot current committed state before the caller restores `target`.
    // The transition origin stays with the undoable/redoable action, not with the current route.
    const current = createFrame(plannedTarget.origin);
    let appliedTarget: HistoryFrame | null = null;
    set((state) => {
      const [target, ...remainingFuture] = state.future;
      if (!target || target.id !== plannedTarget.id) return state;
      appliedTarget = target;
      return {
        past: appendPastFrame(state.past, current),
        future: remainingFuture,
      };
    });
    return appliedTarget;
  },
  clear: () => {
    frameSequence = 0;
    set({ past: [], future: [] });
  },
}));

export const __UNDO_REDO_MAX_HISTORY_STEPS = MAX_HISTORY_STEPS;
