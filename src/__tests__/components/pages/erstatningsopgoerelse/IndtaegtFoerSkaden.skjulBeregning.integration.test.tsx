// @vitest-environment jsdom
//
// «Skjul beregning efter første opgørelse» på den ægte EO-side (udviklerafgørelse 2026-10-24): et tomt grundlag
// vises trods togglen, det forsvinder ikke, mens brugeren udfylder det, og det skjules, når brugeren vender
// tilbage til fanen eller selv slår togglen til.
import { screen, render, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import Erstatningsopgoerelse from '../../../../components/pages/Erstatningsopgoerelse';
import { createActiveTabStorageKey } from '../../../../config/storageManifest';
import { AppSettingsProvider } from '../../../../contexts/AppSettingsContext';
import { RoutePathnameProvider } from '../../../../contexts/RoutePathnameProvider';
import { createErstatningsopgoerelseInitialValues } from '../../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import {
  ProductionInputRuntimeProvider,
  createProductionInputRuntimeBinding,
} from '../../../../inputCore/react';
import { getProductionInputCatalog } from '../../../../inputCore/catalog/productionCatalog';
import { slimInputStore } from '../../../../inputCore/runtime/slimInputStore';
import { hydrateSlimInputStoreForTest } from '../../../../test/actSafeInputStore';
import { toISODateString } from '../../../../types/branded';
import type { ErstatningsopgoerelseValues } from '../../../../schemas/formSchemas';

const ASYNC_TEST_TIMEOUT_MS = 30_000;
const iso = (value: string) => toISODateString(value);

/** Opgørelse nr. 2 med togglen slået til og en angivet månedsløn; beløbet afgør, om grundlaget er gyldigt. */
const hydrate = (maanedsloen: number | undefined): void => {
  const initial = createErstatningsopgoerelseInitialValues();
  const erstatningsopgoerelse: ErstatningsopgoerelseValues = {
    ...initial,
    eoNummer: '2',
    komprimerBeregningEfterFoersteOpgoerelse: 'Ja',
    tafArbejdsstatus: 'Uarbejdsdygtig',
    kravPaaTabtArbejdsfortjeneste: 'Ja',
    kravPaaSvieSmerteGodtgoerelse: 'Nej',
    kravPaaOevrigeErstatningskrav: 'Nej',
    vedroererPeriodeFra: iso('2024-01-01'),
    vedroererPeriodeTil: iso('2024-12-31'),
    opgørelseLavetDen: iso('2025-02-01'),
    tafPerioder: [{ id: 't1', fra: iso('2024-01-01'), til: iso('2024-12-31'), loseFeriedage: undefined }],
    beregnesUdFra: 'Angivet månedsløn',
    maanedsloenenUdgoer: maanedsloen === undefined ? undefined : { kind: 'number', value: maanedsloen },
    eoAngivetLoenLoenudvikling: { ...initial.eoAngivetLoenLoenudvikling, loenudviklingBeregningsgrundlag: 'Ingen' },
  };
  hydrateSlimInputStoreForTest(slimInputStore, getProductionInputCatalog().validateSettledInput({
    sections: {
      stamdata: {
        journalnr: 'J-1', advokat: 'A', sagsbehandler: 'S', skadelidte: 'T', skadestype: 'Arbejdsulykke',
        skadedato: iso('2018-06-01'), skadelidteFodselsdato: iso('1980-01-01'),
      },
      satser: null, aarsloen: null, faellesAarsloen: null, renteberegning: null,
      varigemen: null, forsoergertab: null, erhvervsevnetab: null, erstatningsopgoerelse,
    },
    rejectedInputs: {},
  }));
  sessionStorage.setItem(createActiveTabStorageKey('erstatningsopgoerelse'), 'eo_oplysninger');
};

const renderPage = () => render(
  <MemoryRouter>
    <AppSettingsProvider>
      <RoutePathnameProvider>
        <ProductionInputRuntimeProvider binding={createProductionInputRuntimeBinding()}>
          <Erstatningsopgoerelse />
        </ProductionInputRuntimeProvider>
      </RoutePathnameProvider>
    </AppSettingsProvider>
  </MemoryRouter>
);

const maanedsloenInput = (): HTMLInputElement | null =>
  document.querySelector<HTMLInputElement>('input[name="maanedsloenenUdgoer"]');
const toggle = (): HTMLInputElement => {
  const input = document.querySelector<HTMLInputElement>('input[name="komprimerBeregningEfterFoersteOpgoerelse"]');
  if (input === null) throw new Error('Togglen «Skjul beregning efter første opgørelse» findes ikke');
  return input;
};

describe('Indtægt før skaden – «Skjul beregning efter første opgørelse»', () => {
  beforeEach(() => sessionStorage.clear());
  afterEach(() => sessionStorage.clear());

  it('skjuler et gyldigt grundlag', async () => {
    hydrate(30000);
    renderPage();
    await screen.findByText('Skjul beregning efter første opgørelse');
    expect(toggle().checked).toBe(true);
    expect(maanedsloenInput()).toBeNull();
  }, ASYNC_TEST_TIMEOUT_MS);

  it('viser et tomt grundlag og lader det stå, mens brugeren udfylder det – indtil brugeren vender tilbage', async () => {
    const user = userEvent.setup();
    hydrate(undefined);
    renderPage();

    // Togglen er slået til, men grundlaget er tomt: feltet vises, så brugeren kan udfylde det.
    await waitFor(() => expect(maanedsloenInput()).not.toBeNull());
    expect(toggle().checked).toBe(true);

    // Brugeren udfylder beløbet og forlader feltet. Grundlaget er nu gyldigt, men forsvinder ikke under brugeren.
    await user.click(maanedsloenInput()!);
    await user.keyboard('30000');
    await user.tab();
    await waitFor(() => expect(maanedsloenInput()?.value).toMatch(/30\.000/));
    expect(maanedsloenInput()).not.toBeNull();

    // Et nyt besøg på fanen skjuler det gyldige grundlag.
    await user.click(screen.getByRole('tab', { name: 'Lønindkomst' }));
    await user.click(screen.getByRole('tab', { name: 'EO oplysninger' }));
    await waitFor(() => expect(maanedsloenInput()).toBeNull());
  }, ASYNC_TEST_TIMEOUT_MS);

  it('skjuler straks, når brugeren selv slår togglen til', async () => {
    const user = userEvent.setup();
    hydrate(30000);
    renderPage();
    await screen.findByText('Skjul beregning efter første opgørelse');
    expect(maanedsloenInput()).toBeNull();

    await user.click(toggle());
    await waitFor(() => expect(maanedsloenInput()).not.toBeNull());
    expect(toggle().checked).toBe(false);

    await user.click(toggle());
    await waitFor(() => expect(maanedsloenInput()).toBeNull());
    expect(toggle().checked).toBe(true);
  }, ASYNC_TEST_TIMEOUT_MS);
});
