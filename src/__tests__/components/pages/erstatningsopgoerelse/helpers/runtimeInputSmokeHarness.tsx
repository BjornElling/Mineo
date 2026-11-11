import { hydrateSlimInputStoreForTest } from '../../../../../test/actSafeInputStore';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import * as React from 'react';
import { MemoryRouter } from 'react-router-dom';

import Erstatningsopgoerelse from '../../../../../components/pages/Erstatningsopgoerelse';
import { AppSettingsProvider } from '../../../../../contexts/AppSettingsContext';
import { RoutePathnameProvider } from '../../../../../contexts/RoutePathnameProvider';
import { LOCAL_STORAGE_KEY, writeLocalStorage } from '../../../../../settings/appSettingsStorage';
import {
  ProductionInputRuntimeProvider,
  createProductionInputRuntimeBinding,
} from '../../../../../inputCore/react';
import { getProductionInputCatalog } from '../../../../../inputCore/catalog/productionCatalog';
import { slimInputStore } from '../../../../../inputCore/runtime/slimInputStore';
import {
  createDefaultLoenindkomstAnsaettelsesforhold,
  createErstatningsopgoerelseInitialValues,
} from '../../../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import type { PersistedErstatningsopgoerelseValues, StamdataValues } from '../../../../../schemas/formSchemas';
import { toISODateString } from '../../../../../types/branded';
import { generateEoCase, type EoCaseMode } from '../../../../domain/erstatningsopgoerelse/helpers/eoRuntimeInputArbitrary';

/**
 * Hele Erstatningsopgørelse-siden – alle fire hovedfaner og begge kontrolfaner – monteres på sager, der før
 * væltede siden, og på genererede sager. Domænekæden har sin egen, langt bredere fuzzing
 * (`helpers/eoRuntimeFuzzShard.ts` i domænetestene); her måles det, kun en rendering kan afsløre: komponenter og viewmodels.
 */

type Captured = { errors: string[] };

class CaptureBoundary extends React.Component<{ captured: Captured; children: React.ReactNode }, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override componentDidCatch(error: Error) {
    this.props.captured.errors.push(`${error.name}: ${error.message}`);
  }

  override render() {
    return this.state.failed ? null : this.props.children;
  }
}

const catalog = getProductionInputCatalog();

const TABS = ['EO oplysninger', 'Lønindkomst', 'Offentlige ydelser', 'Beregning'] as const;
const SIDE_TABS = ['EO-kontrol', 'Kontroltabel'] as const;

export const renderAllTabs = async (
  stamdata: StamdataValues,
  erstatningsopgoerelse: PersistedErstatningsopgoerelseValues
): Promise<string[]> => {
  const captured: Captured = { errors: [] };
  const consoleError = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    captured.errors.push(`console.error: ${args.map(String).join(' ').slice(0, 300)}`);
  });
  try {
    hydrateSlimInputStoreForTest(slimInputStore, catalog.validateSettledInput({
      sections: {
        stamdata, satser: null, aarsloen: null, faellesAarsloen: null, renteberegning: null,
        varigemen: null, forsoergertab: null, erstatningsopgoerelse, erhvervsevnetab: null,
      },
      rejectedInputs: {},
    }));
    const binding = createProductionInputRuntimeBinding();
    render(
      <MemoryRouter initialEntries={['/erstatningsopgoerelse']}>
        <AppSettingsProvider>
          <RoutePathnameProvider>
            <ProductionInputRuntimeProvider binding={binding}>
              <CaptureBoundary captured={captured}>
                <Erstatningsopgoerelse />
              </CaptureBoundary>
            </ProductionInputRuntimeProvider>
          </RoutePathnameProvider>
        </AppSettingsProvider>
      </MemoryRouter>
    );
    for (const tab of TABS) {
      if (captured.errors.length > 0) break;
      await act(async () => {
        fireEvent.click(screen.getByRole('tab', { name: tab }));
      });
    }
    for (const tab of SIDE_TABS) {
      if (captured.errors.length > 0) break;
      await act(async () => {
        fireEvent.click(screen.getByText(tab));
      });
    }
  } finally {
    consoleError.mockRestore();
    cleanup();
  }
  return captured.errors;
};

export const stamdata: StamdataValues = {
  skadestype: 'Arbejdsulykke',
  skadedato: toISODateString('2022-03-01'),
};

export const offentligOverenskomstUdenAnsaettelse = (): PersistedErstatningsopgoerelseValues => {
  const eo = createErstatningsopgoerelseInitialValues();
  return {
    ...eo,
    kravPaaTabtArbejdsfortjeneste: 'Ja',
    beregnesUdFra: 'Angivet månedsløn',
    // Feltet er valgfrit af hensyn til ældre `.eo`-filer; tomt læses det som månedsløn.
    eoAngivetLoenLoenudvikling: {
      ...eo.eoAngivetLoenLoenudvikling,
      overenskomstId: 'kl-overenskomst',
      loenudviklingBeregningsgrundlag: 'Overenskomst',
      offentligLoenType: 'Månedsløn',
    },
    loenindkomstAnsaettelsesforhold: [{
      ...createDefaultLoenindkomstAnsaettelsesforhold(),
      id: 'af-1',
      harOverenskomst: true,
      overenskomstId: 'kl-overenskomst',
      loenudviklingBeregningsgrundlag: 'Overenskomst',
      offentligLoenType: 'Månedsløn',
    }],
  };
};

export const ukendtOrganisationIFilteret = (loenmodtager = 'Nedlagt forbund', arbejdsgiver = 'Omdøbt arbejdsgiver'): PersistedErstatningsopgoerelseValues => {
  const eo = createErstatningsopgoerelseInitialValues();
  return {
    ...eo,
    eoAngivetLoenLoenudvikling: {
      ...eo.eoAngivetLoenLoenudvikling,
      loenudviklingBeregningsgrundlag: 'Overenskomst',
      overenskomstFilter: { loenmodtager, arbejdsgiver },
    },
    loenindkomstAnsaettelsesforhold: [{
      ...createDefaultLoenindkomstAnsaettelsesforhold(),
      id: 'af-1',
      overenskomstFilter: { loenmodtager, arbejdsgiver },
    }],
  };
};

/** Fælles opsætning for alle filer, der monterer hele siden. */
export const prepareSmokeEnvironment = (): void => {
  beforeEach(() => {
    sessionStorage.clear();
    writeLocalStorage(LOCAL_STORAGE_KEY, JSON.stringify({ showEOInspektionMenu: true }));
  });
};

/**
 * De genererede sager er de tungeste (seed 13: ~6 s isoleret, ~29 s under coverage i CI). De lå i samme fil som
 * de navngivne sager, så filen tog ~100 s i coverage-gaten og lå på suitens kritiske sti. Nu fordeles de på én
 * fil pr. generatortilstand, der kører parallelt. Grænsen er hævet for netop dem, fordi den parallelle
 * coverage-gate er målt langt over 60 s på samme commit, som består isoleret.
 */
export const defineGeneratedCases = (mode: EoCaseMode, seeds: readonly number[]): void => {
  it.each(seeds)(`monterer en genereret sag (${mode}, seed %i)`, async (seed) => {
    const generated = generateEoCase(seed, mode);
    expect(await renderAllTabs(generated.stamdata, generated.erstatningsopgoerelse)).toEqual([]);
  }, 180_000);
};
