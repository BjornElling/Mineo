// @vitest-environment jsdom
import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { usePersistedSection } from '../../hooks/usePersistedSection';
import { FormPersistenceContext, type FormPersistenceContextValue } from '../../contexts/FormPersistenceContext.shared';
import type { StorageKey } from '../../config/storageManifest';
import type { PersistedSectionMap } from '../../config/persistenceRegistry';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Builds a minimal FormPersistenceContextValue with a controllable
 * getPersistedData implementation. All other methods throw so that any
 * accidental call surfaces immediately.
 */
const makeContext = (
  getPersistedData: <K extends StorageKey>(key: K) => PersistedSectionMap[K] | null
): FormPersistenceContextValue => ({
  getPersistedData,
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
});

type CapturedResult<K extends StorageKey> = {
  value: PersistedSectionMap[K] | null;
};

function renderWithContext<K extends StorageKey>(
  pageKey: K,
  ctx: FormPersistenceContextValue
): CapturedResult<K> {
  const captured: CapturedResult<K> = { value: null };

  const Capture = () => {
    captured.value = usePersistedSection(pageKey);
    return null;
  };

  render(
    <FormPersistenceContext.Provider value={ctx}>
      <Capture />
    </FormPersistenceContext.Provider>
  );

  return captured;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('usePersistedSection', () => {
  it('returns null when getPersistedData returns null', () => {
    const ctx = makeContext(() => null);
    const result = renderWithContext('stamdata', ctx);
    expect(result.value).toBeNull();
  });

  it('returns the section data returned by getPersistedData', () => {
    const stamdataFixture: PersistedSectionMap['stamdata'] = {
      journalnr: 'J-42',
      advokat: '',
      sagsbehandler: '',
      skadelidte: 'Test Person',
      skadestype: 'Arbejdsulykke',
      skadesdato: '2023-06-01',
    };

    const ctx = makeContext(<K extends StorageKey>(key: K) => {
      if (key === 'stamdata') return stamdataFixture as PersistedSectionMap[K];
      return null;
    });

    const result = renderWithContext('stamdata', ctx);
    expect(result.value).toBe(stamdataFixture);
  });

  it('forwards the pageKey argument to getPersistedData', () => {
    const getPersistedData = vi.fn(() => null) as FormPersistenceContextValue['getPersistedData'];
    const ctx = makeContext(getPersistedData);

    renderWithContext('aarsloen', ctx);

    expect(getPersistedData).toHaveBeenCalledWith('aarsloen');
  });

  it('throws when used outside FormPersistenceContext', () => {
    // The hook depends on useFormPersistence which throws if context is null.
    const Bare = () => {
      usePersistedSection('stamdata');
      return null;
    };

    // Suppress the expected error output from React's error boundary mechanism.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Bare />)).toThrow();
    spy.mockRestore();
  });

  it('reflects an updated value when context provides a new reference', async () => {
    let stamdataRef: PersistedSectionMap['stamdata'] | null = null;

    const getPersistedData = vi.fn(<K extends StorageKey>(key: K): PersistedSectionMap[K] | null => {
      if (key === 'stamdata') return stamdataRef as PersistedSectionMap[K] | null;
      return null;
    });

    const captured: { value: PersistedSectionMap['stamdata'] | null } = { value: null };

    const Capture = () => {
      captured.value = usePersistedSection('stamdata');
      return null;
    };

    const ctx = makeContext(getPersistedData);

    const { rerender } = render(
      <FormPersistenceContext.Provider value={ctx}>
        <Capture />
      </FormPersistenceContext.Provider>
    );

    expect(captured.value).toBeNull();

    // Update the data that getPersistedData returns and force a re-render
    // by providing a new context value object (simulates store update).
    stamdataRef = {
      journalnr: 'J-99',
      advokat: '',
      sagsbehandler: '',
      skadelidte: 'Updated',
      skadestype: undefined,
      skadesdato: undefined,
    };

    const updatedCtx = makeContext(getPersistedData);

    rerender(
      <FormPersistenceContext.Provider value={updatedCtx}>
        <Capture />
      </FormPersistenceContext.Provider>
    );

    await waitFor(() => {
      expect(captured.value).toBe(stamdataRef);
    });
  });
});
