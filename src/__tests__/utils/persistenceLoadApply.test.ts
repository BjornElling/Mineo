// @vitest-environment jsdom
import { UI_STORAGE_KEYS } from '../../config/storageManifest';
import { persistenceSchemas } from '../../config/persistenceRegistry';
import type { PersistedSectionKey } from '../../config/persistenceRegistry';
import { executePersistenceLoadApply } from '../../utils/persistenceLoadApply';
import { toISODateString } from '../../types/branded';

// `executePersistenceLoadApply` ejer den atomiske apply af ét autoritativt snapshot + metadata-/handle-/PWA-
// synkronisering (§4.1). Efter greenfield-cutoveren (WI-002) er `replaceAllPersistedData`-parameteren
// generaliseret til en `applySnapshot`-callback, som produktion binder til `CaseFileOperations.applyLoadedSnapshot`
// (→ `replaceCase` gennem coordinatoren). History-rydningen ejes nu af replacement-commanden, ikke denne util.

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
    saveFileHandleToIndexedDBMock.mockResolvedValue(true);
    deleteFileHandleFromIndexedDBMock.mockResolvedValue(true);
  });

  it.each([
    ['gemme', saveFileHandleToIndexedDBMock, { fileHandle: { name: 'sag.eo' } as FileSystemFileHandle }],
    ['rydde', deleteFileHandleFromIndexedDBMock, {}],
  ] as const)('returnerer metadata-advarsel når IndexedDB ikke kan %s filhåndtaget', async (_label, mock, extra) => {
    mock.mockResolvedValueOnce(false);
    const result = await executePersistenceLoadApply({
      result: { status: 'loaded', source: 'manual', filename: 'sag.eo', snapshot: {}, ...extra },
      applySnapshot: vi.fn(),
    });
    expect(result.status).toBe('applied-with-metadata-error');
  });

  it('bygger et fuldt replace-snapshot og synkroniserer load-metadata', async () => {
    const applySnapshot = vi.fn();

    await executePersistenceLoadApply({
      result: {
        status: 'loaded',
        source: 'manual',
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
      applySnapshot,
    });

    expect(applySnapshot).toHaveBeenCalledTimes(1);
    const calledSnapshot = applySnapshot.mock.calls[0][0] as Record<PersistedSectionKey, unknown | undefined>;
    const allKeys = Object.keys(persistenceSchemas) as PersistedSectionKey[];
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
    const applySnapshot = vi.fn();
    const fileHandle = { name: 'pwa.eo' } as FileSystemFileHandle;

    await executePersistenceLoadApply({
      result: {
        status: 'loaded',
        source: 'pwa',
        filename: 'pwa.eo',
        requestId: 'req-1',
        fileHandle,
        snapshot: {},
      },
      applySnapshot,
    });

    expect(saveFileHandleToIndexedDBMock).toHaveBeenCalledWith(fileHandle);
    expect(markPendingPwaFileOpenRequestHandledMock).toHaveBeenCalledWith('req-1');
    expect(clearPendingPwaFileOpenRequestMock).not.toHaveBeenCalled();
    expect(deleteFileHandleFromIndexedDBMock).not.toHaveBeenCalled();
    expect(sessionStorage.getItem(UI_STORAGE_KEYS.lastSavedFilenameBasis)).toBeNull();
  });

  it('fejler fail-closed hvis load-resultatet mangler snapshot', async () => {
    const applySnapshot = vi.fn();

    // Typen kræver nu et snapshot på et anvendeligt load-resultat, men runtime-guarden er bevidst
    // bevaret som forsvar i dybden: skulle et malformet resultat alligevel nå apply, skal det fail-close.
    const malformedResult = { status: 'loaded', source: 'manual', filename: 'x.eo' } as unknown as Parameters<
      typeof executePersistenceLoadApply
    >[0]['result'];

    await expect(executePersistenceLoadApply({
      result: malformedResult,
      applySnapshot,
    })).rejects.toThrow('mangler snapshot');

    expect(applySnapshot).not.toHaveBeenCalled();
    expect(saveFileHandleToIndexedDBMock).not.toHaveBeenCalled();
    expect(deleteFileHandleFromIndexedDBMock).not.toHaveBeenCalled();
  });

  it('fejler fail-closed uden metadata-sideeffekter hvis apply af data kaster', async () => {
    // Fase 1 (atomisk data-apply) fejler: applySnapshot kaster. Så må fase 2
    // (filnavn/handle/PWA-metadata) aldrig køre — ellers ville vi synkronisere metadata
    // for en sag der ikke blev indlæst (persistence-contract §10: fase 1 fejler → uændret state).
    const applySnapshot = vi.fn(() => {
      throw new Error('Zod-validering fejlede under apply');
    });
    const fileHandle = { name: 'sag.eo' } as FileSystemFileHandle;

    await expect(executePersistenceLoadApply({
      result: {
        status: 'loaded',
        source: 'pwa',
        filename: 'sag.eo',
        requestId: 'req-x',
        fileHandle,
        snapshot: {},
      },
      applySnapshot,
    })).rejects.toThrow('Ingen data blev anvendt');

    expect(applySnapshot).toHaveBeenCalledTimes(1);
    // Ingen metadata-sideeffekter og intet skrevet til sessionStorage.
    expect(saveFileHandleToIndexedDBMock).not.toHaveBeenCalled();
    expect(deleteFileHandleFromIndexedDBMock).not.toHaveBeenCalled();
    expect(markPendingPwaFileOpenRequestHandledMock).not.toHaveBeenCalled();
    expect(clearPendingPwaFileOpenRequestMock).not.toHaveBeenCalled();
    expect(sessionStorage.getItem(UI_STORAGE_KEYS.lastSavedFilename)).toBeNull();
  });

  it('returnerer metadata-advarsel efter succesfuld data-apply', async () => {
    const applySnapshot = vi.fn();
    deleteFileHandleFromIndexedDBMock.mockRejectedValueOnce(new Error('IndexedDB fejl'));

    const result = await executePersistenceLoadApply({
      result: {
        status: 'loaded',
        source: 'manual',
        filename: 'sag.eo',
        snapshot: {},
      },
      applySnapshot,
    });

    expect(result.status).toBe('applied-with-metadata-error');
    if (result.status !== 'applied-with-metadata-error') return;
    expect(result.message).toContain('Sagen blev indlæst');
    expect(applySnapshot).toHaveBeenCalledTimes(1);
  });
});
