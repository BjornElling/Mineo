// @vitest-environment jsdom
//
// Shellens to globale genveje og dens ENE beskedboks – de to fund fra brugerblikket på global shell,
// som lever i selve `MainLayout`:
//
//  - **BB-050 (Ctrl+S):** genvejen er registreret på `window` og havde aldrig hørt om overlay-stakken,
//    så et Ctrl+S bag en åben bekræftelsesdialog startede et helt gem – med filvælger og det hele –
//    mens dialogen blev stående og spurgte om noget andet. Undo/redo-halvdelen af samme fund måles i
//    `inputCore/react/useUndoRedoShortcuts.test.tsx`; her måles Ctrl+S.
//  - **BB-053:** beskedboksens nedtælling blev kun startet forfra, når beskedens TYPE skiftede. To
//    beskeder af samme type i træk delte derfor den førstes nedtælling, og en besked, der ankom under
//    udtoningen, var reelt usynlig. Det ramte præcis den bruger, der trykkede igen, fordi han ikke nåede
//    at læse svaret første gang – og gjorde det til at ligne, at knappen ikke virkede.
import { hydrateSlimInputStoreForTest } from '../../../test/actSafeInputStore';
import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

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
import { clickMainLayoutAction, flushMainLayoutAsyncAction } from './mainLayoutActionTestUtils';

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

const renderLayout = () => render(
  <AppSettingsProvider>
    <ProductionInputRuntimeProvider binding={createProductionInputRuntimeBinding()}>
      <MemoryRouter initialEntries={['/stamdata']}>
        <MainLayout>
          <div />
        </MainLayout>
      </MemoryRouter>
    </ProductionInputRuntimeProvider>
  </AppSettingsProvider>
);

const pressCtrlS = async (): Promise<void> => {
  await act(async () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true }));
    await flushMainLayoutAsyncAction();
  });
};

const NO_DATA_MESSAGE = 'Ingen data fundet at gemme';

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  hydrateSlimInputStoreForTest(slimInputStore, emptyInput());
});

afterEach(() => {
  hydrateSlimInputStoreForTest(slimInputStore, emptyInput());
});

describe('MainLayout – overlayet ejer Ctrl+S (BB-050)', () => {
  it('gør intet ved Ctrl+S, mens en bekræftelsesdialog står åben', async () => {
    renderLayout();

    await clickMainLayoutAction('Slet alt');
    const dialog = await screen.findByRole('dialog');

    await pressCtrlS();

    // Sagen er bevidst urørt: gem svarer da med en SYNLIG besked («Ingen data fundet at gemme»), og
    // dens fravær er derfor et positivt bevis for, at genvejen ikke nåede frem. Med en udfyldt sag
    // ville gem-flowet i stedet ende tavst i filvælgeren, som ikke kan betjenes i jsdom – og prøven
    // ville bestå, uanset om genvejen var spærret eller ikke.
    expect(dialog).toBeInTheDocument();
    expect(screen.queryByText(NO_DATA_MESSAGE)).toBeNull();
    expect(screen.queryByText('Gemt')).toBeNull();
  });

  it('virker igen, når dialogen er lukket', async () => {
    // Modprøven. Uden den ville en Ctrl+S, der ALDRIG gør noget, også bestå prøven ovenfor.
    renderLayout();

    await clickMainLayoutAction('Slet alt');
    await screen.findByRole('dialog');
    await clickMainLayoutAction('Annuller');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    await pressCtrlS();

    // Sagen er urørt, så gem svarer «Ingen data fundet at gemme» – beviset for at genvejen nåede frem.
    expect(await screen.findByText(NO_DATA_MESSAGE)).toBeInTheDocument();
  });
});

describe('MainLayout – hver besked får sin egen nedtælling (BB-053)', () => {
  /**
   * Beskedens identitet er det, der gør den anden besked til en frisk boks. Prøven kan ikke måles på
   * teksten alene – den er ordret den samme begge gange – så den måles på DOM-identiteten: er noden
   * en anden, er boksen genskabt med friske timere og en frisk indtoning. Er det samme node, har den
   * anden besked arvet den førstes nedtælling, og det var netop fejlen.
   */
  const currentMessageNode = (): HTMLElement => screen.getByText(NO_DATA_MESSAGE);

  it('genskaber boksen ved en NY besked med samme type og samme tekst', async () => {
    renderLayout();

    await clickMainLayoutAction('Gem');
    const firstNode = await screen.findByText(NO_DATA_MESSAGE);

    await clickMainLayoutAction('Gem');
    await waitFor(() => expect(currentMessageNode()).not.toBe(firstNode));

    // Der står fortsat præcis ÉN besked – identiteten skifter, boksene stables ikke.
    expect(screen.getAllByText(NO_DATA_MESSAGE)).toHaveLength(1);
  });

  it('viser den anden besked, også når den kommer sent i den førstes levetid', async () => {
    // Den oprindelige fejl var værst her: en advarsel varer 5 s, og en besked, der ankom under
    // udtoningen (de sidste 500 ms), blev tegnet gennemsigtig og lukkede sig selv umiddelbart efter.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      renderLayout();

      await clickMainLayoutAction('Gem');
      await screen.findByText(NO_DATA_MESSAGE);

      // Frem til 4,7 s: boksen er midt i sin udtoning, men endnu ikke lukket.
      await act(async () => { await vi.advanceTimersByTimeAsync(4_700); });

      await clickMainLayoutAction('Gem');

      // Den anden besked ER der – og den overlever forbi det tidspunkt, hvor den førstes nedtælling
      // ville have lukket den (5 s efter FØRSTE tryk, altså 300 ms efter det andet).
      await screen.findByText(NO_DATA_MESSAGE);
      await act(async () => { await vi.advanceTimersByTimeAsync(1_000); });
      expect(screen.getByText(NO_DATA_MESSAGE)).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});
