// @vitest-environment jsdom
import { installFileOperationLocks } from '../fixtures/fileOperationLocks';
import { getFileOperationClientSessionStorageKey, getPendingPwaSourceSessionStorageKey } from '../../config/storageManifest';

const probe = vi.hoisted(() => ({
  values: new Map<string, unknown>(),
  reads: [] as string[],
  failWrite: false,
  beforeWrite: undefined as ((key: string) => Promise<void>) | undefined,
}));

vi.mock('../../utils/file/fileHandleKvStore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/file/fileHandleKvStore')>();
  return {
    ...actual,
    readClientScopedFileHandleValueResult: async (key: string) => {
      probe.reads.push(key);
      return { status: 'ok', value: probe.values.get(key) ?? null };
    },
    writeClientScopedFileHandleValue: async (key: string, value: unknown) => {
      await probe.beforeWrite?.(key);
      if (probe.failWrite) {
        probe.failWrite = false;
        return { status: 'error', error: new Error('IDB-write fejlede') };
      }
      probe.values.set(key, value);
      return { status: 'ok', value: undefined };
    },
    deleteClientScopedFileHandleValue: async (key: string) => {
      probe.values.delete(key);
      return { status: 'ok', value: undefined };
    },
  };
});

const makeHandle = (name: string): FileSystemFileHandle => ({
  kind: 'file', name, getFile: vi.fn(),
}) as unknown as FileSystemFileHandle;

describe('fileHandleStorage – genoptagelse uden fremmede filhåndtag', () => {
  let restoreLocks: () => void;
  let client: typeof import('../../utils/fileOperationClientSession');
  let storage: typeof import('../../utils/fileHandleStorage');

  beforeEach(async () => {
    sessionStorage.clear();
    probe.values.clear();
    probe.reads = [];
    probe.failWrite = false;
    probe.beforeWrite = undefined;
    restoreLocks = installFileOperationLocks();
    vi.resetModules();
    client = await import('../../utils/fileOperationClientSession');
    storage = await import('../../utils/fileHandleStorage');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    client.__resetFileOperationClientSessionForTests();
    restoreLocks();
    sessionStorage.clear();
  });

  it('ignorerer legacy current handle og kopierer kun en valideret pending request med bekræftelseskrav', async () => {
    const legacyId = 'client-previous-released-session';
    sessionStorage.setItem(getFileOperationClientSessionStorageKey(), legacyId);
    const own = makeHandle('legacy.eo');
    const request = { id: 'pwa-open-legacy-request-1', createdAtEpochMs: 1, fileHandle: own, fileName: 'legacy.eo', ignoredFileCount: 0 };
    probe.values.set(`client:${legacyId}:current-file-handle`, own);
    probe.values.set(`client:${legacyId}:pending-pwa-open-request`, request);

    expect(await storage.loadFileHandleFromIndexedDB()).toBeNull();
    const pending = await storage.loadPendingPwaOpenRequestFromIndexedDB();
    const session = await client.ensureFileOperationClientSession();

    expect(session.id).toMatch(/^owned:/);
    expect(session.id).not.toBe(legacyId);
    expect(pending).toEqual({ status: 'ok', value: { ...request, requiresConfirmation: true } });
    expect(probe.values.get(`client:${legacyId}:current-file-handle`)).toBe(own);
    expect(probe.values.get(`client:${legacyId}:pending-pwa-open-request`)).toBe(request);
    expect(probe.reads).not.toContain(`client:${legacyId}:current-file-handle`);
    expect(sessionStorage.getItem(getPendingPwaSourceSessionStorageKey())).toBeNull();

    client.__resetFileOperationClientSessionForTests();
    vi.resetModules();
    client = await import('../../utils/fileOperationClientSession');
    storage = await import('../../utils/fileHandleStorage');
    expect(await storage.loadPendingPwaOpenRequestFromIndexedDB()).toEqual(pending);
    expect(await storage.loadFileHandleFromIndexedDB()).toBeNull();
  });

  it('bevarer legacy-alias gennem F5 hvis kopieringen til eget scope fejler', async () => {
    const legacyId = 'client-pending-before-migration';
    sessionStorage.setItem(getFileOperationClientSessionStorageKey(), legacyId);
    const request = { id: 'pwa-open-legacy-pending-1', createdAtEpochMs: 1, fileHandle: makeHandle('legacy.eo'), fileName: 'legacy.eo', ignoredFileCount: 0 };
    probe.values.set(`client:${legacyId}:pending-pwa-open-request`, request);
    probe.failWrite = true;

    expect((await storage.loadPendingPwaOpenRequestFromIndexedDB()).status).toBe('error');
    expect(sessionStorage.getItem(getPendingPwaSourceSessionStorageKey())).toBe(legacyId);
    client.__resetFileOperationClientSessionForTests();
    vi.resetModules();
    client = await import('../../utils/fileOperationClientSession');
    storage = await import('../../utils/fileHandleStorage');

    expect(await storage.loadPendingPwaOpenRequestFromIndexedDB()).toEqual({ status: 'ok', value: { ...request, requiresConfirmation: true } });
    expect(probe.values.get(`client:${legacyId}:pending-pwa-open-request`)).toBe(request);
  });

  it('erstatter ikke legacy-identiteten hvis dens sidste pending-reference ikke kunne gemmes', async () => {
    const legacyId = 'client-pending-preserved-at-failure';
    const key = getFileOperationClientSessionStorageKey();
    sessionStorage.setItem(key, legacyId);
    const originalSet = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, candidate, value) {
      if (candidate === getPendingPwaSourceSessionStorageKey()) throw new Error('Lagerfejl');
      originalSet.call(this, candidate, value);
    });

    expect((await storage.loadPendingPwaOpenRequestFromIndexedDB()).status).toBe('error');
    expect(sessionStorage.getItem(key)).toBe(legacyId);
    expect(probe.reads).toEqual([]);
  });

  it('bevarer kun pending-requesten ved F5 uden Web Locks, aldrig current handle', async () => {
    Object.defineProperty(navigator, 'locks', { configurable: true, value: undefined });
    const own = makeHandle('runtime.eo');
    const request = { id: 'pwa-open-runtime-request-1', createdAtEpochMs: 1, fileHandle: own, fileName: 'runtime.eo', ignoredFileCount: 0 };
    await storage.saveFileHandleToIndexedDB(own);
    expect(await storage.savePendingPwaOpenRequestToIndexedDB(request)).toBe(true);
    client.__resetFileOperationClientSessionForTests();
    vi.resetModules();
    client = await import('../../utils/fileOperationClientSession');
    storage = await import('../../utils/fileHandleStorage');

    expect(await storage.loadFileHandleFromIndexedDB()).toBeNull();
    expect(await storage.loadPendingPwaOpenRequestFromIndexedDB()).toEqual({ status: 'ok', value: { ...request, requiresConfirmation: true } });
    expect((await storage.prepareFileOperationStorageSession()).reloadStable).toBe(false);
  });

  it('genpersisterer eget kendt håndtag og pending request under nyt scope efter pagehide', async () => {
    const own = makeHandle('sag.eo');
    const request = { id: 'pwa-open-own-request-1', createdAtEpochMs: 1, fileHandle: own, fileName: 'sag.eo', ignoredFileCount: 0 };
    await storage.saveFileHandleToIndexedDB(own);
    await storage.savePendingPwaOpenRequestToIndexedDB(request);
    const original = await client.ensureFileOperationClientSession();
    window.dispatchEvent(new Event('pagehide'));
    const foreign = makeHandle('sag.eo');
    probe.values.set(`client:${original.id}:current-file-handle`, foreign);
    probe.reads = [];

    expect(await storage.loadFileHandleFromIndexedDB()).toBe(own);
    const resumed = await storage.prepareFileOperationStorageSession();

    expect(resumed.id).not.toBe(original.id);
    expect(resumed.reloadStable).toBe(true);
    expect(probe.values.get(`client:${resumed.id}:current-file-handle`)).toBe(own);
    expect(probe.values.get(`client:${resumed.id}:pending-pwa-open-request`)).toBe(request);
    expect(probe.values.get(`client:${original.id}:current-file-handle`)).toBe(foreign);
    expect(probe.reads.every((key) => !key.includes(original.id))).toBe(true);
  });

  it('henter ikke et ukendt gammelt håndtag efter pagehide', async () => {
    // Kun pending-recorden er læst i dette dokument. Det gamle current handle er
    // derfor ukendt i memory og må ikke flyttes fra et scope, der kan være overtaget.
    await storage.loadPendingPwaOpenRequestFromIndexedDB();
    const original = await client.ensureFileOperationClientSession();
    const unknown = makeHandle('ukendt.eo');
    probe.values.set(`client:${original.id}:current-file-handle`, unknown);
    window.dispatchEvent(new Event('pagehide'));
    probe.reads = [];

    expect(await storage.loadFileHandleFromIndexedDB()).toBeNull();
    expect(probe.reads.every((key) => !key.includes(original.id))).toBe(true);
    expect(probe.values.get(`client:${original.id}:current-file-handle`)).toBe(unknown);
  });

  it('bevarer memory-kilden og prøver genpersistens igen efter en fejlet genbinding', async () => {
    const own = makeHandle('egen.eo');
    await storage.saveFileHandleToIndexedDB(own);
    window.dispatchEvent(new Event('pagehide'));
    probe.failWrite = true;

    expect(await storage.loadFileHandleFromIndexedDB()).toBeNull();
    expect(await storage.loadFileHandleFromIndexedDB()).toBe(own);
  });

  it('en langsom gammel write beholder sit scope til commit og kan ikke ramme en ny klient', async () => {
    const original = await client.ensureFileOperationClientSession();
    let started = false;
    let finishWrite: (() => void) | undefined;
    const blocked = new Promise<void>((resolve) => { finishWrite = resolve; });
    probe.beforeWrite = async () => { started = true; await blocked; };
    const own = makeHandle('egen.eo');
    const saving = storage.saveFileHandleToIndexedDB(own);
    await vi.waitFor(() => expect(started).toBe(true));
    window.dispatchEvent(new Event('pagehide'));
    vi.resetModules();
    const copied = await import('../../utils/fileOperationClientSession');
    const duplicate = await copied.ensureFileOperationClientSession();
    try {
      expect(duplicate.id).not.toBe(original.id);
      const foreign = makeHandle('anden.eo');
      const foreignKey = `client:${duplicate.id}:current-file-handle`;
      probe.values.set(foreignKey, foreign);
      finishWrite?.();

      expect(await saving).toBe(true);
      expect(probe.values.get(foreignKey)).toBe(foreign);
      expect(probe.values.get(`client:${original.id}:current-file-handle`)).toBe(own);
    } finally {
      finishWrite?.();
      copied.__resetFileOperationClientSessionForTests();
    }
  });
});
