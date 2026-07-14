// @vitest-environment jsdom
import React from 'react';
import { act, render, waitFor } from '@testing-library/react';
import { PERSISTED_DATA_VERSION } from '../../config/persistenceVersion';
import { getInputEnvelopeStorageKey } from '../../config/storageManifest';
import { FormPersistenceProvider, initializePersistenceRuntime } from '../../contexts/FormPersistenceContext';
import { parseInputEnvelope } from '../../input/inputEnvelope';
import { inputRuntimeStore } from '../../stores/inputRuntimeStore';
import { useFormPersistence } from '../../contexts/useFormPersistence';
import type { PersistedSectionsSnapshot } from '../../config/persistenceRegistry';
import type { StamdataValues } from '../../schemas/formSchemas';

const LOENINDKOMST_FIELD_KEY = 'af-1:loenindkomst';

const stampStamdata = (skadelidte: string): StamdataValues => ({
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

const persistedWrapper = (data: unknown) => ({
  version: PERSISTED_DATA_VERSION,
  timestamp: Date.now(),
  data,
});

const emptySnapshot = (): PersistedSectionsSnapshot => ({
  stamdata: undefined,
  satser: undefined,
  aarsloen: undefined,
  faellesAarsloen: undefined,
  renteberegning: undefined,
  varigemen: undefined,
  forsoergertab: undefined,
  erstatningsopgoerelse: undefined,
  erhvervsevnetab: undefined,
});

describe('FormPersistenceContext.replaceAllPersistedData (rollback)', () => {
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
      <FormPersistenceProvider runtime={initializePersistenceRuntime()}>
        <Capture />
      </FormPersistenceProvider>
    );

    await waitFor(() => {
      expect(ctx).not.toBeNull();
    });

    expect(ctx!.getPersistedData('stamdata')?.skadelidte).toBe('X');
    const inputKey = getInputEnvelopeStorageKey();
    const beforeEnvelope = sessionStorage.getItem(inputKey);
    expect(beforeEnvelope).not.toBeNull();

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
    expect(sessionStorage.getItem(inputKey)).toBe(beforeEnvelope);
    expect(sessionStorage.getItem('mineo_stamdata')).toBeNull();
    expect(ctx!.getPersistedData('stamdata')?.skadelidte).toBe('X');
  });

  it('ruller envelopen tilbage hvis store-apply fejler', async () => {
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
      <FormPersistenceProvider runtime={initializePersistenceRuntime()}>
        <Capture />
      </FormPersistenceProvider>
    );

    await waitFor(() => {
      expect(ctx).not.toBeNull();
    });

    expect(ctx!.getPersistedData('stamdata')?.skadelidte).toBe('X');
    expect(ctx!.getPersistedData('satser')?.aargang).toBe(2020);
    const inputKey = getInputEnvelopeStorageKey();
    const beforeEnvelope = sessionStorage.getItem(inputKey);
    expect(beforeEnvelope).not.toBeNull();
    const beforeRevision = inputRuntimeStore.getState().revision;
    const originalApply = inputRuntimeStore.getState().applyInputRuntimeCommit;
    const applySpy = vi.spyOn(inputRuntimeStore.getState(), 'applyInputRuntimeCommit')
      .mockImplementation((commit) => {
        originalApply(commit);
        throw new Error('Injected failure efter store-write');
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

    applySpy.mockRestore();

    expect(error).toBeInstanceOf(Error);
    expect(sessionStorage.getItem(inputKey)).toBe(beforeEnvelope);
    expect(parseInputEnvelope(beforeEnvelope!).input.sections.stamdata?.skadelidte).toBe('X');
    expect(parseInputEnvelope(beforeEnvelope!).input.sections.satser?.aargang).toBe(2020);
    expect(ctx!.getPersistedData('stamdata')?.skadelidte).toBe('X');
    expect(ctx!.getPersistedData('satser')?.aargang).toBe(2020);
    expect(inputRuntimeStore.getState().revision).toBe(beforeRevision);
  });

  it('restores EO lønindkomst field-errors on rollback failure', async () => {
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
      <FormPersistenceProvider runtime={initializePersistenceRuntime()}>
        <Capture />
      </FormPersistenceProvider>
    );

    await waitFor(() => {
      expect(ctx).not.toBeNull();
    });

    await act(async () => {
      ctx!.setFieldError('erstatningsopgoerelse', LOENINDKOMST_FIELD_KEY, 'input', {
        message: 'Ugyldig manuel regulering',
        severity: 'error',
      });
    });
    expect(ctx!.getFieldError('erstatningsopgoerelse', LOENINDKOMST_FIELD_KEY)?.message).toBe('Ugyldig manuel regulering');

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

    expect(ctx!.getFieldError('erstatningsopgoerelse', LOENINDKOMST_FIELD_KEY)?.message).toBe('Ugyldig manuel regulering');
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
      <FormPersistenceProvider runtime={initializePersistenceRuntime()}>
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

  it('clears form field-errors and EO lønindkomst field-errors on successful replaceAllPersistedData', async () => {
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
      <FormPersistenceProvider runtime={initializePersistenceRuntime()}>
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

    await act(async () => {
      ctx!.setFieldError('erstatningsopgoerelse', LOENINDKOMST_FIELD_KEY, 'input', {
        message: 'Ugyldig manuel regulering',
        severity: 'error',
      });
    });
    expect(ctx!.getFieldError('erstatningsopgoerelse', LOENINDKOMST_FIELD_KEY)?.message).toBe('Ugyldig manuel regulering');

    const next = emptySnapshot();
    next.stamdata = stampStamdata('Efter replace');

    await act(async () => {
      ctx!.replaceAllPersistedData(next);
    });

    expect(ctx!.getFieldError('stamdata', 'skadelidte')).toBeUndefined();
    expect(ctx!.getFieldError('erstatningsopgoerelse', LOENINDKOMST_FIELD_KEY)).toBeUndefined();
  });
});
