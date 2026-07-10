// @vitest-environment jsdom
import React from 'react';
import { act, render, waitFor } from '@testing-library/react';
import { PERSISTED_DATA_VERSION } from '../../config/persistenceVersion';
import { FormPersistenceProvider, initializePersistenceRuntime } from '../../contexts/FormPersistenceContext';
import { useFormPersistence } from '../../contexts/useFormPersistence';
import { formPersistenceStore } from '../../stores/formPersistenceStore';
import { undoRedoStore } from '../../stores/undoRedoStore';
import { toISODateString } from '../../types/branded';

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
    <FormPersistenceProvider runtime={initializePersistenceRuntime()}>
      <Capture />
    </FormPersistenceProvider>
  );
  return { getCtx: () => ctx };
};

// ─── Initialisering fra sessionStorage ───────────────────────────────────────

describe('FormPersistenceContext – normalFlow', () => {
  beforeEach(() => {
    sessionStorage.clear();
    undoRedoStore.getState().clear();
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
        skadedato: toISODateString('2024-01-01'),
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
        skadedato: toISODateString('2024-06-15'),
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
        skadedato: undefined,
      });
    });

    const raw = sessionStorage.getItem('mineo_stamdata');
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!) as { version: string; data: Record<string, unknown> };
    expect(parsed.version).toBe(PERSISTED_DATA_VERSION);
    expect(parsed.data.skadelidte).toBe('StorageTest');
  });

  it('ruller persistData storage tilbage hvis cache-commit fejler', async () => {
    sessionStorage.setItem(
      'mineo_stamdata',
      JSON.stringify(persistedWrapper({
        journalnr: '',
        advokat: '',
        sagsbehandler: '',
        skadelidte: 'Før',
        skadestype: undefined,
        skadedato: undefined,
      }))
    );
    const { getCtx } = renderProvider();
    await waitFor(() => expect(getCtx()).not.toBeNull());

    const commitSpy = vi.spyOn(formPersistenceStore.getState(), 'commitSection').mockImplementation(() => {
      throw new Error('Injected commit failure');
    });
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    let didPersist = true;
    await act(async () => {
      didPersist = getCtx()!.persistData('stamdata', {
        journalnr: '',
        advokat: '',
        sagsbehandler: '',
        skadelidte: 'Efter',
        skadestype: undefined,
        skadedato: undefined,
      });
    });

    commitSpy.mockRestore();
    consoleErrorSpy.mockRestore();

    expect(didPersist).toBe(false);
    expect(sessionStorage.getItem('mineo_stamdata')).toContain('Før');
    expect(getCtx()!.getPersistedData('stamdata')?.skadelidte).toBe('Før');
  });

  it('gennemfører store-rollback selv hvis storage-rollback fejler i persistData', async () => {
    const { getCtx } = renderProvider();
    await waitFor(() => expect(getCtx()).not.toBeNull());

    const commitSpy = vi.spyOn(formPersistenceStore.getState(), 'commitSection').mockImplementation(() => {
      throw new Error('Injected commit failure');
    });
    const storageProto = Object.getPrototypeOf(window.sessionStorage) as Storage;
    const removeSpy = vi.spyOn(storageProto, 'removeItem').mockImplementation(() => {
      throw new Error('Injected remove failure');
    });
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    let didPersist = true;
    await act(async () => {
      didPersist = getCtx()!.persistData('stamdata', {
        journalnr: '',
        advokat: '',
        sagsbehandler: '',
        skadelidte: 'Efter',
        skadestype: undefined,
        skadedato: undefined,
      });
    });

    commitSpy.mockRestore();
    removeSpy.mockRestore();
    consoleErrorSpy.mockRestore();

    expect(didPersist).toBe(false);
    expect(getCtx()!.getPersistedData('stamdata')).toBeNull();
  });

  it('ruller storage og store tilbage hvis undo-capture fejler under persistData', async () => {
    const { getCtx } = renderProvider();
    await waitFor(() => expect(getCtx()).not.toBeNull());

    const captureSpy = vi.spyOn(undoRedoStore.getState(), 'capture').mockImplementation(() => {
      throw new Error('Injected undo capture failure');
    });
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    let didPersist = true;
    await act(async () => {
      didPersist = getCtx()!.persistData('stamdata', {
        journalnr: '',
        advokat: '',
        sagsbehandler: '',
        skadelidte: 'Efter',
        skadestype: undefined,
        skadedato: undefined,
      }, {
        undoOrigin: { route: '/stamdata', tabKey: null, sectionKey: 'stamdata', fieldPath: 'skadelidte', focusToken: null },
      });
    });

    captureSpy.mockRestore();
    consoleErrorSpy.mockRestore();

    expect(didPersist).toBe(false);
    expect(sessionStorage.getItem('mineo_stamdata')).toBeNull();
    expect(getCtx()!.getPersistedData('stamdata')).toBeNull();
  });

  it('bevarer kompatible sektioner ved version-mismatch i sessionStorage', async () => {
    // Gem stamdata med forkert version
    sessionStorage.setItem(
      'mineo_stamdata',
      JSON.stringify({
        version: 'old-version-0.1',
        timestamp: Date.now(),
        data: {
          journalnr: 'J-old',
          advokat: '',
          sagsbehandler: '',
          skadelidte: 'Old',
          skadestype: 'Arbejdsulykke',
          skadedato: toISODateString('2024-01-01'),
        },
      })
    );

    const { getCtx } = renderProvider();
    await waitFor(() => expect(getCtx()).not.toBeNull());

    expect(getCtx()!.getPersistedData('stamdata')?.skadelidte).toBe('Old');
    expect(getCtx()!.lastNotice?.type).toBe('warning');
    expect(getCtx()!.lastNotice?.message).toContain('1 sektion fra en anden dataversion blev valideret med den aktuelle struktur');
  });

  it('rydder kun inkompatible sektioner ved version-mismatch og bevarer de kompatible', async () => {
    sessionStorage.setItem(
      'mineo_stamdata',
      JSON.stringify({
        version: 'old-version-0.1',
        timestamp: Date.now(),
        data: {
          journalnr: 'J-old',
          advokat: '',
          sagsbehandler: '',
          skadelidte: 'Bevares',
          skadestype: 'Arbejdsulykke',
          skadedato: toISODateString('2024-01-01'),
        },
      })
    );
    sessionStorage.setItem(
      'mineo_renteberegning',
      JSON.stringify({
        version: 'old-version-0.1',
        timestamp: Date.now(),
        data: {
          rentekravRows: 'forkert-type',
        },
      })
    );

    const { getCtx } = renderProvider();
    await waitFor(() => expect(getCtx()).not.toBeNull());

    expect(getCtx()!.getPersistedData('stamdata')?.skadelidte).toBe('Bevares');
    expect(getCtx()!.getPersistedData('renteberegning')).toBeNull();
    expect(getCtx()!.lastNotice?.type).toBe('error');
    expect(getCtx()!.lastNotice?.message).toContain('1 sektion fra en anden dataversion blev valideret med den aktuelle struktur');
    expect(getCtx()!.lastNotice?.message).toContain('1 sektion kunne ikke overføres sikkert og blev ryddet');
    await waitFor(() => {
      expect(sessionStorage.getItem('mineo_renteberegning')).toBeNull();
    });
    expect(sessionStorage.getItem('mineo_stamdata')).not.toBeNull();
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
        skadedato: undefined,
      });
    });

    expect(getCtx()!.hasAnyData()).toBe(true);
  });
});
