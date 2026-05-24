// @vitest-environment jsdom
import React from 'react';
import { act, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { usePersistedForm, type UsePersistedFormReturn } from '../../hooks/usePersistedForm';
import { FormPersistenceProvider } from '../../contexts/FormPersistenceContext';
import { formPersistenceStore } from '../../stores/formPersistenceStore';
import { undoRedoStore } from '../../stores/undoRedoStore';
import { clearResolvedFieldErrorsCache } from '../../hooks/useFormPersistenceSelectors';
import { stamdataSchema } from '../../schemas/formSchemas';
import { PERSISTED_DATA_VERSION } from '../../config/persistenceVersion';
import { STAMDATA_INITIAL_VALUES } from '../../domain/stamdata/stamdataInitialValues';
import type { PersistedSectionMap } from '../../config/persistenceRegistry';

type StamdataTestValues = PersistedSectionMap['stamdata'];

const initialValues: StamdataTestValues = { ...STAMDATA_INITIAL_VALUES };
const committedInitialValues: StamdataTestValues = stamdataSchema.parse(initialValues);

const renderWithProviders = (ui: React.ReactNode) => render(
  <MemoryRouter initialEntries={['/stamdata']}>
    <FormPersistenceProvider>
      {ui}
    </FormPersistenceProvider>
  </MemoryRouter>
);

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
    undoRedoStore.getState().clear();
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

    const { rerender } = renderWithProviders(<Capture />);

    const firstSetValues = captured.setValues;
    const firstResetForm = captured.resetForm;

    act(() => {
      formPersistenceStore.getState().commitSection('stamdata', { journalnr: 'Opdateret' }, {
        schemaFingerprint: PERSISTED_DATA_VERSION,
      });
    });

    rerender(
      <MemoryRouter initialEntries={['/stamdata']}>
        <FormPersistenceProvider>
        <Capture />
        </FormPersistenceProvider>
      </MemoryRouter>
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

    renderWithProviders(<Capture />);

    act(() => {
      captured.setValues!((prev) => ({ ...prev, journalnr: 'A' }));
      captured.setValues!((prev) => ({ ...prev, journalnr: `${prev.journalnr}B` }));
    });

    expect(captured.values).toEqual({ ...committedInitialValues, journalnr: 'AB' });
    expect(formPersistenceStore.getState().sections.stamdata).toEqual({ ...committedInitialValues, journalnr: 'AB' });
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

    renderWithProviders(<Capture />);

    // Første hydration bumper formVersion til 1
    expect(captured.formVersion).toBe(1);
    const baselineFormVersion = captured.formVersion!;

    act(() => {
      captured.setValues!((prev) => ({ ...prev, journalnr: 'Normal commit' }));
    });

    expect(captured.formVersion).toBe(baselineFormVersion);
    expect(captured.values).toEqual({ ...committedInitialValues, journalnr: 'Normal commit' });

    act(() => {
      captured.replaceValues!({ ...initialValues, journalnr: 'Erstatning' });
    });

    expect(captured.formVersion).toBe(baselineFormVersion + 1);
    expect(captured.values).toEqual({ ...committedInitialValues, journalnr: 'Erstatning' });

    act(() => {
      captured.resetForm!();
    });

    expect(captured.formVersion).toBe(baselineFormVersion + 2);
    expect(captured.values).toEqual(committedInitialValues);
  });

  it('bryder formVersion ved første hydration og ved efterfølgende authoritative events', () => {
    const captured: {
      formVersion: number | null;
      replaceValues: UsePersistedFormReturn<typeof initialValues>['replaceValues'] | null;
      resetForm: UsePersistedFormReturn<typeof initialValues>['resetForm'] | null;
      setValues: UsePersistedFormReturn<typeof initialValues>['setValues'] | null;
    } = {
      formVersion: null,
      replaceValues: null,
      resetForm: null,
      setValues: null,
    };

    const Capture = () => {
      const form = usePersistedForm(stamdataSchema, 'stamdata', initialValues);
      captured.formVersion = form.formVersion;
      captured.replaceValues = form.replaceValues;
      captured.resetForm = form.resetForm;
      captured.setValues = form.setValues;
      return null;
    };

    renderWithProviders(<Capture />);

    // Første hydration (sker i useEffect i FormPersistenceProvider) skal bumpe formVersion,
    // så draft-state hooks (useRowDrafts) kan resynce fra de persisterede værdier.
    expect(captured.formVersion).toBe(1);

    act(() => {
      captured.setValues!((prev) => ({ ...prev, journalnr: 'Normal commit' }));
    });

    // Normale commits bumper ikke formVersion
    expect(captured.formVersion).toBe(1);

    act(() => {
      captured.replaceValues!({ ...initialValues, journalnr: 'Erstatning' });
    });

    expect(captured.formVersion).toBe(2);

    act(() => {
      captured.resetForm!();
    });

    expect(captured.formVersion).toBe(3);
  });

  it('capture kun history for reelle commits efter schema-validering', () => {
    const captured: {
      setFieldValue: UsePersistedFormReturn<typeof initialValues>['setFieldValue'] | null;
    } = {
      setFieldValue: null,
    };

    const Capture = () => {
      const form = usePersistedForm(stamdataSchema, 'stamdata', initialValues);
      captured.setFieldValue = form.setFieldValue;
      return null;
    };

    renderWithProviders(<Capture />);

    act(() => {
      captured.setFieldValue!('journalnr', 'A');
    });

    expect(undoRedoStore.getState().past).toHaveLength(1);
    expect(undoRedoStore.getState().past[0].sections.stamdata).toBeNull();

    act(() => {
      captured.setFieldValue!('journalnr', 'A');
    });

    expect(undoRedoStore.getState().past).toHaveLength(1);
  });

  it('bevarer history når sektionen nulstilles eksplicit', () => {
    const captured: {
      setFieldValue: UsePersistedFormReturn<typeof initialValues>['setFieldValue'] | null;
      resetForm: UsePersistedFormReturn<typeof initialValues>['resetForm'] | null;
    } = {
      setFieldValue: null,
      resetForm: null,
    };

    const Capture = () => {
      const form = usePersistedForm(stamdataSchema, 'stamdata', initialValues);
      captured.setFieldValue = form.setFieldValue;
      captured.resetForm = form.resetForm;
      return null;
    };

    renderWithProviders(<Capture />);

    act(() => {
      captured.setFieldValue!('journalnr', 'A');
    });
    expect(undoRedoStore.getState().canUndo()).toBe(true);

    act(() => {
      captured.resetForm!();
    });

    expect(undoRedoStore.getState().canUndo()).toBe(true);
  });

  it('fail-closed uden render-throw hvis committed sektion ikke matcher schema', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const captured: {
      values: typeof initialValues | null;
    } = {
      values: null,
    };

    const Capture = () => {
      const form = usePersistedForm(stamdataSchema, 'stamdata', initialValues);
      captured.values = form.values;
      return null;
    };

    try {
      expect(() => renderWithProviders(<Capture />)).not.toThrow();

      act(() => {
        formPersistenceStore.getState().__setSectionUnsafe(
          'stamdata',
          { journalnr: 123 } as unknown as typeof initialValues
        );
      });

      expect(captured.values).toEqual(committedInitialValues);
      expect(consoleErrorSpy).toHaveBeenCalled();
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });
});
