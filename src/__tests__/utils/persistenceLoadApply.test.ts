// @vitest-environment jsdom
import { UI_STORAGE_KEYS } from '../../config/storageManifest';
import { persistenceSchemas } from '../../config/persistenceRegistry';
import type { PersistedSectionKey } from '../../config/persistenceRegistry';
import {
  applyAuthoritativeLoadSnapshot,
  synchronizeLoadMetadata,
} from '../../utils/persistenceLoadApply';
import type { ApplicableLoadFileResult } from '../../types/fileOperations';
import { toISODateString } from '../../types/branded';

// Load-apply har efter R4-F01 TO entrypoints, og opdelingen er selve rettelsen: kun
// `applyAuthoritativeLoadSnapshot` er autoritativ og SYNKRON — den hører inde i coordinatorens
// `applyReplacement`, hvor draft-discard sker. `synchronizeLoadMetadata` er den asynkrone filnavns-/handle-/
// PWA-fase (§4.1); den ejer ikke sagsinput og må derfor ikke holde replacement-barrieren åben, mens brugeren
// kan begynde at redigere den netop indlæste sag.
//
// Rækkefølge-invarianten "metadata kører aldrig for en sag, der ikke blev indlæst" er dermed flyttet fra en
// intern try/catch til TYPEN: den asynkrone fase er et selvstændigt kald, som en kaster fra fase 1 aldrig
// nåer. Testene hævder begge halvdele hver for sig plus den ægte rækkefølge gennem `useFileSaveLoad`
// (se `useFileSaveLoad.test.tsx` → "R4-F01").

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

beforeEach(() => {
  sessionStorage.clear();
  vi.clearAllMocks();
  saveFileHandleToIndexedDBMock.mockResolvedValue(true);
  deleteFileHandleFromIndexedDBMock.mockResolvedValue(true);
});

describe('applyAuthoritativeLoadSnapshot — den synkrone, autoritative fase', () => {
  it('bygger et fuldt replace-snapshot over alle persisterede sektioner', () => {
    const applySnapshot = vi.fn();

    applyAuthoritativeLoadSnapshot({
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
  });

  it('rører INGEN metadata-grænse — den er en selvstændig, senere fase', () => {
    applyAuthoritativeLoadSnapshot({
      result: {
        status: 'loaded',
        source: 'pwa',
        filename: 'pwa.eo',
        requestId: 'req-1',
        fileHandle: { name: 'pwa.eo' } as FileSystemFileHandle,
        snapshot: {},
      },
      applySnapshot: vi.fn(),
    });

    expect(saveFileHandleToIndexedDBMock).not.toHaveBeenCalled();
    expect(deleteFileHandleFromIndexedDBMock).not.toHaveBeenCalled();
    expect(markPendingPwaFileOpenRequestHandledMock).not.toHaveBeenCalled();
    expect(sessionStorage.getItem(UI_STORAGE_KEYS.lastSavedFilename)).toBeNull();
  });

  it('fejler fail-closed hvis load-resultatet mangler snapshot', () => {
    const applySnapshot = vi.fn();

    // Typen kræver nu et snapshot på et anvendeligt load-resultat, men runtime-guarden er bevidst
    // bevaret som forsvar i dybden: skulle et malformet resultat alligevel nå apply, skal det fail-close.
    const malformedResult = {
      status: 'loaded', source: 'manual', filename: 'x.eo',
    } as unknown as ApplicableLoadFileResult;

    expect(() => applyAuthoritativeLoadSnapshot({ result: malformedResult, applySnapshot }))
      .toThrow('mangler snapshot');
    expect(applySnapshot).not.toHaveBeenCalled();
  });

  it('kaster med "Ingen data blev anvendt", når apply af data kaster', () => {
    // Fase 1 fejler → kalderen kaster inde i replacement-barrieren, så den åbne draft bevares og
    // fase 2 aldrig nås (persistence-contract §10: fase 1 fejler → uændret state).
    const applySnapshot = vi.fn(() => {
      throw new Error('Zod-validering fejlede under apply');
    });

    expect(() => applyAuthoritativeLoadSnapshot({
      result: { status: 'loaded', source: 'manual', filename: 'sag.eo', snapshot: {} },
      applySnapshot,
    })).toThrow('Ingen data blev anvendt');

    expect(applySnapshot).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem(UI_STORAGE_KEYS.lastSavedFilename)).toBeNull();
  });
});

describe('synchronizeLoadMetadata — den asynkrone metadatafase', () => {
  it.each([
    ['gemme', () => saveFileHandleToIndexedDBMock, { fileHandle: { name: 'sag.eo' } as FileSystemFileHandle }],
    ['rydde', () => deleteFileHandleFromIndexedDBMock, {}],
  ] as const)('returnerer metadata-advarsel når IndexedDB ikke kan %s filhåndtaget', async (_label, mock, extra) => {
    mock().mockResolvedValueOnce(false);

    const result = await synchronizeLoadMetadata({
      status: 'loaded', source: 'manual', filename: 'sag.eo', snapshot: {}, ...extra,
    });

    expect(result.status).toBe('applied-with-metadata-error');
  });

  it('synkroniserer filnavn og rydder et forældet basisnavn', async () => {
    sessionStorage.setItem(UI_STORAGE_KEYS.lastSavedFilenameBasis, '{"skadelidte":"forrige"}');

    const result = await synchronizeLoadMetadata({
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
    });

    expect(result.status).toBe('applied');
    expect(sessionStorage.getItem(UI_STORAGE_KEYS.lastSavedFilename)).toBe('sag.eo');
    expect(sessionStorage.getItem(UI_STORAGE_KEYS.lastSavedFilenameBasis)).toContain('Testperson');
    expect(deleteFileHandleFromIndexedDBMock).toHaveBeenCalledTimes(1);
  });

  it('bevarer PWA/file-handle sideeffekterne samlet i metadatafasen', async () => {
    sessionStorage.setItem(UI_STORAGE_KEYS.lastSavedFilenameBasis, '{"skadelidte":"forrige"}');
    const fileHandle = { name: 'pwa.eo' } as FileSystemFileHandle;

    await synchronizeLoadMetadata({
      status: 'loaded',
      source: 'pwa',
      filename: 'pwa.eo',
      requestId: 'req-1',
      fileHandle,
      snapshot: {},
    });

    expect(saveFileHandleToIndexedDBMock).toHaveBeenCalledWith(fileHandle);
    expect(markPendingPwaFileOpenRequestHandledMock).toHaveBeenCalledWith('req-1');
    expect(clearPendingPwaFileOpenRequestMock).not.toHaveBeenCalled();
    expect(deleteFileHandleFromIndexedDBMock).not.toHaveBeenCalled();
    expect(sessionStorage.getItem(UI_STORAGE_KEYS.lastSavedFilenameBasis)).toBeNull();
  });

  it('returnerer metadata-advarsel når en storagegrænse kaster', async () => {
    deleteFileHandleFromIndexedDBMock.mockRejectedValueOnce(new Error('IndexedDB fejl'));

    const result = await synchronizeLoadMetadata({
      status: 'loaded', source: 'manual', filename: 'sag.eo', snapshot: {},
    });

    expect(result.status).toBe('applied-with-metadata-error');
    if (result.status !== 'applied-with-metadata-error') return;
    expect(result.message).toContain('Sagen blev indlæst');
  });
});
