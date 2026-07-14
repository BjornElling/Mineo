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

// Ombryd den ægte runner, så call-tracking af det typed spor virker på det named import i usePersistedForm.
vi.mock('../../input/inputTransactionRunner', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../input/inputTransactionRunner')>();
  return { ...actual, executeTypedInputTransaction: vi.fn(actual.executeTypedInputTransaction) };
});

const typedSpy = runner.executeTypedInputTransaction as unknown as ReturnType<typeof vi.fn>;

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

describe('usePersistedForm — typed catalog-routing for migrerede referencefelter', () => {
  beforeEach(() => {
    sessionStorage.clear();
    clearResolvedFieldErrorsCache();
    inputRuntimeStore.getState().clearAll({ hydrated: true, persistedDataVersion: PERSISTED_DATA_VERSION });
    typedSpy.mockClear();
  });

  it('routes NOT den første commit i en tom sektion (går gennem den fælles seed-vej)', () => {
    const captured = renderSatserForm();
    act(() => { captured.form!.setFieldValue('aargang', 2024); });
    expect(typedSpy).not.toHaveBeenCalled();
    expect(inputRuntimeStore.getState().input.sections.satser).toEqual({ aargang: 2024 });
  });

  it('router steady-state satser.aargang-commit gennem det typed katalog-spor', () => {
    const captured = renderSatserForm();
    act(() => { captured.form!.setFieldValue('aargang', 2024); }); // seeder sektionen (fælles vej)
    typedSpy.mockClear();

    act(() => { captured.form!.setFieldValue('aargang', 2025); });

    expect(typedSpy).toHaveBeenCalledTimes(1);
    expect(typedSpy.mock.calls[0]?.[0]).toMatchObject({ kind: 'commitImmediateField', value: 2025 });
    expect(inputRuntimeStore.getState().input.sections.satser).toEqual({ aargang: 2025 });
  });

  it('producerer identisk store-state som den tilsvarende replaceSection', () => {
    const captured = renderSatserForm();
    act(() => { captured.form!.setFieldValue('aargang', 2024); });
    act(() => { captured.form!.setFieldValue('aargang', 2025); });
    const viaTyped = inputRuntimeStore.getState().input.sections.satser;

    inputRuntimeStore.getState().clearAll({ hydrated: true, persistedDataVersion: PERSISTED_DATA_VERSION });
    runner.executeInputTransaction({ kind: 'replaceSection', section: 'satser', value: { aargang: 2025 } });
    expect(inputRuntimeStore.getState().input.sections.satser).toEqual(viaTyped);
  });
});
