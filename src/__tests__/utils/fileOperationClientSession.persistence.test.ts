// @vitest-environment jsdom
import { installFileOperationLocks } from '../fixtures/fileOperationLocks';
import { getFileOperationClientSessionStorageKey } from '../../config/storageManifest';
import {
  __resetFileOperationClientSessionForTests,
  ensureFileOperationClientSession,
  getFileOperationClientSessionId,
} from '../../utils/fileOperationClientSession';

let restoreLocks: () => void;

describe('fileOperationClientSession – sessionStorage-kontrakt', () => {
  beforeEach(() => {
    restoreLocks = installFileOperationLocks();
    sessionStorage.clear();
    __resetFileOperationClientSessionForTests();
  });

  afterEach(() => {
    restoreLocks();
    sessionStorage.clear();
    __resetFileOperationClientSessionForTests();
  });

  it('genbruger den gyldige klientidentitet efter en simuleret reload', async () => {
    const storageKey = getFileOperationClientSessionStorageKey();
    const persistedSessionId = 'owned:client-test-session-1234';
    sessionStorage.setItem(storageKey, persistedSessionId);

    await ensureFileOperationClientSession();
    expect(getFileOperationClientSessionId()).toBe(persistedSessionId);

    // En reload nulstiller modulcachen, men ikke den aktuelle fane's sessionStorage.
    __resetFileOperationClientSessionForTests();

    await ensureFileOperationClientSession();
    expect(getFileOperationClientSessionId()).toBe(persistedSessionId);
    expect(sessionStorage.getItem(storageKey)).toBe(persistedSessionId);
  });
});
