// @vitest-environment jsdom
import React from 'react';
import { act, render } from '@testing-library/react';
import { usePersistedForm, type UsePersistedFormReturn } from '../../hooks/usePersistedForm';
import { FormPersistenceProvider } from '../../contexts/FormPersistenceContext';
import { formPersistenceStore } from '../../stores/formPersistenceStore';
import { clearResolvedFieldErrorsCache } from '../../hooks/useFormPersistenceSelectors';
import { satserSchema, stamdataSchema } from '../../schemas/formSchemas';
import { PERSISTED_DATA_VERSION } from '../../config/persistenceVersion';

const initialValues = {
  journalnr: '',
};

describe('usePersistedForm', () => {
  beforeEach(() => {
    sessionStorage.clear();
    clearResolvedFieldErrorsCache();
    formPersistenceStore.getState().clearAll({
      hydrated: true,
      schemaFingerprint: PERSISTED_DATA_VERSION,
      lastCommittedAt: Date.now(),
    });
    formPersistenceStore.getState().clearAllFieldErrors();
    formPersistenceStore.getState().__setMetaUnsafe({ hydrated: false, lastCommittedAt: undefined });
  });

  it('bevarer setValues- og resetForm-referencer når committed values ændres i storen', () => {
    const captured: {
      setValues: UsePersistedFormReturn<typeof initialValues>['setValues'] | null;
      resetForm: UsePersistedFormReturn<typeof initialValues>['resetForm'] | null;
    } = {
      setValues: null,
      resetForm: null,
    };

    const Capture = () => {
      const form = usePersistedForm(stamdataSchema, 'stamdata', initialValues);
      captured.setValues = form.setValues;
      captured.resetForm = form.resetForm;
      return null;
    };

    const { rerender } = render(
      <FormPersistenceProvider>
        <Capture />
      </FormPersistenceProvider>
    );

    const firstSetValues = captured.setValues;
    const firstResetForm = captured.resetForm;

    act(() => {
      formPersistenceStore.getState().commitSection('stamdata', { journalnr: 'Opdateret' }, {
        schemaFingerprint: PERSISTED_DATA_VERSION,
      });
    });

    rerender(
      <FormPersistenceProvider>
        <Capture />
      </FormPersistenceProvider>
    );

    expect(captured.setValues).toBe(firstSetValues);
    expect(captured.resetForm).toBe(firstResetForm);
  });

  it('bruger seneste committed værdi ved sekventielle setValues-kald', () => {
    const captured: {
      setValues: UsePersistedFormReturn<typeof initialValues>['setValues'] | null;
      values: typeof initialValues | null;
    } = {
      setValues: null,
      values: null,
    };

    const Capture = () => {
      const form = usePersistedForm(stamdataSchema, 'stamdata', initialValues);
      captured.setValues = form.setValues;
      captured.values = form.values;
      return null;
    };

    render(
      <FormPersistenceProvider>
        <Capture />
      </FormPersistenceProvider>
    );

    act(() => {
      captured.setValues!((prev) => ({ ...prev, journalnr: 'A' }));
      captured.setValues!((prev) => ({ ...prev, journalnr: `${prev.journalnr}B` }));
    });

    expect(captured.values).toEqual({ journalnr: 'AB' });
    expect(formPersistenceStore.getState().sections.stamdata).toEqual({ journalnr: 'AB' });
  });

  it('bryder kun formVersion ved autoritativ replace og reset', () => {
    const captured: {
      replaceValues: UsePersistedFormReturn<typeof initialValues>['replaceValues'] | null;
      resetForm: UsePersistedFormReturn<typeof initialValues>['resetForm'] | null;
      setValues: UsePersistedFormReturn<typeof initialValues>['setValues'] | null;
      formVersion: number | null;
      values: typeof initialValues | null;
    } = {
      replaceValues: null,
      resetForm: null,
      setValues: null,
      formVersion: null,
      values: null,
    };

    const Capture = () => {
      const form = usePersistedForm(stamdataSchema, 'stamdata', initialValues);
      captured.replaceValues = form.replaceValues;
      captured.resetForm = form.resetForm;
      captured.setValues = form.setValues;
      captured.formVersion = form.formVersion;
      captured.values = form.values;
      return null;
    };

    render(
      <FormPersistenceProvider>
        <Capture />
      </FormPersistenceProvider>
    );

    expect(captured.formVersion).toBe(0);
    const baselineFormVersion = captured.formVersion;

    act(() => {
      captured.setValues!((prev) => ({ ...prev, journalnr: 'Normal commit' }));
    });

    expect(captured.formVersion).toBe(baselineFormVersion);
    expect(captured.values).toEqual({ journalnr: 'Normal commit' });

    act(() => {
      captured.replaceValues!({ journalnr: 'Erstatning' });
    });

    expect(captured.formVersion).toBe((baselineFormVersion ?? 0) + 1);
    expect(captured.values).toEqual({ journalnr: 'Erstatning' });

    act(() => {
      captured.resetForm!();
    });

    expect(captured.formVersion).toBe((baselineFormVersion ?? 0) + 2);
    expect(captured.values).toEqual(initialValues);
  });

  it('bryder ikke formVersion ved første mount eller ved første observation af ny pageKey', () => {
    const captured: {
      formVersion: number | null;
    } = {
      formVersion: null,
    };

    const Capture = ({ pageKey }: { pageKey: 'stamdata' | 'satser' }) => {
      const stamdataForm = usePersistedForm(stamdataSchema, 'stamdata', initialValues);
      const satserForm = usePersistedForm(
        satserSchema,
        'satser',
        { aargang: 2026 }
      );
      captured.formVersion = pageKey === 'stamdata' ? stamdataForm.formVersion : satserForm.formVersion;
      return null;
    };

    const { rerender } = render(
      <FormPersistenceProvider>
        <Capture pageKey="stamdata" />
      </FormPersistenceProvider>
    );

    expect(captured.formVersion).toBe(0);

    rerender(
      <FormPersistenceProvider>
        <Capture pageKey="satser" />
      </FormPersistenceProvider>
    );

    expect(captured.formVersion).toBe(0);
  });
});
