// @vitest-environment jsdom
import { getFileOperationClientSessionStorageKey } from '../../config/storageManifest';
import {
  __resetFileOperationClientSessionForTests,
  getFileOperationClientSessionId,
} from '../../utils/fileOperationClientSession';

describe('fileOperationClientSession – sessionStorage-kontrakt', () => {
  beforeEach(() => {
    sessionStorage.clear();
    __resetFileOperationClientSessionForTests();
  });

  afterEach(() => {
    sessionStorage.clear();
    __resetFileOperationClientSessionForTests();
  });

  it('genbruger den gyldige klientidentitet efter en simuleret reload', () => {
    const storageKey = getFileOperationClientSessionStorageKey();
    const persistedSessionId = 'client-test-session-1234';
    sessionStorage.setItem(storageKey, persistedSessionId);

    expect(getFileOperationClientSessionId()).toBe(persistedSessionId);

    // En reload nulstiller modulcachen, men ikke den aktuelle fane's sessionStorage.
    __resetFileOperationClientSessionForTests();

    expect(getFileOperationClientSessionId()).toBe(persistedSessionId);
    expect(sessionStorage.getItem(storageKey)).toBe(persistedSessionId);
  });
});
