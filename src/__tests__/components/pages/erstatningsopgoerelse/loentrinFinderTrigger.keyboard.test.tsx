// @vitest-environment jsdom
//
// »Find løntrin«-ikonet er en sideintegreret handlingsknap med eksplicit opt-in i Containerens
// tab-sekvens (keyboard-navigation.md §Implementeringsfrihed), på samme måde som »Indsæt dags dato«.
//
// Ikonet stod tidligere med `tabIndex={-1}` og var dermed helt uden for tastaturet: musen var eneste
// vej til løntrin-finderen. Testen måler den observerbare kontraktadfærd på den ÆGTE flade — at
// knappen kan nås med Tab og aktiveres med både Enter og mellemrum — frem for at asserte på
// markør-attributten, som kunne blive inert uden at nogen test fejlede.
//
// Mekanikken bag Enter/mellemrum (Container lader Enter passere på knapper, så native
// button-semantik gælder) er dækket generisk i `Container.test.tsx`. Det testen tilføjer her, er at
// DETTE render-sted faktisk har opt-in'et og derfor indgår i sekvensen.
//
// Testen dækker desuden vejen TILBAGE: Escape fra overlayet skal returnere fokus til knappen
// (keyboard-navigation.md §Popup-fokus-restore). Uden det krav endte fokus på `body`, og
// tastaturbrugeren måtte tabbe forfra gennem siden — registreret som Q-001 i runtime-input-auditen.
import { act, render, screen, waitFor } from '@testing-library/react';
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
import { overenskomstBeregningsdata } from '../../../../data/overenskomstRates';

const ASYNC_TEST_TIMEOUT_MS = 30_000;

/**
 * Ikonet vises kun for en OFFENTLIG overenskomst. Id'et udledes fra datasættets egen klassifikation
 * frem for at være hardkodet, så testen ikke går stille i stå, hvis netop den ene overenskomst
 * omdøbes eller flyttes.
 */
const offentligOverenskomstId = overenskomstBeregningsdata.offentligeOverenskomster
  .map((meta) => meta.id)
  .at(0);

/**
 * De fire gates ind til ikonet er alle almindelige persisterede værdier: TAF-kravet aktiverer
 * sektionen, «Angivet månedsløn» viser lønudviklings-blokken, og grundlag + offentlig overenskomst
 * åbner løn-oplysningsrækken.
 */
const hydrateSurfaceWithVisibleLoentrinFinder = (): void => {
  if (offentligOverenskomstId === undefined) {
    throw new Error('Testforudsætning brudt: datasættet har ingen offentlig overenskomst');
  }

  const erstatningsopgoerelse = createErstatningsopgoerelseInitialValues();
  const catalog = getProductionInputCatalog();

  hydrateSlimInputStoreForTest(slimInputStore, catalog.validateSettledInput({
    sections: {
      stamdata: null, satser: null, aarsloen: null, faellesAarsloen: null, renteberegning: null,
      varigemen: null, forsoergertab: null, erhvervsevnetab: null,
      erstatningsopgoerelse: {
        ...erstatningsopgoerelse,
        kravPaaTabtArbejdsfortjeneste: 'Ja',
        beregnesUdFra: 'Angivet månedsløn',
        eoAngivetLoenLoenudvikling: {
          ...erstatningsopgoerelse.eoAngivetLoenLoenudvikling,
          overenskomstId: offentligOverenskomstId,
          loenudviklingBeregningsgrundlag: 'Overenskomst',
        },
      },
    },
    rejectedInputs: {},
  }));

  sessionStorage.setItem(createActiveTabStorageKey('erstatningsopgoerelse'), 'eo_oplysninger');
};

const renderSurface = () => render(
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

describe('»Find løntrin« indgår i tastatur-sekvensen', () => {
  beforeEach(() => {
    sessionStorage.clear();
    hydrateSurfaceWithVisibleLoentrinFinder();
  });

  afterEach(() => sessionStorage.clear());

  /**
   * Fokuserer ikonet SOM en tastaturbruger — via Tab fra feltet før — og ikke med et direkte
   * `focus()`-kald. Forskellen er hele pointen: `tabIndex={-1}` blokerer ikke et programmatisk
   * `focus()`, så en test der kaldte `focus()` selv ville bestå på den gamle, utilgængelige knap.
   */
  const tabTilFinder = async (
    user: ReturnType<typeof userEvent.setup>
  ): Promise<HTMLElement> => {
    const finder = await screen.findByRole('button', { name: 'Find løntrin' });

    // «Gruppe» er feltet umiddelbart før ikonet i samme række.
    const gruppe = document.querySelector<HTMLInputElement>('input[name="offentligLoenGruppe"]');
    expect(gruppe).not.toBeNull();

    // JSDOM har ingen layoutmotor. Inline position giver samme synlighedssignal som i de øvrige
    // Container-tests og invalidérer inventarets cache gennem den observerede style-attribut.
    finder.style.position = 'fixed';
    if (gruppe) gruppe.style.position = 'fixed';

    act(() => gruppe?.focus());
    await user.keyboard('{Tab}');
    await waitFor(() => expect(finder).toHaveFocus());

    return finder;
  };

  it('kan nås med Tab fra det foregående felt', async () => {
    const user = userEvent.setup();
    renderSurface();

    await tabTilFinder(user);
  }, ASYNC_TEST_TIMEOUT_MS);

  it('åbner overlayet på Enter, når den er nået med Tab', async () => {
    const user = userEvent.setup();
    renderSurface();

    expect(screen.queryByRole('dialog')).toBeNull();
    await tabTilFinder(user);

    await user.keyboard('{Enter}');
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  }, ASYNC_TEST_TIMEOUT_MS);

  /**
   * Svaret på Q-001 i runtime-input-auditen: Escape skal returnere fokus til »Find løntrin«.
   *
   * Fokus endte tidligere på `body` i alle fire browsere (AUDIT-2026-08-14-21), så
   * tastaturbrugeren måtte tabbe forfra gennem hele siden for at komme tilbage til knappen.
   * Kontrakten fastlægger nu restore-målet (keyboard-navigation.md §Popup-fokus-restore).
   */
  it('returnerer fokus til knappen, når overlayet lukkes med Escape', async () => {
    const user = userEvent.setup();
    renderSurface();

    const finder = await tabTilFinder(user);
    await user.keyboard('{Enter}');
    expect(await screen.findByRole('dialog')).toBeInTheDocument();

    await user.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(finder).toHaveFocus());
    expect(document.activeElement).not.toBe(document.body);
  }, ASYNC_TEST_TIMEOUT_MS);

  it('åbner overlayet på mellemrum, når den er nået med Tab', async () => {
    const user = userEvent.setup();
    renderSurface();

    expect(screen.queryByRole('dialog')).toBeNull();
    await tabTilFinder(user);

    await user.keyboard(' ');
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  }, ASYNC_TEST_TIMEOUT_MS);
});
