// @vitest-environment jsdom
import React from 'react';
import { act, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { usePersistedForm, type UsePersistedFormReturn } from '../../hooks/usePersistedForm';
import { FormPersistenceProvider, initializePersistenceRuntime } from '../../contexts/FormPersistenceContext';
import { clearResolvedFieldErrorsCache } from '../../hooks/useFormPersistenceSelectors';
import * as runner from '../../input/inputTransactionRunner';
import { inputRuntimeStore } from '../../stores/inputRuntimeStore';
import { satserSchema, type SatserValues } from '../../schemas/formSchemas';
import { PERSISTED_DATA_VERSION } from '../../config/persistenceVersion';

// Ombryd den ægte runner, så testen kan bevise, at legacy-hooken kun bruger compatibility-vejen.
vi.mock('../../input/inputTransactionRunner', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../input/inputTransactionRunner')>();
  return { ...actual, executeLegacyInputTransaction: vi.fn(actual.executeLegacyInputTransaction) };
});

const transactionSpy = runner.executeLegacyInputTransaction as unknown as ReturnType<typeof vi.fn>;

const SATSER_INITIAL: SatserValues = { aargang: 2020 };

const renderSatserForm = () => {
  const captured: { form: UsePersistedFormReturn<SatserValues> | null } = { form: null };
  const Capture = () => {
    captured.form = usePersistedForm(satserSchema, 'satser', SATSER_INITIAL);
    return null;
  };
  const persistenceRuntime = initializePersistenceRuntime();
  render(
    <MemoryRouter initialEntries={['/satser']}>
      <FormPersistenceProvider runtime={persistenceRuntime}>
        <Capture />
      </FormPersistenceProvider>
    </MemoryRouter>
  );
  return captured;
};

describe('usePersistedForm — entydig legacy-writevej', () => {
  beforeEach(() => {
    sessionStorage.clear();
    clearResolvedFieldErrorsCache();
    inputRuntimeStore.getState().clearAll({ hydrated: true, persistedDataVersion: PERSISTED_DATA_VERSION });
    transactionSpy.mockClear();
  });

  it('committer det første felt i en tom sektion som én replaceSection-transaktion', () => {
    const captured = renderSatserForm();
    act(() => { captured.form!.setFieldValue('aargang', 2024); });
    expect(transactionSpy).toHaveBeenCalledTimes(1);
    expect(transactionSpy.mock.calls[0]?.[0]).toMatchObject({
      kind: 'replaceSection',
      section: 'satser',
      value: { aargang: 2024 },
    });
    expect(inputRuntimeStore.getState().input.sections.satser).toEqual({ aargang: 2024 });
  });

  it('bruger samme replaceSection-vej ved efterfølgende feltcommits', () => {
    const captured = renderSatserForm();
    act(() => { captured.form!.setFieldValue('aargang', 2024); }); // seeder sektionen (fælles vej)
    transactionSpy.mockClear();

    act(() => { captured.form!.setFieldValue('aargang', 2025); });

    expect(transactionSpy).toHaveBeenCalledTimes(1);
    expect(transactionSpy.mock.calls[0]?.[0]).toMatchObject({
      kind: 'replaceSection',
      section: 'satser',
      value: { aargang: 2025 },
    });
    expect(inputRuntimeStore.getState().input.sections.satser).toEqual({ aargang: 2025 });
  });

  it('rydder tidligere rejected input i samme replaceSection-transaktion', () => {
    const captured = renderSatserForm();
    runner.executeLegacyInputTransaction({
      kind: 'changeRejectedInputs',
      changes: [{ pageKey: 'satser', fieldPath: 'aargang', draft: '20x' }],
    });
    transactionSpy.mockClear();

    act(() => { captured.form!.setFieldValue('aargang', 2025); });

    expect(transactionSpy).toHaveBeenCalledTimes(1);
    expect(transactionSpy.mock.calls[0]?.[0]).toMatchObject({
      kind: 'replaceSection',
      rejectedChanges: [{ pageKey: 'satser', fieldPath: 'aargang', draft: null }],
    });
    expect(inputRuntimeStore.getState().input.rejectedInputs).toEqual({});
  });
});
