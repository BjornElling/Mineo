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
import { toISODateString } from '../../../../types/branded';

import {
  ProductionInputRuntimeProvider,
  createProductionInputRuntimeBinding,
} from '../../../../inputCore/react/productionInputRuntime';
import { getProductionInputCatalog } from '../../../../inputCore/catalog/productionCatalog';
import { slimInputStore } from '../../../../inputCore/runtime/slimInputStore';

describe('Erstatningsopgoerelse svie/smerte sats-aar integration', () => {
  const ASYNC_TEST_TIMEOUT_MS = 30_000;

  beforeEach(() => {
    sessionStorage.clear();
  });

  it('viser sats-aar advarslen i Beregning-fanen på den rigtige side', async () => {
    const catalog = getProductionInputCatalog();
    __hydrateSlimInputStoreForTest(slimInputStore, catalog.validateSettledInput({
      sections: {
        stamdata: null, satser: null, aarsloen: null, faellesAarsloen: null, renteberegning: null,
        varigemen: null, forsoergertab: null, erhvervsevnetab: null,
        erstatningsopgoerelse: {
          ...createErstatningsopgoerelseInitialValues(),
          opgørelseLavetDen: toISODateString('2025-12-15'),
          svieSmerteSatserAar: 2025,
          revideretOpgoerelse: 'Nej',
        },
      },
      rejectedInputs: {},
    }));
    sessionStorage.setItem(createActiveTabStorageKey('erstatningsopgoerelse'), 'beregning');

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
      expect(screen.getByText('Svie/smerte-satsen for 2026 kan anvendes.')).toBeInTheDocument();
    });
    expect(screen.getByRole('tab', { name: 'Beregning', selected: true })).toBeInTheDocument();
  }, ASYNC_TEST_TIMEOUT_MS);
});
