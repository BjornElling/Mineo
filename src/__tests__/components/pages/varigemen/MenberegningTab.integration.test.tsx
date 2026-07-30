// @vitest-environment jsdom
import { __hydrateSlimInputStoreForTest } from '../../../../inputCore/runtime/slimInputStore';
//
// Greenfield Varige mén-slice (§2.4 formularrækkefølge trin 5 / Fase 3): hele fanen kører nu på den ENE greenfield
// input-runtime (ingen legacy FormPersistence/invalidDrafts/props). Denne integrationstest kører gennem den
// RIGTIGE migrerede fane + den ægte produktions-runtime og beviser stien felt → settle → reader-projektion →
// download-gate (§1.5/§1.6/§3.9): en canonical méngrad uden for 1..120 blokerer downloaden med en synlig rød
// feltfejl, en byttet datoorden i stamdata blokerer, og et fuldt gyldigt input når dokumentservicen med et frisk
// stamdata-snapshot.
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import MenberegningTab from '../../../../components/pages/varigemen/MenberegningTab';
import { AppSettingsProvider } from '../../../../contexts/AppSettingsContext';
import { RoutePathnameProvider } from '../../../../contexts/RoutePathnameProvider';
import { slimInputStore } from '../../../../inputCore/runtime/slimInputStore';
import { getProductionInputCatalog } from '../../../../inputCore/catalog/productionCatalog';
import {
  ProductionInputRuntimeProvider,
  createProductionInputRuntimeBinding,
} from '../../../../inputCore/react';
import type { StamdataValues } from '../../../../schemas/formSchemas/sections/stamdataSchemas';
import type { VarigeMenValues } from '../../../../schemas/formSchemas';
import { toISODateString } from '../../../../types/branded';
import {
  DOWNLOAD_BLOCKED_INVALID_INPUT_MESSAGE,
  DOWNLOAD_BLOCKED_MISSING_INPUT_MESSAGE,
} from '../../../../document/layout/documentGateTypes';

/**
 * Fase 5: testen måler på livscyklussens IRREVERSIBLE handling (`triggerDocumentDownload`) frem for
 * på et servicekald — en strammere assertion, fordi den kræver at HELE kæden faktisk kørte.
 */
const mockTriggerDocumentDownload = vi.hoisted(() => vi.fn());

vi.mock('../../../../document/downloadArtifact', async (importOriginal) => ({
  ...await importOriginal<typeof import('../../../../document/downloadArtifact')>(),
  triggerDocumentDownload: mockTriggerDocumentDownload,
}));

const catalog = getProductionInputCatalog();

const hydrate = (
  varigemen: VarigeMenValues,
  stamdata: StamdataValues | null
): void => {
  const input = catalog.validateSettledInput({
    sections: {
      stamdata, satser: null, aarsloen: null, faellesAarsloen: null,
      renteberegning: null,
      varigemen, forsoergertab: null, erstatningsopgoerelse: null, erhvervsevnetab: null,
    },
    rejectedInputs: {},
  });
  __hydrateSlimInputStoreForTest(slimInputStore, input);
};

const validStamdata: StamdataValues = {
  journalnr: 'J-2026-001',
  advokat: 'Test Advokat',
  sagsbehandler: 'Test Sagsbehandler',
  skadelidteFodselsdato: toISODateString('1980-01-01'),
  skadedato: toISODateString('2015-01-01'),
  skadestype: 'Arbejdsulykke',
};

const renderTab = () => render(
  <MemoryRouter initialEntries={['/varigemen']}>
    <AppSettingsProvider>
      <RoutePathnameProvider>
        <ProductionInputRuntimeProvider binding={createProductionInputRuntimeBinding()}>
          <MenberegningTab />
        </ProductionInputRuntimeProvider>
      </RoutePathnameProvider>
    </AppSettingsProvider>
  </MemoryRouter>
);

describe('MenberegningTab — reader-projektion + download-gate', () => {
  beforeEach(() => {
    sessionStorage.clear();
    mockTriggerDocumentDownload.mockClear();
  });

  it('et fuldt gyldigt input aktiverer download og når dokumentservicen med frisk stamdata', async () => {
    const user = userEvent.setup();
    hydrate({ mengrad: 10, beregningsdato: toISODateString('2020-01-01') }, validStamdata);
    renderTab();

    const downloadButton = screen.getByTestId('varigemen-download');
    expect(downloadButton).toBeEnabled();

    await user.click(downloadButton);
    await waitFor(() => expect(mockTriggerDocumentDownload).toHaveBeenCalledTimes(1));
    // Journalnummeret kommer fra stamdata og indgår i filnavnet — beviser at den friske
    // stamdata-dependency nåede hele vejen ind i det leverede dokument.
    const artifact = mockTriggerDocumentDownload.mock.calls[0]?.[0] as { filename: string };
    expect(artifact.filename).toContain('J-2026-001');
  });

  it('en canonical méngrad uden for 1..120 committes, viser rød feltfejl og blokerer download (§1.6)', async () => {
    const user = userEvent.setup();
    hydrate({ mengrad: 10, beregningsdato: toISODateString('2020-01-01') }, validStamdata);
    renderTab();

    const input = screen.getByPlaceholderText('0');
    await user.click(input);
    await user.keyboard('{Control>}a{/Control}{Delete}121');
    await user.tab();

    await waitFor(() => {
      expect(input).toHaveAttribute('aria-invalid', 'true');
      expect(screen.getByTestId('varigemen-download')).toBeDisabled();
    });

    // Værdien er committet canonical (kan gemmes i .eo) — den blev IKKE afvist af feltet.
    expect(slimInputStore.getState().input.sections.varigemen).toMatchObject({ mengrad: 121 });

    await user.click(screen.getByTestId('varigemen-download'));
    expect(mockTriggerDocumentDownload).not.toHaveBeenCalled();
  });

  it('en byttet datoorden i stamdata blokerer download (rød feltfejl på datoerne)', async () => {
    hydrate(
      { mengrad: 10, beregningsdato: toISODateString('2020-01-01') },
      {
        ...validStamdata,
        skadelidteFodselsdato: toISODateString('2020-01-02'),
        skadedato: toISODateString('2020-01-01'),
      }
    );
    renderTab();

    expect(screen.getByTestId('varigemen-download')).toBeDisabled();
  });

  it('en manglende beregningsdato blokerer download med "Indtastning mangler"', async () => {
    const user = userEvent.setup();
    hydrate({ mengrad: 10, beregningsdato: undefined }, validStamdata);
    renderTab();

    expect(screen.getByTestId('varigemen-download')).toBeDisabled();
    await user.click(screen.getByTestId('varigemen-download'));
    expect(mockTriggerDocumentDownload).not.toHaveBeenCalled();
  });
});

/**
 * UT-F07: gate-årsagen står KUN i tooltippet, og teksten er den universelle.
 *
 * Brugertestens symptom var, at "Indtastning mangler" stod BÅDE som nedtonet tekst i værdikolonnen OG som
 * tooltip på det inaktive download-ikon. Testene måler derfor to ting, som en visning kun kan opfylde
 * samtidig ved at have præcis én kanal:
 *
 *  1. teksten findes ikke som synlig tekst i dokumentet, og
 *  2. den findes som ikonets tilgængelige navn (MUI's `Tooltip` sætter `aria-label` på den disablede knap).
 *
 * Ben 1 alene ville være grønt, hvis årsagen forsvandt HELT — hvilket ville gøre blokeringen usynlig og
 * bryde den modsatte invariant. Ben 2 alene ville være grønt i den fejltilstand, brugeren rapporterede.
 * Sammen pinner de netop "ét sted, og det sted er tooltippet".
 */
describe('MenberegningTab — gate-årsagen vises kun i tooltippet (UT-F07)', () => {
  beforeEach(() => {
    sessionStorage.clear();
    mockTriggerDocumentDownload.mockClear();
  });

  it('viser "Indtastning mangler" som tooltip og IKKE som tekst ved knappen', () => {
    hydrate({ mengrad: 10, beregningsdato: undefined }, validStamdata);
    renderTab();

    const button = screen.getByTestId('varigemen-download');
    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleName(DOWNLOAD_BLOCKED_MISSING_INPUT_MESSAGE);
    // Ingen synlig tekstknude med samme besked — det var dobbeltvisningen brugeren fandt.
    expect(screen.queryByText(DOWNLOAD_BLOCKED_MISSING_INPUT_MESSAGE)).toBeNull();
  });

  /**
   * En méngrad uden for 1..120 er en RØD feltfejl, ikke en manglende indtastning — og efter brugerkravet
   * 2026-07-30 skal de to blokeringer sige noget FORSKELLIGT: "Fejl i indtastning" mod "Indtastning mangler".
   * Tidligere kollapsede de til én universel tekst, så knappen svarede "Indtastning mangler" på et felt, der
   * var udfyldt — bare forkert.
   *
   * Testen asserter begge retninger (den viser den nye tekst OG ikke den gamle), fordi en assertion på kun
   * den nye ville være grøn, hvis begge tekster stod der. Ét-kanal-invarianten fra klassen ovenfor gælder
   * uændret: teksten må stadig kun findes som tooltip, aldrig som synlig tekst.
   */
  it('bruger "Fejl i indtastning" for en rød feltfejl — IKKE "Indtastning mangler"', async () => {
    const user = userEvent.setup();
    hydrate({ mengrad: 10, beregningsdato: toISODateString('2020-01-01') }, validStamdata);
    renderTab();

    const input = screen.getByPlaceholderText('0');
    await user.click(input);
    await user.keyboard('{Control>}a{/Control}{Delete}121');
    await user.tab();

    await waitFor(() => {
      const button = screen.getByTestId('varigemen-download');
      expect(button).toBeDisabled();
      expect(button).toHaveAccessibleName(DOWNLOAD_BLOCKED_INVALID_INPUT_MESSAGE);
    });
    const button = screen.getByTestId('varigemen-download');
    expect(button).not.toHaveAccessibleName(DOWNLOAD_BLOCKED_MISSING_INPUT_MESSAGE);
    expect(screen.queryByText(DOWNLOAD_BLOCKED_INVALID_INPUT_MESSAGE)).toBeNull();
  });
});
