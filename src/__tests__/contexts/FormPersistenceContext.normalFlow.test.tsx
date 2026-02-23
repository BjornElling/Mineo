// @vitest-environment jsdom
import React from 'react';
import { act, render, waitFor } from '@testing-library/react';
import { PERSISTED_DATA_VERSION } from '../../config/persistenceVersion';
import { FormPersistenceProvider } from '../../contexts/FormPersistenceContext';
import { useFormPersistence } from '../../contexts/useFormPersistence';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const persistedWrapper = (data: unknown) => ({
  version: PERSISTED_DATA_VERSION,
  timestamp: Date.now(),
  data,
});

const renderProvider = () => {
  let ctx: ReturnType<typeof useFormPersistence> | null = null;
  const Capture = () => {
    const value = useFormPersistence();
    React.useEffect(() => {
      ctx = value;
    }, [value]);
    return null;
  };
  render(
    <FormPersistenceProvider>
      <Capture />
    </FormPersistenceProvider>
  );
  return { getCtx: () => ctx };
};

// ─── Initialisering fra sessionStorage ───────────────────────────────────────

describe('FormPersistenceContext – normalFlow', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('getPersistedData returnerer null ved tom sessionStorage', async () => {
    const { getCtx } = renderProvider();
    await waitFor(() => expect(getCtx()).not.toBeNull());
    expect(getCtx()!.getPersistedData('stamdata')).toBeNull();
  });

  it('henter persisted stamdata fra sessionStorage ved initialisering', async () => {
    sessionStorage.setItem(
      'mineo_stamdata',
      JSON.stringify(persistedWrapper({
        journalnr: 'J-99',
        advokat: '',
        sagsbehandler: '',
        skadelidte: 'InitTest',
        skadestype: 'Arbejdsulykke',
        skadesdato: '2024-01-01',
      }))
    );

    const { getCtx } = renderProvider();
    await waitFor(() => expect(getCtx()).not.toBeNull());

    const stamdata = getCtx()!.getPersistedData('stamdata');
    expect(stamdata?.skadelidte).toBe('InitTest');
    expect(stamdata?.journalnr).toBe('J-99');
  });

  it('gemmer og henter data via persistData', async () => {
    const { getCtx } = renderProvider();
    await waitFor(() => expect(getCtx()).not.toBeNull());

    await act(async () => {
      getCtx()!.persistData('stamdata', {
        journalnr: 'J-persist',
        advokat: '',
        sagsbehandler: '',
        skadelidte: 'PersistTest',
        skadestype: 'Arbejdsulykke',
        skadesdato: '2024-06-15',
      });
    });

    const stamdata = getCtx()!.getPersistedData('stamdata');
    expect(stamdata?.skadelidte).toBe('PersistTest');
  });

  it('gemmer til sessionStorage ved persistData', async () => {
    const { getCtx } = renderProvider();
    await waitFor(() => expect(getCtx()).not.toBeNull());

    await act(async () => {
      getCtx()!.persistData('stamdata', {
        journalnr: '',
        advokat: '',
        sagsbehandler: '',
        skadelidte: 'StorageTest',
        skadestype: undefined,
        skadesdato: undefined,
      });
    });

    const raw = sessionStorage.getItem('mineo_stamdata');
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!) as { version: string; data: Record<string, unknown> };
    expect(parsed.version).toBe(PERSISTED_DATA_VERSION);
    expect(parsed.data.skadelidte).toBe('StorageTest');
  });

  it('rydder alle sektioner ved version-mismatch i sessionStorage', async () => {
    // Gem stamdata med forkert version
    sessionStorage.setItem(
      'mineo_stamdata',
      JSON.stringify({ version: 'old-version-0.1', timestamp: Date.now(), data: { skadelidte: 'Old' } })
    );

    const { getCtx } = renderProvider();
    await waitFor(() => expect(getCtx()).not.toBeNull());

    // Ved version mismatch ryddes alt — stamdata skal returnere null
    expect(getCtx()!.getPersistedData('stamdata')).toBeNull();
    // sessionStorage-nøglen er fjernet
    await waitFor(() => {
      expect(sessionStorage.getItem('mineo_stamdata')).toBeNull();
    });
  });

  it('rydder korrupt JSON ved initialisering', async () => {
    sessionStorage.setItem('mineo_stamdata', 'ikke-json {{{');

    const { getCtx } = renderProvider();
    await waitFor(() => expect(getCtx()).not.toBeNull());

    expect(getCtx()!.getPersistedData('stamdata')).toBeNull();
  });

  it('hasAnyData returnerer false ved tom cache', async () => {
    const { getCtx } = renderProvider();
    await waitFor(() => expect(getCtx()).not.toBeNull());
    expect(getCtx()!.hasAnyData()).toBe(false);
  });

  it('hasAnyData returnerer true efter persistData', async () => {
    const { getCtx } = renderProvider();
    await waitFor(() => expect(getCtx()).not.toBeNull());

    await act(async () => {
      getCtx()!.persistData('stamdata', {
        journalnr: '',
        advokat: '',
        sagsbehandler: '',
        skadelidte: 'HasData',
        skadestype: undefined,
        skadesdato: undefined,
      });
    });

    expect(getCtx()!.hasAnyData()).toBe(true);
  });
});
