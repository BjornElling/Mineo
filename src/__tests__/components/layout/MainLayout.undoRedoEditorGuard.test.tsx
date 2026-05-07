import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { AppSettingsProvider } from '../../../contexts/AppSettingsContext';
import { FormPersistenceProvider } from '../../../contexts/FormPersistenceContext';

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

const renderLayout = () =>
  render(
    <AppSettingsProvider>
      <FormPersistenceProvider>
        <MemoryRouter initialEntries={['/stamdata']}>
          <MainLayout>
            <input aria-label="Aktivt felt" autoFocus />
          </MainLayout>
        </MemoryRouter>
      </FormPersistenceProvider>
    </AppSettingsProvider>,
  );

describe('MainLayout undo/redo editor guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
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
});
