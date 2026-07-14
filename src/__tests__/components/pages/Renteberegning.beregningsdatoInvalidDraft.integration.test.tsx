// @vitest-environment jsdom
//
// Fase 7 (greenfield draft/commit) — den RAPPORTEREDE bug, end-to-end: et uparseligt beregningsdato-
// format holdt tidligere download AKTIV, fordi den lokale beregningsdatoHasError-boolean var blank for
// ikke-committbart format (visualErrorMessage tvinges til ''). Nu bindes beregningsdato til invalidDrafts,
// og download-gaten blokerer på den afsluttede ugyldige tilstand. Testen kører gennem den rigtige
// Renteberegning-side (persistence + felt) og skriver en ugyldig dato via det rigtige felt.
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Renteberegning from '../../../components/pages/Renteberegning';
import { FormPersistenceProvider, initializePersistenceRuntime } from '../../../contexts/FormPersistenceContext';
import { AppSettingsProvider } from '../../../contexts/AppSettingsContext';
import { RoutePathnameProvider } from '../../../contexts/RoutePathnameProvider';
import { CriticalActionProvider } from '../../../criticalActions/CriticalActionContext';
import { formPersistenceStore } from '../../../stores/formPersistenceStore';
import { PERSISTED_DATA_VERSION } from '../../../config/persistenceVersion';

const renderPage = () => {
  sessionStorage.clear();
  formPersistenceStore.setState({ meta: { hydrated: true, persistedDataVersion: PERSISTED_DATA_VERSION } });
  formPersistenceStore.getState().clearAllFieldErrors();
  formPersistenceStore.getState().clearAllInvalidDrafts();
  return render(
    <MemoryRouter initialEntries={['/renteberegning']}>
      <AppSettingsProvider>
        <RoutePathnameProvider>
          <CriticalActionProvider>
            <FormPersistenceProvider runtime={initializePersistenceRuntime()}>
              <Renteberegning />
            </FormPersistenceProvider>
          </CriticalActionProvider>
        </RoutePathnameProvider>
      </AppSettingsProvider>
    </MemoryRouter>
  );
};

const beregningsdatoInvalidDraft = (): string | undefined =>
  (formPersistenceStore.getState().invalidDrafts.renteberegning ?? {}).beregningsdato;

const getOversigtButton = () => screen.getByRole('button', { name: 'Download samlet oversigt' });

const getBeregningsdatoInput = (): HTMLInputElement => {
  // Beregningsdato-feltet er i "Beregningsdato"-boksen; adressér via dens label-række.
  const row = screen.getByText('Rente beregnes til og med').closest('.row--label-right-hover') as HTMLElement;
  return within(row).getByRole('textbox') as HTMLInputElement;
};

describe('Renteberegning — uparseligt beregningsdato blokerer download (rapporteret bug, end-to-end)', () => {
  it('en gyldig beregningsdato + gyldig række giver aktiv download; et efterfølgende uparseligt format blokerer', async () => {
    const user = userEvent.setup();
    renderPage();

    // 1) Indtast en gyldig beregningsdato.
    const dato = getBeregningsdatoInput();
    await user.click(dato);
    await user.type(dato, '31-12-2024');
    await user.tab();

    // 2) Udfyld en gyldig rentekrav-række (beløb + renter-fra), så der er noget at downloade.
    const belob = screen.getByPlaceholderText('0,00') as HTMLInputElement;
    await user.click(belob);
    await user.type(belob, '1000');
    await user.tab();

    const renterFraRow = belob.closest('tr') as HTMLElement;
    const renterFra = within(renterFraRow).getAllByRole('textbox')[1] as HTMLInputElement;
    await user.click(renterFra);
    await user.type(renterFra, '01-01-2020');
    await user.tab();

    expect(getOversigtButton()).toBeEnabled();

    // 3) Erstat beregningsdato med et UPARSELIGT format og afslut redigeringen.
    await user.click(dato);
    await user.keyboard('{Control>}a{/Control}{Delete}');
    await user.type(dato, '12.x.20');
    await user.tab();

    // Den uparselige streng er nået invalidDrafts (feltet er bundet — datofeltets key-filter fjerner
    // bogstaver, men "12..20" er stadig et ikke-committbart format), og download er blokeret.
    expect(beregningsdatoInvalidDraft()).toBeTruthy();
    expect(getOversigtButton()).toBeDisabled();
  });
});
