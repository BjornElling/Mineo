import { formPersistenceStore } from '../../stores/formPersistenceStore';
import {
  __resetUndoRedoStoreForTests,
  __UNDO_REDO_MAX_HISTORY_STEPS,
  type HistoryTransitionPlan,
  undoRedoStore,
  type HistoryFrame,
  type HistoryFrameOrigin,
} from '../../stores/undoRedoStore';
import { PERSISTED_DATA_VERSION } from '../../config/persistenceVersion';

const VALID_META = { hydrated: true, schemaFingerprint: PERSISTED_DATA_VERSION };

const origin: HistoryFrameOrigin = {
  route: '/satser',
  tabKey: null,
  sectionKey: 'satser',
  fieldPath: 'aargang',
  focusToken: null,
};

const otherOrigin: HistoryFrameOrigin = {
  route: '/erstatningsopgoerelse',
  tabKey: 'eo-oplysninger',
  sectionKey: 'erstatningsopgoerelse',
  fieldPath: 'perioder[0].fra',
  focusToken: null,
};

const restoreFrameToFormStore = (frame: HistoryFrame): void => {
  formPersistenceStore.getState().restoreHistoryFrame(
    frame.sections,
    frame.sectionRevisions,
    frame.fieldErrors,
    frame.fieldErrorRevisions,
    frame.meta,
    frame.timestamp
  );
};

const applyPlan = (plan: HistoryTransitionPlan | null): HistoryFrame | null => {
  if (!plan) return null;
  restoreFrameToFormStore(plan.target);
  expect(undoRedoStore.getState().commitPlannedTransition(plan)).toBe(true);
  return plan.target;
};

describe('undoRedoStore', () => {
  beforeEach(() => {
    formPersistenceStore.getState().clearAll(VALID_META);
    formPersistenceStore.getState().clearAllFieldErrors();
    __resetUndoRedoStoreForTests();
  });

  it('undo returnerer pre-commit snapshot og redo returnerer post-commit snapshot', () => {
    formPersistenceStore.getState().commitSection('satser', { aargang: 2025 }, { schemaFingerprint: PERSISTED_DATA_VERSION });
    undoRedoStore.getState().capture(origin);
    formPersistenceStore.getState().commitSection('satser', { aargang: 2024 }, { schemaFingerprint: PERSISTED_DATA_VERSION });

    const undoFrame = applyPlan(undoRedoStore.getState().planUndo());
    expect(undoFrame?.sections.satser).toEqual({ aargang: 2025 });
    expect(undoRedoStore.getState().canRedo()).toBe(true);

    const redoFrame = applyPlan(undoRedoStore.getState().planRedo());
    expect(redoFrame?.sections.satser).toEqual({ aargang: 2024 });
  });

  it('bevarer transition-origin gennem undo over redo', () => {
    formPersistenceStore.getState().commitSection('satser', { aargang: 2025 }, { schemaFingerprint: PERSISTED_DATA_VERSION });
    undoRedoStore.getState().capture(origin);
    formPersistenceStore.getState().commitSection('satser', { aargang: 2024 }, { schemaFingerprint: PERSISTED_DATA_VERSION });
    undoRedoStore.getState().capture(otherOrigin);
    formPersistenceStore.getState().commitSection('satser', { aargang: 2023 }, { schemaFingerprint: PERSISTED_DATA_VERSION });

    const firstUndoFrame = applyPlan(undoRedoStore.getState().planUndo());
    expect(firstUndoFrame?.origin).toEqual(otherOrigin);
    const secondUndoFrame = applyPlan(undoRedoStore.getState().planUndo());
    expect(secondUndoFrame?.origin).toEqual(origin);

    const firstRedoFrame = applyPlan(undoRedoStore.getState().planRedo());
    expect(firstRedoFrame?.origin).toEqual(origin);
    const secondRedoFrame = applyPlan(undoRedoStore.getState().planRedo());
    expect(secondRedoFrame?.origin).toEqual(otherOrigin);

    const undoAfterRedoFrame = applyPlan(undoRedoStore.getState().planUndo());
    expect(undoAfterRedoFrame?.origin).toEqual(otherOrigin);
  });

  it('rydder redo-grenen ved ny capture', () => {
    formPersistenceStore.getState().commitSection('satser', { aargang: 2025 }, { schemaFingerprint: PERSISTED_DATA_VERSION });
    undoRedoStore.getState().capture(origin);
    formPersistenceStore.getState().commitSection('satser', { aargang: 2024 }, { schemaFingerprint: PERSISTED_DATA_VERSION });
    applyPlan(undoRedoStore.getState().planUndo());

    undoRedoStore.getState().capture(origin);

    expect(undoRedoStore.getState().canRedo()).toBe(false);
  });

  it('planlægger ikke undo eller redo på tomme stakke', () => {
    expect(undoRedoStore.getState().planUndo()).toBeNull();
    expect(undoRedoStore.getState().planRedo()).toBeNull();
    expect(undoRedoStore.getState().past).toEqual([]);
    expect(undoRedoStore.getState().future).toEqual([]);
  });

  it('flytter et enkelt undo-element til redo-stakken ved commit', () => {
    formPersistenceStore.getState().commitSection('satser', { aargang: 2025 }, { schemaFingerprint: PERSISTED_DATA_VERSION });
    undoRedoStore.getState().capture(origin);
    formPersistenceStore.getState().commitSection('satser', { aargang: 2024 }, { schemaFingerprint: PERSISTED_DATA_VERSION });

    const undoFrame = applyPlan(undoRedoStore.getState().planUndo());

    expect(undoFrame?.sections.satser).toEqual({ aargang: 2025 });
    expect(undoRedoStore.getState().past).toHaveLength(0);
    expect(undoRedoStore.getState().future).toHaveLength(1);
  });

  it('afviser commit hvis stakken er ændret efter planlægning', () => {
    formPersistenceStore.getState().commitSection('satser', { aargang: 2025 }, { schemaFingerprint: PERSISTED_DATA_VERSION });
    undoRedoStore.getState().capture(origin);
    formPersistenceStore.getState().commitSection('satser', { aargang: 2024 }, { schemaFingerprint: PERSISTED_DATA_VERSION });

    const plan = undoRedoStore.getState().planUndo();
    undoRedoStore.getState().capture(otherOrigin);

    expect(plan).not.toBeNull();
    if (!plan) throw new Error('Forventede en undo-plan');
    expect(undoRedoStore.getState().commitPlannedTransition(plan)).toBe(false);
    expect(undoRedoStore.getState().past).toHaveLength(2);
    expect(undoRedoStore.getState().future).toHaveLength(0);
  });

  it('undo efter præcis én capture returnerer det fangede snapshot', () => {
    formPersistenceStore.getState().commitSection('satser', { aargang: 2025 }, { schemaFingerprint: PERSISTED_DATA_VERSION });
    undoRedoStore.getState().capture(origin);
    formPersistenceStore.getState().commitSection('satser', { aargang: 2024 }, { schemaFingerprint: PERSISTED_DATA_VERSION });

    const undoFrame = applyPlan(undoRedoStore.getState().planUndo());

    expect(undoFrame?.sections.satser).toEqual({ aargang: 2025 });
  });

  it('clear rydder tilgængelighed og nulstiller frame-sekvensen', () => {
    formPersistenceStore.getState().commitSection('satser', { aargang: 2025 }, { schemaFingerprint: PERSISTED_DATA_VERSION });
    undoRedoStore.getState().capture(origin);
    undoRedoStore.getState().clear();

    expect(undoRedoStore.getState().canUndo()).toBe(false);
    expect(undoRedoStore.getState().canRedo()).toBe(false);

    undoRedoStore.getState().capture(origin);
    expect(undoRedoStore.getState().past[0].id).toBe('history-1');
  });

  it('begrænser past-stakken til 50 snapshots', () => {
    for (let index = 0; index < __UNDO_REDO_MAX_HISTORY_STEPS + 5; index += 1) {
      formPersistenceStore.getState().commitSection('satser', { aargang: 2000 + index }, { schemaFingerprint: PERSISTED_DATA_VERSION });
      undoRedoStore.getState().capture(origin);
    }

    const past = undoRedoStore.getState().past;
    expect(past).toHaveLength(__UNDO_REDO_MAX_HISTORY_STEPS);
    expect(past[0].sections.satser).toEqual({ aargang: 2005 });
  });

  it('future-stakken vokser ikke over det praktiske maksimum fra undo-flowet', () => {
    for (let index = 0; index < __UNDO_REDO_MAX_HISTORY_STEPS; index += 1) {
      formPersistenceStore.getState().commitSection('satser', { aargang: 2000 + index }, { schemaFingerprint: PERSISTED_DATA_VERSION });
      undoRedoStore.getState().capture(origin);
    }
    formPersistenceStore.getState().commitSection('satser', { aargang: 2100 }, { schemaFingerprint: PERSISTED_DATA_VERSION });

    for (let index = 0; index < __UNDO_REDO_MAX_HISTORY_STEPS; index += 1) {
      applyPlan(undoRedoStore.getState().planUndo());
    }

    expect(undoRedoStore.getState().past).toHaveLength(0);
    expect(undoRedoStore.getState().future).toHaveLength(__UNDO_REDO_MAX_HISTORY_STEPS);
  });
});
