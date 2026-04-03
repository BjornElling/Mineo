import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';

import { PERSISTED_DATA_VERSION } from '../../../config/persistenceVersion';
import { AppSettingsProvider } from '../../../contexts/AppSettingsContext';
import { FormPersistenceProvider } from '../../../contexts/FormPersistenceContext';
import { clearResolvedFieldErrorsCache } from '../../../hooks/useFormPersistenceSelectors';
import { formPersistenceStore } from '../../../stores/formPersistenceStore';
import type { LoadFileResult } from '../../../types/fileOperations';

vi.mock('../../../utils/fileLoad', () => ({
  loadFromFile: vi.fn(),
  loadFromFileHandle: vi.fn(),
}));

let pendingPwaRequest: unknown = null;

vi.mock('../../../utils/pwaLaunchQueue', () => ({
  MINEO_PWA_FILE_OPEN_EVENT: 'mineo:pwa-file-open',
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
  skadestype: '',
  skadesdato: '',
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

    await act(async () => {
      screen.getByText('Hent').click();
    });

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

    await act(async () => {
      screen.getByText('Hent').click();
    });

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

    await act(async () => {
      screen.getByText('Hent').click();
    });
    await screen.findByText('Overskriv eksisterende data?');

    await act(async () => {
      screen.getByText('Overskriv').click();
    });

    expect(sessionStorage.getItem('mineo_stamdata')).toContain('Y');
    expect(sessionStorage.getItem('mineo_satser')).toContain('2021');
    expect(screen.getByTestId('pathname')).toHaveTextContent('/stamdata');
  });

  it('shows the same overwrite dialog for PWA-opened files and does not mutate until confirm', async () => {
    sessionStorage.clear();
    sessionStorage.setItem('mineo_stamdata', JSON.stringify(persistedWrapper(stampStamdata('X'))));
    sessionStorage.setItem('mineo_satser', JSON.stringify(persistedWrapper(stampSatser(2020))));

    const loadFromFileHandleMock = vi.mocked(loadFromFileHandle);
    loadFromFileHandleMock.mockResolvedValue({
      success: true,
      source: 'pwa',
      requestId: 'pwa-open-1',
      filename: 'clean.eo',
      snapshot: { stamdata: stampStamdata('Y'), satser: stampSatser(2021) },
    } satisfies LoadFileResult);

    render(
      <AppSettingsProvider>
        <FormPersistenceProvider>
          <MemoryRouter initialEntries={['/mineo']}>
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
      fileName: 'clean.eo',
      ignoredFileCount: 0,
    };

    await act(async () => {
      window.dispatchEvent(new CustomEvent('mineo:pwa-file-open'));
    });

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

    pendingPwaRequest = {
      id: 'pwa-open-2',
      createdAtEpochMs: Date.now(),
      targetUrl: '/open',
      fileHandle: {} as FileSystemFileHandle,
      fileName: 'clean.eo',
      ignoredFileCount: 0,
    };

    loadFromFileHandleMock.mockResolvedValueOnce({
      success: true,
      source: 'pwa',
      requestId: 'pwa-open-2',
      filename: 'clean.eo',
      snapshot: { stamdata: stampStamdata('Y'), satser: stampSatser(2021) },
    } satisfies LoadFileResult);

    await act(async () => {
      window.dispatchEvent(new CustomEvent('mineo:pwa-file-open'));
    });

    await screen.findByText('Overskriv eksisterende data?');

    await act(async () => {
      screen.getByText('Overskriv').click();
    });

    expect(sessionStorage.getItem('mineo_stamdata')).toContain('Y');
    expect(sessionStorage.getItem('mineo_satser')).toContain('2021');
    expect(screen.getByTestId('pathname')).toHaveTextContent('/stamdata');
  });

});
