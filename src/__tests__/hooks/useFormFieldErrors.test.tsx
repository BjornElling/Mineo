// @vitest-environment jsdom
import React from 'react';
import { render, act } from '@testing-library/react';
import {
  useFormFieldErrors,
  useFormFieldErrorsBySource,
  useFormFieldErrorReporter,
} from '../../hooks/useFormFieldErrors';
import { FormPersistenceContext, type FormPersistenceContextValue } from '../../contexts/FormPersistenceContext.shared';
import type { StorageKey } from '../../config/storageManifest';
import type { FormFieldError } from '../../types/fieldErrors';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const makeCtx = (overrides: Partial<FormPersistenceContextValue> = {}): FormPersistenceContextValue => ({
  getPersistedData: vi.fn(() => null),
  persistData: vi.fn(),
  clearPageData: vi.fn(),
  clearAllData: vi.fn(),
  hasAnyData: vi.fn(() => false),
  getFieldErrors: vi.fn(() => ({})),
  getFieldErrorsBySource: vi.fn(() => ({}) as ReturnType<FormPersistenceContextValue['getFieldErrorsBySource']>),
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

function renderWithCtx<T>(
  ctx: FormPersistenceContextValue,
  capture: { value: T },
  Comp: React.FC
) {
  render(
    <FormPersistenceContext.Provider value={ctx}>
      <Comp />
    </FormPersistenceContext.Provider>
  );
  return capture;
}

// ─── useFormFieldErrors ────────────────────────────────────────────────────────

describe('useFormFieldErrors', () => {
  it('kalder getFieldErrors med korrekt pageKey og returnerer resultatet', () => {
    const errors: Partial<Record<string, FormFieldError>> = {
      journalnr: { message: 'Mangler journalnummer', severity: 'error' },
    };
    const getFieldErrors = vi.fn(() => errors);
    const ctx = makeCtx({ getFieldErrors });

    const captured: { value: typeof errors } = { value: {} };
    const Comp = () => {
      captured.value = useFormFieldErrors('stamdata' as StorageKey);
      return null;
    };

    renderWithCtx(ctx, captured, Comp);

    expect(getFieldErrors).toHaveBeenCalledWith('stamdata');
    expect(captured.value).toBe(errors);
  });

  it('returnerer tomt objekt når ingen fejl eksisterer', () => {
    const ctx = makeCtx({ getFieldErrors: vi.fn(() => ({})) });
    const captured: { value: Record<string, FormFieldError> } = { value: { placeholder: { message: 'x', severity: 'error' } } };
    const Comp = () => {
      captured.value = useFormFieldErrors('satser' as StorageKey);
      return null;
    };

    renderWithCtx(ctx, captured, Comp);

    expect(captured.value).toEqual({});
  });
});

// ─── useFormFieldErrorsBySource ────────────────────────────────────────────────

describe('useFormFieldErrorsBySource', () => {
  it('kalder getFieldErrorsBySource med korrekt pageKey', () => {
    const getFieldErrorsBySource = vi.fn(() => ({}) as ReturnType<FormPersistenceContextValue['getFieldErrorsBySource']>);
    const ctx = makeCtx({ getFieldErrorsBySource });

    const Comp = () => {
      useFormFieldErrorsBySource('aarsloen' as StorageKey);
      return null;
    };

    render(
      <FormPersistenceContext.Provider value={ctx}>
        <Comp />
      </FormPersistenceContext.Provider>
    );

    expect(getFieldErrorsBySource).toHaveBeenCalledWith('aarsloen');
  });
});

// ─── useFormFieldErrorReporter ────────────────────────────────────────────────

describe('useFormFieldErrorReporter', () => {
  it('kalder setFieldError med fejl-besked ved reportError(msg)', async () => {
    const setFieldError = vi.fn();
    const ctx = makeCtx({ setFieldError });

    let reportError!: (msg: string | undefined) => void;
    const Comp = () => {
      reportError = useFormFieldErrorReporter('stamdata' as StorageKey, 'journalnr' as never);
      return null;
    };

    render(
      <FormPersistenceContext.Provider value={ctx}>
        <Comp />
      </FormPersistenceContext.Provider>
    );

    await act(async () => {
      reportError('Journalnummer mangler');
    });

    expect(setFieldError).toHaveBeenCalledWith(
      'stamdata',
      'journalnr',
      'input',
      { message: 'Journalnummer mangler', severity: 'error' }
    );
  });

  it('kalder setFieldError med null ved reportError(undefined)', async () => {
    const setFieldError = vi.fn();
    const ctx = makeCtx({ setFieldError });

    let reportError!: (msg: string | undefined) => void;
    const Comp = () => {
      reportError = useFormFieldErrorReporter('stamdata' as StorageKey, 'journalnr' as never);
      return null;
    };

    render(
      <FormPersistenceContext.Provider value={ctx}>
        <Comp />
      </FormPersistenceContext.Provider>
    );

    await act(async () => {
      reportError(undefined);
    });

    expect(setFieldError).toHaveBeenCalledWith('stamdata', 'journalnr', 'input', null);
  });

  it('kalder setFieldError med null ved reportError med tom streng', async () => {
    const setFieldError = vi.fn();
    const ctx = makeCtx({ setFieldError });

    let reportError!: (msg: string | undefined) => void;
    const Comp = () => {
      reportError = useFormFieldErrorReporter('stamdata' as StorageKey, 'journalnr' as never);
      return null;
    };

    render(
      <FormPersistenceContext.Provider value={ctx}>
        <Comp />
      </FormPersistenceContext.Provider>
    );

    await act(async () => {
      reportError('   '); // whitespace-only → behandles som tom
    });

    expect(setFieldError).toHaveBeenCalledWith('stamdata', 'journalnr', 'input', null);
  });

  it('bruger custom severity når options.severity er angivet', async () => {
    const setFieldError = vi.fn();
    const ctx = makeCtx({ setFieldError });

    let reportError!: (msg: string | undefined) => void;
    const Comp = () => {
      reportError = useFormFieldErrorReporter(
        'stamdata' as StorageKey,
        'journalnr' as never,
        { severity: 'warning' }
      );
      return null;
    };

    render(
      <FormPersistenceContext.Provider value={ctx}>
        <Comp />
      </FormPersistenceContext.Provider>
    );

    await act(async () => {
      reportError('Advarsel');
    });

    expect(setFieldError).toHaveBeenCalledWith(
      'stamdata',
      'journalnr',
      'input',
      { message: 'Advarsel', severity: 'warning' }
    );
  });

  it('rydder ikke fejl ved unmount', async () => {
    const setFieldError = vi.fn();
    const ctx = makeCtx({ setFieldError });

    const Comp = () => {
      useFormFieldErrorReporter('stamdata' as StorageKey, 'journalnr' as never);
      return null;
    };

    const { unmount } = render(
      <FormPersistenceContext.Provider value={ctx}>
        <Comp />
      </FormPersistenceContext.Provider>
    );

    setFieldError.mockClear();

    await act(async () => {
      unmount();
    });

    expect(setFieldError).not.toHaveBeenCalled();
  });
});
