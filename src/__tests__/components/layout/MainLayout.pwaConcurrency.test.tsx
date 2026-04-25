import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';

import { AppSettingsProvider } from '../../../contexts/AppSettingsContext';
import { FormPersistenceProvider } from '../../../contexts/FormPersistenceContext';
import type { LoadFileResult } from '../../../types/fileOperations';

let pendingPwaRequest: unknown = null;

vi.mock('../../../utils/pwaLaunchQueue', () => ({
  MinEO_PWA_FILE_OPEN_EVENT: 'mineo:pwa-file-open',
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

import MainLayout from '../../../components/layout/MainLayout';
import { loadFromFileHandle } from '../../../utils/fileLoad';

describe('MainLayout (PWA concurrency)', () => {
  const RouteProbe = () => {
    const location = useLocation();
    return <div data-testid="pathname">{location.pathname}</div>;
  };

  beforeEach(() => {
    pendingPwaRequest = null;
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('drops new PWA file-opens while preflight dialog is open (policy A)', async () => {
    const loadFromFileHandleMock = vi.mocked(loadFromFileHandle);

    loadFromFileHandleMock.mockResolvedValue({
      success: true,
      source: 'pwa',
      requestId: 'pwa-open-1',
      filename: 'A.eo',
      snapshot: {},
      preflightWarning: {
        expectedCount: 10,
        loadedCount: 9,
        failedCount: 1,
        issues: [{ path: 'satser', reason: 'Sektionen findes ikke i denne version og blev ikke indlæst' }],
      },
    } satisfies LoadFileResult);

    render(
      <AppSettingsProvider>
        <FormPersistenceProvider>
          <MemoryRouter initialEntries={['/open']}>
            <RouteProbe />
            <MainLayout>
              <div />
            </MainLayout>
          </MemoryRouter>
        </FormPersistenceProvider>
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

    // dispatchEvent trigger asynkrone state-ændringer og skal wrappes i act()
    await act(async () => {
      window.dispatchEvent(new CustomEvent('mineo:pwa-file-open'));
    });

    await screen.findByText('Advarsel før indlæsning');

    pendingPwaRequest = {
      id: 'pwa-open-2',
      createdAtEpochMs: Date.now(),
      targetUrl: '/open',
      fileHandle: {} as FileSystemFileHandle,
      fileName: 'B.eo',
      ignoredFileCount: 0,
    };

    await act(async () => {
      window.dispatchEvent(new CustomEvent('mineo:pwa-file-open'));
    });

    await screen.findByText('Ny fil blev forsøgt åbnet – prøv igen når du er færdig');

    await waitFor(() => {
      expect(loadFromFileHandleMock.mock.calls.length).toBeGreaterThanOrEqual(1);
    });

    const calls = loadFromFileHandleMock.mock.calls;
    expect(calls[0]?.[1]).toEqual(expect.objectContaining({ requestId: 'pwa-open-1' }));
    expect(calls.some((c) => c[1]?.requestId === 'pwa-open-2')).toBe(false);
  });

  it('recovers a pending PWA request on /open even if the initial event was missed during startup', async () => {
    vi.useFakeTimers();

    const loadFromFileHandleMock = vi.mocked(loadFromFileHandle);
    loadFromFileHandleMock.mockResolvedValue({
      success: true,
      source: 'pwa',
      requestId: 'pwa-open-late',
      filename: 'late.eo',
      snapshot: { stamdata: { skadelidte: 'Y' } },
    } satisfies LoadFileResult);

    render(
      <AppSettingsProvider>
        <FormPersistenceProvider>
          <MemoryRouter initialEntries={['/open']}>
            <RouteProbe />
            <MainLayout>
              <div />
            </MainLayout>
          </MemoryRouter>
        </FormPersistenceProvider>
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
    });

    expect(loadFromFileHandleMock).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ requestId: 'pwa-open-late' })
    );
    expect(screen.getByTestId('pathname')).toHaveTextContent('/stamdata');
  });

  it('keeps the same pending PWA request available for retry if the first load attempt fails', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const loadFromFileHandleMock = vi.mocked(loadFromFileHandle);
      loadFromFileHandleMock
        .mockRejectedValueOnce(new Error('Midlertidig fejl'))
        .mockResolvedValueOnce({
          success: true,
          source: 'pwa',
          requestId: 'pwa-open-retry',
          filename: 'retry.eo',
          snapshot: { stamdata: { skadelidte: 'Retry' } },
        } satisfies LoadFileResult);

      render(
        <AppSettingsProvider>
          <FormPersistenceProvider>
            <MemoryRouter initialEntries={['/open']}>
              <RouteProbe />
              <MainLayout>
                <div />
              </MainLayout>
            </MemoryRouter>
          </FormPersistenceProvider>
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

      await act(async () => {
        window.dispatchEvent(new CustomEvent('mineo:pwa-file-open'));
      });

      await waitFor(() => {
        expect(loadFromFileHandleMock).toHaveBeenCalledTimes(1);
      });
      expect(screen.getByTestId('pathname')).toHaveTextContent('/open');

      await act(async () => {
        window.dispatchEvent(new CustomEvent('mineo:pwa-file-open'));
      });

      await waitFor(() => {
        expect(loadFromFileHandleMock).toHaveBeenCalledTimes(2);
      });
      expect(consoleErrorSpy).toHaveBeenCalledWith('Hent (PWA) fejlede:', expect.any(Error));
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });
});
