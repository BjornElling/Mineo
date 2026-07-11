import { createStore } from 'zustand/vanilla';
import {
  formPersistenceStore,
  type FieldErrorCache,
  type FieldErrorRevisionMap,
  type FormPersistenceMeta,
  type FormPersistenceSections,
  type InvalidDraftRevisionMap,
  type InvalidDraftsCache,
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
  fieldErrors: FieldErrorCache;
  fieldErrorRevisions: FieldErrorRevisionMap;
  invalidDrafts: InvalidDraftsCache;
  invalidDraftRevisions: InvalidDraftRevisionMap;
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
  captureValueCommit: (origin: HistoryFrameOrigin) => void;
  captureCoalescing: (origin: HistoryFrameOrigin) => void;
  consumeCoalesceMarker: (fieldPath: string | null) => void;
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
    fieldErrors: cloneSnapshot(state.fieldErrors),
    fieldErrorRevisions: cloneSnapshot(state.fieldErrorRevisions),
    invalidDrafts: cloneSnapshot(state.invalidDrafts),
    invalidDraftRevisions: cloneSnapshot(state.invalidDraftRevisions),
    meta: cloneSnapshot(state.meta),
    origin,
  };
};

const appendPastFrame = (past: HistoryFrame[], frame: HistoryFrame): HistoryFrame[] => {
  const next = [...past, frame];
  return next.length > MAX_HISTORY_STEPS ? next.slice(next.length - MAX_HISTORY_STEPS) : next;
};

// ASYMMETRISK coalescing af undo-captures for ÉT felt-commit, så det giver præcis ÉN frame.
//
// Et felt-commit kan røre BÅDE `sections` (persistData) og `invalidDrafts` (writeInvalidDraft): fx
// committer useDraftField/immediate-Delete altid onCommit (setValues) EFTERFULGT af clearInvalidDraft.
// - persistData (value-commit) fanger ALTID sin egen frame via `captureValueCommit` og markerer feltet.
// - Den EFTERFØLGENDE writeInvalidDraft (commit-invalid/clear) på SAMME fieldPath i samme synkrone flow
//   rider på value-commit'ets frame via `captureCoalescing` (fanger ingen ekstra). Men hvis value-commit'et
//   var en no-op (ingen markør), fanger `captureCoalescing` sin EGEN frame — ellers ville en rydning helt
//   uden sektionsændring slet ikke blive fanget, og undo ville springe den over og gendanne den gamle
//   ugyldige værdi (rapporteret bug).
// Markøren forbruges (ryddes) af det parrede writeInvalidDraft i samme flow; microtask-reset er en backstop
// for ikke-parrede value-commits (radio/toggle/dropdown uden invalidDraft). Dette er undo-frame-semantik og
// bor derfor i undo-laget (var tidligere en React-ref i FormPersistenceProvider).
let pendingValueCommitFieldPath: string | null = null;
const markValueCommitPending = (fieldPath: string | null): void => {
  pendingValueCommitFieldPath = fieldPath;
  queueMicrotask(() => {
    pendingValueCommitFieldPath = null;
  });
};
const consumePendingValueCommit = (fieldPath: string | null): boolean => {
  if (pendingValueCommitFieldPath !== null && pendingValueCommitFieldPath === fieldPath) {
    pendingValueCommitFieldPath = null;
    return true;
  }
  return false;
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
  // Value-commit: fanger ALTID sin egen frame og markerer feltet, så en parret invalidDraft-clear i samme
  // synkrone flow kan ride på den (coalesce) i stedet for at fange en ekstra.
  captureValueCommit: (origin) => {
    get().capture(origin);
    markValueCommitPending(origin.fieldPath);
  },
  // invalidDraft-skrivning: rid på et parret value-commits frame fra samme flow (coalesce); ellers fang egen.
  captureCoalescing: (origin) => {
    if (!consumePendingValueCommit(origin.fieldPath)) {
      get().capture(origin);
    }
  },
  // Forbrug en evt. matchende value-commit-markør uden at fange en frame (fx en no-op-clear), så markøren
  // ikke dingler og fejlagtigt coalescer en senere handling.
  consumeCoalesceMarker: (fieldPath) => {
    consumePendingValueCommit(fieldPath);
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
    // Nulstilling af frameSequence er sikker selv om den ellers er monotont stigende: clear tømmer
    // past/future, så en evt. stale plan afvises af stak-medlemskabs-tjekket i canCommitPlannedTransition
    // (past.at(-1)?.id === plan.target.id fejler på tom stak) uafhængigt af frameSequence-værdien.
    set({ past: [], future: [], frameSequence: 0 });
  },
}));

export const __UNDO_REDO_MAX_HISTORY_STEPS = MAX_HISTORY_STEPS;

export const __resetUndoRedoStoreForTests = (): void => {
  undoRedoStore.setState({ past: [], future: [], frameSequence: 0 });
};
