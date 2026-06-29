// @vitest-environment jsdom
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { AppSettingsProvider } from '../../../contexts/AppSettingsContext';
import { FormPersistenceProvider } from '../../../contexts/FormPersistenceContext';
import { __resetUndoFocusTrackerForTests } from '../../../utils/undoFocusTracker';

const undoRedoMocks = vi.hoisted(() => ({
  undo: vi.fn(),
  redo: vi.fn(),
}));

vi.mock('../../../hooks/useUndoRedo', () => ({
  useUndoRedo: () => ({
    canUndo: true,
    canRedo: true,
    undo: undoRedoMocks.undo,
    redo: undoRedoMocks.redo,
  }),
}));

import MainLayout from '../../../components/layout/MainLayout';

const renderLayout = (children: React.ReactNode = <input aria-label="Aktivt felt" autoFocus />) =>
  render(
    <AppSettingsProvider>
      <FormPersistenceProvider>
        <MemoryRouter initialEntries={['/stamdata']}>
          <MainLayout>{children}</MainLayout>
        </MemoryRouter>
      </FormPersistenceProvider>
    </AppSettingsProvider>,
  );

describe('MainLayout undo/redo editor guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  afterEach(() => {
    __resetUndoFocusTrackerForTests();
  });

  it('ignores undo shortcuts silently while a text editor is open', async () => {
    renderLayout();

    await waitFor(() => {
      expect(screen.getByLabelText('Aktivt felt')).toHaveFocus();
    });

    const event = new KeyboardEvent('keydown', {
      key: 'z',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });

    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(undoRedoMocks.undo).not.toHaveBeenCalled();
    expect(undoRedoMocks.redo).not.toHaveBeenCalled();
    expect(screen.queryByText('Kan ikke fortryde eller gentage: afslut eller ret det aktive felt først.')).toBeNull();
  });

  it('calls undo when no editor is active', () => {
    renderLayout(<button type="button">Ikke editor</button>);

    const event = new KeyboardEvent('keydown', {
      key: 'z',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });

    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(undoRedoMocks.undo).toHaveBeenCalledTimes(1);
    expect(undoRedoMocks.redo).not.toHaveBeenCalled();
  });

  it.each([
    ['Ctrl+Y', { key: 'y', ctrlKey: true }],
    ['Ctrl+Shift+Z', { key: 'z', ctrlKey: true, shiftKey: true }],
  ])('calls redo for %s when no editor is active', (_label, init) => {
    renderLayout(<button type="button">Ikke editor</button>);

    const event = new KeyboardEvent('keydown', {
      ...init,
      bubbles: true,
      cancelable: true,
    });

    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(undoRedoMocks.redo).toHaveBeenCalledTimes(1);
    expect(undoRedoMocks.undo).not.toHaveBeenCalled();
  });
});
