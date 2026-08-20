// @vitest-environment jsdom
import { hydrateSlimInputStoreForTest } from '../../../../test/actSafeInputStore';
//
// Varige mén-fanen (§2.4 formularrækkefølge): hele fanen kører på den ENE
// input-runtime (ingen legacy FormPersistence/invalidDrafts/props). Denne integrationstest kører gennem den
// RIGTIGE migrerede fane + den ægte produktions-runtime og beviser stien felt → settle → reader-projektion →
// download-gate (§1.5/§1.6/§3.9): en canonical méngrad uden for 1..120 blokerer downloaden med en synlig rød
// feltfejl, en byttet datoorden i stamdata blokerer, og et fuldt gyldigt input når dokumentservicen med et frisk
// stamdata-snapshot.
import { render, screen, waitFor, within } from '@testing-library/react';
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
  stamdataSkadedatoField,
  stamdataSkadelidteFodselsdatoField,
} from '../../../../inputCore/catalog/stamdataDescriptors';
import {
  DOWNLOAD_BLOCKED_INVALID_INPUT_MESSAGE,
  DOWNLOAD_BLOCKED_MISSING_INPUT_MESSAGE,
} from '../../../../document/layout/documentGateTypes';

/**
 * Testen måler på livscyklussens IRREVERSIBLE handling (`triggerDocumentDownload`) frem for
 * på et servicekald – en strammere assertion, fordi den kræver at HELE kæden faktisk kørte.
 */
const mockTriggerDocumentDownload = vi.hoisted(() => vi.fn());

vi.mock('../../../../document/downloadArtifact', async (importOriginal) => ({
  ...await importOriginal<typeof import('../../../../document/downloadArtifact')>(),
  triggerDocumentDownload: mockTriggerDocumentDownload,
}));

/**
 * `scrollToFieldAddress` mockes, fordi jsdom hverken har layout eller scroll: den ægte funktion ville
 * køre sin rAF-retry-løkke uden nogensinde at finde en editor (Stamdata-siden er ikke mountet her).
 * Påstanden er koblingen – at fanen bruger den DELTE markeringsvej med den rigtige feltadresse.
 */
const mockScrollToFieldAddress = vi.hoisted(() => vi.fn());

vi.mock('../../../../utils/scrollToFieldAddress', async (importOriginal) => ({
  ...await importOriginal<typeof import('../../../../utils/scrollToFieldAddress')>(),
  scrollToFieldAddress: mockScrollToFieldAddress,
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
  hydrateSlimInputStoreForTest(slimInputStore, input);
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

describe('MenberegningTab – reader-projektion + download-gate', () => {
  beforeEach(() => {
    sessionStorage.clear();
    mockTriggerDocumentDownload.mockClear();
    mockScrollToFieldAddress.mockClear();
  });

  it('et fuldt gyldigt input aktiverer download og når dokumentservicen med frisk stamdata', async () => {
    const user = userEvent.setup();
    hydrate({ mengrad: 10, beregningsdato: toISODateString('2020-01-01') }, validStamdata);
    renderTab();

    const downloadButton = screen.getByTestId('varigemen-download');
    expect(downloadButton).toBeEnabled();

    await user.click(downloadButton);
    await waitFor(() => expect(mockTriggerDocumentDownload).toHaveBeenCalledTimes(1));
    // Journalnummeret kommer fra stamdata og indgår i filnavnet – beviser at den friske
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

    // Værdien er committet canonical (kan gemmes i .eo) – den blev IKKE afvist af feltet.
    expect(slimInputStore.getState().input.sections.varigemen).toMatchObject({ mengrad: 121 });

    await user.click(screen.getByTestId('varigemen-download'));
    expect(mockTriggerDocumentDownload).not.toHaveBeenCalled();
  });

  it('afkorter méngradens draft ved codecets tre cifre uden at ændre bounds-reglen', async () => {
    const user = userEvent.setup();
    hydrate({ mengrad: 10, beregningsdato: toISODateString('2020-01-01') }, validStamdata);
    renderTab();

    const input = screen.getByPlaceholderText('0');
    expect(input).toHaveAttribute('maxlength', '3');

    await user.click(input);
    await user.keyboard('{Control>}a{/Control}{Delete}1234');
    await user.tab();

    await waitFor(() => expect(input).toHaveValue('123'));
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(slimInputStore.getState().input.sections.varigemen).toMatchObject({ mengrad: 123 });
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
 * Gate-årsagen i RESULTATRÆKKEN (den nederste "Beregnet méngodtgørelse"-linje) står KUN i download-
 * knappens tooltip, ikke som en ekstra tekstknude i selve resultatrækken.
 *
 * Brugertestens symptom var, at "Indtastning mangler" stod BÅDE som nedtonet tekst i resultat-værdikolonnen
 * OG som tooltip på det inaktive download-ikon. Testen måler derfor to ting, som en visning kun kan opfylde
 * samtidig ved at have præcis én kanal for RESULTATRÆKKEN specifikt:
 *
 *  1. resultatrækken (identificeret ved sin `varigemen-download`-knap) har ingen søskende-tekstknude med
 *     samme besked, og
 *  2. den findes som ikonets tilgængelige navn (MUI's `Tooltip` sætter `aria-label` på den disablede knap).
 *
 * Andre rækker (fx satsrækken) må gerne vise samme universelle tekst synligt – det er efter brugerbeslutning
 * 2026-08-20 (BB-065) den TILSIGTEDE måde de skelner mellem "mangler" og "fejl" i deres egen lånte værdi, og
 * er en anden linje end resultatrækken denne test pinner.
 */
describe('MenberegningTab – gate-årsagen vises kun i tooltippet', () => {
  beforeEach(() => {
    sessionStorage.clear();
    mockTriggerDocumentDownload.mockClear();
  });

  it('viser "Indtastning mangler" som tooltip og IKKE som tekst i resultatrækken', () => {
    hydrate({ mengrad: 10, beregningsdato: undefined }, validStamdata);
    renderTab();

    const button = screen.getByTestId('varigemen-download');
    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleName(DOWNLOAD_BLOCKED_MISSING_INPUT_MESSAGE);
    // Ingen søskende-tekstknude med samme besked i resultatrækken – det var dobbeltvisningen brugeren fandt.
    const resultatRow = button.closest('.row--label-right-hover');
    expect(resultatRow).not.toBeNull();
    expect(within(resultatRow as HTMLElement).queryByText(DOWNLOAD_BLOCKED_MISSING_INPUT_MESSAGE)).toBeNull();
  });

  /**
   * En méngrad uden for 5..120 er en RØD feltfejl, ikke en manglende indtastning – og efter brugerkravet
   * 2026-07-30 skal de to blokeringer sige noget FORSKELLIGT: "Fejl i indtastning" mod "Indtastning mangler".
   * Tidligere kollapsede de til én universel tekst, så knappen svarede "Indtastning mangler" på et felt, der
   * var udfyldt – bare forkert.
   *
   * Testen asserter begge retninger (den viser den nye tekst OG ikke den gamle), fordi en assertion på kun
   * den nye ville være grøn, hvis begge tekster stod der. Ét-kanal-invarianten fra klassen ovenfor gælder
   * uændret: teksten må stadig kun findes som tooltip, aldrig som synlig tekst.
   */
  it('bruger "Fejl i indtastning" for en rød feltfejl – IKKE "Indtastning mangler"', async () => {
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
      expect(button).toHaveAccessibleName('Værdi skal være mellem 5 og 120');
    });
    const button = screen.getByTestId('varigemen-download');
    expect(button).not.toHaveAccessibleName(DOWNLOAD_BLOCKED_MISSING_INPUT_MESSAGE);
    expect(screen.queryByText(DOWNLOAD_BLOCKED_INVALID_INPUT_MESSAGE)).toBeNull();
  });

  /**
   * «Mangler (angiv i Stamdata)» skal PEGE på feltet – ikke kun skifte side.
   *
   * Linkene navigerede tidligere blot til Stamdata og efterlod brugeren dér uden anvisning, selv om det er
   * den reneste form for «en indtastning mangler»: feltet findes, det er blot tomt. Blokerings-feedbacken
   * havde samme mangel, og skadedato-grenen returnerede endda uden at gøre noget som helst.
   *
   * Testen hævder, at den DELTE markeringsvej kaldes med præcis det stamdata-felt, rækken handler om.
   * Selve blinket er dækket af `scrollToFieldAddress`-/blink-testene og af e2e; her er påstanden
   * koblingen: rigtigt felt, rigtig vej, ingen side-lokal kopi.
   */
  it.each([
    { label: 'Fødselsdato', field: stamdataSkadelidteFodselsdatoField },
    { label: 'Skadedato', field: stamdataSkadedatoField },
  ])('$label-linket fører til feltet i Stamdata og markerer det', async ({ label, field }) => {
    const user = userEvent.setup();
    // Begge datoer er tomme, så begge rækker viser «Mangler (angiv i Stamdata)».
    hydrate({ mengrad: 10, beregningsdato: toISODateString('2020-01-01') }, {
      ...validStamdata,
      skadelidteFodselsdato: undefined,
      skadedato: undefined,
    });
    renderTab();

    const row = screen.getByText(label).closest('.row--label-right-hover');
    expect(row).not.toBeNull();
    await user.click(within(row as HTMLElement).getByText('Stamdata'));

    expect(mockScrollToFieldAddress).toHaveBeenCalledWith(field.bind().address);
  });

  it('en blokeret download peger på den manglende stamdata-dato frem for kun at ryste knappen', async () => {
    const user = userEvent.setup();
    hydrate({ mengrad: 10, beregningsdato: toISODateString('2020-01-01') }, {
      ...validStamdata,
      skadelidteFodselsdato: undefined,
    });
    renderTab();

    await user.click(screen.getByTestId('varigemen-download'));

    expect(mockTriggerDocumentDownload).not.toHaveBeenCalled();
    expect(mockScrollToFieldAddress).toHaveBeenCalledWith(
      stamdataSkadelidteFodselsdatoField.bind().address
    );
  });

  /**
   * BB-069: et klik på en (endnu) AKTIV downloadknap, mens méngrad har en åben draft med en ugyldig
   * værdi. Knappens gate læser render-tidens tilstand og er derfor stadig aktiv i det øjeblik brugeren
   * klikker – en åben draft ændrer bevidst ikke gaten. Der var TO fejl i samspil:
   *
   *  1. Museklikkets `mousedown` flytter native fokus til knappen og blurrer det åbne draft-felt FØR
   *     `click` affyres. Blur committer draften synkront, méngrad bliver rødt, og knappen bliver
   *     `disabled` – FØR click-eventet når frem. En disabled `<button>` fyrer intet `onClick`, så
   *     klikket forsvandt helt. Rettet med `onMouseDown={(e) => e.preventDefault()}` på selve
   *     downloadknappen (lokalt for denne flade), som bevarer fokus på draft-feltet til click rammer.
   *  2. Selve fokus-feedbacken læste closure-værdier fra renderet FØR settle og fandt derfor intet
   *     blokerende felt. Rettet ved at læse en FRISK evaluering (`readPort.getEvaluation()`) taget
   *     EFTER settle.
   *
   * Begge dele skal virke sammen, før méngrad-feltet korrekt får fokus og blink.
   */
  it('et klik på en aktiv knap, mens méngrad-draften er ugyldig, fokuserer méngrad efter settle', async () => {
    const user = userEvent.setup();
    hydrate({ mengrad: 10, beregningsdato: toISODateString('2020-01-01') }, validStamdata);
    renderTab();

    const input = screen.getByPlaceholderText('0');
    // Dobbeltklik åbner editoren (§1.3) – kun DÉR skriver Ctrl+A/Delete/tastning i en åben draft, i stedet
    // for at Delete på det lukkede, fokuserede felt committer en tom værdi med det samme.
    await user.dblClick(input);
    await user.keyboard('{Control>}a{/Control}{Delete}121');
    // INGEN Tab: draften er stadig åben, og knappen er derfor stadig aktiv (render-tidens gate).
    expect(screen.getByTestId('varigemen-download')).toBeEnabled();

    await user.click(screen.getByTestId('varigemen-download'));

    // `user.click` afventer selv preflightens promise (settle → gate → fokus-feedback), som er
    // synkron fra det punkt af – ingen waitFor nødvendig, og en waitFor her ville kunne polle længere
    // end blinkets egen fjernelses-timer (FIELD_ATTENTION_BLINK_DURATION_MS) og gøre testen flaky.
    // Blinket selv (`FIELD_ATTENTION_BLINK_CLASS`) måles bevidst IKKE her: det er en transient DOM-klasse
    // sat af en direkte DOM-mutation, som en efterfølgende Reacts re-render overskriver igen – samme grund
    // til at blink kun kan måles i e2e via `animationstart` (se `project_transient_visual_must_restart`).
    // Denne test pinner i stedet den observerbare, stabile effekt: klikket blev IKKE tabt (methoden blev
    // kaldt, méngrad blev korrekt afsluttet som en rød feltfejl, og downloaden blev reelt afvist).
    expect(mockTriggerDocumentDownload).not.toHaveBeenCalled();
    expect(input).toHaveAttribute('aria-invalid', 'true');
  });
});
