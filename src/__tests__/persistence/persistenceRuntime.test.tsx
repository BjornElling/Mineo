// @vitest-environment jsdom
import React from 'react';
import { render } from '@testing-library/react';
import { FormPersistenceProvider } from '../../contexts/FormPersistenceContext';
import { PERSISTED_DATA_VERSION } from '../../config/persistenceVersion';
import { getStorageKey } from '../../config/storageManifest';
import { initializePersistenceRuntime } from '../../persistence/persistenceRuntime';
import { formPersistenceStore } from '../../stores/formPersistenceStore';
import { usePersistedSectionSelector } from '../../hooks/useFormPersistenceSelectors';
import type { PersistedData } from '../../types/persistence';

const writeSatser = (aargang: number): void => {
  const payload: PersistedData = {
    version: PERSISTED_DATA_VERSION,
    timestamp: Date.now(),
    data: { aargang },
  };
  sessionStorage.setItem(getStorageKey('satser'), JSON.stringify(payload));
};

describe('initializePersistenceRuntime', () => {
  beforeEach(() => {
    sessionStorage.clear();
    formPersistenceStore.getState().clearAll({
      hydrated: true,
      persistedDataVersion: PERSISTED_DATA_VERSION,
    });
  });

  it('hydrater store atomisk før første React-render som autoritativ revision', () => {
    writeSatser(2026);
    formPersistenceStore.getState().setFieldError(
      'satser',
      'aargang',
      'input',
      { message: 'Gammel runtime-fejl', severity: 'error' },
    );
    const before = formPersistenceStore.getState();

    initializePersistenceRuntime();
    const after = formPersistenceStore.getState();

    expect(after.sections.satser).toEqual({ aargang: 2026 });
    expect(after.meta.hydrated).toBe(true);
    expect(after.sectionRevisions.satser).toBe(before.sectionRevisions.satser + 1);
    expect(after.committedChangeCounter).toBe(before.committedChangeCounter);
    expect(after.authoritativeSnapshotEpoch).toBe(before.authoritativeSnapshotEpoch + 1);
    expect(after.fieldErrors.satser).toEqual({});
    expect(after.fieldErrorRevisions.satser).toBe(before.fieldErrorRevisions.satser + 1);
    expect(after.invalidDraftRevisions.satser).toBe(before.invalidDraftRevisions.satser + 1);
  });

  it('genhydrerer ikke ved provider-remount med samme runtime', () => {
    writeSatser(2025);
    const runtime = initializePersistenceRuntime();
    const observed: number[] = [];
    const Capture = () => {
      const aargang = usePersistedSectionSelector('satser')?.aargang;
      if (aargang !== undefined) observed.push(aargang);
      return null;
    };

    const first = render(
      <FormPersistenceProvider runtime={runtime}>
        <Capture />
      </FormPersistenceProvider>,
    );
    first.unmount();

    formPersistenceStore.getState().commitSection('satser', { aargang: 2027 });
    writeSatser(2024);
    render(
      <FormPersistenceProvider runtime={runtime}>
        <Capture />
      </FormPersistenceProvider>,
    );

    expect(observed).toEqual([2025, 2027]);
    expect(formPersistenceStore.getState().sections.satser).toEqual({ aargang: 2027 });
  });
});
