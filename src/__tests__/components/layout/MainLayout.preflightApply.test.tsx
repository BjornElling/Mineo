import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { AppSettingsProvider } from '../../../contexts/AppSettingsContext';
import { FormPersistenceProvider, useFormPersistence } from '../../../contexts/FormPersistenceContext';
import type { LoadFileResult } from '../../../types/fileOperations';

vi.mock('../../../utils/fileLoad', () => ({
  loadFromFile: vi.fn(),
  loadFromFileHandle: vi.fn(),
}));

import MainLayout from '../../../components/layout/MainLayout';
import { loadFromFile } from '../../../utils/fileLoad';

const stampStamdata = (skadelidte: string) => ({
  journalnr: '',
  advokat: '',
  sagsbehandler: '',
  skadelidte,
  skadestype: '',
  skadesdato: '',
});

describe('MainLayout (preflight apply)', () => {
  it('applies only schema-valid sections on "Indlæs trods fejl" and clears runtime field errors', async () => {
    const loadFromFileMock = vi.mocked(loadFromFile);
    loadFromFileMock.mockResolvedValue({
      success: true,
      source: 'manual',
      filename: 'broken.eo',
      snapshot: { stamdata: stampStamdata('Y') },
      preflightWarning: {
        expectedCount: 10,
        loadedCount: 9,
        failedCount: 1,
        issues: [{ path: 'satser', reason: 'Sektionen kunne ikke indlæses (Forkert format) og blev ikke indlæst' }],
      },
    } satisfies LoadFileResult);

    let ctx: ReturnType<typeof useFormPersistence> | null = null;

    const Probe = () => {
      const value = useFormPersistence();
      React.useEffect(() => {
        ctx = value;
      }, [value]);
      return <div data-testid="epoch">{String(value.authoritativeSnapshotEpoch)}</div>;
    };

    render(
      <AppSettingsProvider>
        <FormPersistenceProvider>
          <MemoryRouter initialEntries={['/stamdata']}>
            <Probe />
            <MainLayout>
              <div />
            </MainLayout>
          </MemoryRouter>
        </FormPersistenceProvider>
      </AppSettingsProvider>
    );

    await waitFor(() => {
      expect(ctx).not.toBeNull();
    });

    const initialEpoch = Number(screen.getByTestId('epoch').textContent ?? '0');

    act(() => {
      ctx!.setFieldError('stamdata', 'skadelidte', 'schema', { message: 'Testfejl', severity: 'error' });
      ctx!.setFieldError('satser', 'aargang', 'input', { message: 'Testfejl 2', severity: 'error' });
    });

    expect(ctx!.getFieldError('stamdata', 'skadelidte')?.message).toBe('Testfejl');
    expect(ctx!.getFieldError('satser', 'aargang')?.message).toBe('Testfejl 2');

    await act(async () => {
      screen.getByText('Hent').click();
    });

    await screen.findByText('Advarsel før indlæsning');

    await act(async () => {
      screen.getByText('Indlæs trods fejl').click();
    });

    await waitFor(() => {
      const nextEpoch = Number(screen.getByTestId('epoch').textContent ?? '0');
      expect(nextEpoch).toBe(initialEpoch + 1);
    });

    expect(ctx!.getFieldError('stamdata', 'skadelidte')).toBeUndefined();
    expect(ctx!.getFieldError('satser', 'aargang')).toBeUndefined();
    expect(Object.keys(ctx!.getFieldErrorsBySource('stamdata')).length).toBe(0);
    expect(Object.keys(ctx!.getFieldErrorsBySource('satser')).length).toBe(0);

    const stored = sessionStorage.getItem('mineo_stamdata');
    expect(stored).toContain('Y');
    expect(sessionStorage.getItem('mineo_satser')).toBeNull();
  });
});
