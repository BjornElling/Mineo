// @vitest-environment jsdom
const loadPendingPwaOpenRequestFromIndexedDBMock = vi.fn();
const deletePendingPwaOpenRequestFromIndexedDBMock = vi.fn();
const savePendingPwaOpenRequestToIndexedDBMock = vi.fn();
const logWarningMock = vi.fn();

vi.mock('../../utils/fileHandleStorage', () => ({
  savePendingPwaOpenRequestToIndexedDB: (...args: unknown[]) => savePendingPwaOpenRequestToIndexedDBMock(...args),
  loadPendingPwaOpenRequestFromIndexedDB: () => loadPendingPwaOpenRequestFromIndexedDBMock(),
  deletePendingPwaOpenRequestFromIndexedDB: () => deletePendingPwaOpenRequestFromIndexedDBMock(),
}));

vi.mock('../../utils/logger', () => ({
  logWarning: (...args: unknown[]) => logWarningMock(...args),
}));

const buildFileHandle = (name = 'test.eo'): FileSystemFileHandle => ({
  kind: 'file',
  name,
  getFile: vi.fn(),
} as unknown as FileSystemFileHandle);

type PwaLaunchQueueModule = typeof import('../../utils/pwaLaunchQueue');

describe('pwaLaunchQueue', () => {
  let pwaLaunchQueue: PwaLaunchQueueModule;

  beforeEach(async () => {
    vi.resetModules();
    pwaLaunchQueue = await import('../../utils/pwaLaunchQueue');
    loadPendingPwaOpenRequestFromIndexedDBMock.mockReset();
    deletePendingPwaOpenRequestFromIndexedDBMock.mockReset();
    savePendingPwaOpenRequestToIndexedDBMock.mockReset();
    logWarningMock.mockReset();
    savePendingPwaOpenRequestToIndexedDBMock.mockResolvedValue(true);
    deletePendingPwaOpenRequestFromIndexedDBMock.mockResolvedValue(true);
    await pwaLaunchQueue.clearPendingPwaFileOpenRequest();
    deletePendingPwaOpenRequestFromIndexedDBMock.mockClear();
    savePendingPwaOpenRequestToIndexedDBMock.mockClear();
    logWarningMock.mockClear();
  });

  it('rehydrates a persisted pending request and keeps it pending until it is marked handled', async () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
    loadPendingPwaOpenRequestFromIndexedDBMock.mockResolvedValue({
      id: 'pwa-open-7',
      createdAtEpochMs: 123,
      targetUrl: '/open',
      fileHandle: buildFileHandle(),
      fileName: 'test.eo',
      ignoredFileCount: 0,
    });

    await pwaLaunchQueue.hydratePendingPwaFileOpenRequest();

    expect(await pwaLaunchQueue.retryPendingPwaFileOpenRequest()).toBe(true);
    expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({
      type: 'mineo:pwa-file-open',
    }));

    const next = pwaLaunchQueue.getPendingPwaFileOpenRequest();
    expect(next).toEqual(expect.objectContaining({
      id: 'pwa-open-7',
      fileName: 'test.eo',
    }));

    await pwaLaunchQueue.markPendingPwaFileOpenRequestHandled('pwa-open-7');
    expect(pwaLaunchQueue.getPendingPwaFileOpenRequest()).toBeNull();
  });

  it('bevarer en PWA-fil gennem versionsskift og registrerer consumeren i den nye app-version', async () => {
    let persistedRequest: unknown = null;
    savePendingPwaOpenRequestToIndexedDBMock.mockImplementation(async (request: unknown) => {
      persistedRequest = request;
      return true;
    });
    loadPendingPwaOpenRequestFromIndexedDBMock.mockImplementation(async () => persistedRequest);

    const oldVersionSetConsumerMock = vi.fn();
    Object.defineProperty(window, 'launchQueue', {
      configurable: true,
      value: { setConsumer: oldVersionSetConsumerMock },
    });

    pwaLaunchQueue.setupPwaLaunchQueueConsumer();
    const oldVersionConsumer = oldVersionSetConsumerMock.mock.calls[0]?.[0] as ((params: {
      files?: ReadonlyArray<FileSystemHandle>;
      targetURL?: string;
    }) => Promise<void>) | undefined;
    const fileHandle = buildFileHandle('før-opdatering.eo');

    await oldVersionConsumer?.({ files: [fileHandle], targetURL: '/open' });
    await vi.waitFor(() => {
      expect(persistedRequest).toEqual(expect.objectContaining({ fileHandle, fileName: 'før-opdatering.eo' }));
    });

    // En ny modulevaluation svarer til den app-version, der starter efter PWA-opdateringen.
    vi.resetModules();
    const updatedPwaLaunchQueue = await import('../../utils/pwaLaunchQueue');
    const updatedVersionSetConsumerMock = vi.fn();
    Object.defineProperty(window, 'launchQueue', {
      configurable: true,
      value: { setConsumer: updatedVersionSetConsumerMock },
    });

    updatedPwaLaunchQueue.setupPwaLaunchQueueConsumer();
    await updatedPwaLaunchQueue.hydratePendingPwaFileOpenRequest();

    expect(updatedVersionSetConsumerMock).toHaveBeenCalledOnce();
    expect(updatedPwaLaunchQueue.getPendingPwaFileOpenRequest()).toEqual(expect.objectContaining({
      fileHandle,
      fileName: 'før-opdatering.eo',
    }));

    delete (window as Window & { launchQueue?: unknown }).launchQueue;
  });

  it('lader en ny launchQueue-fil vinde over en ældre request, der hydreres samtidig', async () => {
    const olderHandle = buildFileHandle('ældre.eo');
    const newerHandle = buildFileHandle('nyere.eo');
    let resolveStoredRequest: ((request: unknown) => void) | undefined;
    loadPendingPwaOpenRequestFromIndexedDBMock.mockImplementationOnce(() => (
      new Promise((resolve) => {
        resolveStoredRequest = resolve;
      })
    ));

    const setConsumerMock = vi.fn();
    Object.defineProperty(window, 'launchQueue', {
      configurable: true,
      value: { setConsumer: setConsumerMock },
    });
    pwaLaunchQueue.setupPwaLaunchQueueConsumer();

    const hydratePromise = pwaLaunchQueue.hydratePendingPwaFileOpenRequest();
    const consumer = setConsumerMock.mock.calls[0]?.[0] as ((params: {
      files?: ReadonlyArray<FileSystemHandle>;
      targetURL?: string;
    }) => Promise<void>) | undefined;
    await consumer?.({ files: [newerHandle], targetURL: '/open' });
    resolveStoredRequest?.({
      id: 'pwa-open-7',
      createdAtEpochMs: 123,
      targetUrl: '/open',
      fileHandle: olderHandle,
      fileName: 'ældre.eo',
      ignoredFileCount: 0,
    });
    await hydratePromise;

    expect(pwaLaunchQueue.getPendingPwaFileOpenRequest()).toEqual(expect.objectContaining({
      fileHandle: newerHandle,
      fileName: 'nyere.eo',
    }));

    delete (window as Window & { launchQueue?: unknown }).launchQueue;
  });

  it('sletter ikke en nyere launchQueue-fil, når en ugyldig ældre record hydreres samtidig', async () => {
    let resolveStoredRequest: ((request: unknown) => void) | undefined;
    loadPendingPwaOpenRequestFromIndexedDBMock.mockImplementationOnce(() => (
      new Promise((resolve) => {
        resolveStoredRequest = resolve;
      })
    ));

    const setConsumerMock = vi.fn();
    Object.defineProperty(window, 'launchQueue', {
      configurable: true,
      value: { setConsumer: setConsumerMock },
    });
    pwaLaunchQueue.setupPwaLaunchQueueConsumer();

    const hydratePromise = pwaLaunchQueue.hydratePendingPwaFileOpenRequest();
    const consumer = setConsumerMock.mock.calls[0]?.[0] as ((params: {
      files?: ReadonlyArray<FileSystemHandle>;
      targetURL?: string;
    }) => Promise<void>) | undefined;
    const newerHandle = buildFileHandle('nyere.eo');
    const consumerPromise = consumer?.({ files: [newerHandle], targetURL: '/open' });

    resolveStoredRequest?.({ invalid: true });
    await hydratePromise;
    await consumerPromise;

    expect(deletePendingPwaOpenRequestFromIndexedDBMock).not.toHaveBeenCalled();
    expect(savePendingPwaOpenRequestToIndexedDBMock).toHaveBeenCalledWith(
      expect.objectContaining({ fileHandle: newerHandle, fileName: 'nyere.eo' })
    );
    delete (window as Window & { launchQueue?: unknown }).launchQueue;
  });

  it('fortsætter uden pending request, hvis IndexedDB ikke kan læses ved opstart', async () => {
    loadPendingPwaOpenRequestFromIndexedDBMock.mockRejectedValueOnce(new Error('IndexedDB utilgængelig'));

    await expect(pwaLaunchQueue.hydratePendingPwaFileOpenRequest()).resolves.toBeUndefined();

    expect(pwaLaunchQueue.getPendingPwaFileOpenRequest()).toBeNull();
    expect(logWarningMock).toHaveBeenCalledWith(
      'Pending PWA-open request kunne ikke hentes fra IndexedDB',
      expect.objectContaining({ context: 'hydratePendingPwaFileOpenRequest.load' })
    );
  });

  it('dispatches PWA-open event even if persistence of the pending request fails', async () => {
    const setConsumerMock = vi.fn();
    Object.defineProperty(window, 'launchQueue', {
      configurable: true,
      value: {
        setConsumer: setConsumerMock,
      },
    });
    savePendingPwaOpenRequestToIndexedDBMock.mockRejectedValueOnce(new Error('IDB nede'));

    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

    pwaLaunchQueue.setupPwaLaunchQueueConsumer();

    const consumer = setConsumerMock.mock.calls[0]?.[0] as ((params: {
      files?: ReadonlyArray<FileSystemHandle>;
      targetURL?: string;
    }) => Promise<void>) | undefined;

    expect(consumer).toBeDefined();

    await consumer?.({
      files: [buildFileHandle()],
      targetURL: '/open',
    });

    expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({
      type: pwaLaunchQueue.Mineo_PWA_FILE_OPEN_EVENT,
    }));
    await Promise.resolve();
    expect(logWarningMock).toHaveBeenCalled();

    delete (window as Window & { launchQueue?: unknown }).launchQueue;
  });

  it('udsender eventet ved ankomst, mens langsom persistens stadig afventer', async () => {
    const setConsumerMock = vi.fn();
    Object.defineProperty(window, 'launchQueue', {
      configurable: true,
      value: { setConsumer: setConsumerMock },
    });

    let resolveSave: ((saved: boolean) => void) | undefined;
    savePendingPwaOpenRequestToIndexedDBMock.mockImplementationOnce(() => (
      new Promise<boolean>((resolve) => {
        resolveSave = resolve;
      })
    ));
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
    pwaLaunchQueue.setupPwaLaunchQueueConsumer();
    const consumer = setConsumerMock.mock.calls[0]?.[0] as ((params: {
      files?: ReadonlyArray<FileSystemHandle>;
      targetURL?: string;
    }) => Promise<void>) | undefined;

    const consumerPromise = consumer?.({ files: [buildFileHandle()], targetURL: '/open' });
    expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({
      type: pwaLaunchQueue.Mineo_PWA_FILE_OPEN_EVENT,
    }));

    await vi.waitFor(() => expect(resolveSave).toBeTypeOf('function'));
    resolveSave?.(true);
    await consumerPromise;
    delete (window as Window & { launchQueue?: unknown }).launchQueue;
  });

  it('gendanner en pending request, hvis rydning ikke kan verificeres', async () => {
    const setConsumerMock = vi.fn();
    Object.defineProperty(window, 'launchQueue', {
      configurable: true,
      value: { setConsumer: setConsumerMock },
    });
    deletePendingPwaOpenRequestFromIndexedDBMock.mockResolvedValueOnce(false);
    pwaLaunchQueue.setupPwaLaunchQueueConsumer();
    const consumer = setConsumerMock.mock.calls[0]?.[0] as ((params: {
      files?: ReadonlyArray<FileSystemHandle>;
      targetURL?: string;
    }) => Promise<void>) | undefined;
    await consumer?.({ files: [buildFileHandle()], targetURL: '/open' });
    const request = pwaLaunchQueue.getPendingPwaFileOpenRequest();
    expect(request).not.toBeNull();

    await expect(pwaLaunchQueue.clearPendingPwaFileOpenRequest(request?.id)).rejects.toThrow(
      'kunne ikke ryddes sikkert'
    );
    expect(pwaLaunchQueue.getPendingPwaFileOpenRequest()).toEqual(request);
    delete (window as Window & { launchQueue?: unknown }).launchQueue;
  });

  it('genskaber ikke en håndteret request i IndexedDB, hvis save afsluttes efter clear', async () => {
    const setConsumerMock = vi.fn();
    Object.defineProperty(window, 'launchQueue', {
      configurable: true,
      value: {
        setConsumer: setConsumerMock,
      },
    });

    let resolveSave: ((saved: boolean) => void) | undefined;
    savePendingPwaOpenRequestToIndexedDBMock.mockImplementationOnce(() => (
      new Promise<boolean>((resolve) => {
        resolveSave = resolve;
      })
    ));

    pwaLaunchQueue.setupPwaLaunchQueueConsumer();

    const consumer = setConsumerMock.mock.calls[0]?.[0] as ((params: {
      files?: ReadonlyArray<FileSystemHandle>;
      targetURL?: string;
    }) => Promise<void>) | undefined;

    const consumerPromise = consumer?.({
      files: [buildFileHandle()],
      targetURL: '/open',
    });

    const request = pwaLaunchQueue.getPendingPwaFileOpenRequest();
    expect(request?.id).toBe('pwa-open-1');

    const clearPromise = pwaLaunchQueue.clearPendingPwaFileOpenRequest();
    resolveSave?.(true);
    await consumerPromise;
    await clearPromise;

    expect(deletePendingPwaOpenRequestFromIndexedDBMock).toHaveBeenCalled();
    expect(pwaLaunchQueue.getPendingPwaFileOpenRequest()).toBeNull();

    delete (window as Window & { launchQueue?: unknown }).launchQueue;
  });

  it('fjerner en ugyldig gemt pending request under hydrering', async () => {
    loadPendingPwaOpenRequestFromIndexedDBMock.mockResolvedValue({
      id: 'pwa-open-8',
      createdAtEpochMs: 123,
      fileHandle: { name: 'mangler-getFile.eo' },
      fileName: 'mangler-getFile.eo',
      ignoredFileCount: 0,
    });

    await pwaLaunchQueue.hydratePendingPwaFileOpenRequest();

    expect(pwaLaunchQueue.getPendingPwaFileOpenRequest()).toBeNull();
    expect(deletePendingPwaOpenRequestFromIndexedDBMock).toHaveBeenCalled();
    expect(logWarningMock).toHaveBeenCalledWith(
      'Ugyldig pending PWA-open request blev fjernet fra IndexedDB',
      expect.objectContaining({ context: 'hydratePendingPwaFileOpenRequest.invalidStoredRequest' })
    );
  });

  describe('durable handoff-barriere før opstartens genindlæsning', () => {
    // Opstartens opdateringsbarriere kan genindlæse dokumentet. En `.eo`-request, browseren afleverede
    // få millisekunder forinden, lever da kun i hukommelsen, mens IndexedDB-skrivningen er undervejs —
    // en genindlæsning ville tabe brugerens fil. Boot skal derfor kunne vente på den durable handoff.

    it('bekræfter handoff, når der slet ingen pending request er', async () => {
      expect(await pwaLaunchQueue.awaitDurablePendingPwaFileOpenHandoff()).toBe(true);
    });

    it('afventer den igangværende skrivning og bekræfter først, når requesten står i IndexedDB', async () => {
      const handle = buildFileHandle('sag.eo');
      let resolveSave: ((value: boolean) => void) | null = null;
      savePendingPwaOpenRequestToIndexedDBMock.mockImplementation(
        () => new Promise<boolean>((resolve) => {
          resolveSave = resolve;
        }),
      );

      let consumer: ((params: { files: FileSystemFileHandle[] }) => Promise<void>) | null = null;
      (window as unknown as { launchQueue: unknown }).launchQueue = {
        setConsumer: (fn: (params: { files: FileSystemFileHandle[] }) => Promise<void>) => {
          consumer = fn;
        },
      };
      pwaLaunchQueue.setupPwaLaunchQueueConsumer();
      const consumed = consumer!({ files: [handle] });

      // Skrivningen er endnu ikke færdig: barrieren må ikke frigive opstarten.
      let settled = false;
      const barrier = pwaLaunchQueue.awaitDurablePendingPwaFileOpenHandoff().then((value) => {
        settled = true;
        return value;
      });
      await Promise.resolve();
      expect(settled).toBe(false);

      loadPendingPwaOpenRequestFromIndexedDBMock.mockResolvedValue({
        id: 'pwa-open-1',
        createdAtEpochMs: 123,
        fileHandle: handle,
        fileName: 'sag.eo',
        ignoredFileCount: 0,
      });
      resolveSave!(true);
      await consumed;

      expect(await barrier).toBe(true);
    });

    it('afviser handoff, når requesten ikke kan bekræftes i IndexedDB', async () => {
      const handle = buildFileHandle('sag.eo');
      savePendingPwaOpenRequestToIndexedDBMock.mockResolvedValue(false);

      let consumer: ((params: { files: FileSystemFileHandle[] }) => Promise<void>) | null = null;
      (window as unknown as { launchQueue: unknown }).launchQueue = {
        setConsumer: (fn: (params: { files: FileSystemFileHandle[] }) => Promise<void>) => {
          consumer = fn;
        },
      };
      pwaLaunchQueue.setupPwaLaunchQueueConsumer();
      await consumer!({ files: [handle] });

      // Intet i IndexedDB ⇒ opstarten må ikke genindlæse; brugerens fil vejer tungere end at komme
      // på nyeste version med det samme.
      loadPendingPwaOpenRequestFromIndexedDBMock.mockResolvedValue(null);
      expect(await pwaLaunchQueue.awaitDurablePendingPwaFileOpenHandoff()).toBe(false);
    });
  });

  it.each([
    { id: '', createdAtEpochMs: 123, fileName: 'test.eo', ignoredFileCount: 0 },
    { id: 'pwa-open-1', createdAtEpochMs: Number.NaN, fileName: 'test.eo', ignoredFileCount: 0 },
    { id: 'pwa-open-1', createdAtEpochMs: 123, fileName: ' ', ignoredFileCount: 0 },
    { id: 'pwa-open-1', createdAtEpochMs: 123, fileName: 'test.eo', ignoredFileCount: -1 },
  ])('afviser ugyldig persisted request: %o', async (invalid) => {
    loadPendingPwaOpenRequestFromIndexedDBMock.mockResolvedValue({
      ...invalid,
      fileHandle: buildFileHandle(),
    });

    await pwaLaunchQueue.hydratePendingPwaFileOpenRequest();

    expect(pwaLaunchQueue.getPendingPwaFileOpenRequest()).toBeNull();
    expect(deletePendingPwaOpenRequestFromIndexedDBMock).toHaveBeenCalled();
  });
});
