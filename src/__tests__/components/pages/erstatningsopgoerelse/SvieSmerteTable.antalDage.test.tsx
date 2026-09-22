// @vitest-environment jsdom
import { hydrateSlimInputStoreForTest } from '../../../../test/actSafeInputStore';
import { render, screen, waitFor, within } from '@testing-library/react';
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
} from '../../../../inputCore/react';
import { getProductionInputCatalog } from '../../../../inputCore/catalog/productionCatalog';
import { slimInputStore } from '../../../../inputCore/runtime/slimInputStore';

const iso = (value: string) => toISODateString(value);

/**
 * «Antal dage» er det eneste tal, brugeren ser mens han taster, og det skal derfor være det tal,
 * opgørelsen faktisk betaler for – altså dagene inden for EO-perioden, ikke rækkens egen længde.
 * Tooltippet ved «Periode:» beder udtrykkeligt om at lade tidligere perioder stå, så rækker uden
 * for perioden er normaltilstanden fra og med 2. opgørelse (BB-217).
 */
describe('SvieSmerteTable – «Antal dage» viser bidraget i EO-perioden', () => {
  const ASYNC_TEST_TIMEOUT_MS = 30_000;

  beforeEach(() => {
    sessionStorage.clear();
  });

  const renderMedPerioder = async () => {
    const catalog = getProductionInputCatalog();
    hydrateSlimInputStoreForTest(slimInputStore, catalog.validateSettledInput({
      sections: {
        stamdata: null, satser: null, aarsloen: null, faellesAarsloen: null, renteberegning: null,
        varigemen: null, forsoergertab: null, erhvervsevnetab: null,
        erstatningsopgoerelse: {
          ...createErstatningsopgoerelseInitialValues(),
          kravPaaSvieSmerteGodtgoerelse: 'Ja',
          tidligereSsMax: 'Nej',
          vedroererPeriodeFra: iso('2024-01-01'),
          vedroererPeriodeTil: iso('2024-12-31'),
          svieSmertePerioder: [
            // Rækker ud over EO-periodens start: 90 egne dage, hvoraf 59 ligger i perioden.
            { id: 'ss-1', fra: iso('2023-12-01'), til: iso('2024-02-28'), tilstand: 'sygemeldt' },
            // Helt uden for perioden: 365 egne dage, men bidrager med 0.
            { id: 'ss-2', fra: iso('2023-01-01'), til: iso('2023-12-31'), tilstand: 'sygemeldt' },
            // Helt inden for perioden: uændret.
            { id: 'ss-3', fra: iso('2024-06-01'), til: iso('2024-06-10'), tilstand: 'sygemeldt' },
          ],
        },
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
      expect(screen.queryAllByText('Svie- og smertegodtgørelse').length).toBeGreaterThan(0);
    });
  };

  const dagCelleFor = (rowId: string): string => {
    const row = document.querySelector(`[data-mineo-row-id="${rowId}"]`);
    if (!row) throw new Error(`Fandt ikke rækken ${rowId}`);
    // Kolonnerne er fra, til, antal dage, tilstand.
    return within(row as HTMLElement).getAllByRole('cell')[2]?.textContent?.trim() ?? '';
  };

  it('klipper rækkens dage til EO-perioden og viser 0 for en række helt udenfor', async () => {
    await renderMedPerioder();

    // 01-01-2024 til 28-02-2024 inklusive = 59 dage, ikke rækkens egne 90.
    expect(dagCelleFor('ss-1')).toBe('59');
    expect(dagCelleFor('ss-2')).toBe('0');
    expect(dagCelleFor('ss-3')).toBe('10');
  }, ASYNC_TEST_TIMEOUT_MS);

  it('bærer årsagen i kolonneoverskriften, så det lavere tal ikke ser ud som en tavs reduktion', async () => {
    await renderMedPerioder();

    expect(screen.getAllByText('Antal dage (i EO-perioden)').length).toBeGreaterThan(0);
  }, ASYNC_TEST_TIMEOUT_MS);
});
