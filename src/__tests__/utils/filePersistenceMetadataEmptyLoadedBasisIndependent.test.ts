// @vitest-environment jsdom

import { UI_STORAGE_KEYS } from '../../config/storageManifest';
import { persistLoadedFilenameMetadata } from '../../utils/filePersistenceMetadata';

describe('filePersistenceMetadata – tomt loaded basis', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it('rydder gammelt basisnavn uden at ændre eksisterende filnavn', () => {
    sessionStorage.setItem(UI_STORAGE_KEYS.lastSavedFilename, 'gammel.eo');
    sessionStorage.setItem(
      UI_STORAGE_KEYS.lastSavedFilenameBasis,
      JSON.stringify({ skadelidte: 'Gammel' }),
    );

    persistLoadedFilenameMetadata({
      stamdata: { skadelidte: '   ' },
    });

    expect(sessionStorage.getItem(UI_STORAGE_KEYS.lastSavedFilename)).toBe('gammel.eo');
    expect(sessionStorage.getItem(UI_STORAGE_KEYS.lastSavedFilenameBasis)).toBeNull();
  });
});
