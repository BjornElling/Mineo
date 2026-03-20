import React from 'react';
import { act, render, waitFor } from '@testing-library/react';
import { PERSISTED_DATA_VERSION } from '../../config/persistenceVersion';
import { FormPersistenceProvider } from '../../contexts/FormPersistenceContext';
import { useFormPersistence } from '../../contexts/useFormPersistence';
import type { StorageKey } from '../../config/storageManifest';
import { eoLoenindkomstInputErrorStore } from '../../stores/eoLoenindkomstInputErrorStore';

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

const persistedWrapper = (data: unknown) => ({
  version: PERSISTED_DATA_VERSION,
  timestamp: Date.now(),
  data,
});

const emptySnapshot = (): Record<StorageKey, unknown | undefined> => ({
  stamdata: undefined,
  satser: undefined,
  aarsloen: undefined,
  faellesAarsloen: undefined,
  faellesPersondata: undefined,
  renteberegning: undefined,
  varigemen: undefined,
  forsoergertab: undefined,
  erstatningsopgoerelse: undefined,
  erhvervsevnetab: undefined,
});

describe('FormPersistenceContext.replaceAllPersistedData (rollback)', () => {
  beforeEach(() => {
    eoLoenindkomstInputErrorStore.getState().clearAll();
  });

  it('rolls back sessionStorage and cache when sessionStorage setItem fails mid-apply', async () => {
    sessionStorage.clear();
    sessionStorage.setItem('mineo_stamdata', JSON.stringify(persistedWrapper(stampStamdata('X'))));

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

    await waitFor(() => {
      expect(ctx).not.toBeNull();
    });

    expect(ctx!.getPersistedData('stamdata')?.skadelidte).toBe('X');

    let injectedFailures = 0;
    const storageProto = Object.getPrototypeOf(window.sessionStorage) as { setItem: (key: string, value: string) => void };
    const originalSetItem = storageProto.setItem;
    const setItemSpy = vi.spyOn(storageProto, 'setItem').mockImplementation((key: string, value: string) => {
      if (injectedFailures === 0) {
        injectedFailures += 1;
        throw new Error('Injected failure');
      }
      return originalSetItem.call(window.sessionStorage, key, value);
    });

    const next = emptySnapshot();
    next.stamdata = stampStamdata('Y');

    let error: unknown;
    await act(async () => {
      try {
        ctx!.replaceAllPersistedData(next);
      } catch (e) {
        error = e;
      }
    });

    setItemSpy.mockRestore();

    expect(error).toBeInstanceOf(Error);
    expect(sessionStorage.getItem('mineo_stamdata')).toContain('X');
    expect(ctx!.getPersistedData('stamdata')?.skadelidte).toBe('X');
  });

  it('rolls back when a later write fails (no partial apply)', async () => {
    sessionStorage.clear();
    sessionStorage.setItem('mineo_stamdata', JSON.stringify(persistedWrapper(stampStamdata('X'))));
    sessionStorage.setItem('mineo_satser', JSON.stringify(persistedWrapper(stampSatser(2020))));

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

    await waitFor(() => {
      expect(ctx).not.toBeNull();
    });

    expect(ctx!.getPersistedData('stamdata')?.skadelidte).toBe('X');
    expect(ctx!.getPersistedData('satser')?.aargang).toBe(2020);

    let callCount = 0;
    const storageProto = Object.getPrototypeOf(window.sessionStorage) as { setItem: (key: string, value: string) => void };
    const originalSetItem = storageProto.setItem;
    const setItemSpy = vi.spyOn(storageProto, 'setItem').mockImplementation((key: string, value: string) => {
      callCount += 1;
      if (callCount === 2) {
        throw new Error('Injected failure');
      }
      return originalSetItem.call(window.sessionStorage, key, value);
    });

    const next = emptySnapshot();
    next.stamdata = stampStamdata('Y');
    next.satser = stampSatser(2021);

    let error: unknown;
    await act(async () => {
      try {
        ctx!.replaceAllPersistedData(next);
      } catch (e) {
        error = e;
      }
    });

    setItemSpy.mockRestore();

    expect(error).toBeInstanceOf(Error);
    expect(sessionStorage.getItem('mineo_stamdata')).toContain('X');
    expect(sessionStorage.getItem('mineo_satser')).toContain('2020');
    expect(sessionStorage.getItem('mineo_varigemen')).toBeNull();
    expect(ctx!.getPersistedData('stamdata')?.skadelidte).toBe('X');
    expect(ctx!.getPersistedData('satser')?.aargang).toBe(2020);
  });

  it('restores EO input-error store on rollback failure', async () => {
    sessionStorage.clear();
    sessionStorage.setItem('mineo_stamdata', JSON.stringify(persistedWrapper(stampStamdata('X'))));

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

    await waitFor(() => {
      expect(ctx).not.toBeNull();
    });

    eoLoenindkomstInputErrorStore.getState().setError('af-1', true);
    expect(eoLoenindkomstInputErrorStore.getState().errors).toEqual({ 'af-1': true });

    const storageProto = Object.getPrototypeOf(window.sessionStorage) as { setItem: (key: string, value: string) => void };
    const setItemSpy = vi.spyOn(storageProto, 'setItem').mockImplementation((_key: string, _value: string) => {
      throw new Error('Injected failure');
    });

    const next = emptySnapshot();
    next.stamdata = stampStamdata('Y');

    await act(async () => {
      expect(() => ctx!.replaceAllPersistedData(next)).toThrow();
    });

    setItemSpy.mockRestore();

    expect(eoLoenindkomstInputErrorStore.getState().errors).toEqual({ 'af-1': true });
  });

  it('restores form field-errors on rollback failure', async () => {
    sessionStorage.clear();
    sessionStorage.setItem('mineo_stamdata', JSON.stringify(persistedWrapper(stampStamdata('X'))));

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

    await waitFor(() => {
      expect(ctx).not.toBeNull();
    });

    await act(async () => {
      ctx!.setFieldError('stamdata', 'skadelidte', 'input', { message: 'Før rollback', severity: 'error' });
    });
    await waitFor(() => {
      expect(ctx!.getFieldError('stamdata', 'skadelidte')?.message).toBe('Før rollback');
    });
    const beforeRevision = ctx!.getFieldErrorRevision('stamdata');

    const storageProto = Object.getPrototypeOf(window.sessionStorage) as { setItem: (key: string, value: string) => void };
    const setItemSpy = vi.spyOn(storageProto, 'setItem').mockImplementation(() => {
      throw new Error('Injected failure');
    });

    const next = emptySnapshot();
    next.stamdata = stampStamdata('Y');

    await act(async () => {
      expect(() => ctx!.replaceAllPersistedData(next)).toThrow();
    });

    setItemSpy.mockRestore();

    expect(ctx!.getFieldError('stamdata', 'skadelidte')?.message).toBe('Før rollback');
    expect(ctx!.getFieldErrorRevision('stamdata')).toBe(beforeRevision);
  });

  it('clears form field-errors and EO input-errors on successful replaceAllPersistedData', async () => {
    sessionStorage.clear();

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

    await waitFor(() => {
      expect(ctx).not.toBeNull();
    });

    await act(async () => {
      ctx!.setFieldError('stamdata', 'skadelidte', 'input', { message: 'Skal ryddes', severity: 'error' });
    });
    await waitFor(() => {
      expect(ctx!.getFieldError('stamdata', 'skadelidte')?.message).toBe('Skal ryddes');
    });

    eoLoenindkomstInputErrorStore.getState().setError('af-1', true);
    expect(eoLoenindkomstInputErrorStore.getState().errors).toEqual({ 'af-1': true });

    const next = emptySnapshot();
    next.stamdata = stampStamdata('Efter replace');

    await act(async () => {
      ctx!.replaceAllPersistedData(next);
    });

    expect(ctx!.getFieldError('stamdata', 'skadelidte')).toBeUndefined();
    expect(eoLoenindkomstInputErrorStore.getState().errors).toEqual({});
  });
});
