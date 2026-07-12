// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { AppSettingsProvider } from '../../../contexts/AppSettingsContext';
import { FormPersistenceProvider, initializePersistenceRuntime } from '../../../contexts/FormPersistenceContext';
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
import StyledTextField from '../../../components/inputs/StyledTextField';

const renderLayout = (
  children: React.ReactNode = (
    <StyledTextField value="" label="Aktivt felt" autoFocus onCommit={() => true} />
  ),
) =>
  render(
    <AppSettingsProvider>
      <FormPersistenceProvider runtime={initializePersistenceRuntime()}>
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
    fireEvent.keyDown(screen.getByLabelText('Aktivt felt'), { key: 'a', code: 'KeyA' });
    await waitFor(() => expect(screen.getByLabelText('Aktivt felt')).not.toHaveAttribute('readonly'));

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

  it('calls undo when no editor is active', async () => {
    renderLayout(<button type="button">Ikke editor</button>);

    const event = new KeyboardEvent('keydown', {
      key: 'z',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });

    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    await waitFor(() => expect(undoRedoMocks.undo).toHaveBeenCalledTimes(1));
    expect(undoRedoMocks.redo).not.toHaveBeenCalled();
  });

  it.each([
    ['Ctrl+Y', { key: 'y', ctrlKey: true }],
    ['Ctrl+Shift+Z', { key: 'z', ctrlKey: true, shiftKey: true }],
  ])('calls redo for %s when no editor is active', async (_label, init) => {
    renderLayout(<button type="button">Ikke editor</button>);

    const event = new KeyboardEvent('keydown', {
      ...init,
      bubbles: true,
      cancelable: true,
    });

    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    await waitFor(() => expect(undoRedoMocks.redo).toHaveBeenCalledTimes(1));
    expect(undoRedoMocks.undo).not.toHaveBeenCalled();
  });
});
