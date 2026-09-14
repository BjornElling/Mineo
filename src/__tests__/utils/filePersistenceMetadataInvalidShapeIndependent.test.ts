// @vitest-environment jsdom

import { UI_STORAGE_KEYS } from '../../config/storageManifest';
import { loadStoredFilenameBasis } from '../../utils/filePersistenceMetadata';

describe('filePersistenceMetadata – ugyldig basis-shape', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it('afviser valid JSON med forkert metadata-shape og rydder værdien', () => {
    sessionStorage.setItem(
      UI_STORAGE_KEYS.lastSavedFilenameBasis,
      JSON.stringify({ skadelidte: 42, fremmedFelt: true }),
    );

    expect(loadStoredFilenameBasis()).toBeNull();
    expect(sessionStorage.getItem(UI_STORAGE_KEYS.lastSavedFilenameBasis)).toBeNull();
  });
});
