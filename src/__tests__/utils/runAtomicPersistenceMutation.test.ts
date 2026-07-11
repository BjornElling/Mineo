// @vitest-environment jsdom
import { runAtomicPersistenceMutation } from '../../utils/persistenceStoreRollback';
import { formPersistenceStore } from '../../stores/formPersistenceStore';
import { __resetUndoRedoStoreForTests, undoRedoStore, type HistoryFrameOrigin } from '../../stores/undoRedoStore';
import { readSessionStorageValue, writeSessionStorageValue } from '../../utils/safeSessionStorage';
import { PERSISTED_DATA_VERSION } from '../../config/persistenceVersion';

const VALID_META = { hydrated: true, schemaFingerprint: PERSISTED_DATA_VERSION };
const KEY = 'mineo_test_atomic';

const origin: HistoryFrameOrigin = {
  route: '/satser',
  tabKey: null,
  sectionKey: 'satser',
  fieldPath: 'aargang',
  focusToken: null,
};

describe('runAtomicPersistenceMutation', () => {
  beforeEach(() => {
    sessionStorage.clear();
    formPersistenceStore.getState().clearAll(VALID_META);
    __resetUndoRedoStoreForTests();
  });

  it('kører mutationen og efterlader den anvendt ved succes', () => {
    runAtomicPersistenceMutation({
      operation: 'test',
      affectedStorageKeys: [KEY],
      mutate: () => {
        writeSessionStorageValue(KEY, 'ny');
        formPersistenceStore.getState().commitSection('satser', { aargang: 2026 }, {});
      },
    });

    expect(readSessionStorageValue(KEY)).toBe('ny');
    expect(formPersistenceStore.getState().sections.satser).toEqual({ aargang: 2026 });
  });

  it('ruller sessionStorage og store tilbage hvis mutationen kaster', () => {
    writeSessionStorageValue(KEY, 'oprindelig');
    formPersistenceStore.getState().commitSection('satser', { aargang: 2020 }, {});

    expect(() =>
      runAtomicPersistenceMutation({
        operation: 'test',
        affectedStorageKeys: [KEY],
        mutate: () => {
          writeSessionStorageValue(KEY, 'halvvejs');
          formPersistenceStore.getState().commitSection('satser', { aargang: 2099 }, {});
          throw new Error('boom');
        },
      })
    ).toThrow('boom');

    expect(readSessionStorageValue(KEY)).toBe('oprindelig');
    expect(formPersistenceStore.getState().sections.satser).toEqual({ aargang: 2020 });
  });

  it('fjerner en nyskrevet nøgle igen ved rollback (oprindeligt fraværende)', () => {
    expect(() =>
      runAtomicPersistenceMutation({
        operation: 'test',
        affectedStorageKeys: [KEY],
        mutate: () => {
          writeSessionStorageValue(KEY, 'skabt');
          throw new Error('boom');
        },
      })
    ).toThrow();

    expect(readSessionStorageValue(KEY)).toBeNull();
  });

  it('gendanner undo-historik ved captureUndo:true når mutationen kaster', () => {
    undoRedoStore.getState().capture(origin);
    const beforeLen = undoRedoStore.getState().past.length;

    expect(() =>
      runAtomicPersistenceMutation({
        operation: 'test',
        affectedStorageKeys: [],
        captureUndo: true,
        mutate: () => {
          undoRedoStore.getState().capture(origin);
          throw new Error('boom');
        },
      })
    ).toThrow();

    expect(undoRedoStore.getState().past).toHaveLength(beforeLen);
  });

  it('gendanner IKKE undo-historik ved captureUndo:false (standard)', () => {
    undoRedoStore.getState().capture(origin);
    const beforeLen = undoRedoStore.getState().past.length;

    expect(() =>
      runAtomicPersistenceMutation({
        operation: 'test',
        affectedStorageKeys: [],
        mutate: () => {
          undoRedoStore.getState().capture(origin);
          throw new Error('boom');
        },
      })
    ).toThrow();

    expect(undoRedoStore.getState().past).toHaveLength(beforeLen + 1);
  });

  it('samler rollback-fejl i den kastede fejl når storage-gendannelse selv fejler', () => {
    const storageProto = Object.getPrototypeOf(window.sessionStorage) as Storage;
    const removeSpy = vi.spyOn(storageProto, 'removeItem').mockImplementation(() => {
      throw new Error('Injected remove failure');
    });

    let caught: unknown;
    try {
      runAtomicPersistenceMutation({
        operation: 'testOp',
        affectedStorageKeys: [KEY], // oprindeligt fraværende → rollback forsøger removeItem
        mutate: () => {
          throw new Error('oprindelig fejl');
        },
      });
    } catch (error) {
      caught = error;
    }

    removeSpy.mockRestore();

    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toContain('testOp fejlede og rollback havde');
    expect((caught as Error).message).toContain('oprindelig fejl');
  });
});
