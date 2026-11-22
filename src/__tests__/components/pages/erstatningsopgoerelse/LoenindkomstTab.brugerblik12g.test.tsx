// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import Erstatningsopgoerelse from '../../../../components/pages/Erstatningsopgoerelse';
import { createActiveTabStorageKey } from '../../../../config/storageManifest';
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
import { getOverenskomsterByOrg, resolveOverenskomstDisplay } from '../../../../data/overenskomstRates';
import type { LoenindkomstAnsaettelsesforhold } from '../../../../schemas/formSchemas';

// Brugerblik 12g: BB-435 (organisationsfiltre uden fælles overenskomst) og BB-438 (sletedialogen skal nævne
// kortets overskrift med nummer, så to kort med samme navn kan skelnes).

const ASYNC_TEST_TIMEOUT_MS = 30_000;
const GEMT_OVERENSKOMST = 'kl-overenskomst';

const employment = (
  id: string,
  overrides: Partial<LoenindkomstAnsaettelsesforhold> = {},
): LoenindkomstAnsaettelsesforhold => ({
  ...createDefaultLoenindkomstAnsaettelsesforhold(),
  id,
  ...overrides,
});

const hydrate = (employments: readonly LoenindkomstAnsaettelsesforhold[]): void => {
  const catalog = getProductionInputCatalog();
  hydrateSlimInputStoreForTest(slimInputStore, catalog.validateSettledInput({
    sections: {
      stamdata: { ...STAMDATA_INITIAL_VALUES, skadestype: 'Arbejdsulykke' },
      satser: null, aarsloen: null, faellesAarsloen: null, renteberegning: null,
      varigemen: null, forsoergertab: null, erhvervsevnetab: null,
      erstatningsopgoerelse: {
        ...createErstatningsopgoerelseInitialValues(),
        beregnesUdFra: 'Beregningsperiode',
        loenindkomstAnsaettelsesforhold: [...employments],
      },
    },
    rejectedInputs: {},
  }));
};

const renderLoenindkomst = () => render(
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

const INGEN_MATCH = 'Ingen overenskomster matcher de valgte filtre';

describe('Lønindkomst – Brugerblik 12g', () => {
  beforeEach(() => {
    sessionStorage.clear();
    sessionStorage.setItem(createActiveTabStorageKey('erstatningsopgoerelse'), EO_TAB_KEYS.LOENINDKOMST);
  });

  it('forudsætning: RLTN + Dansk Metal giver ingen overenskomster', () => {
    expect(getOverenskomsterByOrg('Dansk Metal', 'RLTN')).toEqual([]);
  });

  it('BB-435: viser en ikke-valgbar «ingen match»-linje og bevarer den valgte aftale', async () => {
    const user = userEvent.setup();
    hydrate([employment('af-1', {
      harOverenskomst: true,
      overenskomstId: GEMT_OVERENSKOMST,
      overenskomstFilter: { loenmodtager: 'Dansk Metal', arbejdsgiver: 'RLTN' },
    })]);
    renderLoenindkomst();

    const gemtLabel = resolveOverenskomstDisplay(GEMT_OVERENSKOMST);
    const combobox = await screen.findByDisplayValue(gemtLabel);
    await user.click(combobox);

    const listbox = await screen.findByRole('listbox');
    const note = within(listbox).getByRole('option', { name: INGEN_MATCH });
    expect(note).toHaveAttribute('aria-disabled', 'true');
    // Placeholder-rækken (ryd feltet) står stadig først; derudover kun oplysningslinjen.
    expect(within(listbox).getAllByRole('option')).toHaveLength(2);

    // Hverken klik eller tastatur må committe linjen: piletaster springer den over, og den valgte aftale står.
    fireEvent.click(note);
    await user.keyboard('{ArrowDown}{ArrowDown}');
    expect(combobox).not.toHaveAttribute('aria-activedescendant', note.id);
    await user.keyboard('{Escape}');
    act(() => (combobox as HTMLElement).focus());
    await user.keyboard('i');

    await waitFor(() => expect(combobox).toHaveValue(gemtLabel));
  }, ASYNC_TEST_TIMEOUT_MS);

  it('BB-435: linjen vises ikke, når filtrene matcher overenskomster', async () => {
    const user = userEvent.setup();
    hydrate([employment('af-1', {
      harOverenskomst: true,
      overenskomstId: GEMT_OVERENSKOMST,
      overenskomstFilter: { loenmodtager: undefined, arbejdsgiver: undefined },
    })]);
    renderLoenindkomst();

    await user.click(await screen.findByDisplayValue(resolveOverenskomstDisplay(GEMT_OVERENSKOMST)));
    const listbox = await screen.findByRole('listbox');
    expect(within(listbox).queryByRole('option', { name: INGEN_MATCH })).not.toBeInTheDocument();
  }, ASYNC_TEST_TIMEOUT_MS);

  it('BB-438: sletedialogen nævner kortets overskrift med nummer – også når to kort har samme navn', async () => {
    const user = userEvent.setup();
    hydrate([
      employment('af-1', { navnPaaArbejdssted: 'Fiktiv kommune A' }),
      employment('af-2', { navnPaaArbejdssted: 'Fiktiv kommune A' }),
      employment('af-3'),
    ]);
    renderLoenindkomst();

    await screen.findByText('Ansættelsesforhold 2 (Fiktiv kommune A)');
    const sletKnapper = screen.getAllByRole('button', { name: 'Slet ansættelsesforhold' });
    expect(sletKnapper).toHaveLength(3);

    await user.click(sletKnapper[1] as HTMLElement);
    expect(await screen.findByText(
      'Dette vil slette alle oplysninger i Ansættelsesforhold 2 (Fiktiv kommune A).',
      { exact: false },
    )).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Annuller' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    await user.click(sletKnapper[2] as HTMLElement);
    expect(await screen.findByText(
      'Dette vil slette alle oplysninger i Ansættelsesforhold 3.',
      { exact: false },
    )).toBeInTheDocument();
  }, ASYNC_TEST_TIMEOUT_MS);
});
