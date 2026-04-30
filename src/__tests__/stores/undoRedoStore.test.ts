import { formPersistenceStore } from '../../stores/formPersistenceStore';
import { __UNDO_REDO_MAX_HISTORY_STEPS, undoRedoStore, type HistoryFrameOrigin } from '../../stores/undoRedoStore';
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

describe('undoRedoStore', () => {
  beforeEach(() => {
    formPersistenceStore.getState().clearAll(VALID_META);
    formPersistenceStore.getState().clearAllFieldErrors();
    undoRedoStore.getState().clear();
  });

  it('undo returnerer pre-commit snapshot og redo returnerer post-commit snapshot', () => {
    formPersistenceStore.getState().commitSection('satser', { aargang: 2025 }, { schemaFingerprint: PERSISTED_DATA_VERSION });
    undoRedoStore.getState().capture(origin);
    formPersistenceStore.getState().commitSection('satser', { aargang: 2024 }, { schemaFingerprint: PERSISTED_DATA_VERSION });

    const undoFrame = undoRedoStore.getState().undo();
    expect(undoFrame?.sections.satser).toEqual({ aargang: 2025 });
    expect(undoRedoStore.getState().canRedo()).toBe(true);

    const redoFrame = undoRedoStore.getState().redo();
    expect(redoFrame?.sections.satser).toEqual({ aargang: 2024 });
  });

  it('bevarer transition-origin gennem undo over redo', () => {
    formPersistenceStore.getState().commitSection('satser', { aargang: 2025 }, { schemaFingerprint: PERSISTED_DATA_VERSION });
    undoRedoStore.getState().capture(origin);
    formPersistenceStore.getState().commitSection('satser', { aargang: 2024 }, { schemaFingerprint: PERSISTED_DATA_VERSION });
    undoRedoStore.getState().capture(otherOrigin);
    formPersistenceStore.getState().commitSection('satser', { aargang: 2023 }, { schemaFingerprint: PERSISTED_DATA_VERSION });

    const firstUndoFrame = undoRedoStore.getState().undo();
    expect(firstUndoFrame?.origin).toEqual(otherOrigin);
    const secondUndoFrame = undoRedoStore.getState().undo();
    expect(secondUndoFrame?.origin).toEqual(origin);

    const firstRedoFrame = undoRedoStore.getState().redo();
    expect(firstRedoFrame?.origin).toEqual(origin);
    const secondRedoFrame = undoRedoStore.getState().redo();
    expect(secondRedoFrame?.origin).toEqual(otherOrigin);

    const undoAfterRedoFrame = undoRedoStore.getState().undo();
    expect(undoAfterRedoFrame?.origin).toEqual(otherOrigin);
  });

  it('rydder redo-grenen ved ny capture', () => {
    formPersistenceStore.getState().commitSection('satser', { aargang: 2025 }, { schemaFingerprint: PERSISTED_DATA_VERSION });
    undoRedoStore.getState().capture(origin);
    formPersistenceStore.getState().commitSection('satser', { aargang: 2024 }, { schemaFingerprint: PERSISTED_DATA_VERSION });
    undoRedoStore.getState().undo();

    undoRedoStore.getState().capture(origin);

    expect(undoRedoStore.getState().canRedo()).toBe(false);
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
});
