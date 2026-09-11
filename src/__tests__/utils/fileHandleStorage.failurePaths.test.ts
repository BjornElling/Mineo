// @vitest-environment jsdom
const storageMocks = vi.hoisted(() => ({
  readFileHandleValueResult: vi.fn(),
  readFileHandleValue: vi.fn(),
  writeFileHandleValues: vi.fn(),
  deleteFileHandleValues: vi.fn(),
  readClientScopedFileHandleValueResult: vi.fn(),
  writeClientScopedFileHandleValue: vi.fn(),
  deleteClientScopedFileHandleValue: vi.fn(),
}));

vi.mock('../../utils/file/fileHandleKvStore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/file/fileHandleKvStore')>();
  return {
    ...actual,
    readFileHandleValueResult: (...args: unknown[]) => storageMocks.readFileHandleValueResult(...args),
    readFileHandleValue: (...args: unknown[]) => storageMocks.readFileHandleValue(...args),
    writeFileHandleValues: (...args: unknown[]) => storageMocks.writeFileHandleValues(...args),
    deleteFileHandleValues: (...args: unknown[]) => storageMocks.deleteFileHandleValues(...args),
    readClientScopedFileHandleValueResult: (...args: unknown[]) => storageMocks.readClientScopedFileHandleValueResult(...args),
    writeClientScopedFileHandleValue: (...args: unknown[]) => storageMocks.writeClientScopedFileHandleValue(...args),
    deleteClientScopedFileHandleValue: (...args: unknown[]) => storageMocks.deleteClientScopedFileHandleValue(...args),
  };
});

vi.mock('../../utils/logger', () => ({
  logWarning: vi.fn(),
}));

import {
  deleteDefaultDirectoryHandle,
  deleteFileHandleFromIndexedDB,
  deletePendingPwaOpenRequestFromIndexedDB,
  getDirectoryDisplayInfo,
  loadDefaultDirectoryHandle,
  loadFileHandleFromIndexedDB,
  loadPendingPwaOpenRequestFromIndexedDB,
  requestPersistentStorage,
  saveDefaultDirectoryHandle,
  saveFileHandleToIndexedDB,
  savePendingPwaOpenRequestToIndexedDB,
} from '../../utils/fileHandleStorage';

type StorageErrorResult = Readonly<{ status: 'error'; error: Error }>;

const storageError = (message: string): StorageErrorResult => ({
  status: 'error',
  error: new Error(message),
});

const unavailable = (): Readonly<{ status: 'unavailable' }> => ({ status: 'unavailable' });

const fileHandle = {
  kind: 'file',
  name: 'sag.eo',
  getFile: vi.fn(),
} as unknown as FileSystemFileHandle;

const directoryHandle = {
  kind: 'directory',
  name: 'Sager',
} as unknown as FileSystemDirectoryHandle;

const pendingRequest = {
  id: 'pwa-open-test-1',
  createdAtEpochMs: 1_700_000_000_000,
  fileHandle,
  fileName: 'sag.eo',
  ignoredFileCount: 0,
};

const originalNavigatorStorageDescriptor = Object.getOwnPropertyDescriptor(navigator, 'storage');

const setNavigatorStorage = (storage: unknown): void => {
  Object.defineProperty(navigator, 'storage', {
    configurable: true,
    value: storage,
  });
};

const restoreNavigatorStorage = (): void => {
  if (originalNavigatorStorageDescriptor) {
    Object.defineProperty(navigator, 'storage', originalNavigatorStorageDescriptor);
  } else {
    Reflect.deleteProperty(navigator, 'storage');
  }
};

describe('fileHandleStorage – IndexedDB-fejlstier', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  afterEach(() => {
    restoreNavigatorStorage();
  });

  describe('persistent storage', () => {
    it('returnerer false når browserens persist-kapabilitet mangler', async () => {
      Reflect.deleteProperty(navigator, 'storage');

      await expect(requestPersistentStorage()).resolves.toBe(false);
    });

    it('returnerer false når browserens persist-kald fejler', async () => {
      const persist = vi.fn().mockRejectedValue(new Error('persist fejlede'));
      setNavigatorStorage({ persist });

      await expect(requestPersistentStorage()).resolves.toBe(false);
      expect(persist).toHaveBeenCalledOnce();
    });
  });

  describe('filhåndtag', () => {
    it('returnerer false når save-operationen fejler', async () => {
      storageMocks.writeClientScopedFileHandleValue.mockResolvedValue(storageError('put fejlede'));

      await expect(saveFileHandleToIndexedDB(fileHandle)).resolves.toBe(false);
    });

    it('returnerer null når load-operationen fejler', async () => {
      storageMocks.readClientScopedFileHandleValueResult.mockResolvedValue(storageError('get fejlede'));

      await expect(loadFileHandleFromIndexedDB()).resolves.toBeNull();
    });

    it('returnerer false ved slettefejl, men true når IndexedDB er utilgængelig', async () => {
      storageMocks.deleteClientScopedFileHandleValue.mockResolvedValueOnce(storageError('delete fejlede'));
      await expect(deleteFileHandleFromIndexedDB()).resolves.toBe(false);

      storageMocks.deleteClientScopedFileHandleValue.mockResolvedValueOnce(unavailable());
      await expect(deleteFileHandleFromIndexedDB()).resolves.toBe(true);
    });
  });

  describe('standardmappe', () => {
    it('returnerer null ved atomisk storage-fejl under gemning', async () => {
      storageMocks.writeFileHandleValues.mockResolvedValue(storageError('directory put fejlede'));

      await expect(saveDefaultDirectoryHandle(directoryHandle)).resolves.toBeNull();
    });

    it('returnerer null ved læsefejl og slettefejl', async () => {
      storageMocks.readFileHandleValue.mockResolvedValue(null);
      await expect(loadDefaultDirectoryHandle()).resolves.toBeNull();

      storageMocks.deleteFileHandleValues.mockResolvedValue(storageError('directory delete fejlede'));
      await expect(deleteDefaultDirectoryHandle()).resolves.toBe(false);
    });

    it('skjuler storage-fejl for den passive metadata-observatør', async () => {
      storageMocks.readFileHandleValueResult.mockResolvedValue(storageError('metadata get fejlede'));

      await expect(getDirectoryDisplayInfo()).resolves.toBeNull();
      expect(storageMocks.readFileHandleValueResult).toHaveBeenCalledWith(
        'default_directory_meta',
        'getDirectoryDisplayInfo',
        { silent: true },
      );
    });
  });

  describe('pending PWA-request', () => {
    it('returnerer false ved save-fejl uden at kaste', async () => {
      storageMocks.writeClientScopedFileHandleValue.mockResolvedValue(storageError('PWA put fejlede'));

      await expect(savePendingPwaOpenRequestToIndexedDB(pendingRequest)).resolves.toBe(false);
    });

    it('bevarer statusbærende load-fejl og oversætter delete-fejl til false', async () => {
      const loadFailure = storageError('PWA get fejlede');
      storageMocks.readClientScopedFileHandleValueResult.mockResolvedValue(loadFailure);
      await expect(loadPendingPwaOpenRequestFromIndexedDB()).resolves.toBe(loadFailure);

      const deleteFailure = storageError('PWA delete fejlede');
      storageMocks.deleteClientScopedFileHandleValue.mockResolvedValue(deleteFailure);
      await expect(deletePendingPwaOpenRequestFromIndexedDB()).resolves.toBe(false);
    });
  });
});
