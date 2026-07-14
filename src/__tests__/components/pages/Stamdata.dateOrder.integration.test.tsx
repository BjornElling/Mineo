// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Stamdata from '../../../components/pages/Stamdata';
import { AppSettingsProvider } from '../../../contexts/AppSettingsContext';
import { FormPersistenceProvider, initializePersistenceRuntime } from '../../../contexts/FormPersistenceContext';
import { RoutePathnameProvider } from '../../../contexts/RoutePathnameProvider';
import { CriticalActionProvider } from '../../../criticalActions/CriticalActionContext';
import { PERSISTED_DATA_VERSION } from '../../../config/persistenceVersion';
import { createEmptyFormPersistenceSections, formPersistenceStore } from '../../../stores/formPersistenceStore';

const renderPage = () => {
  sessionStorage.clear();
  formPersistenceStore.setState({
    sections: createEmptyFormPersistenceSections(),
    meta: { hydrated: true, persistedDataVersion: PERSISTED_DATA_VERSION },
  });
  formPersistenceStore.getState().clearAllFieldErrors();
  formPersistenceStore.getState().clearAllInvalidDrafts();

  return render(
    <MemoryRouter initialEntries={['/stamdata']}>
      <AppSettingsProvider>
        <RoutePathnameProvider>
          <CriticalActionProvider>
            <FormPersistenceProvider runtime={initializePersistenceRuntime()}>
              <Stamdata />
            </FormPersistenceProvider>
          </CriticalActionProvider>
        </RoutePathnameProvider>
      </AppSettingsProvider>
    </MemoryRouter>
  );
};

const inputForRow = (label: string): HTMLInputElement => {
  const row = screen.getByText(label).closest('.row--label-offset') as HTMLElement;
  return within(row).getByRole('textbox') as HTMLInputElement;
};

describe('Stamdata — canonical datoordensfejl', () => {
  it('committer begge datoer canonical og viser et blokerende issue på begge felter', async () => {
    const user = userEvent.setup();
    renderPage();
    const fodselsdato = inputForRow('Fødselsdato');
    const skadedato = inputForRow('Skadedato');

    await user.click(fodselsdato);
    await user.type(fodselsdato, '01-01-2010');
    await user.tab();
    await user.click(skadedato);
    await user.type(skadedato, '31-12-2009');
    await user.tab();

    await waitFor(() => {
      expect(formPersistenceStore.getState().sections.stamdata).toEqual(expect.objectContaining({
        skadelidteFodselsdato: '2010-01-01',
        skadedato: '2009-12-31',
      }));
    });
    expect(formPersistenceStore.getState().invalidDrafts.stamdata).toEqual({});

    await waitFor(() => {
      expect(fodselsdato).toHaveAttribute('aria-invalid', 'true');
      expect(skadedato).toHaveAttribute('aria-invalid', 'true');
    });
    expect(formPersistenceStore.getState().fieldErrors.stamdata.skadedato?.input).toEqual(expect.objectContaining({
      message: 'Skadedato kan ikke være før fødselsdatoen (01-01-2010)',
      severity: 'error',
      blocksSave: false,
    }));
    expect(formPersistenceStore.getState().fieldErrors.stamdata.skadelidteFodselsdato?.input).toEqual(expect.objectContaining({
      message: 'Fødselsdato kan ikke være efter skadedatoen (31-12-2009)',
      severity: 'error',
      blocksSave: false,
    }));
  });
});
