// @vitest-environment jsdom
//
// Fase 7 acceptmatrix punkt 3, KLIK-VÆK-benet (WI-013, tilføjet efter re-review R7).
//
// §1.3 opregner fire settle-udløsere: "Blur, Enter, klik uden for feltet og almindelig
// side-/fanenavigation". Blur og Enter var dækket i `useFormFieldSurface.test.tsx`, men gennem DIREKTE
// kald af `onBlur`/`onKeyDown` — ikke gennem en faktisk brugerhandling. Side- og fanenavigation har
// hver sin test. "Klik uden for feltet" havde ingen.
//
// Registret citerede i stedet en Escape-test som evidens, hvilket re-reviewet korrekt afviste: Escape
// er den MODSATTE regel (§1.3: "Escape lukker editoren uden at udstede en command"). En test, der
// beviser at intet committes, kan ikke bære et punkt om, at noget committes.
//
// Testen klikker derfor på et rigtigt element uden for feltet, i den ægte side med den ægte runtime, og
// læser resultatet fra det autoritative afsluttede input.
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import VarigeMen from '../../../components/pages/VarigeMen';
import { AppSettingsProvider } from '../../../contexts/AppSettingsContext';
import { RoutePathnameProvider } from '../../../contexts/RoutePathnameProvider';
import { getProductionInputCatalog } from '../../../inputCore/catalog/productionCatalog';
import {
  ProductionInputRuntimeProvider,
  createProductionInputRuntimeBinding,
} from '../../../inputCore/react';
import { slimInputStore, __hydrateSlimInputStoreForTest } from '../../../inputCore/runtime/slimInputStore';

const catalog = getProductionInputCatalog();

const emptyInput = () => catalog.validateSettledInput({
  sections: {
    stamdata: null, satser: null, aarsloen: null, faellesAarsloen: null,
    renteberegning: null, varigemen: null, forsoergertab: null,
    erstatningsopgoerelse: null, erhvervsevnetab: null,
  },
  rejectedInputs: {},
});

const renderPage = () => render(
  <MemoryRouter initialEntries={['/varigemen']}>
    <AppSettingsProvider>
      <RoutePathnameProvider>
        <ProductionInputRuntimeProvider binding={createProductionInputRuntimeBinding()}>
          <VarigeMen />
        </ProductionInputRuntimeProvider>
      </RoutePathnameProvider>
    </AppSettingsProvider>
  </MemoryRouter>
);

const settledMengrad = (): unknown =>
  (slimInputStore.getState().input.sections.varigemen as { mengrad?: unknown } | null)?.mengrad;

describe('VarigeMen — klik uden for feltet settler den åbne editor (§1.3, acceptmatrix punkt 3)', () => {
  beforeEach(() => {
    sessionStorage.clear();
    __hydrateSlimInputStoreForTest(slimInputStore, emptyInput());
  });

  afterEach(() => {
    __hydrateSlimInputStoreForTest(slimInputStore, emptyInput());
  });

  it('afslutter draften, når brugeren klikker på et element uden for feltet', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByPlaceholderText('0'));
    await user.keyboard('15');

    // §1.2: endnu intet afsluttet.
    expect(settledMengrad()).toBeUndefined();

    // Klik på sidens titel — et rigtigt element uden for feltet, IKKE en fane og ikke et andet input,
    // så hverken fane-skiftet eller en anden editors åbning kan forklare et settle.
    await user.click(screen.getByText('Varige mén'));

    await waitFor(() => {
      expect(settledMengrad()).toBe(15);
    });
    // Feltet er lukket igen (editoren blev afsluttet, ikke blot forlagt).
    expect(screen.getByPlaceholderText('0')).toHaveAttribute('readonly');
  });

  it('afslutter også en FEJLENDE draft ved klik væk og viser fejlen (§1.3/§1.6)', async () => {
    const user = userEvent.setup();
    renderPage();

    const input = screen.getByPlaceholderText('0');
    await user.click(input);
    await user.keyboard('121'); // uden for 1..120 → canonical bounds-fejl

    await user.click(screen.getByText('Varige mén'));

    await waitFor(() => {
      expect(settledMengrad()).toBe(121);
    });
    await waitFor(() => {
      expect(screen.getByPlaceholderText('0')).toHaveAttribute('aria-invalid', 'true');
    });
  });
});
