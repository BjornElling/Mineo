// @vitest-environment jsdom
import { hydrateSlimInputStoreForTest } from '../../../../test/actSafeInputStore';
import { render, screen, waitFor } from '@testing-library/react';
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
import type { ErstatningsopgoerelseValues } from '../../../../schemas/formSchemas';

/**
 * Et bilagsnummer, programmet finder inkonsistent, UDGÅR tavst af papiret: `getBilag` returnerer
 * `undefined`, så snart `resolveBilagWarning` giver et svar, og «Dokumentation vedlægges som bilag …»
 * skrives da slet ikke. Før stod feltet alligevel neutralt, og advarslen fandtes kun i boksen på
 * Beregning-fanen – brugeren, der netop står i Bilagsnumre-sektionen og skriver numrene, havde ingen
 * anledning til at gå et andet sted hen for at se, om nogen af dem blev brugt.
 *
 * Advarslen er ikke-blokerende: nummeret er en oplysning, ikke et krav.
 */
const ASYNC_TEST_TIMEOUT_MS = 30_000;

const renderOplysningerFanen = async (overrides: Partial<ErstatningsopgoerelseValues>) => {
  const values: ErstatningsopgoerelseValues = {
    ...createErstatningsopgoerelseInitialValues(),
    visBilagsnumre: 'Ja',
    ...overrides,
  };
  const catalog = getProductionInputCatalog();
  hydrateSlimInputStoreForTest(slimInputStore, catalog.validateSettledInput({
    sections: {
      stamdata: null, satser: null, aarsloen: null, faellesAarsloen: null, renteberegning: null,
      varigemen: null, forsoergertab: null,
      erstatningsopgoerelse: values, erhvervsevnetab: null,
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
    expect(screen.getByDisplayValue('3')).toBeInTheDocument();
  });
  return screen.getByDisplayValue('3');
};

describe('BilagsnumreSection – feltnær advarsel om et ubrugt bilagsnummer', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('binder advarslen til selve feltet, når et ménafgørelses-bilagsnummer er angivet uden en afgørelse', async () => {
    const felt = await renderOplysningerFanen({
      bilagsnumreMenAfgoerelse: '3',
      varigeMenAfgorelse: 'Nej',
    });

    // Advarslen skal nå brugeren gennem FELTETS eget `aria-describedby`, ikke bare stå et sted på siden.
    // Teksten er ordret boksens egen, så de to kanaler ikke kan drifte fra hinanden.
    const beskrivelsesId = felt.getAttribute('aria-describedby');
    expect(beskrivelsesId).toBeTruthy();
    expect(document.getElementById(beskrivelsesId as string)?.textContent)
      .toContain('men angivet at der ikke er truffet afgørelse');
  }, ASYNC_TEST_TIMEOUT_MS);

  it('lader feltet stå uden advarsel, når konteksten er konsistent', async () => {
    const felt = await renderOplysningerFanen({
      bilagsnumreMenAfgoerelse: '3',
      varigeMenAfgorelse: 'Ja',
      menAfgoerelseDato: undefined,
    });

    const beskrivelsesId = felt.getAttribute('aria-describedby');
    const beskrivelse = beskrivelsesId === null ? '' : (document.getElementById(beskrivelsesId)?.textContent ?? '');
    expect(beskrivelse).not.toContain('men angivet at der ikke er truffet afgørelse');
  }, ASYNC_TEST_TIMEOUT_MS);
});
