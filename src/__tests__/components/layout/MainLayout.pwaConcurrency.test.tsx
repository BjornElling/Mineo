// @vitest-environment jsdom
import { hydrateSlimInputStoreForTest } from '../../../test/actSafeInputStore';
import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';

import { AppSettingsProvider } from '../../../contexts/AppSettingsContext';
import {
  ProductionInputRuntimeProvider,
  bootstrapProductionInputRuntime,
  createProductionInputRuntimeBinding,
} from '../../../inputCore/react';
import { slimInputStore } from '../../../inputCore/runtime/slimInputStore';
import { getProductionInputCatalog } from '../../../inputCore/catalog/productionCatalog';
import type { LoadFileResult } from '../../../types/fileOperations';

let pendingPwaRequest: unknown = null;

vi.mock('../../../utils/pwaLaunchQueue', () => ({
  Mineo_PWA_FILE_OPEN_EVENT: 'mineo:pwa-file-open',
  clearPendingPwaFileOpenRequest: vi.fn(async () => {
    pendingPwaRequest = null;
  }),
  getPendingPwaFileOpenRequest: () => pendingPwaRequest,
  markPendingPwaFileOpenRequestHandled: vi.fn(async (requestId: string) => {
    if ((pendingPwaRequest as { id?: string } | null)?.id === requestId) {
      pendingPwaRequest = null;
    }
  }),
}));

vi.mock('../../../utils/fileLoad', () => ({
  loadFromFile: vi.fn(),
  loadFromFileHandle: vi.fn(),
}));

vi.mock('../../../utils/fileHelpers', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../../utils/fileHelpers')>();
  return {
    ...original,
    resolveDefaultDirectoryHandle: vi.fn(async () => null),
  };
});

vi.mock('../../../utils/fileHandleStorage', () => ({
  deleteFileHandleFromIndexedDB: vi.fn(async () => true),
  saveFileHandleToIndexedDB: vi.fn(async () => true),
  deletePendingPwaOpenRequestFromIndexedDB: vi.fn(async () => true),
  loadPendingPwaOpenRequestFromIndexedDB: vi.fn(async () => null),
  savePendingPwaOpenRequestToIndexedDB: vi.fn(async () => true),
}));

import MainLayout from '../../../components/layout/MainLayout';
import { loadFromFileHandle } from '../../../utils/fileLoad';
import { dispatchPwaFileOpen } from './mainLayoutActionTestUtils';

// PWA-samtidighed drives via DOM-events; mount-wrapperen er testens eneste særegne del
// fra legacy FormPersistence til den ene produktions-runtime. Ingen af disse tests hævder mod field-error-lageret.
const catalog = getProductionInputCatalog();
bootstrapProductionInputRuntime();

const emptyInput = () => catalog.validateSettledInput({
  sections: {
    stamdata: null, satser: null, aarsloen: null, faellesAarsloen: null,
    renteberegning: null, varigemen: null, forsoergertab: null,
    erstatningsopgoerelse: null, erhvervsevnetab: null,
  },
  rejectedInputs: {},
});

describe('MainLayout (PWA concurrency)', () => {
  const RouteProbe = () => {
    const location = useLocation();
    return <div data-testid="pathname">{location.pathname}</div>;
  };

  beforeEach(() => {
    pendingPwaRequest = null;
    window.sessionStorage.clear();
    vi.clearAllMocks();
    vi.useRealTimers();
    hydrateSlimInputStoreForTest(slimInputStore, emptyInput());
  });

  afterEach(() => {
    hydrateSlimInputStoreForTest(slimInputStore, emptyInput());
  });

  it('køer seneste PWA-fil under preflight og kræver bekræftelse før indlæsning', async () => {
    const loadFromFileHandleMock = vi.mocked(loadFromFileHandle);

    loadFromFileHandleMock
      .mockResolvedValueOnce({
        status: 'preflight',
        source: 'pwa',
        requestId: 'pwa-open-1',
        filename: 'A.eo',
        snapshot: {},
        preflightWarning: {
          expectedCount: 10,
          loadedCount: 9,
          failedCount: 1,
          issues: [{ kind: 'sectionDropped', path: 'satser', reason: 'Sektionen findes ikke i denne version og blev ikke indlæst' }],
        },
      } satisfies LoadFileResult)
      .mockResolvedValueOnce({
        status: 'loaded',
        source: 'pwa',
        requestId: 'pwa-open-2',
        filename: 'B.eo',
        snapshot: { stamdata: { skadelidte: 'B' } },
      } satisfies LoadFileResult);

    render(
      <AppSettingsProvider>
        <ProductionInputRuntimeProvider binding={createProductionInputRuntimeBinding()}>
          <MemoryRouter initialEntries={['/open']}>
            <RouteProbe />
            <MainLayout>
              <div />
            </MainLayout>
          </MemoryRouter>
        </ProductionInputRuntimeProvider>
      </AppSettingsProvider>
    );

    pendingPwaRequest = {
      id: 'pwa-open-1',
      createdAtEpochMs: Date.now(),
      targetUrl: '/open',
      fileHandle: {} as FileSystemFileHandle,
      fileName: 'A.eo',
      ignoredFileCount: 0,
    };

    await dispatchPwaFileOpen();

    await screen.findByText('Nogle felter blev sat til standardværdier');

    pendingPwaRequest = {
      id: 'pwa-open-2',
      createdAtEpochMs: Date.now(),
      targetUrl: '/open',
      fileHandle: {} as FileSystemFileHandle,
      fileName: 'B.eo',
      ignoredFileCount: 0,
    };

    await dispatchPwaFileOpen();

    expect(loadFromFileHandleMock).toHaveBeenCalledTimes(1);
    // Preflight-dialogen beholder sine tre fastlagte valg (persistence-contract §preflight).
    fireEvent.click(screen.getByRole('button', { name: 'Stop og gør intet' }));

    await screen.findByText('En anden fil er klar til at blive indlæst');
    expect(screen.getByText(/Filen “B\.eo”/)).toBeInTheDocument();
    expect(loadFromFileHandleMock).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Indlæs fil' }));
    await waitFor(() => {
      expect(loadFromFileHandleMock).toHaveBeenCalledTimes(2);
    });
    expect(loadFromFileHandleMock.mock.calls[1]?.[1]).toEqual(
      expect.objectContaining({ requestId: 'pwa-open-2' })
    );
  });

  it('frigiver ikke en PWA-kø før den aktive fil-I/O er afsluttet', async () => {
    const loadFromFileHandleMock = vi.mocked(loadFromFileHandle);
    let resolveFirstLoad: ((result: LoadFileResult) => void) | undefined;
    loadFromFileHandleMock.mockImplementationOnce(() => new Promise((resolve) => {
      resolveFirstLoad = resolve;
    }));

    render(
      <AppSettingsProvider>
        <ProductionInputRuntimeProvider binding={createProductionInputRuntimeBinding()}>
          <MemoryRouter initialEntries={['/open']}>
            <RouteProbe />
            <MainLayout><div /></MainLayout>
          </MemoryRouter>
        </ProductionInputRuntimeProvider>
      </AppSettingsProvider>
    );

    pendingPwaRequest = {
      id: 'pwa-io-1',
      createdAtEpochMs: Date.now(),
      targetUrl: '/open',
      fileHandle: {} as FileSystemFileHandle,
      fileName: 'I gang.eo',
      ignoredFileCount: 0,
    };
    await dispatchPwaFileOpen();
    expect(loadFromFileHandleMock).toHaveBeenCalledTimes(1);

    pendingPwaRequest = {
      id: 'pwa-io-2',
      createdAtEpochMs: Date.now(),
      targetUrl: '/open',
      fileHandle: {} as FileSystemFileHandle,
      fileName: 'Seneste.eo',
      ignoredFileCount: 0,
    };
    await dispatchPwaFileOpen();
    expect(loadFromFileHandleMock).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('En anden fil er klar til at blive indlæst')).not.toBeInTheDocument();

    await act(async () => {
      resolveFirstLoad?.({
        status: 'loaded',
        source: 'pwa',
        requestId: 'pwa-io-1',
        filename: 'I gang.eo',
        snapshot: { stamdata: { skadelidte: 'A' } },
      });
    });

    await screen.findByText('En anden fil er klar til at blive indlæst');
    expect(screen.getByText(/Filen “Seneste\.eo”/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Annuller' }));
    await waitFor(() => {
      expect(pendingPwaRequest).toBeNull();
    });
    expect(loadFromFileHandleMock).toHaveBeenCalledTimes(1);
  });

  it('recovers a pending PWA request on /open even if the initial event was missed during startup', async () => {
    vi.useFakeTimers();

    const loadFromFileHandleMock = vi.mocked(loadFromFileHandle);
    loadFromFileHandleMock.mockResolvedValue({
      status: 'loaded',
      source: 'pwa',
      requestId: 'pwa-open-late',
      filename: 'late.eo',
      snapshot: { stamdata: { skadelidte: 'Y' } },
    } satisfies LoadFileResult);

    render(
      <AppSettingsProvider>
        <ProductionInputRuntimeProvider binding={createProductionInputRuntimeBinding()}>
          <MemoryRouter initialEntries={['/open']}>
            <RouteProbe />
            <MainLayout>
              <div />
            </MainLayout>
          </MemoryRouter>
        </ProductionInputRuntimeProvider>
      </AppSettingsProvider>
    );

    pendingPwaRequest = {
      id: 'pwa-open-late',
      createdAtEpochMs: Date.now(),
      targetUrl: '/open',
      fileHandle: {} as FileSystemFileHandle,
      fileName: 'late.eo',
      ignoredFileCount: 0,
    };

    await act(async () => {
      await vi.advanceTimersByTimeAsync(150);
      // PWA-køen registrerer udfaldet før den frigiver sin in-flight-lås; afvent begge
      // promise-led, så navigationen fra det gennemførte apply er observerbar.
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(loadFromFileHandleMock).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ requestId: 'pwa-open-late' })
    );
    vi.useRealTimers();
    await waitFor(() => {
      expect(screen.getByTestId('pathname')).toHaveTextContent('/stamdata');
    });
  });

  it('keeps the same pending PWA request available for retry if the first load attempt fails', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const loadFromFileHandleMock = vi.mocked(loadFromFileHandle);
      loadFromFileHandleMock
        .mockRejectedValueOnce(new Error('Midlertidig fejl'))
        .mockResolvedValueOnce({
          status: 'loaded',
          source: 'pwa',
          requestId: 'pwa-open-retry',
          filename: 'retry.eo',
          snapshot: { stamdata: { skadelidte: 'Retry' } },
        } satisfies LoadFileResult);

      render(
        <AppSettingsProvider>
          <ProductionInputRuntimeProvider binding={createProductionInputRuntimeBinding()}>
            <MemoryRouter initialEntries={['/open']}>
              <RouteProbe />
              <MainLayout>
                <div />
              </MainLayout>
            </MemoryRouter>
          </ProductionInputRuntimeProvider>
        </AppSettingsProvider>
      );

      pendingPwaRequest = {
        id: 'pwa-open-retry',
        createdAtEpochMs: Date.now(),
        targetUrl: '/open',
        fileHandle: {} as FileSystemFileHandle,
        fileName: 'retry.eo',
        ignoredFileCount: 0,
      };

      await dispatchPwaFileOpen();

      // Vent på at FØRSTE forsøg er fuldt fejlet (fejlen logget), ikke kun at loadFromFileHandle er
      // kaldt. `isPwaLoadInProgressRef` nulstilles først i load-promisens `.finally`, EFTER rejection
      // er behandlet (console.error). Dispatch'es det andet event før da, ser in-flight-guarden
      // load'et som stadig i gang og dropper retry'et → flaky fejl under parallel CI-belastning.
      // Fejl-loggen er den observerbare markør for at guarden er (ved at blive) nulstillet.
      await waitFor(() => {
        expect(loadFromFileHandleMock).toHaveBeenCalledTimes(1);
        expect(consoleErrorSpy).toHaveBeenCalledWith('Hent (PWA) fejlede:', expect.any(Error));
      });
      expect(screen.getByTestId('pathname')).toHaveTextContent('/open');

      await dispatchPwaFileOpen();

      await waitFor(() => {
        expect(loadFromFileHandleMock).toHaveBeenCalledTimes(2);
      });
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });
});
