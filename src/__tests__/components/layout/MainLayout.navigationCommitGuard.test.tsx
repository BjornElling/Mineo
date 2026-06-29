// @vitest-environment jsdom
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { AppSettingsProvider } from '../../../contexts/AppSettingsContext';
import { FormPersistenceProvider } from '../../../contexts/FormPersistenceContext';
import MainLayout from '../../../components/layout/MainLayout';

describe('MainLayout navigation commit guard', () => {
  it('keeps navigation fail-closed when an editable field is still active during page change', async () => {
    const user = userEvent.setup();

    const ActiveEditorPage = () => (
      <div>
        <div>Stamdata testside</div>
        <input aria-label="Aktivt felt" autoFocus />
      </div>
    );

    const SatserPage = () => <div>Satser testside</div>;

    render(
      <AppSettingsProvider>
        <FormPersistenceProvider>
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

    await user.click(screen.getByText('Satser'));

    expect(screen.getByText('Stamdata testside')).toBeInTheDocument();
    expect(screen.queryByText('Satser testside')).toBeNull();
    expect(await screen.findByText('Kan ikke skifte side: afslut eller ret det aktive felt først.')).toBeInTheDocument();
    expect(screen.getByLabelText('Aktivt felt')).toHaveFocus();
  });
});
