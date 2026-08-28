// @vitest-environment jsdom
import { hydrateSlimInputStoreForTest } from '../../../test/actSafeInputStore';
//
// Forsørgertab-siden (§2.4 formularrækkefølge): hele siden kører på den ENE
// greenfield input-runtime (ingen legacy FormPersistence/invalidDrafts/props). Denne integrationstest kører gennem
// den RIGTIGE migrerede side + den ægte produktions-runtime og beviser stien felt → settle → reader-projektion →
// download-gate (§1.5/§1.6/§3.9): et fuldt gyldigt input aktiverer download og når dokumentservicen med et frisk
// stamdata-snapshot; en canonical tilkendt-periode uden for 1..10 blokerer med en synlig rød feltfejl; en byttet
// stamdata-datoorden blokerer.
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Forsoergertab from '../../../components/pages/Forsoergertab';
import { AppSettingsProvider } from '../../../contexts/AppSettingsContext';
import { RoutePathnameProvider } from '../../../contexts/RoutePathnameProvider';
import { slimInputStore } from '../../../inputCore/runtime/slimInputStore';
import { getProductionInputCatalog } from '../../../inputCore/catalog/productionCatalog';
import {
  ProductionInputRuntimeProvider,
  createProductionInputRuntimeBinding,
} from '../../../inputCore/react';
import type { StamdataValues } from '../../../schemas/formSchemas/sections/stamdataSchemas';
import type { FaellesAarsloenValues, ForsoergertabValues } from '../../../schemas/formSchemas';
import { toISODateString } from '../../../types/branded';
import { DOWNLOAD_BLOCKED_MISSING_INPUT_MESSAGE } from '../../../document/layout/documentGateTypes';
import { aarsloenAslMax } from '../../../data/lovbestemteRates';
import {
  stamdataSkadedatoField,
  stamdataSkadelidteFodselsdatoField,
} from '../../../inputCore/catalog/stamdataDescriptors';

/**
 * Testen måler på livscyklussens IRREVERSIBLE handling (`triggerDocumentDownload`) frem for
 * på et servicekald – en strammere assertion, fordi den kræver at HELE kæden (barriere, frisk
 * capture, token-lighed, gate, lazy-load, friskheds-recheck, rendering) faktisk kørte.
 */
const mockTriggerDocumentDownload = vi.hoisted(() => vi.fn());

vi.mock('../../../document/downloadArtifact', async (importOriginal) => ({
  ...await importOriginal<typeof import('../../../document/downloadArtifact')>(),
  triggerDocumentDownload: mockTriggerDocumentDownload,
}));

/**
 * `scrollToFieldAddress` mockes, fordi jsdom hverken har layout eller scroll, og Stamdata-siden ikke er
 * mountet her: den ægte funktion ville køre sin rAF-retry-løkke uden at finde en editor. Påstanden er
 * koblingen – at siden bruger den DELTE markeringsvej med den rigtige feltadresse.
 */
const mockScrollToFieldAddress = vi.hoisted(() => vi.fn());

vi.mock('../../../utils/scrollToFieldAddress', async (importOriginal) => ({
  ...await importOriginal<typeof import('../../../utils/scrollToFieldAddress')>(),
  scrollToFieldAddress: mockScrollToFieldAddress,
}));

const catalog = getProductionInputCatalog();

const asAmount = (value: number) => ({ kind: 'number' as const, value });

const hydrate = (
  forsoergertab: ForsoergertabValues,
  faellesAarsloen: FaellesAarsloenValues,
  stamdata: StamdataValues | null
): void => {
  const input = catalog.validateSettledInput({
    sections: {
      stamdata, satser: null, aarsloen: null, faellesAarsloen,
      renteberegning: null,
      varigemen: null, forsoergertab, erstatningsopgoerelse: null, erhvervsevnetab: null,
    },
    rejectedInputs: {},
  });
  hydrateSlimInputStoreForTest(slimInputStore, input);
};

const validForsoergertab: ForsoergertabValues = {
  beregningsdato: toISODateString('2020-06-01'),
  efterladteFodselsdato: toISODateString('1973-01-01'),
  virkningsdato: toISODateString('2020-05-01'),
  koen: undefined,
  tilkendtForPeriodeAar: 10,
};
const validFaellesAarsloen: FaellesAarsloenValues = {
  aslAarsloen: asAmount(450000),
  ealAarsloen: asAmount(450000),
};
const validStamdata: StamdataValues = {
  journalnr: 'J-2026-002',
  advokat: 'Test Advokat',
  sagsbehandler: 'Test Sagsbehandler',
  skadelidte: 'Test',
  skadelidteFodselsdato: toISODateString('1980-01-01'),
  skadedato: toISODateString('2020-05-01'),
  skadestype: 'Arbejdsulykke',
};

const renderPage = () => render(
  <MemoryRouter initialEntries={['/forsoergertab']}>
    <AppSettingsProvider>
      <RoutePathnameProvider>
        <ProductionInputRuntimeProvider binding={createProductionInputRuntimeBinding()}>
          <Forsoergertab />
        </ProductionInputRuntimeProvider>
      </RoutePathnameProvider>
    </AppSettingsProvider>
  </MemoryRouter>
);

describe('Forsoergertab – reader-projektion + download-gate', () => {
  beforeEach(() => {
    sessionStorage.clear();
    mockTriggerDocumentDownload.mockClear();
    mockScrollToFieldAddress.mockClear();
  });

  /**
   * «Mangler (angiv i Stamdata)» skal PEGE på feltet – ikke kun skifte side.
   *
   * Linkene navigerede tidligere blot til Stamdata og efterlod brugeren dér uden anvisning, selv om det er
   * den reneste form for «en indtastning mangler»: feltet findes, det er blot tomt, og dets descriptor er
   * allerede bundet i viewmodellen. Begge rækker har hver SIT felt, så testen dækker dem hver for sig –
   * ellers kunne ét fælles mål bestå for den forkerte række.
   */
  it.each([
    { label: 'Skadelidtes fødselsdato', field: stamdataSkadelidteFodselsdatoField },
    { label: 'Skadedato', field: stamdataSkadedatoField },
  ])('$label-linket fører til feltet i Stamdata og markerer det', async ({ label, field }) => {
    const user = userEvent.setup();
    hydrate(validForsoergertab, validFaellesAarsloen, {
      ...validStamdata,
      skadelidteFodselsdato: undefined,
      skadedato: undefined,
    });
    renderPage();

    const row = screen.getByText(label).closest('.row--label-right-hover');
    expect(row).not.toBeNull();
    await user.click(within(row as HTMLElement).getByText('Stamdata'));

    expect(mockScrollToFieldAddress).toHaveBeenCalledWith(field.bind().address);
  });

  it('et fuldt gyldigt input aktiverer download og leverer et dokument med frisk stamdata', async () => {
    const user = userEvent.setup();
    hydrate(validForsoergertab, validFaellesAarsloen, validStamdata);
    renderPage();

    const inputSection = document.querySelector('[data-section-id="forsoergertab-beregning"]');
    expect(inputSection).not.toBeNull();
    expect(within(inputSection as HTMLElement).getByText('Skadelidtes årsløn (efter ASL)')).toBeInTheDocument();
    expect(within(inputSection as HTMLElement).getByText('Skadelidtes årsløn efter EAL (hvis forskellig fra ASL)')).toBeInTheDocument();
    expect(screen.getByText('Resterende periode (hele år og måneder)')).toBeInTheDocument();
    const downloadButton = screen.getByTestId('forsoergertab-download');
    await waitFor(() => expect(downloadButton).toBeEnabled());

    await user.click(downloadButton);
    await waitFor(() => expect(mockTriggerDocumentDownload).toHaveBeenCalledTimes(1));
    // Journalnummeret kommer fra stamdata og indgår i filnavnet – beviser at den friske
    // stamdata-dependency nåede hele vejen ind i det leverede dokument.
    const artifact = mockTriggerDocumentDownload.mock.calls[0]?.[0] as { filename: string };
    expect(artifact.filename).toContain('J-2026-002');
  });

  it('viser den aktuelle kontekstuelle label for Stamdatas dato', () => {
    hydrate(validForsoergertab, validFaellesAarsloen, {
      ...validStamdata,
      skadestype: 'Erhvervssygdom',
    });
    renderPage();

    expect(screen.getByText('Anmeldelsesdato')).toBeInTheDocument();
    expect(screen.queryByText('Skadedato')).toBeNull();
  });

  it('en canonical tilkendt-periode uden for 1..10 committes, viser rød feltfejl og blokerer download (§1.6)', async () => {
    const user = userEvent.setup();
    hydrate(validForsoergertab, validFaellesAarsloen, validStamdata);
    renderPage();

    const input = document.querySelector('input[name="tilkendtForPeriodeAar"]') as HTMLInputElement;
    await user.click(input);
    await user.keyboard('{Control>}a{/Control}{Delete}11');
    await user.tab();

    await waitFor(() => {
      expect(input).toHaveAttribute('aria-invalid', 'true');
    });
    // Værdien er committet canonical (kan gemmes i .eo) – den blev IKKE afvist af feltet.
    expect(slimInputStore.getState().input.sections.forsoergertab).toMatchObject({ tilkendtForPeriodeAar: 11 });

    const downloadButton = screen.getByTestId('forsoergertab-download');
    await waitFor(() => expect(downloadButton).toBeDisabled());
    await user.click(downloadButton);
    expect(mockTriggerDocumentDownload).not.toHaveBeenCalled();
  });

  it('en byttet datoorden i stamdata blokerer download (rød feltfejl på datoerne)', async () => {
    hydrate(
      validForsoergertab,
      validFaellesAarsloen,
      {
        ...validStamdata,
        skadelidteFodselsdato: toISODateString('2020-01-02'),
        skadedato: toISODateString('2020-01-01'),
      }
    );
    renderPage();

    const downloadButton = screen.getByTestId('forsoergertab-download');
    await waitFor(() => expect(downloadButton).toBeDisabled());
  });

  /**
   * Oplysningen om ASL-maksimum skal NÅ brugeren.
   *
   * Beskeden blev udledt i snapshottet før rettelsen, men ingen komponent læste den – derfor er det netop
   * en test gennem den ægte side, der er beviset. En snapshot-unittest kunne ikke skelne "udledt" fra "vist".
   */
  const ASL_MAX_NOTICE = 'Når Skadelidtes årsløn (efter ASL) svarer til maksimum, skal den faktiske årsløn indtastes.';

  it('viser ASL-maksimum-oplysningen på siden uden at blokere download (beslutning 3)', async () => {
    hydrate(
      validForsoergertab,
      { aslAarsloen: asAmount(aarsloenAslMax[2020]!), ealAarsloen: undefined },
      validStamdata
    );
    renderPage();

    expect(await screen.findByText(ASL_MAX_NOTICE)).toBeInTheDocument();
    // Ikke-blokerende: den faktiske årsløn KAN legitimt være præcis maksimum.
    const downloadButton = screen.getByTestId('forsoergertab-download');
    await waitFor(() => expect(downloadButton).toBeEnabled());
  });

  it('viser INGEN ASL-maksimum-oplysning, når årslønnen ligger under maksimum', () => {
    // Ankeret: uden det ville testen ovenfor kunne bestå på en besked, siden altid viser.
    hydrate(validForsoergertab, validFaellesAarsloen, validStamdata);
    renderPage();

    expect(screen.queryByText(ASL_MAX_NOTICE)).not.toBeInTheDocument();
  });
});

/**
 * Gate-årsagen står KUN i tooltippet – også når blokeringen rammer selve aktiveringen.
 *
 * Brugertestens symptom på denne side var den lange gate-interne besked "Der er ikke beregnet en PDF-klar
 * EAL- eller ASL-del.", vist BÅDE som tekst og som tooltip. Tre ting skal derfor gælde samtidig:
 *
 *  1. den lange interne besked er væk fra brugerfladen (den lever videre som `message` til koder/tests),
 *  2. tooltippet er den universelle tekst, og
 *  3. et KLIK på den inaktive knap giver INGEN besked – hverken under knappen eller i rækken.
 *
 * Punkt 3 er udviklerbeslutningen 2026-07-31, gjort universel for hele programmet: en deaktiveret
 * download-knap svarer aldrig med tekst. Knappen var synligt inaktiv, og brugeren har haft tooltippet;
 * en besked oveni ville forklare det, brugeren allerede kunne se.
 */
describe('Forsoergertab – gate-årsagen vises kun i tooltippet', () => {
  beforeEach(() => {
    sessionStorage.clear();
    mockTriggerDocumentDownload.mockClear();
  });

  const GATE_INTERNAL_MESSAGE = 'Der er ikke beregnet en PDF-klar EAL- eller ASL-del.';

  it('viser den universelle tekst som tooltip, og den lange interne besked står ingen steder', async () => {
    // Tom sag: ingen PDF-klar EAL/ASL-del – netop den blokering, brugeren rapporterede.
    hydrate({}, { aslAarsloen: undefined, ealAarsloen: undefined }, validStamdata);
    renderPage();

    const button = screen.getByTestId('forsoergertab-download');
    await waitFor(() => expect(button).toBeDisabled());
    expect(button).toHaveAccessibleName(DOWNLOAD_BLOCKED_MISSING_INPUT_MESSAGE);
    // Hverken den universelle tekst eller den gamle lange besked må stå som synlig tekst ved knappen.
    expect(screen.queryByText(DOWNLOAD_BLOCKED_MISSING_INPUT_MESSAGE)).toBeNull();
    expect(screen.queryByText(GATE_INTERNAL_MESSAGE)).toBeNull();
  });

  /**
   * Den svære halvdel af reglen: en gate-blokering kan ramme en AKTIVERING og ikke kun den reaktive knap.
   * `runDocumentPreflight` gater FØRST efter commit-barrieren (`documentLifecycle.ts:168-171`), så et klik
   * på en ENABLED knap med en åben editor kan blokere, fordi settlet netop gjorde værdien ugyldig.
   *
   * Det er præcis den sti, der tidligere producerede en besked i udfaldsrækken. Under den universelle regel
   * skal også DEN være tavs: `gate-blocked` bærer ingen brugerbesked, uanset hvornår den opdages. Testen er
   * det eneste sted, der kan fremkalde stien – den skriver en ugyldig værdi i det åbne felt og klikker
   * DIREKTE på den (stadig aktiverede) knap, så settlet og gaten sker i samme aktivering.
   *
   * Bemærk hvad testen IKKE hævder: at brugeren står uden signal. Downloaden stoppes (ingen fil), knappen
   * bliver disabled på den nye revision, og feltet bærer selv sin røde markering.
   */
  it('en blokering opdaget under aktiveringen er tavs – ingen besked i udfaldsrækken', async () => {
    const user = userEvent.setup();
    hydrate(validForsoergertab, validFaellesAarsloen, validStamdata);
    renderPage();

    const button = screen.getByTestId('forsoergertab-download');
    await waitFor(() => expect(button).toBeEnabled());

    // Gør værdien ugyldig UDEN at lukke editoren: knappen er stadig enabled på den gamle revision.
    const input = document.querySelector('input[name="tilkendtForPeriodeAar"]') as HTMLInputElement;
    await user.click(input);
    // Erstat uden et særskilt Delete-keydown: clear er en immediate-commit-handling, mens denne tekst
    // forbliver en åben draft indtil downloadaktiveringen kører commit-barrieren.
    await user.keyboard('{Control>}a{/Control}11');
    expect(button).toBeEnabled();

    // `user.click` ville blurre inputtet FØRST (som settler og disabler knappen), så aktiveringen aldrig
    // nåede handleren. `pointerDown`+`click` direkte på knappen rammer den rækkefølge, brugeren oplever:
    // aktiveringen starter, mens editoren stadig er åben, og preflighten settler selv (§1.4).
    fireEvent.pointerDown(button);
    fireEvent.click(button);

    // Aktiveringen blev stoppet: ingen fil.
    expect(mockTriggerDocumentDownload).not.toHaveBeenCalled();
    // ... og den blev stoppet TAVST. Knappen er nu disabled på den nye revision, hvilket beviser at
    // gaten faktisk afviste – så assertionen nedenfor ikke kan være grøn, fordi intet skete.
    await waitFor(() => expect(button).toBeDisabled());
    expect(screen.queryByTestId('document-outcome-message')).toBeNull();
    expect(screen.queryByText(DOWNLOAD_BLOCKED_MISSING_INPUT_MESSAGE)).toBeNull();
    expect(screen.queryByText(GATE_INTERNAL_MESSAGE)).toBeNull();
  });
});
