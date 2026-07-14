// @vitest-environment jsdom
//
// Fase 8 (greenfield draft/commit): Satser-sidens `aargang` er nu BUNDET (onFieldError), så en afsluttet
// ugyldig årgang når `invalidDrafts`-storen og ses af download-gaten. Denne integrationstest kører gennem
// den RIGTIGE Satser-side + en rigtig FormPersistenceProvider (ikke en mock), så den beviser den virkelige
// sti felt → invalidDrafts → gate — jf. document-output-contract.md §A2.1 og design §11.4-mønstret.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Satser from '../../../components/pages/Satser';
import { FormPersistenceProvider, initializePersistenceRuntime } from '../../../contexts/FormPersistenceContext';
import { AppSettingsProvider } from '../../../contexts/AppSettingsContext';
import { RoutePathnameProvider } from '../../../contexts/RoutePathnameProvider';
import { formPersistenceStore } from '../../../stores/formPersistenceStore';
import { PERSISTED_DATA_VERSION } from '../../../config/persistenceVersion';
import { satserAngivAarYearBounds } from '../../../data/lovbestemteRates';

const aargangInvalidDraft = (): string | undefined =>
  (formPersistenceStore.getState().invalidDrafts.satser ?? {}).aargang;

const renderSatser = (committedAargang: number) => {
  formPersistenceStore.setState({
    sections: { ...formPersistenceStore.getState().sections, satser: { aargang: committedAargang } },
    meta: { hydrated: true, persistedDataVersion: PERSISTED_DATA_VERSION },
  });
  return render(
    <MemoryRouter initialEntries={['/satser']}>
      <AppSettingsProvider>
        <RoutePathnameProvider>
          <FormPersistenceProvider runtime={initializePersistenceRuntime()}>
            <Satser />
          </FormPersistenceProvider>
        </RoutePathnameProvider>
      </AppSettingsProvider>
    </MemoryRouter>
  );
};

const getYearInput = () => screen.getByRole('textbox') as HTMLInputElement;
// Satser-siden har præcis én knap (download-knappen). Dens aria-label skifter til gate-årsagen når
// den er deaktiveret, så vi adresserer den strukturelt frem for på "download"-teksten.
const getDownloadButton = () => screen.getByRole('button');

describe('Satser download-gate — afsluttet ugyldigt årstal blokerer download', () => {
  beforeEach(() => {
    sessionStorage.clear();
    formPersistenceStore.getState().clearAllFieldErrors();
    formPersistenceStore.getState().clearAllInvalidDrafts();
  });

  it('download er aktiv for en gyldig committed årgang', () => {
    renderSatser(satserAngivAarYearBounds.maxYear);
    expect(getDownloadButton()).toBeEnabled();
  });

  it('en afsluttet ugyldig årgang oven på en gyldig committed årgang blokerer download', async () => {
    const user = userEvent.setup();
    renderSatser(satserAngivAarYearBounds.maxYear);
    const input = getYearInput();

    // Download er aktiv på den gyldige committede årgang.
    expect(getDownloadButton()).toBeEnabled();

    // Erstat med et uparseligt årstal og afslut redigeringen (blur).
    await user.click(input);
    await user.keyboard('{Control>}a{/Control}{Delete}');
    await user.type(input, '123');
    await user.tab();

    // Den rå ugyldige streng er nået invalidDrafts (feltet er bundet), og gaten blokerer download —
    // selv om den tidligere gyldige canonical årgang stadig ligger bag masken.
    expect(input).toHaveValue('123');
    expect(aargangInvalidDraft()).toBe('123');
    expect(getDownloadButton()).toBeDisabled();
  });

  it('at rette den ugyldige årgang tilbage til en gyldig værdi åbner download igen', async () => {
    const user = userEvent.setup();
    renderSatser(satserAngivAarYearBounds.maxYear);
    const input = getYearInput();

    await user.click(input);
    await user.keyboard('{Control>}a{/Control}{Delete}');
    await user.type(input, '123');
    await user.tab();
    expect(getDownloadButton()).toBeDisabled();

    // Ret til en gyldig årgang: invalidDrafts ryddes, gaten åbner igen.
    await user.click(input);
    await user.keyboard('{Control>}a{/Control}{Delete}');
    await user.type(input, String(satserAngivAarYearBounds.maxYear));
    await user.tab();

    expect(aargangInvalidDraft()).toBeUndefined();
    expect(getDownloadButton()).toBeEnabled();
  });
});
