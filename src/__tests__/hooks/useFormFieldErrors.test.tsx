// @vitest-environment jsdom
import React from 'react';
import { render, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import {
  useFormFieldErrors,
  useFieldErrorsBySourceForSection,
  useFormFieldErrorReporter,
} from '../../hooks/useFormFieldErrors';
import { clearResolvedFieldErrorsCache } from '../../hooks/useFormPersistenceSelectors';
import type { FormPersistenceContextValue } from '../../contexts/FormPersistenceContext.shared';
import { FormPersistenceContext } from '../../contexts/FormPersistenceContext.internal';
import { FormPersistenceProvider } from '../../contexts/FormPersistenceContext';
import type { StorageKey } from '../../config/storageManifest';
import type { FormFieldError, ReportableFieldError } from '../../types/fieldErrors';
import { formPersistenceStore } from '../../stores/formPersistenceStore';
import { undoRedoStore } from '../../stores/undoRedoStore';
import { PERSISTED_DATA_VERSION } from '../../config/persistenceVersion';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const makeCtx = (overrides: Partial<FormPersistenceContextValue> = {}): FormPersistenceContextValue => ({
  getPersistedData: vi.fn(() => null),
  // Optimistisk standard: tests der vil dække afvist commit, skal override return-værdien eksplicit.
  persistData: vi.fn(() => true),
  clearPageData: vi.fn(),
  clearAllData: vi.fn(),
  hasAnyData: vi.fn(() => false),
  getFieldErrors: vi.fn(() => ({})),
  getFieldErrorsBySource: vi.fn(() => ({}) as ReturnType<FormPersistenceContextValue['getFieldErrorsBySource']>),
  getFieldError: vi.fn(() => undefined),
  setFieldError: vi.fn(),
  clearFieldErrors: vi.fn(),
  clearAllFieldErrors: vi.fn(),
  commitInvalidDraft: vi.fn(() => true),
  clearInvalidDraft: vi.fn(() => true),
  getInvalidDraft: vi.fn(() => undefined),
  getInvalidDraftsForSection: vi.fn(() => ({})),
  getSectionRevision: vi.fn(() => 0),
  getFieldErrorRevision: vi.fn(() => 0),
  replaceAllPersistedData: vi.fn(),
  lastNotice: null,
  lastNoticeEpoch: 0,
  ...overrides,
});

const renderWithMockContext = (ctx: FormPersistenceContextValue, ui: React.ReactNode) =>
  render(
    <MemoryRouter initialEntries={['/stamdata']}>
      <FormPersistenceContext.Provider value={ctx}>
        {ui}
      </FormPersistenceContext.Provider>
    </MemoryRouter>
  );

// ─── useFormFieldErrors ────────────────────────────────────────────────────────

describe('useFormFieldErrors', () => {
  beforeEach(() => {
    sessionStorage.clear();
    clearResolvedFieldErrorsCache();
    formPersistenceStore.getState().clearAll({
      hydrated: true,
      schemaFingerprint: PERSISTED_DATA_VERSION,
      lastCommittedAt: Date.now(),
    });
    formPersistenceStore.getState().clearAllFieldErrors();
    undoRedoStore.getState().clear();
  });

  it('læser resolved errors via den reelle store-backed selector-sti', () => {
    const captured: { value: Partial<Record<string, FormFieldError>> } = { value: {} };
    const Comp = () => {
      captured.value = useFormFieldErrors('stamdata' as StorageKey);
      return null;
    };

    // Fejl sættes EFTER mount: provideren hydrerer ved mount og rydder fieldErrors atomisk (kontrakt §6.3),
    // og i den rigtige app sættes feltfejl først under brugerinteraktion inde i provideren.
    render(
      <FormPersistenceProvider>
        <Comp />
      </FormPersistenceProvider>
    );

    act(() => {
      formPersistenceStore.getState().setFieldError('stamdata', 'journalnr', 'input', {
        message: 'Mangler journalnummer',
        severity: 'error',
      });
    });

    expect(captured.value).toEqual({
      journalnr: { message: 'Mangler journalnummer', severity: 'error', source: 'input', blocksSave: true },
    });
  });

  it('returnerer tomt objekt når ingen fejl eksisterer', () => {
    const captured: { value: Record<string, FormFieldError> } = { value: { placeholder: { message: 'x', severity: 'error', source: 'input' } } };
    const Comp = () => {
      captured.value = useFormFieldErrors('satser' as StorageKey);
      return null;
    };

    render(
      <FormPersistenceProvider>
        <Comp />
      </FormPersistenceProvider>
    );

    expect(captured.value).toEqual({});
  });
});

// ─── useFieldErrorsBySourceForSection ─────────────────────────────────────────

describe('useFieldErrorsBySourceForSection', () => {
  it('læser field errors by source via den reelle store-backed selector-sti', () => {
    const captured: {
      value: ReturnType<typeof useFieldErrorsBySourceForSection> | null;
    } = { value: null };
    const Comp = () => {
      captured.value = useFieldErrorsBySourceForSection('aarsloen' as StorageKey);
      return null;
    };

    // Fejl sættes EFTER mount (provideren rydder fieldErrors ved hydrate, kontrakt §6.3).
    render(
      <FormPersistenceProvider>
        <Comp />
      </FormPersistenceProvider>
    );

    act(() => {
      formPersistenceStore.getState().setFieldError('aarsloen', 'tableData', 'input', {
        message: 'Fejl i tabel',
        severity: 'error',
      });
    });

    expect(captured.value).toEqual({
      tableData: {
        input: { message: 'Fejl i tabel', severity: 'error', source: 'input', blocksSave: true },
      },
    });
  });
});

// ─── useFormFieldErrorReporter ────────────────────────────────────────────────

describe('useFormFieldErrorReporter', () => {
  it('kalder setFieldError med fejl-besked ved reportError(msg)', async () => {
    const setFieldError = vi.fn();
    const ctx = makeCtx({ setFieldError });

    let reportError!: (msg: ReportableFieldError | undefined) => void;
    const Comp = () => {
      reportError = useFormFieldErrorReporter('stamdata' as StorageKey, 'journalnr' as never);
      return null;
    };

    renderWithMockContext(ctx, <Comp />);

    await act(async () => {
      reportError('Journalnummer mangler');
    });

    expect(setFieldError).toHaveBeenCalledWith(
      'stamdata',
      'journalnr',
      'input',
      { message: 'Journalnummer mangler', severity: 'error', blocksSave: true }
    );
  });

  it('kalder setFieldError med null ved reportError(undefined)', async () => {
    const setFieldError = vi.fn();
    const ctx = makeCtx({ setFieldError });

    let reportError!: (msg: ReportableFieldError | undefined) => void;
    const Comp = () => {
      reportError = useFormFieldErrorReporter('stamdata' as StorageKey, 'journalnr' as never);
      return null;
    };

    renderWithMockContext(ctx, <Comp />);

    await act(async () => {
      reportError(undefined);
    });

    expect(setFieldError).toHaveBeenCalledWith('stamdata', 'journalnr', 'input', null);
  });

  it('kalder setFieldError med null ved reportError med tom streng', async () => {
    const setFieldError = vi.fn();
    const ctx = makeCtx({ setFieldError });

    let reportError!: (msg: ReportableFieldError | undefined) => void;
    const Comp = () => {
      reportError = useFormFieldErrorReporter('stamdata' as StorageKey, 'journalnr' as never);
      return null;
    };

    renderWithMockContext(ctx, <Comp />);

    await act(async () => {
      reportError('   '); // whitespace-only → behandles som tom
    });

    expect(setFieldError).toHaveBeenCalledWith('stamdata', 'journalnr', 'input', null);
  });

  it('bruger custom severity når options.severity er angivet', async () => {
    const setFieldError = vi.fn();
    const ctx = makeCtx({ setFieldError });

    let reportError!: (msg: ReportableFieldError | undefined) => void;
    const Comp = () => {
      reportError = useFormFieldErrorReporter(
        'stamdata' as StorageKey,
        'journalnr' as never,
        { severity: 'warning' }
      );
      return null;
    };

    renderWithMockContext(ctx, <Comp />);

    await act(async () => {
      reportError('Advarsel');
    });

    expect(setFieldError).toHaveBeenCalledWith(
      'stamdata',
      'journalnr',
      'input',
      { message: 'Advarsel', severity: 'warning', blocksSave: true }
    );
  });

  it('videresender blocksSave=false for committede UI-only fejl', async () => {
    const setFieldError = vi.fn();
    const ctx = makeCtx({ setFieldError });

    let reportError!: (msg: ReportableFieldError | undefined) => void;
    const Comp = () => {
      reportError = useFormFieldErrorReporter('stamdata' as StorageKey, 'journalnr' as never);
      return null;
    };

    renderWithMockContext(ctx, <Comp />);

    await act(async () => {
      reportError({ message: 'Datoen ligger uden for intervallet', blocksSave: false });
    });

    expect(setFieldError).toHaveBeenCalledWith(
      'stamdata',
      'journalnr',
      'input',
      { message: 'Datoen ligger uden for intervallet', severity: 'error', blocksSave: false }
    );
  });

  it('rydder ikke fejl ved unmount', async () => {
    const setFieldError = vi.fn();
    const ctx = makeCtx({ setFieldError });

    const Comp = () => {
      useFormFieldErrorReporter('stamdata' as StorageKey, 'journalnr' as never);
      return null;
    };

    const { unmount } = renderWithMockContext(ctx, <Comp />);

    setFieldError.mockClear();

    await act(async () => {
      unmount();
    });

    expect(setFieldError).not.toHaveBeenCalled();
  });

  it('rapporterer en blokerende fejl uden at oprette et undo-skridt (undo-capture ejes nu af commitInvalidDraft-kanalen)', async () => {
    const setFieldError = vi.fn();
    const ctx = makeCtx({ setFieldError });

    let reportError!: (msg: ReportableFieldError | undefined) => void;
    const Comp = () => {
      reportError = useFormFieldErrorReporter('stamdata' as StorageKey, 'journalnr' as never);
      return null;
    };

    renderWithMockContext(
      ctx,
      <>
        <input data-mineo-undo-focus-token="focus-a" data-mineo-undo-field-path="journalnr" />
        <Comp />
      </>
    );

    await act(async () => {
      reportError({ message: 'Ugyldigt input', blocksSave: true });
    });

    expect(setFieldError).toHaveBeenCalledWith(
      'stamdata',
      'journalnr',
      'input',
      { message: 'Ugyldigt input', severity: 'error', blocksSave: true }
    );
    // Reporteren capturer ikke længere undo-frames; den ikke-committbare rå draft (og dens undo-frame)
    // ejes af invalidDrafts-kanalen via FormPersistenceContext.commitInvalidDraft.
    expect(undoRedoStore.getState().past).toHaveLength(0);
  });
});
