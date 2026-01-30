import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { AppSettingsProvider } from '../../../contexts/AppSettingsContext';
import { FormPersistenceProvider } from '../../../contexts/FormPersistenceContext';
import type { LoadFileResult } from '../../../types/fileOperations';

let pendingPwaRequest: unknown = null;

vi.mock('../../../utils/pwaLaunchQueue', () => ({
  MINEO_PWA_FILE_OPEN_EVENT: 'mineo:pwa-file-open',
  takeNextPwaFileOpenRequest: () => {
    const next = pendingPwaRequest;
    pendingPwaRequest = null;
    return next;
  },
}));

vi.mock('../../../utils/fileLoad', () => ({
  loadFromFile: vi.fn(),
  loadFromFileHandle: vi.fn(),
}));

import MainLayout from '../../../components/layout/MainLayout';
import { loadFromFileHandle } from '../../../utils/fileLoad';

describe('MainLayout (PWA concurrency)', () => {
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
    window.dispatchEvent(new CustomEvent('mineo:pwa-file-open'));

    await screen.findByText('Advarsel før indlæsning');

    pendingPwaRequest = {
      id: 'pwa-open-2',
      createdAtEpochMs: Date.now(),
      targetUrl: '/open',
      fileHandle: {} as FileSystemFileHandle,
      fileName: 'B.eo',
      ignoredFileCount: 0,
    };
    window.dispatchEvent(new CustomEvent('mineo:pwa-file-open'));

    await screen.findByText('Ny fil blev forsøgt åbnet – prøv igen når du er færdig');

    await waitFor(() => {
      expect(loadFromFileHandleMock).toHaveBeenCalledTimes(1);
    });

    const calls = loadFromFileHandleMock.mock.calls;
    expect(calls[0]?.[1]).toEqual({ requestId: 'pwa-open-1' });
    expect(calls.some((c) => c[1]?.requestId === 'pwa-open-2')).toBe(false);
  });
});
