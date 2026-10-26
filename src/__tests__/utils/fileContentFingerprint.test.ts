// @vitest-environment jsdom
import { createHash, webcrypto } from 'node:crypto';
import { UI_STORAGE_KEYS, getCaseScopedSessionStorageKeys } from '../../config/storageManifest';
import {
  createFileContentFingerprint,
  readFileContentFingerprint,
  readSavedFileContentFingerprint,
} from '../../utils/fileContentFingerprint';
import { persistLoadedFilenameMetadata, persistSavedFilenameMetadata } from '../../utils/filePersistenceMetadata';
import { MAX_FILE_SIZE } from '../../config/version';

describe('fileContentFingerprint', () => {
  beforeEach(() => {
    sessionStorage.clear();
    if (!globalThis.crypto?.subtle) vi.stubGlobal('crypto', webcrypto);
  });

  afterEach(() => vi.unstubAllGlobals());

  it('matcher en uafhængig SHA-256-reference for præcist UTF-8-indhold', async () => {
    const content = 'æøå og en fil\nmed to linjer';
    const expected = createHash('sha256').update(content, 'utf8').digest('hex');
    await expect(createFileContentFingerprint(content)).resolves.toBe(expected);
    expect(await createFileContentFingerprint(`${content}\n`)).not.toBe(expected);
    expect(await createFileContentFingerprint(content.replace('\n', '\r\n'))).not.toBe(expected);
  });

  it('læser filen på ny ved hver kontrol', async () => {
    const getFile = vi.fn()
      .mockResolvedValueOnce({ text: async () => 'før' })
      .mockResolvedValueOnce({ text: async () => 'efter' });
    const handle = { getFile } as unknown as FileSystemFileHandle;

    const before = await readFileContentFingerprint(handle);
    const after = await readFileContentFingerprint(handle);

    expect(before).not.toBe(after);
    expect(getFile).toHaveBeenCalledTimes(2);
  });

  it('læser ikke indholdet hvis en ekstern erstatningsfil overskrider størrelsesgrænsen', async () => {
    const text = vi.fn();
    const handle = { getFile: vi.fn().mockResolvedValue({ size: MAX_FILE_SIZE + 1, text }) } as unknown as FileSystemFileHandle;
    await expect(readFileContentFingerprint(handle)).rejects.toMatchObject({ name: 'NotReadableError' });
    expect(text).not.toHaveBeenCalled();
  });

  it.each([null, '', 'ikke et fingerprint', 'a'.repeat(63), 'A'.repeat(64)])('bruger ikke ugyldig browsermetadata %s', (stored) => {
    if (stored !== null) sessionStorage.setItem(UI_STORAGE_KEYS.lastSavedFileFingerprint, stored);
    expect(readSavedFileContentFingerprint()).toBeNull();
  });

  it('bevarer fingerprint sammen med filnavn og basis efter save og load', async () => {
    const fingerprint = await createFileContentFingerprint('indhold');
    persistSavedFilenameMetadata('gemt.eo', { skadelidte: 'Fiktiv' }, fingerprint);
    expect(readSavedFileContentFingerprint()).toBe(fingerprint);

    persistLoadedFilenameMetadata({ filename: 'indlæst.eo', stamdata: { skadelidte: 'Fiktiv' }, fingerprint });
    expect(readSavedFileContentFingerprint()).toBe(fingerprint);
    expect(sessionStorage.getItem(UI_STORAGE_KEYS.lastSavedFilename)).toBe('indlæst.eo');
    expect(getCaseScopedSessionStorageKeys()).toContain(UI_STORAGE_KEYS.lastSavedFileFingerprint);
  });

  it('fjerner gammel baseline når næste fil ikke har et fingerprint', async () => {
    const fingerprint = await createFileContentFingerprint('indhold');
    persistSavedFilenameMetadata('gemt.eo', {}, fingerprint);
    persistLoadedFilenameMetadata({ filename: 'anden.eo', stamdata: {} });
    expect(readSavedFileContentFingerprint()).toBeNull();

    persistSavedFilenameMetadata('gemt.eo', {}, fingerprint);
    persistSavedFilenameMetadata('download.eo', {});
    expect(readSavedFileContentFingerprint()).toBeNull();
  });

  it('gendanner også fingerprint når sidste metadata-write fejler', async () => {
    const before = await createFileContentFingerprint('før');
    const after = await createFileContentFingerprint('efter');
    persistSavedFilenameMetadata('før.eo', { skadelidte: 'Før' }, before);
    const storagePrototype = Object.getPrototypeOf(sessionStorage) as Storage;
    const original = storagePrototype.setItem;
    let writes = 0;
    const spy = vi.spyOn(storagePrototype, 'setItem').mockImplementation(function (this: Storage, key: string, value: string) {
      writes += 1;
      if (writes === 3) throw new Error('Lageret kunne ikke skrive fingerprint');
      original.call(this, key, value);
    });
    try {
      expect(() => persistSavedFilenameMetadata('efter.eo', { skadelidte: 'Efter' }, after)).toThrow();
      expect(readSavedFileContentFingerprint()).toBe(before);
      expect(sessionStorage.getItem(UI_STORAGE_KEYS.lastSavedFilename)).toBe('før.eo');
      expect(sessionStorage.getItem(UI_STORAGE_KEYS.lastSavedFilenameBasis)).toBe('{"skadelidte":"Før"}');
    } finally {
      spy.mockRestore();
    }
  });
});
