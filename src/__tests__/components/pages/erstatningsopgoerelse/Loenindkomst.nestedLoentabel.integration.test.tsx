// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
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
import {
  __hydrateSlimInputStoreForTest,
  slimInputStore,
} from '../../../../inputCore/runtime/slimInputStore';
import { EO_TAB_KEYS } from '../../../../config/eoTabKeys';
import type { StandardLoenTableRow } from '../../../../schemas/formSchemas';

// Den nested løntabel under et ansættelsesforhold (§1.11, §3.2). Kravet: hele kortet — inklusive løntabellens
// placeholder-række OG dens committede rækker — kan renderes. Cellernes dataidentitet er nested (ejerens id +
// rækkens id), og hver synlig celle kunne være første fejlsted, hvis en surface bandt med for få entity-led.
//
// Denne test findes, fordi den fælles StandardLoenTable tidligere KUN blev integrationsdækket i sin top-level
// Årsløn-variant. Den variant kræver ét entity-led og kunne derfor ikke afsløre et manglende ejer-id.

const ASYNC_TEST_TIMEOUT_MS = 30_000;

const loenRow = (id: string, maaned: string, aar: string): StandardLoenTableRow => ({
  id,
  col0_maaned: maaned, col1_maaned: aar,
  col0_uge: undefined, col1_uge: undefined, col0_dag: undefined, col1_dag: undefined,
  col2: { kind: 'number', value: 30000 },
  col3: undefined, col4: undefined, col5: undefined,
  fpFvShSoBeloeb: undefined, pensionBeloeb: undefined,
});

const hydrate = (rows: readonly StandardLoenTableRow[]): void => {
  const catalog = getProductionInputCatalog();
  __hydrateSlimInputStoreForTest(slimInputStore, catalog.validateSettledInput({
    sections: {
      stamdata: null, satser: null, aarsloen: null, faellesAarsloen: null, renteberegning: null,
      varigemen: null, forsoergertab: null, erhvervsevnetab: null,
      erstatningsopgoerelse: {
        ...createErstatningsopgoerelseInitialValues(),
        loenindkomstAnsaettelsesforhold: [{
          ...createDefaultLoenindkomstAnsaettelsesforhold(),
          id: 'af-1',
          indtaegtsoplysningerTableData: [...rows],
        }],
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

describe('EO-lønindkomst — nested løntabel under et ansættelsesforhold', () => {
  beforeEach(() => {
    sessionStorage.clear();
    sessionStorage.setItem(createActiveTabStorageKey('erstatningsopgoerelse'), EO_TAB_KEYS.LOENINDKOMST);
  });

  it('renderer kortet med en TOM løntabel uden at kaste', async () => {
    // Præcis brugerens handling: et nyt ansættelsesforhold har ingen lønrækker, så alle synlige celler er
    // placeholder-celler. Under den gamle enkelt-id-binding kastede den første celle allerede under render.
    hydrate([]);
    renderLoenindkomst();

    await waitFor(() => {
      expect(screen.getByText('Oplysninger om ansættelsesforhold')).toBeInTheDocument();
    });
    // Løntabellens periodekolonne beviser, at den nested tabel faktisk nåede at rendere.
    expect(screen.getAllByPlaceholderText('mm').length).toBeGreaterThan(0);
  }, ASYNC_TEST_TIMEOUT_MS);

  it('renderer kortet med COMMITTEDE lønrækker uden at kaste (indlæst .eo)', async () => {
    // Den afledte risiko rapporten pegede på: en gemt sag med lønrækker rammer BÅDE den eksisterende-række-
    // binding og placeholder-bindingen ved første render, uden at brugeren gør noget.
    hydrate([loenRow('row-1', '1', '2024'), loenRow('row-2', '2', '2024')]);
    renderLoenindkomst();

    await waitFor(() => {
      expect(screen.getByText('Oplysninger om ansættelsesforhold')).toBeInTheDocument();
    });
    // De committede cellers værdier skal være læst gennem den nested feltadresse.
    await waitFor(() => {
      expect(screen.getAllByDisplayValue('2024').length).toBeGreaterThan(0);
    });
  }, ASYNC_TEST_TIMEOUT_MS);
});
