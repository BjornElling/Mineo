// @vitest-environment jsdom
import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PERSISTED_DATA_VERSION } from '../../../config/persistenceVersion';
import { clearResolvedFieldErrorsCache } from '../../../hooks/useFormPersistenceSelectors';
import { formPersistenceStore } from '../../../stores/formPersistenceStore';
import { undoRedoStore } from '../../../stores/undoRedoStore';

vi.mock('../../../components/tables/useRentekravRows', () => ({
  __esModule: true,
  default: () => ({
    draftRows: [],
    onFieldChange: vi.fn(),
    onRowBlur: vi.fn(),
    reorderRows: vi.fn(),
    committedById: new Map(),
  }),
}));

vi.mock('../../../components/pages/renteberegning/RenteberegningTab', () => ({
  __esModule: true,
  default: (props: {
    kommentarer?: string;
    onKommentarerCommit: (event: { target: { value: string } }) => void;
  }) => (
    <section aria-label="Procesrente beregner">
      <output data-testid="kommentarer">{props.kommentarer ?? ''}</output>
      <button
        type="button"
        onClick={() => {
          props.onKommentarerCommit({ target: { value: '  Standalone kommentar  ' } });
        }}
      >
        Commit kommentar
      </button>
    </section>
  ),
}));

import MinProcesrenteApp from '../../../apps/minprocesrente/MinProcesrenteApp';

describe('MinProcesrenteApp', () => {
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    window.history.replaceState(null, '', '/');
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
    window.matchMedia = originalMatchMedia;
    document.documentElement.style.backgroundColor = '';
    document.body.innerHTML = '<div id="root"></div>';
    document.body.style.backgroundColor = '';
    document.body.style.overflow = '';
    document.body.style.height = '';
    document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => meta.remove());
    const themeColorMeta = document.createElement('meta');
    themeColorMeta.name = 'theme-color';
    themeColorMeta.content = '#e9ecef';
    document.head.appendChild(themeColorMeta);
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it('monterer standalone provider-kæden og committer renteberegning via den faktiske persistence-hook', async () => {
    const user = userEvent.setup();

    render(<MinProcesrenteApp />);

    expect(screen.getByRole('heading', { name: 'minProcesrente.dk' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Procesrente beregner' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Commit kommentar' }));

    await waitFor(() => {
      expect(screen.getByTestId('kommentarer')).toHaveTextContent('Standalone kommentar');
    });
    expect(formPersistenceStore.getState().sections.renteberegning).toMatchObject({
      kommentarer: 'Standalone kommentar',
    });
  });

  it('fortryder et committed felt med Ctrl+Z (undo virker på standalone-siden)', async () => {
    const user = userEvent.setup();

    render(<MinProcesrenteApp />);

    await user.click(screen.getByRole('button', { name: 'Commit kommentar' }));
    await waitFor(() => {
      expect(formPersistenceStore.getState().sections.renteberegning).toMatchObject({
        kommentarer: 'Standalone kommentar',
      });
    });
    expect(undoRedoStore.getState().canUndo()).toBe(true);

    // Ingen editor er åben (fokus er på en knap), så Ctrl+Z udfører undo.
    act(() => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true, cancelable: true })
      );
    });

    await waitFor(() => {
      expect(formPersistenceStore.getState().sections.renteberegning?.kommentarer).toBeUndefined();
    });
    expect(undoRedoStore.getState().canRedo()).toBe(true);
  });

  it('sætter mobilens browser-chrome til samme baggrund som siden på touch-enheder', () => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query === '(pointer: coarse)',
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    const { unmount } = render(<MinProcesrenteApp />);

    expect(document.documentElement.style.backgroundColor).toBe('rgb(248, 249, 250)');
    expect(document.body.style.backgroundColor).toBe('rgb(248, 249, 250)');
    expect(document.getElementById('root')?.style.backgroundColor).toBe('rgb(248, 249, 250)');
    expect(document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.content).toBe('#f8f9fa');

    unmount();

    expect(document.documentElement.style.backgroundColor).toBe('');
    expect(document.body.style.backgroundColor).toBe('');
    expect(document.getElementById('root')?.style.backgroundColor).toBe('');
    expect(document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.content).toBe('#e9ecef');
  });
});
