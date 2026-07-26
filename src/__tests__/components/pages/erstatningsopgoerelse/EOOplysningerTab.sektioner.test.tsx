// @vitest-environment jsdom
import { __hydrateSlimInputStoreForTest } from '../../../../inputCore/runtime/slimInputStore';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import Erstatningsopgoerelse from '../../../../components/pages/Erstatningsopgoerelse';
import { createActiveTabStorageKey } from '../../../../config/storageManifest';
import { AppSettingsProvider } from '../../../../contexts/AppSettingsContext';
import { RoutePathnameProvider } from '../../../../contexts/RoutePathnameProvider';
import {
  createErstatningsopgoerelseInitialValues,
} from '../../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import {
  ProductionInputRuntimeProvider,
  createProductionInputRuntimeBinding,
} from '../../../../inputCore/react/productionInputRuntime';
import { getProductionInputCatalog } from '../../../../inputCore/catalog/productionCatalog';
import { slimInputStore } from '../../../../inputCore/runtime/slimInputStore';

/**
 * Regressions-net for A1's sektion-dekomponering af EO-oplysninger-fanen: når den store inline-JSX
 * splittes i sektion-komponenter (der forbruger view-modellen via kontekst), skal fanen fortsat
 * rendere alle de uafhængigt synlige sektioner. Testen fanger en tabt/krakkende sektion.
 */
describe('EOOplysningerTab sektioner', () => {
  const ASYNC_TEST_TIMEOUT_MS = 30_000;

  beforeEach(() => {
    sessionStorage.clear();
  });

  it('renderer alle uafhængigt synlige sektioner på oplysninger-fanen', async () => {
    const catalog = getProductionInputCatalog();
    __hydrateSlimInputStoreForTest(slimInputStore, catalog.validateSettledInput({
      sections: {
        stamdata: null, satser: null, aarsloen: null, faellesAarsloen: null, renteberegning: null,
        varigemen: null, forsoergertab: null,
        erstatningsopgoerelse: createErstatningsopgoerelseInitialValues(), erhvervsevnetab: null,
      },
      rejectedInputs: {},
    }));
    sessionStorage.setItem(createActiveTabStorageKey('erstatningsopgoerelse'), 'eo_oplysninger');

    render(
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

    await waitFor(() => {
      expect(screen.queryAllByText('Bilagsnumre').length).toBeGreaterThan(0);
    });

    const expectedSectionHeaders = [
      'Erstatningsopgørelse',
      'Forlig',
      'AES-afgørelser',
      'Svie- og smertegodtgørelse',
      'Tabt arbejdsfortjeneste',
      'Indtægt før skadedatoen',
      'Øvrige erstatningskrav',
      'Eventuelle særlige kommentarer',
      'Bilagsnumre',
    ];

    for (const header of expectedSectionHeaders) {
      expect(
        screen.queryAllByText(header).length,
        `Forventede sektion-overskrift "${header}" på oplysninger-fanen`
      ).toBeGreaterThan(0);
    }
  }, ASYNC_TEST_TIMEOUT_MS);
});
