// @vitest-environment jsdom
import { installFileOperationLocks } from '../fixtures/fileOperationLocks';

import { getFileOperationClientSessionStorageKey } from '../../config/storageManifest';
import {
  __resetFileOperationClientSessionForTests,
  ensureFileOperationClientSession,
  getFileOperationClientSessionId,
} from '../../utils/fileOperationClientSession';

let restoreLocks: () => void;

describe('fileOperationClientSession – storage-skrivefejl', () => {
  beforeEach(() => {
    restoreLocks = installFileOperationLocks();
    sessionStorage.clear();
    __resetFileOperationClientSessionForTests();
  });

  afterEach(() => {
    restoreLocks();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    sessionStorage.clear();
    __resetFileOperationClientSessionForTests();
  });

  it('bevarer en stabil in-memory-identitet når sessionStorage ikke kan skrives', async () => {
    const storageKey = getFileOperationClientSessionStorageKey();
    const replacementId = 'client-write-failure-session-1';
    const randomUUID = vi.fn(() => replacementId);
    const storageProto = Object.getPrototypeOf(window.sessionStorage) as Storage;
    const setItemSpy = vi.spyOn(storageProto, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });

    vi.stubGlobal('crypto', { randomUUID });

    await expect(ensureFileOperationClientSession()).resolves.toMatchObject({ id: `owned:${replacementId}`, reloadStable: false });
    expect(getFileOperationClientSessionId()).toBe(`owned:${replacementId}`);
    expect(setItemSpy).toHaveBeenCalledWith(storageKey, `owned:${replacementId}`);
    expect(sessionStorage.getItem(storageKey)).toBeNull();
    await ensureFileOperationClientSession();
    expect(getFileOperationClientSessionId()).toBe(`owned:${replacementId}`);
    expect(randomUUID).toHaveBeenCalledOnce();
  });

  it('afviser et nyt scope når en tidligere identitet ikke kan erstattes sikkert', async () => {
    const storageKey = getFileOperationClientSessionStorageKey();
    const previousId = 'owned:client-previous-session-1234';
    sessionStorage.setItem(storageKey, previousId);
    // Uden Web Locks kan den kopierede identitet ikke godkendes. Den skal erstattes,
    // og fejlet lagring må ikke koble den nye sag tilbage til forgængerens håndtag.
    Reflect.deleteProperty(navigator, 'locks');
    vi.stubGlobal('crypto', { randomUUID: vi.fn(() => 'client-replacement-session-1234') });
    const storageProto = Object.getPrototypeOf(sessionStorage) as Storage;
    vi.spyOn(storageProto, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });

    await expect(ensureFileOperationClientSession()).rejects.toThrow('Browserens midlertidige lager kunne ikke opdatere filnavnsoplysninger.');
    expect(sessionStorage.getItem(storageKey)).toBe(previousId);
  });
});
