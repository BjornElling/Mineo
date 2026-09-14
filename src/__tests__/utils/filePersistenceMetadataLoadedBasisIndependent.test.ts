// @vitest-environment jsdom

import { UI_STORAGE_KEYS } from '../../config/storageManifest';
import { persistLoadedFilenameMetadata } from '../../utils/filePersistenceMetadata';

describe('filePersistenceMetadata – load af filnavnsgrundlag', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it('bevarer eksisterende filnavn og genberegner basis fra indlæste stamdata', () => {
    sessionStorage.setItem(UI_STORAGE_KEYS.lastSavedFilename, 'gammel.eo');
    sessionStorage.setItem(
      UI_STORAGE_KEYS.lastSavedFilenameBasis,
      JSON.stringify({ skadelidte: 'Gammel' }),
    );

    persistLoadedFilenameMetadata({
      stamdata: {
        skadelidte: 'Ny',
        skadestype: 'Arbejdsskade',
        skadedato: '2024-01-02',
      },
    });

    expect(sessionStorage.getItem(UI_STORAGE_KEYS.lastSavedFilename)).toBe('gammel.eo');
    expect(sessionStorage.getItem(UI_STORAGE_KEYS.lastSavedFilenameBasis)).toBe(
      JSON.stringify({
        skadelidte: 'Ny',
        skadestype: 'Arbejdsskade',
        skadedato: '2024-01-02',
      }),
    );
  });
});
