// @vitest-environment jsdom
import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';

import { PERSISTED_DATA_VERSION } from '../../../config/persistenceVersion';
import { AppSettingsProvider } from '../../../contexts/AppSettingsContext';
import { FormPersistenceProvider, initializePersistenceRuntime } from '../../../contexts/FormPersistenceContext';
import { clearResolvedFieldErrorsCache } from '../../../hooks/useFormPersistenceSelectors';
import { formPersistenceStore } from '../../../stores/formPersistenceStore';
import type { LoadFileResult } from '../../../types/fileOperations';

vi.mock('../../../utils/fileLoad', () => ({
  loadFromFile: vi.fn(),
  loadFromFileHandle: vi.fn(),
}));

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

import MainLayout from '../../../components/layout/MainLayout';
import { loadFromFile, loadFromFileHandle } from '../../../utils/fileLoad';
import {
  clickMainLayoutAction,
  dispatchPwaFileOpen,
  flushMainLayoutAsyncAction,
} from './mainLayoutActionTestUtils';

const persistedWrapper = (data: unknown) => ({
  version: PERSISTED_DATA_VERSION,
  timestamp: Date.now(),
  data,
});

const stampStamdata = (skadelidte: string) => ({
  journalnr: '',
  advokat: '',
  sagsbehandler: '',
  skadelidte,
  skadestype: undefined,
  skadedato: undefined,
});

const stampSatser = (aargang: number) => ({
  aargang,
});

describe('MainLayout (overwrite gating)', () => {
  const RouteProbe = () => {
    const location = useLocation();
    return <div data-testid="pathname">{location.pathname}</div>;
  };

  beforeEach(() => {
    pendingPwaRequest = null;
    vi.clearAllMocks();
    sessionStorage.clear();
    clearResolvedFieldErrorsCache();
    formPersistenceStore.getState().clearAll({
      hydrated: true,
      schemaFingerprint: PERSISTED_DATA_VERSION,
      lastCommittedAt: Date.now(),
    });
    formPersistenceStore.getState().clearAllFieldErrors();
    formPersistenceStore.getState().__setMetaUnsafe({ hydrated: false, lastCommittedAt: undefined });
  });

  it('navigates to Stamdata after a successful manual load without overwrite dialog', async () => {
    sessionStorage.clear();

    const loadFromFileMock = vi.mocked(loadFromFile);
    loadFromFileMock.mockResolvedValue({
      success: true,
      source: 'manual',
      filename: 'clean.eo',
      snapshot: { stamdata: stampStamdata('Y') },
    } satisfies LoadFileResult);

    render(
      <AppSettingsProvider>
        <FormPersistenceProvider runtime={initializePersistenceRuntime()}>
          <MemoryRouter initialEntries={['/open']}>
            <RouteProbe />
            <MainLayout>
              <div />
            </MainLayout>
          </MemoryRouter>
        </FormPersistenceProvider>
      </AppSettingsProvider>
    );

    await clickMainLayoutAction('Hent');

    await waitFor(() => {
      expect(screen.getByTestId('pathname')).toHaveTextContent('/stamdata');
    });
    expect(sessionStorage.getItem('mineo_stamdata')).toContain('Y');
  });

  it('shows overwrite dialog when data exists; does not mutate until confirm', async () => {
    sessionStorage.clear();
    sessionStorage.setItem('mineo_stamdata', JSON.stringify(persistedWrapper(stampStamdata('X'))));
    sessionStorage.setItem('mineo_satser', JSON.stringify(persistedWrapper(stampSatser(2020))));

    const loadFromFileMock = vi.mocked(loadFromFile);
    loadFromFileMock.mockResolvedValue({
      success: true,
      source: 'manual',
      filename: 'clean.eo',
      snapshot: { stamdata: stampStamdata('Y'), satser: stampSatser(2021) },
    } satisfies LoadFileResult);

    render(
      <AppSettingsProvider>
        <FormPersistenceProvider runtime={initializePersistenceRuntime()}>
          <MemoryRouter initialEntries={['/open']}>
            <RouteProbe />
            <MainLayout>
              <div />
            </MainLayout>
          </MemoryRouter>
        </FormPersistenceProvider>
      </AppSettingsProvider>
    );

    await clickMainLayoutAction('Hent');

    await screen.findByText('Overskriv eksisterende data?');

    expect(sessionStorage.getItem('mineo_stamdata')).toContain('X');
    expect(sessionStorage.getItem('mineo_satser')).toContain('2020');

    await act(async () => {
      screen.getByText('Stop og gør intet').click();
    });

    await waitFor(() => {
      expect(screen.queryByText('Overskriv eksisterende data?')).toBeNull();
    });
    expect(sessionStorage.getItem('mineo_stamdata')).toContain('X');
    expect(sessionStorage.getItem('mineo_satser')).toContain('2020');

    await clickMainLayoutAction('Hent');
    await screen.findByText('Overskriv eksisterende data?');

    await clickMainLayoutAction('Overskriv');

    expect(sessionStorage.getItem('mineo_stamdata')).toContain('Y');
    expect(sessionStorage.getItem('mineo_satser')).toContain('2021');
    expect(screen.getByTestId('pathname')).toHaveTextContent('/stamdata');
  });

  it('shows the same overwrite dialog for PWA-opened files and does not mutate until confirm', async () => {
    sessionStorage.clear();
    sessionStorage.setItem('mineo_stamdata', JSON.stringify(persistedWrapper(stampStamdata('X'))));
    sessionStorage.setItem('mineo_satser', JSON.stringify(persistedWrapper(stampSatser(2020))));

    const loadFromFileHandleMock = vi.mocked(loadFromFileHandle);
    let resolvePwaLoad: ((result: LoadFileResult) => void) | null = null;
    const pwaLoad = new Promise<LoadFileResult>((resolve) => {
      resolvePwaLoad = resolve;
    });
    loadFromFileHandleMock.mockReturnValueOnce(pwaLoad);
    const pwaLoadResult = {
      success: true,
      source: 'pwa',
      requestId: 'pwa-open-1',
      filename: 'clean.eo',
      snapshot: { stamdata: stampStamdata('Y'), satser: stampSatser(2021) },
    } satisfies LoadFileResult;

    pendingPwaRequest = {
      id: 'pwa-open-1',
      createdAtEpochMs: Date.now(),
      targetUrl: '/open',
      fileHandle: {} as FileSystemFileHandle,
      fileName: 'clean.eo',
      ignoredFileCount: 0,
    };

    render(
      <AppSettingsProvider>
        <FormPersistenceProvider runtime={initializePersistenceRuntime()}>
          <MemoryRouter initialEntries={['/mineo']}>
            <RouteProbe />
            <MainLayout>
              <div />
            </MainLayout>
          </MemoryRouter>
        </FormPersistenceProvider>
      </AppSettingsProvider>
    );

    await waitFor(() => {
      expect(loadFromFileHandleMock).toHaveBeenCalledTimes(1);
    });
    await act(async () => {
      resolvePwaLoad?.(pwaLoadResult);
      await pwaLoad;
      for (let attempt = 0; attempt < 5 && !document.body.textContent?.includes('Overskriv eksisterende data?'); attempt += 1) {
        await flushMainLayoutAsyncAction();
      }
    });

    expect(screen.getByText('Overskriv eksisterende data?')).toBeInTheDocument();

    expect(sessionStorage.getItem('mineo_stamdata')).toContain('X');
    expect(sessionStorage.getItem('mineo_satser')).toContain('2020');

    await clickMainLayoutAction('Stop og gør intet');

    await waitFor(() => {
      expect(screen.queryByText('Overskriv eksisterende data?')).toBeNull();
    });
    expect(sessionStorage.getItem('mineo_stamdata')).toContain('X');
    expect(sessionStorage.getItem('mineo_satser')).toContain('2020');

    let resolveSecondPwaLoad: ((result: LoadFileResult) => void) | null = null;
    const secondPwaLoad = new Promise<LoadFileResult>((resolve) => {
      resolveSecondPwaLoad = resolve;
    });
    loadFromFileHandleMock.mockReturnValueOnce(secondPwaLoad);
    const secondPwaLoadResult = {
      success: true,
      source: 'pwa',
      requestId: 'pwa-open-2',
      filename: 'clean.eo',
      snapshot: { stamdata: stampStamdata('Y'), satser: stampSatser(2021) },
    } satisfies LoadFileResult;
    pendingPwaRequest = {
      id: 'pwa-open-2',
      createdAtEpochMs: Date.now(),
      targetUrl: '/open',
      fileHandle: {} as FileSystemFileHandle,
      fileName: 'clean.eo',
      ignoredFileCount: 0,
    };

    await dispatchPwaFileOpen();
    await waitFor(() => {
      expect(loadFromFileHandleMock).toHaveBeenCalledTimes(2);
    });
    await act(async () => {
      resolveSecondPwaLoad?.(secondPwaLoadResult);
      await secondPwaLoad;
      for (let attempt = 0; attempt < 5 && !document.body.textContent?.includes('Overskriv eksisterende data?'); attempt += 1) {
        await flushMainLayoutAsyncAction();
      }
    });

    expect(screen.getByText('Overskriv eksisterende data?')).toBeInTheDocument();

    await clickMainLayoutAction('Overskriv');

    expect(sessionStorage.getItem('mineo_stamdata')).toContain('Y');
    expect(sessionStorage.getItem('mineo_satser')).toContain('2021');
    expect(screen.getByTestId('pathname')).toHaveTextContent('/stamdata');
  });

});
