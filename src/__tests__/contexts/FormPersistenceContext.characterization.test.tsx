// @vitest-environment jsdom
import React from 'react';
import { act, render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { FormPersistenceProvider } from '../../contexts/FormPersistenceContext';
import { useFormPersistence } from '../../contexts/useFormPersistence';
import type { StorageKey } from '../../config/storageManifest';
import { useFormFieldErrorReporter } from '../../hooks/useFormFieldErrors';
import { getAuthoritativeSnapshotEpochSnapshot } from '../../hooks/useFormPersistenceSelectors';

const stampStamdata = (skadelidte: string) => ({
  journalnr: '',
  advokat: '',
  sagsbehandler: '',
  skadelidte,
  skadestype: '',
  skadedato: '',
});

const emptySnapshot = (): Record<StorageKey, unknown | undefined> => ({
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

const renderProviderWithReporter = () => {
  let ctx: ReturnType<typeof useFormPersistence> | null = null;
  let reportError: ((message: string | undefined) => void) | null = null;

  const Capture = ({ mounted }: { mounted: boolean }) => {
    const value = useFormPersistence();
    React.useEffect(() => {
      ctx = value;
    }, [value]);

    if (!mounted) return null;
    return <ReporterCapture />;
  };

  const ReporterCapture = () => {
    reportError = useFormFieldErrorReporter('erhvervsevnetab', 'aslAfgoerelser', {
      source: 'input',
      severity: 'error',
    });
    return null;
  };

  const rendered = render(
    <MemoryRouter>
      <FormPersistenceProvider>
        <Capture mounted />
      </FormPersistenceProvider>
    </MemoryRouter>
  );

  return {
    getCtx: () => ctx,
    getReporter: () => reportError,
    rerenderMounted: (mounted: boolean) =>
      rendered.rerender(
        <MemoryRouter>
          <FormPersistenceProvider>
            <Capture mounted={mounted} />
          </FormPersistenceProvider>
        </MemoryRouter>
      ),
  };
};

describe('FormPersistenceContext characterization', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('increments section revision on persistData without bumping authoritative epoch', async () => {
    const { getCtx } = renderProvider();
    await waitFor(() => expect(getCtx()).not.toBeNull());

    const initialRevision = getCtx()!.getSectionRevision('stamdata');
    const initialEpoch = getAuthoritativeSnapshotEpochSnapshot();

    await act(async () => {
      getCtx()!.persistData('stamdata', stampStamdata('Rev 1'));
    });

    expect(getCtx()!.getSectionRevision('stamdata')).toBe(initialRevision + 1);
    expect(getAuthoritativeSnapshotEpochSnapshot()).toBe(initialEpoch);
  });

  it('increments field-error revision on set/clear field error', async () => {
    const { getCtx } = renderProvider();
    await waitFor(() => expect(getCtx()).not.toBeNull());

    const initialRevision = getCtx()!.getFieldErrorRevision('stamdata');

    await act(async () => {
      getCtx()!.setFieldError('stamdata', 'skadelidte', 'schema', { message: 'Fejl', severity: 'error' });
    });
    expect(getCtx()!.getFieldErrorRevision('stamdata')).toBe(initialRevision + 1);

    await act(async () => {
      getCtx()!.setFieldError('stamdata', 'skadelidte', 'schema', null);
    });
    expect(getCtx()!.getFieldErrorRevision('stamdata')).toBe(initialRevision + 2);
  });

  it('replaceAllPersistedData bumps authoritative epoch and all section revisions', async () => {
    const { getCtx } = renderProvider();
    await waitFor(() => expect(getCtx()).not.toBeNull());

    const beforeEpoch = getAuthoritativeSnapshotEpochSnapshot();
    const beforeStamdataRevision = getCtx()!.getSectionRevision('stamdata');
    const beforeSatserRevision = getCtx()!.getSectionRevision('satser');

    const snapshot = emptySnapshot();
    snapshot.stamdata = stampStamdata('Efter indlæsning');
    snapshot.satser = { aargang: 2026 };

    await act(async () => {
      getCtx()!.replaceAllPersistedData(snapshot);
    });

    expect(getAuthoritativeSnapshotEpochSnapshot()).toBe(beforeEpoch + 1);
    expect(getCtx()!.getSectionRevision('stamdata')).toBe(beforeStamdataRevision + 1);
    expect(getCtx()!.getSectionRevision('satser')).toBe(beforeSatserRevision + 1);
    expect(getCtx()!.getPersistedData('stamdata')?.skadelidte).toBe('Efter indlæsning');
    expect(getCtx()!.getPersistedData('satser')?.aargang).toBe(2026);
  });

  it('clearPageData increments only the targeted section revision without bumping authoritative epoch', async () => {
    const { getCtx } = renderProvider();
    await waitFor(() => expect(getCtx()).not.toBeNull());

    await act(async () => {
      getCtx()!.persistData('stamdata', stampStamdata('Skal ryddes'));
      getCtx()!.persistData('satser', { aargang: 2026 });
    });

    const beforeEpoch = getAuthoritativeSnapshotEpochSnapshot();
    const beforeStamdataRevision = getCtx()!.getSectionRevision('stamdata');
    const beforeSatserRevision = getCtx()!.getSectionRevision('satser');

    await act(async () => {
      getCtx()!.clearPageData('stamdata');
    });

    expect(getAuthoritativeSnapshotEpochSnapshot()).toBe(beforeEpoch);
    expect(getCtx()!.getSectionRevision('stamdata')).toBe(beforeStamdataRevision + 1);
    expect(getCtx()!.getSectionRevision('satser')).toBe(beforeSatserRevision);
    expect(getCtx()!.getPersistedData('stamdata')).toBeNull();
    expect(getCtx()!.getPersistedData('satser')?.aargang).toBe(2026);
  });

  it('clearAllData bumps authoritative epoch and all section revisions', async () => {
    const { getCtx } = renderProvider();
    await waitFor(() => expect(getCtx()).not.toBeNull());

    await act(async () => {
      getCtx()!.persistData('stamdata', stampStamdata('Skal ryddes'));
      getCtx()!.persistData('satser', { aargang: 2026 });
    });

    const beforeEpoch = getAuthoritativeSnapshotEpochSnapshot();
    const beforeStamdataRevision = getCtx()!.getSectionRevision('stamdata');
    const beforeSatserRevision = getCtx()!.getSectionRevision('satser');

    await act(async () => {
      getCtx()!.clearAllData();
    });

    expect(getAuthoritativeSnapshotEpochSnapshot()).toBe(beforeEpoch + 1);
    expect(getCtx()!.getSectionRevision('stamdata')).toBe(beforeStamdataRevision + 1);
    expect(getCtx()!.getSectionRevision('satser')).toBe(beforeSatserRevision + 1);
    expect(getCtx()!.getPersistedData('stamdata')).toBeNull();
    expect(getCtx()!.getPersistedData('satser')).toBeNull();
  });

  it('bevarer feltfejl over unmount/remount og rydder dem først ved clearAllData', async () => {
    const { getCtx, getReporter, rerenderMounted } = renderProviderWithReporter();
    await waitFor(() => expect(getCtx()).not.toBeNull());
    await waitFor(() => expect(getReporter()).not.toBeNull());

    await act(async () => {
      getReporter()!('Kapitaliseringsdato kan ikke være før afgørelsesdato');
    });

    expect(getCtx()!.getFieldError('erhvervsevnetab', 'aslAfgoerelser')?.message).toBe(
      'Kapitaliseringsdato kan ikke være før afgørelsesdato'
    );

    await act(async () => {
      rerenderMounted(false);
    });

    expect(getCtx()!.getFieldError('erhvervsevnetab', 'aslAfgoerelser')?.message).toBe(
      'Kapitaliseringsdato kan ikke være før afgørelsesdato'
    );

    await act(async () => {
      rerenderMounted(true);
    });

    expect(getCtx()!.getFieldError('erhvervsevnetab', 'aslAfgoerelser')?.message).toBe(
      'Kapitaliseringsdato kan ikke være før afgørelsesdato'
    );

    await act(async () => {
      getCtx()!.clearAllData();
    });

    expect(getCtx()!.getFieldError('erhvervsevnetab', 'aslAfgoerelser')).toBeUndefined();
  });

  it('rydder feltfejl ved replaceAllPersistedData', async () => {
    const { getCtx, getReporter } = renderProviderWithReporter();
    await waitFor(() => expect(getCtx()).not.toBeNull());
    await waitFor(() => expect(getReporter()).not.toBeNull());

    await act(async () => {
      getReporter()!('Kapitaliseringsdato kan ikke være før afgørelsesdato');
    });

    expect(getCtx()!.getFieldError('erhvervsevnetab', 'aslAfgoerelser')?.message).toBe(
      'Kapitaliseringsdato kan ikke være før afgørelsesdato'
    );

    const snapshot = emptySnapshot();
    snapshot.stamdata = stampStamdata('Efter load');

    await act(async () => {
      getCtx()!.replaceAllPersistedData(snapshot);
    });

    expect(getCtx()!.getFieldError('erhvervsevnetab', 'aslAfgoerelser')).toBeUndefined();
  });
});
