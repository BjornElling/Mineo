// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';

import type { PwaLoadOutcome } from '../../hooks/useFileSaveLoad';
import type { PwaFileOpenRequest } from '../../utils/pwaLaunchQueue';
import { usePwaLaunchQueue } from '../../hooks/usePwaLaunchQueue';

const pwaMocks = vi.hoisted(() => ({
  clearPendingPwaFileOpenRequest: vi.fn(),
  getPendingPwaFileOpenRequest: vi.fn(),
  logWarning: vi.fn(),
}));

vi.mock('../../utils/pwaLaunchQueue', () => ({
  clearPendingPwaFileOpenRequest: pwaMocks.clearPendingPwaFileOpenRequest,
  getPendingPwaFileOpenRequest: pwaMocks.getPendingPwaFileOpenRequest,
  Mineo_PWA_FILE_OPEN_EVENT: 'mineo:pwa-file-open',
}));

vi.mock('../../utils/logger', () => ({
  logWarning: pwaMocks.logWarning,
}));

type HookArgs = Parameters<typeof usePwaLaunchQueue>[0];

const neverBusy = (): boolean => false;
const defaultHandleHentFromPwaRequest: HookArgs['handleHentFromPwaRequest'] = async () => 'applied';

const makeRequest = (id: string, fileName = `${id}.eo`): PwaFileOpenRequest => ({
  id,
  createdAtEpochMs: 1,
  fileHandle: {} as FileSystemFileHandle,
  fileName,
  ignoredFileCount: 0,
});

const flushPromises = async (): Promise<void> => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
};

const baseArgs = (overrides: Partial<HookArgs> = {}): HookArgs => ({
  locationPathname: '/stamdata',
  pendingLoadResultOpen: false,
  pendingOverwriteApplyOpen: false,
  pendingResetConfirmationOpen: false,
  fileOperationInProgress: false,
  isFileOperationInProgress: neverBusy,
  handleHentFromPwaRequest: defaultHandleHentFromPwaRequest,
  ...overrides,
});

describe('usePwaLaunchQueue', () => {
  beforeEach(() => {
    vi.useRealTimers();
    pwaMocks.clearPendingPwaFileOpenRequest.mockReset();
    pwaMocks.clearPendingPwaFileOpenRequest.mockResolvedValue(true);
    pwaMocks.getPendingPwaFileOpenRequest.mockReset();
    pwaMocks.getPendingPwaFileOpenRequest.mockReturnValue(null);
    pwaMocks.logWarning.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('behandler en eksplicit PWA-event når hooken er klar', async () => {
    const request = makeRequest('pwa-open-event-1');
    const handleHentFromPwaRequest = vi.fn<HookArgs['handleHentFromPwaRequest']>().mockResolvedValue('applied');
    const { result } = renderHook(() => usePwaLaunchQueue(baseArgs({ handleHentFromPwaRequest })));
    pwaMocks.getPendingPwaFileOpenRequest.mockReturnValue(request);

    await act(async () => {
      window.dispatchEvent(new Event('mineo:pwa-file-open'));
      await Promise.resolve();
    });

    expect(handleHentFromPwaRequest).toHaveBeenCalledWith(request);
    expect(result.current.pendingPwaConfirmation).toBeNull();
  });

  it('ignorerer et eksplicit PWA-event uden ventende request', () => {
    const handleHentFromPwaRequest = vi.fn<HookArgs['handleHentFromPwaRequest']>().mockResolvedValue('applied');
    renderHook(() => usePwaLaunchQueue(baseArgs({ handleHentFromPwaRequest })));

    act(() => {
      window.dispatchEvent(new Event('mineo:pwa-file-open'));
    });

    expect(handleHentFromPwaRequest).not.toHaveBeenCalled();
  });

  it('viser seneste request efter busy og loader den ved bekræftelse', async () => {
    const firstRequest = makeRequest('pwa-open-busy-1');
    const latestRequest = makeRequest('pwa-open-busy-2', 'seneste.eo');
    let pendingRequest: PwaFileOpenRequest | null = null;
    let resolveFirstOutcome: ((outcome: PwaLoadOutcome) => void) | undefined;
    const handleHentFromPwaRequest = vi.fn<HookArgs['handleHentFromPwaRequest']>()
      .mockImplementationOnce(() => new Promise<PwaLoadOutcome>((resolve) => {
        resolveFirstOutcome = resolve;
      }))
      .mockResolvedValueOnce('applied');
    const { result } = renderHook(
      (args: HookArgs) => usePwaLaunchQueue(args),
      { initialProps: baseArgs({ handleHentFromPwaRequest }) },
    );
    pwaMocks.getPendingPwaFileOpenRequest.mockImplementation(() => pendingRequest);
    pendingRequest = firstRequest;

    await act(async () => {
      window.dispatchEvent(new Event('mineo:pwa-file-open'));
      await Promise.resolve();
    });

    expect(handleHentFromPwaRequest).toHaveBeenCalledWith(firstRequest);
    await act(async () => {
      resolveFirstOutcome?.('busy');
      await Promise.resolve();
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(result.current.pendingPwaConfirmation).toEqual({
        requestId: firstRequest.id,
        fileName: firstRequest.fileName,
      });
    });

    pendingRequest = latestRequest;
    act(() => {
      result.current.confirmQueuedPwaFileOpen();
    });
    await flushPromises();

    expect(handleHentFromPwaRequest).toHaveBeenNthCalledWith(2, latestRequest);
    expect(result.current.pendingPwaConfirmation).toBeNull();
  });

  it('opdaterer en synlig bekræftelse, når en nyere request ankommer', async () => {
    const firstRequest = makeRequest('pwa-open-visible-1');
    const latestRequest = makeRequest('pwa-open-visible-2', 'nyeste.eo');
    let pendingRequest: PwaFileOpenRequest | null = null;
    let busy = true;
    const isFileOperationInProgress = () => busy;
    const { result, rerender } = renderHook(
      (args: HookArgs) => usePwaLaunchQueue(args),
      { initialProps: baseArgs({
        fileOperationInProgress: true,
        isFileOperationInProgress,
      }) },
    );
    pwaMocks.getPendingPwaFileOpenRequest.mockImplementation(() => pendingRequest);
    pendingRequest = firstRequest;

    act(() => {
      window.dispatchEvent(new Event('mineo:pwa-file-open'));
    });
    busy = false;
    rerender(baseArgs({
      fileOperationInProgress: false,
      isFileOperationInProgress,
    }));

    await waitFor(() => {
      expect(result.current.pendingPwaConfirmation).toEqual({
        requestId: firstRequest.id,
        fileName: firstRequest.fileName,
      });
    });
    pendingRequest = latestRequest;
    act(() => {
      window.dispatchEvent(new Event('mineo:pwa-file-open'));
    });

    await waitFor(() => {
      expect(result.current.pendingPwaConfirmation).toEqual({
        requestId: latestRequest.id,
        fileName: latestRequest.fileName,
      });
    });
  });

  it('rydder en ignoreret request og logger en fejl ved mislykket oprydning', async () => {
    const request = makeRequest('pwa-open-ignore-1');
    const handleHentFromPwaRequest = vi.fn<HookArgs['handleHentFromPwaRequest']>().mockResolvedValue('busy');
    pwaMocks.getPendingPwaFileOpenRequest.mockReturnValue(request);
    pwaMocks.clearPendingPwaFileOpenRequest.mockRejectedValue(new Error('storagefejl'));
    const { result } = renderHook(() => usePwaLaunchQueue(baseArgs({
      handleHentFromPwaRequest,
    })));

    await act(async () => {
      window.dispatchEvent(new Event('mineo:pwa-file-open'));
      await Promise.resolve();
      await Promise.resolve();
    });

    act(() => {
      result.current.ignoreQueuedPwaFileOpen();
    });
    await flushPromises();

    expect(pwaMocks.clearPendingPwaFileOpenRequest).toHaveBeenCalledWith(request.id);
    expect(pwaMocks.logWarning).toHaveBeenCalledWith(
      'Kunne ikke rydde ignoreret PWA-fil-request',
      expect.objectContaining({
        context: 'usePwaLaunchQueue.ignoreQueuedRequest',
        data: { errorMessage: 'storagefejl' },
      }),
    );
    expect(result.current.pendingPwaConfirmation).toBeNull();
  });

  it.each([
    ['load-result-dialog', 'pendingLoadResultOpen'],
    ['overskriv-dialog', 'pendingOverwriteApplyOpen'],
    ['nulstil-dialog', 'pendingResetConfirmationOpen'],
  ] as const)('holder en PWA-request i kø, mens %s er åben', (_label, gate) => {
    const request = makeRequest(`pwa-open-gate-${gate}`);
    const handleHentFromPwaRequest = vi.fn<HookArgs['handleHentFromPwaRequest']>().mockResolvedValue('applied');
    const { result } = renderHook(() => usePwaLaunchQueue(baseArgs({
      [gate]: true,
      handleHentFromPwaRequest,
    })));
    pwaMocks.getPendingPwaFileOpenRequest.mockReturnValue(request);

    act(() => {
      window.dispatchEvent(new Event('mineo:pwa-file-open'));
    });

    expect(handleHentFromPwaRequest).not.toHaveBeenCalled();
    expect(result.current.pendingPwaConfirmation).toBeNull();
  });

  it('viser bekræftelsen, når en køet request ikke længere er blokeret', () => {
    const request = makeRequest('pwa-open-file-busy-1');
    let busy = true;
    const isFileOperationInProgress = vi.fn(() => busy);
    const { result, rerender } = renderHook(
      (args: HookArgs) => usePwaLaunchQueue(args),
      { initialProps: baseArgs({
        fileOperationInProgress: true,
        isFileOperationInProgress,
      }) },
    );
    pwaMocks.getPendingPwaFileOpenRequest.mockReturnValue(request);

    act(() => {
      window.dispatchEvent(new Event('mineo:pwa-file-open'));
    });
    expect(result.current.pendingPwaConfirmation).toBeNull();

    busy = false;
    rerender(baseArgs({
      fileOperationInProgress: false,
      isFileOperationInProgress,
    }));

    expect(result.current.pendingPwaConfirmation).toEqual({
      requestId: request.id,
      fileName: request.fileName,
    });
  });

  it('gør intet ved bekræftelse, hvis requesten er forsvundet', () => {
    const request = makeRequest('pwa-open-confirm-missing-1');
    let busy = true;
    const isFileOperationInProgress = () => busy;
    const handleHentFromPwaRequest = vi.fn<HookArgs['handleHentFromPwaRequest']>().mockResolvedValue('applied');
    const { result, rerender } = renderHook(
      (args: HookArgs) => usePwaLaunchQueue(args),
      { initialProps: baseArgs({
        fileOperationInProgress: true,
        isFileOperationInProgress,
        handleHentFromPwaRequest,
      }) },
    );
    pwaMocks.getPendingPwaFileOpenRequest.mockReturnValue(request);

    act(() => {
      window.dispatchEvent(new Event('mineo:pwa-file-open'));
    });
    busy = false;
    rerender(baseArgs({
      fileOperationInProgress: false,
      isFileOperationInProgress,
      handleHentFromPwaRequest,
    }));
    pwaMocks.getPendingPwaFileOpenRequest.mockReturnValue(null);

    act(() => {
      result.current.confirmQueuedPwaFileOpen();
    });

    expect(handleHentFromPwaRequest).not.toHaveBeenCalled();
    expect(result.current.pendingPwaConfirmation).toBeNull();
  });

  it('rydder køen, hvis den ventende request forsvinder før promotion', () => {
    const request = makeRequest('pwa-open-vanished-1');
    let busy = true;
    const isFileOperationInProgress = () => busy;
    const { result, rerender } = renderHook(
      (args: HookArgs) => usePwaLaunchQueue(args),
      { initialProps: baseArgs({
        fileOperationInProgress: true,
        isFileOperationInProgress,
      }) },
    );
    pwaMocks.getPendingPwaFileOpenRequest.mockReturnValue(request);

    act(() => {
      window.dispatchEvent(new Event('mineo:pwa-file-open'));
    });
    pwaMocks.getPendingPwaFileOpenRequest.mockReturnValue(null);
    busy = false;
    rerender(baseArgs({
      fileOperationInProgress: false,
      isFileOperationInProgress,
    }));

    expect(result.current.pendingPwaConfirmation).toBeNull();
  });

  it('finder en request på Åbn-siden via retry-vinduet', async () => {
    vi.useFakeTimers();
    const request = makeRequest('pwa-open-retry-1');
    const handleHentFromPwaRequest = vi.fn<HookArgs['handleHentFromPwaRequest']>().mockResolvedValue('applied');
    const { result } = renderHook(() => usePwaLaunchQueue(baseArgs({
      locationPathname: '/open',
      handleHentFromPwaRequest,
    })));
    pwaMocks.getPendingPwaFileOpenRequest.mockReturnValue(request);

    await act(async () => {
      vi.advanceTimersByTime(100);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(handleHentFromPwaRequest).toHaveBeenCalledWith(request);
    expect(result.current.pendingPwaConfirmation).toBeNull();
  });

  it('sætter retry-request i kø, mens en filhandling stadig kører', () => {
    vi.useFakeTimers();
    const request = makeRequest('pwa-open-retry-busy-1');
    let busy = true;
    const isFileOperationInProgress = () => busy;
    const { result, rerender } = renderHook(
      (args: HookArgs) => usePwaLaunchQueue(args),
      { initialProps: baseArgs({
        locationPathname: '/open',
        fileOperationInProgress: true,
        isFileOperationInProgress,
      }) },
    );
    pwaMocks.getPendingPwaFileOpenRequest.mockReturnValue(request);

    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(result.current.pendingPwaConfirmation).toBeNull();

    busy = false;
    rerender(baseArgs({
      locationPathname: '/open',
      fileOperationInProgress: false,
      isFileOperationInProgress,
    }));

    expect(result.current.pendingPwaConfirmation).toEqual({
      requestId: request.id,
      fileName: request.fileName,
    });
  });

  it('stopper retry-timeren ved unmount', () => {
    vi.useFakeTimers();
    const request = makeRequest('pwa-open-unmount-1');
    const handleHentFromPwaRequest = vi.fn<HookArgs['handleHentFromPwaRequest']>().mockResolvedValue('applied');
    const { unmount } = renderHook(() => usePwaLaunchQueue(baseArgs({
      locationPathname: '/open',
      handleHentFromPwaRequest,
    })));
    pwaMocks.getPendingPwaFileOpenRequest.mockReturnValue(request);

    unmount();
    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(handleHentFromPwaRequest).not.toHaveBeenCalled();
  });
});
