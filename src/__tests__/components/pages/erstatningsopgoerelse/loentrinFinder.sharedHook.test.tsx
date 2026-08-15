// @vitest-environment jsdom
//
// Løntrin-finderen bruger ÉN hook for begge flader (`shared/useLoentrinFinder`). Før konsolideringen havde
// Lønindkomst og EO-oplysninger hver sin ~95 % ordret identiske hook, og forskellen kostede en reel fejl:
//
//   Alle ansættelsesforhold-kort bandt den SAMME trigger-ref, så React efterlod den på det sidst monterede
//   kort. Åbnede brugeren finderen fra et andet kort end det nederste, vendte fokus ved lukning tilbage til
//   det NEDERSTE korts «Find løntrin»-knap — et brud på `keyboard-navigation.md` §Popup-fokus-restore, der
//   kræver fokus tilbage til «den kontrol, brugeren åbnede den med».
//
// Fejlen var usynlig for den eksisterende dækning, fordi `loentrinFinderTrigger.keyboard.test.tsx` kun kører
// EO-fladen, som har ÉN trigger. Testene her dækker derfor flerhed: to kort, to knapper, og en restore der
// skal ramme netop den, der åbnede. Desuden hævdes den per-kort-persistens, som er den ene reelle forskel
// mellem de to flader, så konsolideringen ikke stiltiende kan tabe den.
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import Erstatningsopgoerelse from '../../../../components/pages/Erstatningsopgoerelse';
import { createActiveTabStorageKey, UI_STORAGE_KEYS } from '../../../../config/storageManifest';
import { AppSettingsProvider } from '../../../../contexts/AppSettingsContext';
import { RoutePathnameProvider } from '../../../../contexts/RoutePathnameProvider';
import {
  createDefaultLoenindkomstAnsaettelsesforhold,
  createErstatningsopgoerelseInitialValues,
} from '../../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { getProductionInputCatalog } from '../../../../inputCore/catalog/productionCatalog';
import {
  ProductionInputRuntimeProvider,
  createProductionInputRuntimeBinding,
} from '../../../../inputCore/react';
import { slimInputStore } from '../../../../inputCore/runtime/slimInputStore';
import { hydrateSlimInputStoreForTest } from '../../../../test/actSafeInputStore';
import { EO_TAB_KEYS } from '../../../../config/eoTabKeys';
import { STAMDATA_INITIAL_VALUES } from '../../../../domain/stamdata/stamdataInitialValues';
import { overenskomstBeregningsdata } from '../../../../data/overenskomstRates';

const ASYNC_TEST_TIMEOUT_MS = 30_000;

/**
 * Ikonet vises kun for en OFFENTLIG overenskomst. Id'et udledes af datasættets egen klassifikation, så
 * testen ikke går stille i stå, hvis netop den ene overenskomst omdøbes eller flyttes.
 */
const offentligOverenskomstId = overenskomstBeregningsdata.offentligeOverenskomster
  .map((meta) => meta.id)
  .at(0);

const employmentWithFinder = (id: string, navn: string) => {
  if (offentligOverenskomstId === undefined) {
    throw new Error('Testforudsætning brudt: datasættet har ingen offentlig overenskomst');
  }
  return {
    ...createDefaultLoenindkomstAnsaettelsesforhold(),
    id,
    navnPaaArbejdssted: navn,
    overenskomstId: offentligOverenskomstId,
    loenudviklingBeregningsgrundlag: 'Overenskomst' as const,
  };
};

/** To ansættelsesforhold — netop det, en enkelt delt trigger-ref ikke kan holde adskilt. */
const hydrateTwoEmployments = (): void => {
  const catalog = getProductionInputCatalog();
  hydrateSlimInputStoreForTest(slimInputStore, catalog.validateSettledInput({
    sections: {
      stamdata: { ...STAMDATA_INITIAL_VALUES, skadestype: 'Arbejdsulykke' },
      satser: null, aarsloen: null, faellesAarsloen: null, renteberegning: null,
      varigemen: null, forsoergertab: null, erhvervsevnetab: null,
      erstatningsopgoerelse: {
        ...createErstatningsopgoerelseInitialValues(),
        kravPaaTabtArbejdsfortjeneste: 'Ja',
        loenindkomstAnsaettelsesforhold: [
          employmentWithFinder('af-1', 'Første arbejdssted'),
          employmentWithFinder('af-2', 'Andet arbejdssted'),
        ],
      },
    },
    rejectedInputs: {},
  }));
  sessionStorage.setItem(createActiveTabStorageKey('erstatningsopgoerelse'), EO_TAB_KEYS.LOENINDKOMST);
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

describe('useLoentrinFinder — én hook for begge flader', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  const findTriggers = async (): Promise<HTMLElement[]> => {
    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: 'Find løntrin' }).length).toBe(2);
    });
    return screen.getAllByRole('button', { name: 'Find løntrin' });
  };

  it('returnerer fokus til det FØRSTE korts knap, når finderen blev åbnet derfra', async () => {
    const user = userEvent.setup();
    hydrateTwoEmployments();
    renderSurface();

    const [firstTrigger, secondTrigger] = await findTriggers();
    expect(firstTrigger).not.toBe(secondTrigger);

    await user.click(firstTrigger);
    expect(await screen.findByRole('dialog')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    // Kernen i fejlen: med én delt ref landede fokus her på DET ANDET korts knap.
    await waitFor(() => expect(firstTrigger).toHaveFocus());
    expect(secondTrigger).not.toHaveFocus();
  }, ASYNC_TEST_TIMEOUT_MS);

  it('returnerer fokus til det ANDET korts knap, når finderen blev åbnet derfra', async () => {
    const user = userEvent.setup();
    hydrateTwoEmployments();
    renderSurface();

    const [firstTrigger, secondTrigger] = await findTriggers();

    await user.click(secondTrigger);
    expect(await screen.findByRole('dialog')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    await waitFor(() => expect(secondTrigger).toHaveFocus());
    expect(firstTrigger).not.toHaveFocus();
  }, ASYNC_TEST_TIMEOUT_MS);

  it('husker indtastningen PR. ansættelsesforhold, så to kort ikke deler beløb', async () => {
    const user = userEvent.setup();
    hydrateTwoEmployments();
    renderSurface();

    const [firstTrigger, secondTrigger] = await findTriggers();

    // Indtast et beløb på kort 1 og luk.
    await user.click(firstTrigger);
    const firstDialog = await screen.findByRole('dialog');
    const firstAmount = within(firstDialog).getByRole('textbox', { name: 'Månedsløn' });
    await user.click(firstAmount);
    await user.keyboard('40000');
    // Tab afslutter beløbsfeltet (commit ved blur), så værdien er gemt, FØR overlayet lukkes.
    // Escape må ikke både annullere en åben redigering OG lukke fladen i ét tryk
    // (`keyboard-navigation.md`): med en ændret draft annullerer første Escape kun redigeringen.
    await user.keyboard('{Tab}');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    // Kort 2 må IKKE have arvet beløbet: persistensen er nøglet på ansættelsesforholdets id.
    await user.click(secondTrigger);
    const secondDialog = await screen.findByRole('dialog');
    expect(within(secondDialog).getByRole('textbox', { name: 'Månedsløn' })).toHaveValue('');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    // Persistensen ligger under den `caseScoped` nøgle, så `Slet alt` rydder den med sagen.
    const persisted = sessionStorage.getItem(UI_STORAGE_KEYS.loentrinFinderOverlay);
    expect(persisted).not.toBeNull();
    expect(persisted).toContain('af-1');
  }, ASYNC_TEST_TIMEOUT_MS);

  it('cirkulerer tab-sekvensen Ansættelse -> Beløb -> Dato -> Beregn inde i overlayet', async () => {
    const user = userEvent.setup();
    hydrateTwoEmployments();
    renderSurface();

    const [firstTrigger] = await findTriggers();
    await user.click(firstTrigger);
    const dialog = await screen.findByRole('dialog');

    // Ansættelse-dropdownen fokuseres ved åbning (overlayets egen mount-effekt).
    const ansaettelse = within(dialog).getByRole('combobox', { name: 'Ansættelse' });
    await waitFor(() => expect(ansaettelse).toHaveFocus());

    const beloeb = within(dialog).getByRole('textbox', { name: 'Månedsløn' });
    const dato = within(dialog).getByRole('textbox', { name: 'Dato' });
    const beregn = within(dialog).getByRole('button', { name: 'Beregn' });

    await user.tab();
    expect(beloeb).toHaveFocus();
    await user.tab();
    expect(dato).toHaveFocus();
    await user.tab();
    expect(beregn).toHaveFocus();
    // Sekvensen er lukket: fra Beregn tilbage til Ansættelse, aldrig ud til siden bagved.
    await user.tab();
    expect(ansaettelse).toHaveFocus();
  }, ASYNC_TEST_TIMEOUT_MS);
});
