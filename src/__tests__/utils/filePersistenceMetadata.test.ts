// @vitest-environment jsdom
import { UI_STORAGE_KEYS } from '../../config/storageManifest';
import { persistSavedFilenameMetadata } from '../../utils/filePersistenceMetadata';

describe('filePersistenceMetadata', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('gendanner begge tidligere metadatafelter ved delvist storage-fejl', () => {
    sessionStorage.setItem(UI_STORAGE_KEYS.lastSavedFilename, 'gammel.eo');
    sessionStorage.setItem(UI_STORAGE_KEYS.lastSavedFilenameBasis, '{"skadelidte":"Gammel"}');

    const storagePrototype = Object.getPrototypeOf(window.sessionStorage) as Storage;
    const originalSetItem = storagePrototype.setItem;
    let callCount = 0;
    const setItemSpy = vi.spyOn(storagePrototype, 'setItem').mockImplementation(function setItemWithFailure(
      this: Storage,
      key: string,
      value: string,
    ): void {
      callCount += 1;
      if (callCount === 2) throw new Error('storage-fejl');
      originalSetItem.call(this, key, value);
    });

    expect(() => persistSavedFilenameMetadata('ny.eo', { skadelidte: 'Ny' }))
      .toThrow('Browserens midlertidige lager kunne ikke opdatere filnavnsoplysninger');
    expect(sessionStorage.getItem(UI_STORAGE_KEYS.lastSavedFilename)).toBe('gammel.eo');
    expect(sessionStorage.getItem(UI_STORAGE_KEYS.lastSavedFilenameBasis)).toBe('{"skadelidte":"Gammel"}');

    setItemSpy.mockRestore();
  });
});
