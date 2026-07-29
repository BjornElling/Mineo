// @vitest-environment jsdom
import { __hydrateSlimInputStoreForTest } from '../../../inputCore/runtime/slimInputStore';
//
// Greenfield Renteberegning-slice (§2.4 trin 4 / §2.5 / Fase 3): hele siden kører nu på den ENE greenfield
// input-runtime (ingen legacy FormPersistence/invalidDrafts). Denne integrationstest kører gennem den RIGTIGE
// migrerede side + den ægte produktions-runtime og beviser den virkelige sti felt → settle → reader-projektion
// → download-gate (§1.5/§1.6/§3.9): en afsluttet ugyldig beregningsdato blokerer downloads, og en gyldig
// committed række når dokumentservicen.
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Renteberegning from '../../../components/pages/Renteberegning';
import { AppSettingsProvider } from '../../../contexts/AppSettingsContext';
import { RoutePathnameProvider } from '../../../contexts/RoutePathnameProvider';
import { slimInputStore } from '../../../inputCore/runtime/slimInputStore';
import { getProductionInputCatalog } from '../../../inputCore/catalog/productionCatalog';
import {
  ProductionInputRuntimeProvider,
  createProductionInputRuntimeBinding,
} from '../../../inputCore/react/productionInputRuntime';
import type { RentekravRow } from '../../../schemas/formSchemas';
import type { StamdataValues } from '../../../schemas/formSchemas/sections/stamdataSchemas';
import { toISODateString } from '../../../types/branded';

/**
 * Fase 5: testen måler på livscyklussens IRREVERSIBLE handling (`triggerDocumentDownload`) frem for
 * på et servicekald — en strammere assertion, fordi den kræver at HELE kæden faktisk kørte. Begge
 * rente-outputs går gennem samme handling, så tælleren dækker dem tilsammen.
 */
const mockTriggerDocumentDownload = vi.hoisted(() => vi.fn());

vi.mock('../../../document/downloadArtifact', async (importOriginal) => ({
  ...await importOriginal<typeof import('../../../document/downloadArtifact')>(),
  triggerDocumentDownload: mockTriggerDocumentDownload,
}));

vi.mock('../../../hooks/usePersistedActiveTab', () => ({
  usePersistedActiveTab: () => ({ activeTab: 'calculation', setActiveTab: vi.fn() }),
}));

const catalog = getProductionInputCatalog();

const hydrate = (
  rows: readonly RentekravRow[],
  beregningsdato: string | undefined,
  stamdata: StamdataValues | null = null
): void => {
  const input = catalog.validateSettledInput({
    sections: {
      stamdata, satser: null, aarsloen: null, faellesAarsloen: null,
      renteberegning: {
        beregningsdato: beregningsdato === undefined ? undefined : toISODateString(beregningsdato),
        kommentarer: undefined,
        rentekravRows: rows as RentekravRow[],
      },
      varigemen: null, forsoergertab: null, erstatningsopgoerelse: null, erhvervsevnetab: null,
    },
    rejectedInputs: {},
  });
  __hydrateSlimInputStoreForTest(slimInputStore, input);
};

const validRow = (id: string): RentekravRow => ({
  id,
  belob: { kind: 'number', value: 1_000 },
  renterFra: toISODateString('2024-01-01'),
  tillaegstid: 0,
  enhed: 'dage',
});

const renderRenteberegning = () => render(
  <MemoryRouter initialEntries={['/renteberegning']}>
    <AppSettingsProvider>
      <RoutePathnameProvider>
        <ProductionInputRuntimeProvider binding={createProductionInputRuntimeBinding()}>
          <Renteberegning />
        </ProductionInputRuntimeProvider>
      </RoutePathnameProvider>
    </AppSettingsProvider>
  </MemoryRouter>
);

describe('Renteberegning — download-gate mod afsluttet input', () => {
  beforeEach(() => {
    sessionStorage.clear();
    mockTriggerDocumentDownload.mockClear();
  });

  it('en gyldig committed række + beregningsdato giver en aktiv oversigts-download der når servicen', async () => {
    const user = userEvent.setup();
    hydrate([validRow('r1')], '2024-12-31');
    renderRenteberegning();

    const oversigtButton = screen.getByRole('button', { name: 'Download samlet oversigt' });
    expect(oversigtButton).toBeEnabled();

    await user.click(oversigtButton);
    await waitFor(() => expect(mockTriggerDocumentDownload).toHaveBeenCalledTimes(1));
  });

  it('en afsluttet ugyldig beregningsdato blokerer downloads (§1.5/§1.6)', async () => {
    const user = userEvent.setup();
    hydrate([validRow('r1')], '2024-12-31');
    renderRenteberegning();

    const oversigtButton = screen.getByRole('button', { name: 'Download samlet oversigt' });
    expect(oversigtButton).toBeEnabled();

    // Find beregningsdato-feltet strukturelt: det ligger i "Beregningsdato"-boksen (kommentarer er en anden textbox).
    const beregningsdatoBox = screen
      .getByText('Rente beregnes til og med')
      .closest('.row--label-right-hover') as HTMLElement;
    const dateInput = within(beregningsdatoBox).getByRole('textbox') as HTMLInputElement;

    await user.click(dateInput);
    await user.keyboard('{Control>}a{/Control}{Delete}');
    await user.type(dateInput, '99-99-9999');
    await user.tab();

    // Gaten blokerer nu (den globale beregningsdato er rejected) → oversigts-download er deaktiveret og servicen nås ikke.
    expect(screen.getByRole('button', { name: 'Download samlet oversigt' })).toBeDisabled();
    expect(mockTriggerDocumentDownload).not.toHaveBeenCalled();
  });

  it('canonical datoordensfejl i stamdata blokerer både række- og oversigtsdownload', async () => {
    const user = userEvent.setup();
    hydrate([validRow('r1')], '2024-12-31', {
      skadelidteFodselsdato: toISODateString('2020-01-02'),
      skadedato: toISODateString('2020-01-01'),
    });
    renderRenteberegning();

    const rowButton = screen.getByRole('button', { name: 'Download PDF-specifikation for række 1' });
    const oversigtButton = screen.getByRole('button', { name: 'Download samlet oversigt' });
    expect(rowButton).toBeDisabled();
    expect(oversigtButton).toBeDisabled();

    await user.click(rowButton);
    await user.click(oversigtButton);
    expect(mockTriggerDocumentDownload).not.toHaveBeenCalled();
  });
});
