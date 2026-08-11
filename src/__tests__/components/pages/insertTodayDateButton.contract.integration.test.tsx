// @vitest-environment jsdom
//
// ÉN fælles kontrakttest for »Indsæt dags dato« på ALLE fem flader.
//
// Fejlen var, at hver af de fem knapper kaldte `commitImmediate(today)`. Den command er `setImmediateField`,
// som reduceren kun tillader for choice/toggle — alle datofelter er text-controls, så et klik kastede
// `InputReducer: setImmediateField er kun tilladt for choice/toggle` som en uncaught systemfejl.
//
// Testen er BEVIDST tabeldrevet over de fem sider frem for fem næsten identiske tests: fejlen var netop, at
// den samme forkerte kommando var kopieret fem steder, og en per-side-test ville lade en sjette flade opstå
// udækket. Hver side renderes med den ÆGTE produktions-runtime, og klikket måles på det autoritative
// afsluttede input — ikke på et hook-kald.
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import Forsoergertab from '../../../components/pages/Forsoergertab';
import VarigeMen from '../../../components/pages/VarigeMen';
import Renteberegning from '../../../components/pages/Renteberegning';
import Erhvervsevnetab from '../../../components/pages/Erhvervsevnetab';
import Erstatningsopgoerelse from '../../../components/pages/Erstatningsopgoerelse';
import { AppSettingsProvider } from '../../../contexts/AppSettingsContext';
import { RoutePathnameProvider } from '../../../contexts/RoutePathnameProvider';
import { getProductionInputCatalog } from '../../../inputCore/catalog/productionCatalog';
import {
  ProductionInputRuntimeProvider,
  createProductionInputRuntimeBinding,
} from '../../../inputCore/react';
import { slimInputStore } from '../../../inputCore/runtime/slimInputStore';
import { hydrateSlimInputStoreForTest } from '../../../test/actSafeInputStore';
import type { FieldRef, PersistedInputSections } from '../../../inputCore';
import { forsoergertabBeregningsdatoField } from '../../../inputCore/catalog/forsoergertabDescriptors';
import { varigeMenBeregningsdatoField } from '../../../inputCore/catalog/varigeMenDescriptors';
import { renteberegningBeregningsdatoField } from '../../../inputCore/catalog/renteberegningDescriptors';
import { erhvervsevnetabBeregningsdatoField } from '../../../inputCore/catalog/erhvervsevnetabDescriptors';
import { eoOpgørelseLavetDenField } from '../../../inputCore/catalog/erstatningsopgoerelseDescriptors';
import type { ISODateString } from '../../../types/branded';
import { getTodayLocalISO } from '../../../utils/dateUtils';

const catalog = getProductionInputCatalog();

const EMPTY_SECTIONS: PersistedInputSections = {
  stamdata: null, satser: null, aarsloen: null, faellesAarsloen: null,
  renteberegning: null, varigemen: null, forsoergertab: null,
  erstatningsopgoerelse: null, erhvervsevnetab: null,
};

const hydrateEmpty = (): void => {
  hydrateSlimInputStoreForTest(
    slimInputStore,
    catalog.validateSettledInput({ sections: EMPTY_SECTIONS, rejectedInputs: {} })
  );
};

/**
 * Læser feltets afsluttede canonical værdi gennem feltets EGEN descriptor. Det autoritative afsluttede input
 * er kilden — ikke DOM'en, så en ren visningsopdatering uden et commit ikke kan bære testen — og descriptoren
 * er adressen, så testen ikke bærer en håndskrevet kopi af hver sektions nøgle.
 */
const readCommitted = (field: FieldRef<ISODateString | undefined>): string | undefined =>
  field.descriptor.readCanonical(slimInputStore.getState().input.sections, field.address);

/** De fem flader, der bærer knappen — den ene liste, begge kontrakttests kører over. */
const SURFACES: readonly Readonly<{
  name: string;
  route: string;
  render: () => React.ReactElement;
  field: FieldRef<ISODateString | undefined>;
}>[] = [
  {
    name: 'Forsørgertab',
    route: '/forsoergertab',
    render: () => <Forsoergertab />,
    field: forsoergertabBeregningsdatoField.bind(),
  },
  {
    name: 'Varigt mén',
    route: '/varigemen',
    render: () => <VarigeMen />,
    field: varigeMenBeregningsdatoField.bind(),
  },
  {
    name: 'Renteberegning',
    route: '/renteberegning',
    render: () => <Renteberegning />,
    field: renteberegningBeregningsdatoField.bind(),
  },
  {
    name: 'Erhvervsevnetab',
    route: '/erhvervsevnetab',
    render: () => <Erhvervsevnetab />,
    field: erhvervsevnetabBeregningsdatoField.bind(),
  },
  {
    name: 'Erstatningsopgørelse',
    route: '/erstatningsopgoerelse',
    render: () => <Erstatningsopgoerelse />,
    field: eoOpgørelseLavetDenField.bind(),
  },
];

const renderSurface = (surface: (typeof SURFACES)[number]) => render(
  <MemoryRouter initialEntries={[surface.route]}>
    <AppSettingsProvider>
      <RoutePathnameProvider>
        <ProductionInputRuntimeProvider binding={createProductionInputRuntimeBinding()}>
          {surface.render()}
        </ProductionInputRuntimeProvider>
      </RoutePathnameProvider>
    </AppSettingsProvider>
  </MemoryRouter>
);

describe('»Indsæt dags dato« — fælles kommandokontrakt på alle fem flader', () => {
  beforeEach(() => {
    sessionStorage.clear();
    hydrateEmpty();
  });

  afterEach(() => sessionStorage.clear());

  for (const surface of SURFACES) {
    it(`${surface.name}: klik committer dags dato canonical uden at kaste`, async () => {
      const user = userEvent.setup();
      const errors: unknown[] = [];
      // En uncaught fejl fra dispatch ville ellers kun ende i React' error boundary/konsollen. Fanges den
      // her, fejler testen på PRÆCIS brugerens symptom i stedet for på en følgeeffekt.
      const onError = (event: ErrorEvent) => { errors.push(event.error); };
      window.addEventListener('error', onError);

      try {
        renderSurface(surface);

        const button = await screen.findByRole('button', { name: 'Indsæt dags dato' });
        await user.click(button);

        await waitFor(() => expect(readCommitted(surface.field)).toBe(getTodayLocalISO()));
        expect(errors).toEqual([]);
        // Ét klik = ét afsluttet felt-commit; feltet står canonical, ikke som rejected råtekst (§1.5).
        expect(slimInputStore.getState().input.rejectedInputs).toEqual({});
      } finally {
        window.removeEventListener('error', onError);
      }
    });

    it(`${surface.name}: klik giver ÉT undo-trin med en felt-origin`, async () => {
      const user = userEvent.setup();
      renderSurface(surface);

      const revisionBefore = slimInputStore.getState().revision;
      const pastBefore = slimInputStore.getState().history.past.length;

      const button = await screen.findByRole('button', { name: 'Indsæt dags dato' });
      await user.click(button);

      await waitFor(() => expect(readCommitted(surface.field)).toBe(getTodayLocalISO()));

      const state = slimInputStore.getState();
      expect(state.revision).toBe(revisionBefore + 1);
      expect(state.history.past.length).toBe(pastBefore + 1);
      // §3.7: undo skal kunne navigere tilbage til det felt, knappen skrev i.
      expect(state.history.past.at(-1)?.origin?.kind).toBe('field');
    });
  }
});
