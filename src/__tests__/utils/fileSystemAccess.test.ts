// @vitest-environment jsdom
import { logError, logWarning } from '../../utils/logger';
import {
  ensureFileHandleReadPermission,
  FileHandleAccessError,
  isFileSystemAccessSupported,
  isFileSystemFileHandle,
  openFileWithPicker,
  readFromFileHandle,
  saveFileWithPicker,
  writeToFileHandle,
} from '../../utils/fileSystemAccess';

vi.mock('../../utils/logger', () => ({
  logError: vi.fn(),
  logWarning: vi.fn(),
  sanitizeFilenameForLog: (value: unknown) => String(value ?? ''),
}));

type PickerName = 'showOpenFilePicker' | 'showSaveFilePicker';

const pickerNames: readonly PickerName[] = ['showOpenFilePicker', 'showSaveFilePicker'];
const originalPickerDescriptors = new Map(
  pickerNames.map((name) => [name, Object.getOwnPropertyDescriptor(window, name)]),
);

const setPickerCapability = (name: PickerName, value: unknown): void => {
  Object.defineProperty(window, name, {
    configurable: true,
    writable: true,
    value,
  });
};

const removePickerCapability = (name: PickerName): void => {
  Reflect.deleteProperty(window, name);
};

const restorePickerCapabilities = (): void => {
  for (const name of pickerNames) {
    const descriptor = originalPickerDescriptors.get(name);
    if (descriptor) {
      Object.defineProperty(window, name, descriptor);
    } else {
      removePickerCapability(name);
    }
  }
};

const makeFileHandle = (overrides: Record<string, unknown> = {}): FileSystemFileHandle => ({
  name: 'sag.eo',
  getFile: vi.fn(),
  createWritable: vi.fn(),
  ...overrides,
}) as unknown as FileSystemFileHandle;

describe('fileSystemAccess', () => {
  beforeEach(() => {
    for (const name of pickerNames) removePickerCapability(name);
  });

  afterEach(() => {
    restorePickerCapabilities();
  });

  describe('isFileSystemAccessSupported', () => {
    it('returnerer true når begge picker-kapabiliteter er callable', () => {
      setPickerCapability('showOpenFilePicker', vi.fn());
      setPickerCapability('showSaveFilePicker', vi.fn());

      expect(isFileSystemAccessSupported()).toBe(true);
    });

    it.each([
      ['showOpenFilePicker', 'showOpenFilePicker'],
      ['showSaveFilePicker', 'showSaveFilePicker'],
    ] as const)('returnerer false når %s mangler', (_label, missingPicker) => {
      setPickerCapability('showOpenFilePicker', vi.fn());
      setPickerCapability('showSaveFilePicker', vi.fn());
      removePickerCapability(missingPicker);

      expect(isFileSystemAccessSupported()).toBe(false);
    });

    // TD-017: Den nuværende property-only-detektion accepterer disse værdier som en picker.
    // `it.fails` holder fundet synligt i testlaget uden at ændre produktets fallback-adfærd.
    it.fails.each([
      ['showOpenFilePicker', undefined],
      ['showSaveFilePicker', undefined],
      ['showOpenFilePicker', null],
      ['showSaveFilePicker', null],
      ['showOpenFilePicker', {}],
      ['showSaveFilePicker', {}],
    ] as const)('skal afvise %s når værdien er undefined eller ikke-callable: %o', (brokenPicker, value) => {
      setPickerCapability('showOpenFilePicker', vi.fn());
      setPickerCapability('showSaveFilePicker', vi.fn());
      setPickerCapability(brokenPicker, value);

      expect(isFileSystemAccessSupported()).toBe(false);
    });
  });

  describe('ensureFileHandleReadPermission', () => {
    it('accepterer handles uden queryPermission', async () => {
      await expect(ensureFileHandleReadPermission(makeFileHandle())).resolves.toBeUndefined();
    });

    it('accepterer allerede granted læsetilladelse uden request', async () => {
      const queryPermission = vi.fn().mockResolvedValue('granted');
      const requestPermission = vi.fn();
      const handle = makeFileHandle({ queryPermission, requestPermission });

      await expect(ensureFileHandleReadPermission(handle)).resolves.toBeUndefined();

      expect(queryPermission).toHaveBeenCalledWith({ mode: 'read' });
      expect(requestPermission).not.toHaveBeenCalled();
    });

    it('anmoder om læsetilladelse når queryPermission ikke er granted', async () => {
      const queryPermission = vi.fn().mockResolvedValue('prompt');
      const requestPermission = vi.fn().mockResolvedValue('granted');
      const handle = makeFileHandle({ queryPermission, requestPermission });

      await expect(ensureFileHandleReadPermission(handle)).resolves.toBeUndefined();

      expect(requestPermission).toHaveBeenCalledWith({ mode: 'read' });
    });

    it('fejler fail-closed når læsetilladelse fortsat mangler', async () => {
      const queryPermission = vi.fn().mockResolvedValue('denied');
      const requestPermission = vi.fn().mockResolvedValue('denied');
      const handle = makeFileHandle({ queryPermission, requestPermission });

      await expect(ensureFileHandleReadPermission(handle)).rejects.toMatchObject({
        name: 'FileHandleAccessError',
        message: 'Adgang til filen er ikke længere tilladt. Vælg filen igen via Hent.',
      });
    });

    it('fejler fail-closed uden requestPermission når queryPermission afviser', async () => {
      const queryPermission = vi.fn().mockResolvedValue('denied');
      const handle = makeFileHandle({ queryPermission });

      await expect(ensureFileHandleReadPermission(handle)).rejects.toBeInstanceOf(
        FileHandleAccessError,
      );
    });
  });

  describe('openFileWithPicker', () => {
    it('returnerer fil og handle og videresender startplacering', async () => {
      const file = new File(['indhold'], 'sag.eo', { type: 'application/octet-stream' });
      const handle = makeFileHandle({ getFile: vi.fn().mockResolvedValue(file) });
      const picker = vi.fn().mockResolvedValue([handle]);
      setPickerCapability('showOpenFilePicker', picker);

      await expect(openFileWithPicker('downloads')).resolves.toEqual({ file, handle });
      expect(picker).toHaveBeenCalledWith(expect.objectContaining({
        startIn: 'downloads',
        multiple: false,
        types: [expect.objectContaining({
          accept: { 'application/x-eo': ['.eo'] },
        })],
      }));
    });

    it('returnerer null når brugeren annullerer picker-dialogen', async () => {
      const abort = Object.assign(new Error('annulleret'), { name: 'AbortError' });
      setPickerCapability('showOpenFilePicker', vi.fn().mockRejectedValue(abort));

      await expect(openFileWithPicker()).resolves.toBeNull();
      expect(logError).not.toHaveBeenCalled();
    });

    it('oversætter picker-fejl og logger den reelle fejl', async () => {
      setPickerCapability('showOpenFilePicker', vi.fn().mockRejectedValue(new Error('picker fejlede')));

      await expect(openFileWithPicker()).rejects.toThrow('Kunne ikke åbne fil: picker fejlede');
      expect(logError).toHaveBeenCalledWith('Fejl ved fil-åbning:', expect.objectContaining({
        message: 'picker fejlede',
      }));
    });

    it('fejler eksplicit når open-picker-kapabiliteten mangler', async () => {
      await expect(openFileWithPicker()).rejects.toThrow(
        'Kunne ikke åbne fil: File System Access API er ikke understøttet i denne browser',
      );
    });
  });

  describe('saveFileWithPicker', () => {
    it('tilføjer .eo og returnerer valgt handle', async () => {
      const handle = makeFileHandle();
      const picker = vi.fn().mockResolvedValue(handle);
      setPickerCapability('showSaveFilePicker', picker);

      await expect(saveFileWithPicker('sag', 'documents')).resolves.toBe(handle);
      expect(picker).toHaveBeenCalledWith(expect.objectContaining({
        suggestedName: 'sag.eo',
        startIn: 'documents',
      }));
    });

    it('returnerer null når brugeren annullerer save-dialogen', async () => {
      const abort = Object.assign(new Error('annulleret'), { name: 'AbortError' });
      setPickerCapability('showSaveFilePicker', vi.fn().mockRejectedValue(abort));

      await expect(saveFileWithPicker('sag')).resolves.toBeNull();
      expect(logError).not.toHaveBeenCalled();
    });

    it('afviser valgt fil uden .eo-endelse og logger advarsel', async () => {
      const handle = makeFileHandle({ name: 'sag.txt' });
      setPickerCapability('showSaveFilePicker', vi.fn().mockResolvedValue(handle));

      await expect(saveFileWithPicker('sag')).rejects.toThrow('Filen skal have .eo extension');
      expect(logWarning).toHaveBeenCalledWith('Bruger valgte fil uden .eo extension: sag.txt');
    });

    it('fejler eksplicit når save-picker-kapabiliteten mangler', async () => {
      await expect(saveFileWithPicker('sag')).rejects.toThrow(
        'Kunne ikke vælge fil-placering: File System Access API er ikke understøttet i denne browser',
      );
    });
  });

  describe('handle- og filoperationer', () => {
    it.each([
      [null, false],
      [{}, false],
      [{ getFile: 'ikke-en-funktion' }, false],
      [{ getFile: vi.fn() }, true],
    ] as const)('isFileSystemFileHandle(%o) returnerer %s', (value, expected) => {
      expect(isFileSystemFileHandle(value)).toBe(expected);
    });

    it('skriver content og lukker writable stream', async () => {
      const write = vi.fn().mockResolvedValue(undefined);
      const close = vi.fn().mockResolvedValue(undefined);
      const handle = makeFileHandle({ createWritable: vi.fn().mockResolvedValue({ write, close }) });

      await expect(writeToFileHandle(handle, 'content')).resolves.toBeUndefined();

      expect(write).toHaveBeenCalledWith('content');
      expect(close).toHaveBeenCalledOnce();
    });

    it('oversætter skrivefejl og logger den reelle fejl', async () => {
      const handle = makeFileHandle({
        createWritable: vi.fn().mockRejectedValue(new Error('skrivning fejlede')),
      });

      await expect(writeToFileHandle(handle, 'content')).rejects.toThrow(
        'Kunne ikke skrive fil: skrivning fejlede',
      );
      expect(logError).toHaveBeenCalledWith('Fejl ved skrivning til fil:', expect.any(Error));
    });

    it('læser tekst fra fil-handle', async () => {
      const text = vi.fn().mockResolvedValue('content');
      const getFile = vi.fn().mockResolvedValue({ text });
      const handle = makeFileHandle({ getFile });

      await expect(readFromFileHandle(handle)).resolves.toBe('content');
      expect(getFile).toHaveBeenCalledOnce();
      expect(text).toHaveBeenCalledOnce();
    });

    it('oversætter læsefejl og logger den reelle fejl', async () => {
      const handle = makeFileHandle({
        getFile: vi.fn().mockRejectedValue(new Error('læsning fejlede')),
      });

      await expect(readFromFileHandle(handle)).rejects.toThrow(
        'Kunne ikke læse fil: læsning fejlede',
      );
      expect(logError).toHaveBeenCalledWith('Fejl ved læsning fra fil:', expect.any(Error));
    });

    it('eksporterer den forventede fejltype for manglende handle-tilladelse', () => {
      const error = new FileHandleAccessError('test');

      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('FileHandleAccessError');
    });
  });
});
