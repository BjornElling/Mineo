import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { PERSISTED_DATA_VERSION } from '../../../config/persistenceVersion';
import { AppSettingsProvider } from '../../../contexts/AppSettingsContext';
import { FormPersistenceProvider } from '../../../contexts/FormPersistenceContext';
import type { LoadFileResult } from '../../../types/fileOperations';

vi.mock('../../../utils/fileLoad', () => ({
  loadFromFile: vi.fn(),
  loadFromFileHandle: vi.fn(),
}));

import MainLayout from '../../../components/layout/MainLayout';
import { loadFromFile } from '../../../utils/fileLoad';

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
          <MemoryRouter initialEntries={['/stamdata']}>
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
  });
});
