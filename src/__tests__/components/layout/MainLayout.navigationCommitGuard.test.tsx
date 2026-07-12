// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { AppSettingsProvider } from '../../../contexts/AppSettingsContext';
import { FormPersistenceProvider, initializePersistenceRuntime } from '../../../contexts/FormPersistenceContext';
import MainLayout from '../../../components/layout/MainLayout';
import StyledTextField from '../../../components/inputs/StyledTextField';

describe('MainLayout navigation commit guard', () => {
  it('keeps navigation fail-closed when an editable field is still active during page change', async () => {
    const ActiveEditorPage = () => (
      <div>
        <div>Stamdata testside</div>
        <StyledTextField value="" label="Aktivt felt" autoFocus onCommit={() => undefined} />
      </div>
    );

    const SatserPage = () => <div>Satser testside</div>;

    render(
      <AppSettingsProvider>
        <FormPersistenceProvider runtime={initializePersistenceRuntime()}>
          <MemoryRouter initialEntries={['/stamdata']}>
            <Routes>
              <Route
                path="/stamdata"
                element={
                  <MainLayout>
                    <ActiveEditorPage />
                  </MainLayout>
                }
              />
              <Route
                path="/satser"
                element={
                  <MainLayout>
                    <SatserPage />
                  </MainLayout>
                }
              />
            </Routes>
          </MemoryRouter>
        </FormPersistenceProvider>
      </AppSettingsProvider>
    );

    await waitFor(() => {
      expect(screen.getByLabelText('Aktivt felt')).toHaveFocus();
    });
    fireEvent.keyDown(screen.getByLabelText('Aktivt felt'), { key: 'a', code: 'KeyA' });
    await waitFor(() => expect(screen.getByLabelText('Aktivt felt')).not.toHaveAttribute('readonly'));

    fireEvent.click(screen.getByText('Satser'));

    expect(screen.getByText('Stamdata testside')).toBeInTheDocument();
    expect(screen.queryByText('Satser testside')).toBeNull();
    expect(await screen.findByText('Kan ikke skifte side: afslut eller ret det aktive felt først.')).toBeInTheDocument();
    expect(screen.getByLabelText('Aktivt felt')).toHaveFocus();
  });
});
