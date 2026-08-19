// @vitest-environment jsdom
import { hydrateSlimInputStoreForTest } from '../../../test/actSafeInputStore';
//
// Renteberegning-siden (§2.4/§2.5): hele siden kører på den ENE
// input-runtime (ingen legacy FormPersistence/invalidDrafts). Denne integrationstest kører gennem den RIGTIGE
// migrerede side + den ægte produktions-runtime og beviser den virkelige sti felt → settle → reader-projektion
// → download-gate (§1.5/§1.6/§3.9): en afsluttet ugyldig beregningsdato blokerer downloads, og en gyldig
// committed række når dokumentservicen.
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
} from '../../../inputCore/react';
import type { RentekravRow } from '../../../schemas/formSchemas';
import type { StamdataValues } from '../../../schemas/formSchemas/sections/stamdataSchemas';
import { toISODateString } from '../../../types/branded';

/**
 * Testen måler på livscyklussens IRREVERSIBLE handling (`triggerDocumentDownload`) frem for
 * på et servicekald – en strammere assertion, fordi den kræver at HELE kæden faktisk kørte. Begge
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
  hydrateSlimInputStoreForTest(slimInputStore, input);
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

describe('Renteberegning – download-gate mod afsluttet input', () => {
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

  it('lader Slet alle rydde en alene afvist beregningsdato', async () => {
    const user = userEvent.setup();
    hydrate([], undefined);
    renderRenteberegning();

    const clearAllButton = screen.getByRole('button', { name: 'Slet alle indtastninger' });
    expect(clearAllButton).toBeDisabled();

    const beregningsdatoBox = screen
      .getByText('Rente beregnes til og med')
      .closest('.row--label-right-hover') as HTMLElement;
    const dateInput = within(beregningsdatoBox).getByRole('textbox') as HTMLInputElement;

    await user.click(dateInput);
    await user.type(dateInput, '99-99-9999');
    await user.tab();

    // Afvist råtekst er stadig brugerindtastet indhold, så den destruktive recovery-handling
    // skal være mulig, selv om samme felt naturligt blokerer dokumenter.
    expect(clearAllButton).toBeEnabled();

    await user.click(clearAllButton);
    await user.click(screen.getByRole('button', { name: 'Ja, slet' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Slet alle indtastninger' })).toBeDisabled());
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

describe('Renteberegning – Evt. tillægstid', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  const getTillaegstidInput = (): HTMLInputElement => {
    const row = document.querySelector<HTMLElement>('tr[data-mineo-row-id="r1"]');
    if (!row) throw new Error('Rentekravsrækken blev ikke renderet');
    return within(row).getAllByRole('textbox')[2] as HTMLInputElement;
  };

  it('accepterer højst to cifre i den åbne draft', async () => {
    const user = userEvent.setup();
    hydrate([{ ...validRow('r1'), tillaegstid: undefined }], '2024-12-31');
    renderRenteberegning();

    const input = getTillaegstidInput();
    expect(input).toHaveAttribute('maxlength', '2');

    await user.dblClick(input);
    await user.type(input, '123');
    expect(input).toHaveValue('12');

    await user.keyboard('{Enter}');
    expect(input).toHaveValue('12');
    expect(input).toHaveAttribute('aria-invalid', 'false');
  });

  it('bevarer et indlæst trecifret canonical input gennem det eksisterende bounds-issue', () => {
    // Cifferloftet er et værn på den skrivende overflade. Et allerede schema-gyldigt canonical tal fra
    // load/programmatisk state må ikke afvises som format; det skal i stedet få det afledte bounds-issue.
    hydrate([{ ...validRow('r1'), tillaegstid: 123 }], '2024-12-31');
    renderRenteberegning();

    const input = getTillaegstidInput();

    expect(input).toHaveValue('123');
    expect(input).toHaveAttribute('aria-invalid', 'true');
  });

  // Kontraktændring 2026-08-09 (`input-field-behavior-contract.md` §1.2/§1.2a): paste afgrænses
  // nu PRÆCIS som tastning. Testen krævede før, at et indsat `987` overlevede i fuld længde og blev en rød
  // fejl ved settle – det byggede på det ophævede princip om, at paste aldrig måtte afkortes. Nu er det
  // tredje ciffer blokeret ved indgangen, ligesom det er ved tastning, så `98` er den ØNSKEDE værdi og
  // feltet er gyldigt. Et allerede indlæst canonical tal er en separat read-side-situation og bevares
  // derfor fortsat med sit afledte bounds-issue, som testen ovenfor hævder.
  it('afgrænser et indsat trecifret tal som ved tastning', async () => {
    const user = userEvent.setup();
    hydrate([{ ...validRow('r1'), tillaegstid: undefined }], '2024-12-31');
    renderRenteberegning();

    const input = getTillaegstidInput();
    await user.dblClick(input);
    await user.paste('987');

    expect(input).toHaveValue('98');
    fireEvent.blur(input);
    expect(input).toHaveValue('98');
    // Tavs blokering (§1.2 pkt. 3): det afviste ciffer blev aldrig en del af værdien, så der er
    // ingen fejltilstand at vise.
    expect(input).toHaveAttribute('aria-invalid', 'false');
  });
});
