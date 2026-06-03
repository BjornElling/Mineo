// @vitest-environment jsdom
import React from 'react';
import { act, render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { FormPersistenceProvider } from '../../contexts/FormPersistenceContext';
import { useFormPersistence } from '../../contexts/useFormPersistence';
import { getStorageKey } from '../../config/storageManifest';
import { PERSISTED_DATA_VERSION } from '../../config/persistenceVersion';
import type { PersistedData } from '../../types/persistence';
import type { PersistedSectionsSnapshot } from '../../config/persistenceRegistry';
import type { StamdataValues } from '../../schemas/formSchemas';
import { useFormFieldErrorReporter } from '../../hooks/useFormFieldErrors';
import { useUnsavedChangesGuard } from '../../hooks/useUnsavedChangesGuard';
import {
  getAuthoritativeSnapshotEpochSnapshot,
  useAuthoritativeSnapshotEpochSelector,
  useCombinedSectionRevisionSelector,
  usePersistedSectionSelector,
} from '../../hooks/useFormPersistenceSelectors';

const stampStamdata = (skadelidte: string): StamdataValues => ({
  journalnr: '',
  advokat: '',
  sagsbehandler: '',
  skadelidte,
  skadestype: undefined,
  skadedato: undefined,
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

  it('gør session-hydreret data synlig for child-komponentens første render', () => {
    const payload: PersistedData = {
      version: PERSISTED_DATA_VERSION,
      timestamp: Date.now(),
      data: { aargang: 2026 },
    };
    sessionStorage.setItem(getStorageKey('satser'), JSON.stringify(payload));
    const firstRenderValues: Array<number | undefined> = [];

    const CaptureFirstRender = () => {
      firstRenderValues.push(usePersistedSectionSelector('satser')?.aargang);
      return null;
    };

    render(
      <FormPersistenceProvider>
        <CaptureFirstRender />
      </FormPersistenceProvider>
    );

    expect(firstRenderValues[0]).toBe(2026);
  });

  it('markerer ikke hydreret sessionStorage-data som ikke-gemte ændringer uden efterfølgende commit', () => {
    const payload: PersistedData = {
      version: PERSISTED_DATA_VERSION,
      timestamp: Date.now(),
      data: stampStamdata('Hydreret sag'),
    };
    sessionStorage.setItem(getStorageKey('stamdata'), JSON.stringify(payload));
    const observedHasUnsavedChanges: boolean[] = [];

    const CaptureUnsavedState = () => {
      const combinedSectionRevision = useCombinedSectionRevisionSelector();
      const authoritativeSnapshotEpoch = useAuthoritativeSnapshotEpochSelector();
      const { hasUnsavedChanges } = useUnsavedChangesGuard({
        combinedSectionRevision,
        authoritativeSnapshotEpoch,
      });
      observedHasUnsavedChanges.push(hasUnsavedChanges);
      return null;
    };

    render(
      <FormPersistenceProvider>
        <CaptureUnsavedState />
      </FormPersistenceProvider>
    );

    expect(observedHasUnsavedChanges.at(-1)).toBe(false);
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
