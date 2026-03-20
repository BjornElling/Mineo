// @vitest-environment jsdom
import React from 'react';
import { render } from '@testing-library/react';
import { z } from 'zod';
import { usePersistedForm, type UsePersistedFormReturn } from '../../hooks/usePersistedForm';
import { FormPersistenceContext, type FormPersistenceContextValue } from '../../contexts/FormPersistenceContext.shared';

const stamdataSchema = z.object({
  journalnr: z.string(),
});

const initialValues = {
  journalnr: '',
};

const makeContext = (overrides: Partial<FormPersistenceContextValue> = {}): FormPersistenceContextValue => ({
  getPersistedData: vi.fn(() => null),
  persistData: vi.fn(),
  clearPageData: vi.fn(),
  clearAllData: vi.fn(),
  hasAnyData: vi.fn(() => false),
  getFieldErrors: vi.fn(() => ({})),
  getFieldErrorsBySource: vi.fn(() => ({})) as FormPersistenceContextValue['getFieldErrorsBySource'],
  getFieldError: vi.fn(() => undefined),
  setFieldError: vi.fn(),
  clearFieldErrors: vi.fn(),
  clearAllFieldErrors: vi.fn(),
  authoritativeSnapshotEpoch: 0,
  getSectionRevision: vi.fn(() => 0),
  getFieldErrorRevision: vi.fn(() => 0),
  replaceAllPersistedData: vi.fn(),
  lastNotice: null,
  lastNoticeEpoch: 0,
  ...overrides,
});

describe('usePersistedForm', () => {
  it('bevarer setValues- og resetForm-referencer når persistence-context funktioner skifter identitet', () => {
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

    const firstContext = makeContext();
    const { rerender } = render(
      <FormPersistenceContext.Provider value={firstContext}>
        <Capture />
      </FormPersistenceContext.Provider>
    );

    const firstSetValues = captured.setValues;
    const firstResetForm = captured.resetForm;

    const secondContext = makeContext({
      getPersistedData: vi.fn(() => null),
      persistData: vi.fn(),
      clearPageData: vi.fn(),
      clearFieldErrors: vi.fn(),
    });

    rerender(
      <FormPersistenceContext.Provider value={secondContext}>
        <Capture />
      </FormPersistenceContext.Provider>
    );

    expect(captured.setValues).toBe(firstSetValues);
    expect(captured.resetForm).toBe(firstResetForm);
  });
});
