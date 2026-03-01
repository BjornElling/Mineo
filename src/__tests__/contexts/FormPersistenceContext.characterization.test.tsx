// @vitest-environment jsdom
import React from 'react';
import { act, render, waitFor } from '@testing-library/react';
import { FormPersistenceProvider } from '../../contexts/FormPersistenceContext';
import { useFormPersistence } from '../../contexts/useFormPersistence';
import type { StorageKey } from '../../config/storageManifest';

const stampStamdata = (skadelidte: string) => ({
  journalnr: '',
  advokat: '',
  sagsbehandler: '',
  skadelidte,
  skadestype: '',
  skadesdato: '',
});

const emptySnapshot = (): Record<StorageKey, unknown | undefined> => ({
  stamdata: undefined,
  satser: undefined,
  aarsloen: undefined,
  renteberegning: undefined,
  varigemen: undefined,
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

describe('FormPersistenceContext characterization', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('increments section revision on persistData without bumping authoritative epoch', async () => {
    const { getCtx } = renderProvider();
    await waitFor(() => expect(getCtx()).not.toBeNull());

    const initialRevision = getCtx()!.getSectionRevision('stamdata');
    const initialEpoch = getCtx()!.authoritativeSnapshotEpoch;

    await act(async () => {
      getCtx()!.persistData('stamdata', stampStamdata('Rev 1'));
    });

    expect(getCtx()!.getSectionRevision('stamdata')).toBe(initialRevision + 1);
    expect(getCtx()!.authoritativeSnapshotEpoch).toBe(initialEpoch);
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

    const beforeEpoch = getCtx()!.authoritativeSnapshotEpoch;
    const beforeStamdataRevision = getCtx()!.getSectionRevision('stamdata');
    const beforeSatserRevision = getCtx()!.getSectionRevision('satser');

    const snapshot = emptySnapshot();
    snapshot.stamdata = stampStamdata('Efter indlæsning');
    snapshot.satser = { aargang: 2026 };

    await act(async () => {
      getCtx()!.replaceAllPersistedData(snapshot);
    });

    expect(getCtx()!.authoritativeSnapshotEpoch).toBe(beforeEpoch + 1);
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

    const beforeEpoch = getCtx()!.authoritativeSnapshotEpoch;
    const beforeStamdataRevision = getCtx()!.getSectionRevision('stamdata');
    const beforeSatserRevision = getCtx()!.getSectionRevision('satser');

    await act(async () => {
      getCtx()!.clearPageData('stamdata');
    });

    expect(getCtx()!.authoritativeSnapshotEpoch).toBe(beforeEpoch);
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

    const beforeEpoch = getCtx()!.authoritativeSnapshotEpoch;
    const beforeStamdataRevision = getCtx()!.getSectionRevision('stamdata');
    const beforeSatserRevision = getCtx()!.getSectionRevision('satser');

    await act(async () => {
      getCtx()!.clearAllData();
    });

    expect(getCtx()!.authoritativeSnapshotEpoch).toBe(beforeEpoch + 1);
    expect(getCtx()!.getSectionRevision('stamdata')).toBe(beforeStamdataRevision + 1);
    expect(getCtx()!.getSectionRevision('satser')).toBe(beforeSatserRevision + 1);
    expect(getCtx()!.getPersistedData('stamdata')).toBeNull();
    expect(getCtx()!.getPersistedData('satser')).toBeNull();
  });
});
