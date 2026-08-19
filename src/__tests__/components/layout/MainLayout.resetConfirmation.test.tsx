// @vitest-environment jsdom
//
// `Slet alt` bekræftes gennem programmets egen `ConfirmationDialog`, ikke en native `window.confirm`.
// Skiftet er ikke kosmetisk, og testene her hævder præcis det, den native dialog ikke kunne garantere:
//
//  1. Bekræftelsen er SYNLIG i appen (kan læses, tabbes og lukkes af testen – en `window.confirm` kan
//     ingen af de ting, og derfor kunne auditens påstand om «reset-dialogens fokus-/Tab-/Escape-adfærd»
//     i `docs/testing/runtime-input-audit/STATUS.md` aldrig efterprøves).
//  2. Annullering og Escape bevarer sagen fuldstændigt (`critical-action-contract.md` §7).
//  3. Bekræftelse rydder sagen atomisk og afslutter INDE i appen med navigation til Stamdata.
//  4. Fokus vender tilbage til `Slet alt`-menuknappen (`keyboard-navigation.md` §Popup-fokus-restore).
//     Menuknappen kalder `preventDefault()` i `onMouseDown`, så den bliver aldrig `activeElement`;
//     restoren hviler derfor på den eksplicitte ref, og uden den ville fokus falde et vilkårligt sted.
import { hydrateSlimInputStoreForTest } from '../../../test/actSafeInputStore';
import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';

import { AppSettingsProvider } from '../../../contexts/AppSettingsContext';
import {
  ProductionInputRuntimeProvider,
  bootstrapProductionInputRuntime,
  createProductionInputRuntimeBinding,
} from '../../../inputCore/react';
import { slimInputStore } from '../../../inputCore/runtime/slimInputStore';
import { getProductionInputCatalog } from '../../../inputCore/catalog/productionCatalog';
import type { SettledInput } from '../../../inputCore/settledInput';

vi.mock('../../../utils/fileLoad', () => ({
  loadFromFile: vi.fn(),
  loadFromFileHandle: vi.fn(),
}));

vi.mock('../../../utils/fileHelpers', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../../utils/fileHelpers')>();
  return {
    ...original,
    resolveDefaultDirectoryHandle: vi.fn(async () => null),
  };
});

vi.mock('../../../utils/fileHandleStorage', () => ({
  deleteFileHandleFromIndexedDB: vi.fn(async () => true),
  saveFileHandleToIndexedDB: vi.fn(async () => true),
}));

vi.mock('../../../utils/pwaLaunchQueue', () => ({
  Mineo_PWA_FILE_OPEN_EVENT: 'mineo:pwa-file-open',
  clearPendingPwaFileOpenRequest: vi.fn(async () => {}),
  getPendingPwaFileOpenRequest: () => null,
  markPendingPwaFileOpenRequestHandled: vi.fn(async () => {}),
}));

import MainLayout from '../../../components/layout/MainLayout';
import { clickMainLayoutAction } from './mainLayoutActionTestUtils';

const catalog = getProductionInputCatalog();
bootstrapProductionInputRuntime();

const emptyInput = (): SettledInput => catalog.validateSettledInput({
  sections: {
    stamdata: null, satser: null, aarsloen: null, faellesAarsloen: null,
    renteberegning: null, varigemen: null, forsoergertab: null,
    erstatningsopgoerelse: null, erhvervsevnetab: null,
  },
  rejectedInputs: {},
});

const hydrateWithData = (skadelidte: string): void => {
  hydrateSlimInputStoreForTest(slimInputStore,
    catalog.validateSettledInput({
      sections: {
        ...emptyInput().sections,
        stamdata: {
          journalnr: '',
          advokat: '',
          sagsbehandler: '',
          skadelidte,
          skadestype: undefined,
          skadedato: undefined,
        },
      },
      rejectedInputs: {},
    })
  );
};

const storedSkadelidte = (): string | undefined =>
  slimInputStore.getState().input.sections.stamdata?.skadelidte;

const DIALOG_TITLE = 'Slet alle indtastninger';

/**
 * Menuknappens tilgængelige navn adskiller ordene med et HARD space, så labelen ikke kan brydes over
 * to linjer i den udfoldede menu. Accessible-name-matching er eksakt, så et almindeligt mellemrum
 * finder ikke knappen. Matcheren er derfor et regex, der accepterer begge whitespace-former: testen
 * hævder fokus-restoren, ikke hvilket mellemrumstegn labelen bruger.
 */
const SLET_ALT_BUTTON_NAME = /^Slet\salt$/;

describe('MainLayout – Slet alt-bekræftelse', () => {
  const RouteProbe = () => {
    const location = useLocation();
    return <div data-testid="pathname">{location.pathname}</div>;
  };

  const renderLayout = () => render(
    <AppSettingsProvider>
      <ProductionInputRuntimeProvider binding={createProductionInputRuntimeBinding()}>
        <MemoryRouter initialEntries={['/stamdata']}>
          <RouteProbe />
          <MainLayout>
            <div />
          </MainLayout>
        </MemoryRouter>
      </ProductionInputRuntimeProvider>
    </AppSettingsProvider>
  );

  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    hydrateSlimInputStoreForTest(slimInputStore, emptyInput());
  });

  afterEach(() => {
    hydrateSlimInputStoreForTest(slimInputStore, emptyInput());
  });

  it('viser bekræftelsen i appen og sletter intet, før brugeren bekræfter', async () => {
    hydrateWithData('Beholdes');
    renderLayout();

    await clickMainLayoutAction('Slet alt');

    // Dialogen er programmets egen – den kan findes i DOM med sin danske titel og advarselstekst.
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByText(DIALOG_TITLE)).toBeInTheDocument();
    expect(dialog).toHaveTextContent('ADVARSEL: Dette sletter alle ikke-gemte indtastninger i Mineo!');
    expect(dialog).toHaveTextContent('Indholdet i gemte .eo-filer ændres ikke.');

    // Intet er rørt endnu.
    expect(storedSkadelidte()).toBe('Beholdes');
  });

  it('bevarer sagen ved Annuller og returnerer fokus til Slet alt-knappen', async () => {
    hydrateWithData('Beholdes');
    renderLayout();

    await clickMainLayoutAction('Slet alt');
    await screen.findByRole('dialog');

    await clickMainLayoutAction('Annuller');

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(storedSkadelidte()).toBe('Beholdes');
    // Fokus må aldrig efterlades på `body` efter en lukket popup.
    await waitFor(() => {
      expect(screen.getByRole('button', { name: SLET_ALT_BUTTON_NAME })).toHaveFocus();
    });
  });

  it('bevarer sagen ved Escape og returnerer fokus til Slet alt-knappen', async () => {
    const user = userEvent.setup();
    hydrateWithData('Beholdes');
    renderLayout();

    await clickMainLayoutAction('Slet alt');
    await screen.findByRole('dialog');

    // `user.keyboard` act-wrapper allerede selv. Et ekstra `await act(async () => …)` udenom gør
    // act-kaldene indlejrede, og React melder da «testing environment is not configured to support
    // act(...)» på stderr – uden at testen fejler. Tastetrykket sendes derfor bart.
    await user.keyboard('{Escape}');

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(storedSkadelidte()).toBe('Beholdes');
    await waitFor(() => {
      expect(screen.getByRole('button', { name: SLET_ALT_BUTTON_NAME })).toHaveFocus();
    });
  });

  it('rydder sagen og navigerer til Stamdata, når brugeren bekræfter', async () => {
    hydrateWithData('Slettes');
    renderLayout();

    await clickMainLayoutAction('Slet alt');
    await screen.findByRole('dialog');

    await clickMainLayoutAction('Ja, slet');

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(storedSkadelidte()).toBeUndefined();
    expect(screen.getByTestId('pathname')).toHaveTextContent('/stamdata');
    expect(screen.getByText('Alle indtastninger slettet')).toBeInTheDocument();
  });

  it('holder bekræftelsens fokus inde i dialogen, så Tab ikke slipper ud til siden bagved', async () => {
    const user = userEvent.setup();
    hydrateWithData('Beholdes');
    renderLayout();

    await clickMainLayoutAction('Slet alt');
    const dialog = await screen.findByRole('dialog');

    const cancel = within(dialog).getByRole('button', { name: 'Annuller' });
    const confirm = within(dialog).getByRole('button', { name: 'Ja, slet' });

    // Annuller fokuseres først: den ikke-destruktive udgang er standardvalget.
    await waitFor(() => expect(cancel).toHaveFocus());

    await user.tab();
    expect(confirm).toHaveFocus();
    await user.tab();
    expect(cancel).toHaveFocus();
  });
});
