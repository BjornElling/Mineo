// @vitest-environment jsdom
import {
  FileHandleAccessError,
  openFileWithPicker,
  readFromFileHandle,
  saveFileWithPicker,
  writeToFileHandle,
} from '../../utils/fileSystemAccess';
import { readFileContentFingerprint } from '../../utils/fileContentFingerprint';
import { logError, logWarning } from '../../utils/logger';

vi.mock('../../utils/fileContentFingerprint', () => ({
  readFileContentFingerprint: vi.fn(),
}));

vi.mock('../../utils/logger', () => ({
  logError: vi.fn(),
  logWarning: vi.fn(),
  sanitizeFilenameForLog: (value: unknown) => String(value ?? ''),
}));

const fingerprint = vi.mocked(readFileContentFingerprint);
const pickerNames = ['showOpenFilePicker', 'showSaveFilePicker'] as const;
const originalPickers = pickerNames.map((name) => ({ name, descriptor: Object.getOwnPropertyDescriptor(window, name) }));

const writableProbe = () => {
  const stream = {
    write: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    abort: vi.fn().mockResolvedValue(undefined),
  };
  const createWritable = vi.fn().mockResolvedValue(stream);
  const handle = { name: 'sag.eo', createWritable, getFile: vi.fn() } as unknown as FileSystemFileHandle;
  return { handle, createWritable, ...stream };
};

describe('fileSystemAccess – eksterne filændringer og afbrudt skrivning', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fingerprint.mockResolvedValue('accepteret revision');
  });

  afterEach(() => {
    for (const { name, descriptor } of originalPickers) {
      if (descriptor) Object.defineProperty(window, name, descriptor);
      else Reflect.deleteProperty(window, name);
    }
  });

  it('kontrollerer accepteret filrevision efter eksklusiv åbning og afslutter derefter skrivningen', async () => {
    const probe = writableProbe();

    await writeToFileHandle(probe.handle, 'nyt indhold', 'accepteret revision');

    expect(probe.createWritable).toHaveBeenCalledWith({ mode: 'exclusive', keepExistingData: false });
    expect(fingerprint).toHaveBeenCalledWith(probe.handle);
    expect(probe.createWritable.mock.invocationCallOrder[0]).toBeLessThan(fingerprint.mock.invocationCallOrder[0]);
    expect(fingerprint.mock.invocationCallOrder[0]).toBeLessThan(probe.write.mock.invocationCallOrder[0]);
    expect(probe.write).toHaveBeenCalledWith('nyt indhold');
    expect(probe.write.mock.invocationCallOrder[0]).toBeLessThan(probe.close.mock.invocationCallOrder[0]);
    expect(probe.close).toHaveBeenCalledOnce();
    expect(probe.abort).not.toHaveBeenCalled();
  });

  it('aborterer uden write eller close når filen blev ændret mens streamen åbnede', async () => {
    const probe = writableProbe();
    probe.createWritable.mockImplementationOnce(async () => {
      fingerprint.mockResolvedValue('eksternt ændret revision');
      return { write: probe.write, close: probe.close, abort: probe.abort };
    });

    await expect(writeToFileHandle(probe.handle, 'nyt indhold', 'accepteret revision'))
      .rejects.toThrow('Filen blev ændret igen');

    expect(probe.abort).toHaveBeenCalledOnce();
    expect(probe.write).not.toHaveBeenCalled();
    expect(probe.close).not.toHaveBeenCalled();
    expect(logError).not.toHaveBeenCalled();
    expect(logWarning).not.toHaveBeenCalled();
  });

  it('aborterer midlertidigt indhold uden close hvis originalen ændres under write', async () => {
    const probe = writableProbe();
    fingerprint.mockResolvedValueOnce('accepteret revision').mockResolvedValueOnce('ekstern ændring under write');
    await expect(writeToFileHandle(probe.handle, 'nyt indhold', 'accepteret revision')).rejects.toThrow('Filen blev ændret igen');
    expect(probe.write).toHaveBeenCalledOnce();
    expect(probe.abort).toHaveBeenCalledOnce();
    expect(probe.close).not.toHaveBeenCalled();
    expect(logError).not.toHaveBeenCalled();
  });

  it('aborterer uden write eller close når sagsinput blev ændret mens streamen åbnede', async () => {
    const probe = writableProbe();
    let sourceCurrent = true;
    probe.createWritable.mockImplementationOnce(async () => {
      sourceCurrent = false;
      return { write: probe.write, close: probe.close, abort: probe.abort };
    });

    await expect(writeToFileHandle(probe.handle, 'nyt indhold', 'accepteret revision', () => sourceCurrent))
      .rejects.toThrow('sagen blev ændret undervejs');

    expect(probe.abort).toHaveBeenCalledOnce();
    expect(probe.write).not.toHaveBeenCalled();
    expect(probe.close).not.toHaveBeenCalled();
    expect(logError).not.toHaveBeenCalled();
    expect(logWarning).not.toHaveBeenCalled();
  });

  const expectedWriteErrors = [
    'NotFoundError', 'NotAllowedError', 'SecurityError', 'NoModificationAllowedError',
    'NotReadableError', 'QuotaExceededError', 'AbortError',
  ] as const;

  for (const phase of ['create', 'write', 'close'] as const) {
    it.each(expectedWriteErrors)(`viser %s under ${phase} som filfejl uden teknisk alarm`, async (name) => {
      const probe = writableProbe();
      const error = new DOMException('Filsystemet ændrede sig', name);
      if (phase === 'create') probe.createWritable.mockRejectedValueOnce(error);
      else probe[phase].mockRejectedValueOnce(error);

      await expect(writeToFileHandle(probe.handle, 'nyt indhold', 'accepteret revision'))
        .rejects.toMatchObject({ name: 'FileHandleAccessError', cause: error });

      if (phase === 'create') expect(probe.abort).not.toHaveBeenCalled();
      else expect(probe.abort).toHaveBeenCalledOnce();
      if (phase !== 'close') expect(probe.close).not.toHaveBeenCalled();
      if (phase === 'create') expect(probe.write).not.toHaveBeenCalled();
      expect(logError).not.toHaveBeenCalled();
      expect(logWarning).not.toHaveBeenCalled();
    });
  }

  it('bevarer oprindelig filfejl når abort også fejler', async () => {
    const probe = writableProbe();
    const original = new DOMException('Disken er fuld', 'QuotaExceededError');
    probe.write.mockRejectedValueOnce(original);
    probe.abort.mockRejectedValueOnce(new Error('Streamen er allerede fejlet'));

    await expect(writeToFileHandle(probe.handle, 'nyt indhold'))
      .rejects.toMatchObject({ name: 'FileHandleAccessError', cause: original });

    expect(probe.abort).toHaveBeenCalledOnce();
    expect(probe.close).not.toHaveBeenCalled();
    expect(logError).not.toHaveBeenCalled();
  });

  it('aborterer og bevarer filfejlen når kontrol-læsningen fejler efter streamåbning', async () => {
    const probe = writableProbe();
    fingerprint.mockRejectedValueOnce(new DOMException('Filen er slettet', 'NotFoundError'));

    await expect(writeToFileHandle(probe.handle, 'nyt indhold', 'accepteret revision'))
      .rejects.toBeInstanceOf(FileHandleAccessError);

    expect(probe.abort).toHaveBeenCalledOnce();
    expect(probe.write).not.toHaveBeenCalled();
    expect(probe.close).not.toHaveBeenCalled();
    expect(logError).not.toHaveBeenCalled();
  });

  for (const phase of ['getFile', 'text'] as const) {
    it.each(['NotFoundError', 'NotAllowedError', 'SecurityError', 'NotReadableError'])(
      `viser %s under læsningens ${phase} uden teknisk alarm`, async (name) => {
        const error = new DOMException('Filen er ikke tilgængelig', name);
        const text = vi.fn().mockResolvedValue('indhold');
        const getFile = vi.fn().mockResolvedValue({ text });
        if (phase === 'getFile') getFile.mockRejectedValueOnce(error);
        else text.mockRejectedValueOnce(error);
        const handle = { getFile } as unknown as FileSystemFileHandle;

        await expect(readFromFileHandle(handle))
          .rejects.toMatchObject({ name: 'FileHandleAccessError', cause: error });

        expect(logError).not.toHaveBeenCalled();
        expect(logWarning).not.toHaveBeenCalled();
      },
    );
  }

  for (const picker of pickerNames) {
    it(`annullerer ${picker} stille ved browserens AbortError`, async () => {
      Object.defineProperty(window, picker, {
        configurable: true,
        value: vi.fn().mockRejectedValue(new DOMException('Brugeren annullerede', 'AbortError')),
      });

      const result = picker === 'showOpenFilePicker' ? openFileWithPicker() : saveFileWithPicker('sag.eo');

      await expect(result).resolves.toBeNull();
      expect(logError).not.toHaveBeenCalled();
      expect(logWarning).not.toHaveBeenCalled();
    });

    it.each(['NotFoundError', 'NotAllowedError', 'SecurityError'])(
      `viser %s fra ${picker} uden teknisk alarm`, async (name) => {
        const error = new DOMException('Placeringen er ikke tilgængelig', name);
        Object.defineProperty(window, picker, { configurable: true, value: vi.fn().mockRejectedValue(error) });

        const result = picker === 'showOpenFilePicker' ? openFileWithPicker() : saveFileWithPicker('sag.eo');

        await expect(result).rejects.toMatchObject({ name: 'FileHandleAccessError', cause: error });
        expect(logError).not.toHaveBeenCalled();
        expect(logWarning).not.toHaveBeenCalled();
      },
    );
  }
});
