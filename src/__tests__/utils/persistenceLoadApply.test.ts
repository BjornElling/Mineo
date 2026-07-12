// @vitest-environment jsdom
import { UI_STORAGE_KEYS } from '../../config/storageManifest';
import { persistenceSchemas } from '../../config/persistenceRegistry';
import type { StorageKey } from '../../config/storageManifest';
import { executePersistenceLoadApply } from '../../utils/persistenceLoadApply';
import { formPersistenceStore } from '../../stores/formPersistenceStore';
import { undoRedoStore, type HistoryFrameOrigin } from '../../stores/undoRedoStore';
import { toISODateString } from '../../types/branded';

const saveFileHandleToIndexedDBMock = vi.fn();
const deleteFileHandleFromIndexedDBMock = vi.fn();
const markPendingPwaFileOpenRequestHandledMock = vi.fn();
const clearPendingPwaFileOpenRequestMock = vi.fn();

vi.mock('../../utils/fileHandleStorage', () => ({
  saveFileHandleToIndexedDB: (...args: unknown[]) => saveFileHandleToIndexedDBMock(...args),
  deleteFileHandleFromIndexedDB: (...args: unknown[]) => deleteFileHandleFromIndexedDBMock(...args),
}));

vi.mock('../../utils/pwaLaunchQueue', () => ({
  markPendingPwaFileOpenRequestHandled: (...args: unknown[]) => markPendingPwaFileOpenRequestHandledMock(...args),
  clearPendingPwaFileOpenRequest: (...args: unknown[]) => clearPendingPwaFileOpenRequestMock(...args),
}));

describe('executePersistenceLoadApply', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.clearAllMocks();
    undoRedoStore.getState().clear();
  });

  it('bygger et fuldt replace-snapshot og synkroniserer load-metadata', async () => {
    const replaceAllPersistedData = vi.fn();

    await executePersistenceLoadApply({
      result: {
        success: true,
        filename: 'sag.eo',
        snapshot: {
          stamdata: {
            journalnr: '',
            advokat: '',
            sagsbehandler: '',
            skadelidte: 'Testperson',
            skadestype: 'Arbejdsulykke',
            skadedato: toISODateString('2024-01-15'),
          },
        },
      },
      replaceAllPersistedData,
    });

    expect(replaceAllPersistedData).toHaveBeenCalledTimes(1);
    const calledSnapshot = replaceAllPersistedData.mock.calls[0][0] as Record<StorageKey, unknown | undefined>;
    const allKeys = Object.keys(persistenceSchemas) as StorageKey[];
    expect(Object.keys(calledSnapshot).sort()).toEqual(allKeys.slice().sort());
    expect(calledSnapshot.stamdata).toEqual(expect.any(Object));
    for (const key of allKeys.filter((key) => key !== 'stamdata')) {
      expect(calledSnapshot[key]).toBeUndefined();
    }
    expect(sessionStorage.getItem(UI_STORAGE_KEYS.lastSavedFilename)).toBe('sag.eo');
    expect(sessionStorage.getItem(UI_STORAGE_KEYS.lastSavedFilenameBasis)).toContain('Testperson');
    expect(deleteFileHandleFromIndexedDBMock).toHaveBeenCalledTimes(1);
    expect(clearPendingPwaFileOpenRequestMock).toHaveBeenCalledTimes(1);
    expect(saveFileHandleToIndexedDBMock).not.toHaveBeenCalled();
    expect(markPendingPwaFileOpenRequestHandledMock).not.toHaveBeenCalled();
  });

  it('bevarer PWA/file-handle sideeffekter samlet i samme apply-entrypoint', async () => {
    sessionStorage.setItem(UI_STORAGE_KEYS.lastSavedFilenameBasis, '{"skadelidte":"forrige"}');
    const replaceAllPersistedData = vi.fn();
    const fileHandle = { name: 'pwa.eo' } as FileSystemFileHandle;

    await executePersistenceLoadApply({
      result: {
        success: true,
        requestId: 'req-1',
        fileHandle,
        snapshot: {},
      },
      replaceAllPersistedData,
    });

    expect(saveFileHandleToIndexedDBMock).toHaveBeenCalledWith(fileHandle);
    expect(markPendingPwaFileOpenRequestHandledMock).toHaveBeenCalledWith('req-1');
    expect(clearPendingPwaFileOpenRequestMock).not.toHaveBeenCalled();
    expect(deleteFileHandleFromIndexedDBMock).not.toHaveBeenCalled();
    expect(sessionStorage.getItem(UI_STORAGE_KEYS.lastSavedFilenameBasis)).toBeNull();
  });

  it('fejler fail-closed hvis load-resultatet mangler snapshot', async () => {
    const replaceAllPersistedData = vi.fn();

    await expect(executePersistenceLoadApply({
      result: {
        success: true,
      },
      replaceAllPersistedData,
    })).rejects.toThrow('mangler snapshot');

    expect(replaceAllPersistedData).not.toHaveBeenCalled();
    expect(saveFileHandleToIndexedDBMock).not.toHaveBeenCalled();
    expect(deleteFileHandleFromIndexedDBMock).not.toHaveBeenCalled();
  });

  it('fejler fail-closed uden metadata-sideeffekter hvis apply af data kaster', async () => {
    // Fase 1 (atomisk data-apply) fejler: replaceAllPersistedData kaster. Så må fase 2
    // (filnavn/handle/PWA-metadata) aldrig køre — ellers ville vi synkronisere metadata
    // for en sag der ikke blev indlæst (persistence-contract §10: fase 1 fejler → uændret state).
    const replaceAllPersistedData = vi.fn(() => {
      throw new Error('Zod-validering fejlede under apply');
    });
    const fileHandle = { name: 'sag.eo' } as FileSystemFileHandle;

    await expect(executePersistenceLoadApply({
      result: {
        success: true,
        filename: 'sag.eo',
        requestId: 'req-x',
        fileHandle,
        snapshot: {},
      },
      replaceAllPersistedData,
    })).rejects.toThrow('Ingen data blev anvendt');

    expect(replaceAllPersistedData).toHaveBeenCalledTimes(1);
    // Ingen metadata-sideeffekter og intet skrevet til sessionStorage.
    expect(saveFileHandleToIndexedDBMock).not.toHaveBeenCalled();
    expect(deleteFileHandleFromIndexedDBMock).not.toHaveBeenCalled();
    expect(markPendingPwaFileOpenRequestHandledMock).not.toHaveBeenCalled();
    expect(clearPendingPwaFileOpenRequestMock).not.toHaveBeenCalled();
    expect(sessionStorage.getItem(UI_STORAGE_KEYS.lastSavedFilename)).toBeNull();
  });

  it('returnerer metadata-advarsel efter succesfuld data-apply', async () => {
    const replaceAllPersistedData = vi.fn();
    deleteFileHandleFromIndexedDBMock.mockRejectedValueOnce(new Error('IndexedDB fejl'));

    const result = await executePersistenceLoadApply({
      result: {
        success: true,
        snapshot: {},
      },
      replaceAllPersistedData,
    });

    expect(result.status).toBe('applied-with-metadata-error');
    if (result.status !== 'applied-with-metadata-error') return;
    expect(result.message).toContain('Sagen blev indlæst');
    expect(replaceAllPersistedData).toHaveBeenCalledTimes(1);
  });

  it('rydder undo/redo-stakken efter succesfuld dataindlæsning', async () => {
    const origin: HistoryFrameOrigin = {
      route: '/satser',
      tabKey: null,
      sectionKey: 'satser',
      fieldPath: 'aargang',
      focusToken: null,
    };
    formPersistenceStore.getState().commitSection('satser', { aargang: 2025 }, {});
    undoRedoStore.getState().capture(origin);

    await executePersistenceLoadApply({
      result: {
        success: true,
        snapshot: {},
      },
      replaceAllPersistedData: vi.fn(() => {
        undoRedoStore.getState().clear();
      }),
    });

    expect(undoRedoStore.getState().canUndo()).toBe(false);
    expect(undoRedoStore.getState().canRedo()).toBe(false);
  });
});
