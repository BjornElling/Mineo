// @vitest-environment jsdom
import { hydrateSlimInputStoreForTest } from '../../../test/actSafeInputStore';
//
// Årsløn-siden (§2.4/§2.5). Integrationstest gennem den RIGTIGE side + den
// ægte produktions-runtime (`ProductionInputRuntimeProvider` mod `slimInputStore`). Beviser den virkelige sti:
// hydreret sag → reader-projektion → StandardLoenTable over grid-adapteren (afledte kolonner, valideringssummary,
// række-infrastruktur) + beregningsprincip-blok, uden legacy `usePersistedForm`/`invalidDrafts`.
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Aarsloen from '../../../components/pages/Aarsloen';
import { AppSettingsProvider } from '../../../contexts/AppSettingsContext';
import { RoutePathnameProvider } from '../../../contexts/RoutePathnameProvider';
import { slimInputStore } from '../../../inputCore/runtime/slimInputStore';
import { getProductionInputCatalog } from '../../../inputCore/catalog/productionCatalog';
import {
  FIELD_ATTENTION_BLINK_CLASS,
  FIELD_ATTENTION_BLINK_DURATION_MS,
} from '../../../inputCore/react/fieldAttentionBlink';
import {
  ProductionInputRuntimeProvider,
  createProductionInputRuntimeBinding,
} from '../../../inputCore/react';
import type { StandardLoenTableRow } from '../../../schemas/formSchemas';
import type { StamdataValues } from '../../../schemas/formSchemas/sections/stamdataSchemas';
import { toISODateString } from '../../../types/branded';

const { logErrorMock } = vi.hoisted(() => ({ logErrorMock: vi.fn() }));
vi.mock('../../../utils/logger', async (importOriginal) => ({
  ...await importOriginal<typeof import('../../../utils/logger')>(),
  logError: logErrorMock,
}));

/**
 * Testen måler på livscyklussens IRREVERSIBLE handling (`triggerDocumentDownload`) frem for
 * på et servicekald – en strammere assertion, fordi den kræver at HELE kæden faktisk kørte.
 */
const mockTriggerDocumentDownload = vi.hoisted(() => vi.fn());
vi.mock('../../../document/downloadArtifact', async (importOriginal) => ({
  ...await importOriginal<typeof import('../../../document/downloadArtifact')>(),
  triggerDocumentDownload: mockTriggerDocumentDownload,
}));

const catalog = getProductionInputCatalog();

const amount = (value: number) => ({ kind: 'number' as const, value });

const hydrateAarsloen = (
  aarsloen: Record<string, unknown> | null,
  stamdata: StamdataValues | null = null
): void => {
  const input = catalog.validateSettledInput({
    sections: {
      stamdata, satser: null, aarsloen, faellesAarsloen: null, renteberegning: null,
      varigemen: null, forsoergertab: null, erstatningsopgoerelse: null, erhvervsevnetab: null,
    },
    rejectedInputs: {},
  });
  hydrateSlimInputStoreForTest(slimInputStore, input);
};

const renderAarsloen = () => render(
  <MemoryRouter initialEntries={['/aarsloen']}>
    <AppSettingsProvider>
      <RoutePathnameProvider>
        <ProductionInputRuntimeProvider binding={createProductionInputRuntimeBinding()}>
          <Aarsloen />
        </ProductionInputRuntimeProvider>
      </RoutePathnameProvider>
    </AppSettingsProvider>
  </MemoryRouter>
);

const getDataRowCells = (rowIndex: number): HTMLElement[] => {
  const rows = screen.getAllByRole('row');
  // rows[0] = header; datarækker følger.
  return within(rows[rowIndex + 1]).getAllByRole('cell');
};

describe('Årsløn – siden og løntabellen over grid-adapteren', () => {
  beforeEach(() => {
    sessionStorage.clear();
    mockTriggerDocumentDownload.mockClear();
  });

  it('renderer på en FRESH sag (aarsloen-sektion = null) uden at kaste; required-valg får deres canonical default', () => {
    // Regression: en fresh/`Slet alt`-sag har `aarsloen: null` i storen (ingen Zod-default anvendt på en
    // nullable sektion). `deriveSettledFieldView` falder tilbage til descriptorens `emptyValue`, så
    // `ChoiceField(allowEmpty=false)` for tillaegAngivesSom/loenPaaHelligdage ikke kaster.
    hydrateAarsloen(null);
    renderAarsloen();
    expect(screen.getByText('Årslønsberegning')).toBeInTheDocument();
    // Default loenperiode = 'maaned' → månedstabellens overskrifter vises.
    const columnHeaders = screen.getAllByRole('columnheader').map((th) => th.textContent);
    expect(columnHeaders).toContain('Måned');
  });

  it('renderer sidens overskrifter og løntabellens kolonneoverskrifter', () => {
    hydrateAarsloen({ tableData: [] });
    renderAarsloen();
    expect(screen.getByText('Årslønsberegning')).toBeInTheDocument();
    expect(screen.getByText('Indtægtsoplysninger')).toBeInTheDocument();
    // Månedstabellens kolonneoverskrifter (default loenperiode = 'maaned') – scoped til tabellens header,
    // så "Måned"/"År" ikke forveksles med radio-optionen "Løn indtastes som".
    const columnHeaders = screen.getAllByRole('columnheader').map((th) => th.textContent);
    expect(columnHeaders).toContain('Måned');
    expect(columnHeaders).toContain('År');
    expect(columnHeaders).toContain('Samlet løn');
  });

  it('viser mindst to rækker (én committed + trailing placeholder op til minimum)', () => {
    hydrateAarsloen({
      loenperiode: 'maaned',
      tableData: [
        { id: 'r1', col0_maaned: '1', col1_maaned: '2024', col2: amount(50000) } as StandardLoenTableRow,
      ],
    });
    renderAarsloen();
    // Header + mindst 2 datarækker (den committede + en trailing placeholder).
    const rows = screen.getAllByRole('row');
    expect(rows.length).toBeGreaterThanOrEqual(3);
  });

  it('beregner de afledte kolonner (FP/FV/SH/SO, Pension, Samlet) fra committed rækkeinput + satser', () => {
    // Satser: ferie 10% + fritvalg 5,5% (totalPct 15,5%), pension 10%.
    hydrateAarsloen({
      loenperiode: 'maaned',
      feriePct: 10,
      fritvalgPct: 5.5,
      pensionPct: 10,
      tableData: [
        { id: 'r1', col0_maaned: '1', col1_maaned: '2024', col2: amount(1000) } as StandardLoenTableRow,
      ],
    });
    renderAarsloen();
    const cells = getDataRowCells(0);
    // col6 = 1000 * 0,155 = 155,00 kr.; col7 = 1000 * 1,155 * 0,10 = 115,50 kr.; col8 = 1000 + 155 + 115,5 = 1.270,50 kr.
    expect(cells[6]?.textContent).toContain('155,00');
    expect(cells[7]?.textContent).toContain('115,50');
    expect(cells[8]?.textContent).toContain('1.270,50');
  });

  it('en committed satsprocent uden for 0–100 skjules af readeren og undertrykker et misvisende resultat (§1.6)', () => {
    // En gammel .eo kan have en canonical sats > 100; den er nu en rød feltfejl → readeren skjuler værdien, og
    // sammentællingen viser "—" i stedet for et misvisende tal (fatal-gate).
    hydrateAarsloen({
      loenperiode: 'maaned',
      feriePct: 150,
      tableData: [
        { id: 'r1', col0_maaned: '1', col1_maaned: '2024', col2: amount(1000) } as StandardLoenTableRow,
      ],
    });
    renderAarsloen();
    expect(screen.getByText('Sammentælling af løn fra tabellen:').parentElement?.textContent).toContain('—');
  });

  // ── "Kritisk Fejl"-boksen: findes KUN med indhold ──────────────────────────────────────────────────────
  //
  // Regression: boksen stod permanent øverst på siden og var TOM. Viewmodellen skrev `?? []` på et
  // `string | null`-felt; et tomt array er truthy, så boksens eget værn (`if (!beregningsFejl)`) slap igennem,
  // og `{[]}` renderede lovligt til ingenting, fordi `string[]` er en gyldig ReactNode.
  //
  // Begge retninger måles, og det er bevidst: en test der kun tjekker "boksen er væk på en ren sag" ville
  // også være grøn, hvis boksen aldrig kunne vises. Den anden retning beviser, at overskriften stadig HAR en
  // levende vej – ellers var værnet grønt af tomhed.
  const kritiskFejlBox = (): HTMLElement | null => screen.queryByText('Kritisk Fejl');

  it('viser INGEN "Kritisk Fejl"-boks på en sag uden beregningsfejl', () => {
    hydrateAarsloen({
      loenperiode: 'maaned',
      feriePct: 10,
      tableData: [
        { id: 'r1', col0_maaned: '1', col1_maaned: '2024', col2: amount(1000) } as StandardLoenTableRow,
      ],
    });
    renderAarsloen();
    expect(kritiskFejlBox()).toBeNull();
  });

  it('viser INGEN "Kritisk Fejl"-boks på en helt fresh sag (aarsloen = null)', () => {
    // Den tilstand brugeren så fejlen i: en tom side, hvor der intet er at klage over.
    hydrateAarsloen(null);
    renderAarsloen();
    expect(kritiskFejlBox()).toBeNull();
  });

  it('viser "Kritisk Fejl"-boksen MED en læsbar besked, når en beregning KASTER', async () => {
    // Boksens eneste NÅBARE indhold er en intern undtagelse, fanget af `safeCompute`.
    //
    // Det er en pointe i sig selv. `computeAarsloenBeregning` sætter også `beregningsFejl` fra
    // `resolveAarsloenCanonicalRangeIssues` (out-of-range sats), men den gren er UNÅELIG fra siden: projektionens
    // `resolveAarsloenFieldErrorGate` kontrollerer de samme felter under de samme betingelser og kalder da slet
    // ikke motoren (`calculation === null`). Derfor kan et out-of-range input ikke fylde boksen – fatal-gate-testen
    // ovenfor dækker den vej, og den viser '—', ikke en fejlboks.
    //
    // Testen fodrer derfor den vej, der ER tilbage: en kastende periodeberegning. Uden dette ville boksen ikke
    // have nogen bevist levende vej overhovedet, og de to negative tests ovenfor ville være grønne af tomhed.
    const periodeBeregning = await import('../../../utils/periodeBeregning');
    const spy = vi.spyOn(periodeBeregning, 'beregnMaanedPeriode').mockImplementation(() => {
      throw new Error('syntetisk beregningsfejl');
    });
    logErrorMock.mockClear();

    try {
      hydrateAarsloen({
        loenperiode: 'maaned',
        feriePct: 10,
        tableData: [
          { id: 'r1', col0_maaned: '1', col1_maaned: '2024', col2: amount(1000) } as StandardLoenTableRow,
        ],
      });
      renderAarsloen();

      const header = kritiskFejlBox();
      expect(header).not.toBeNull();
      // Boksens brødtekst – ikke overskriften selv – skal have synligt indhold. En boks med overskrift og intet
      // indhold er værre end ingen boks: den påstår en fejl uden at kunne navngive den.
      const boxText = header?.parentElement?.textContent?.replace('Kritisk Fejl', '').trim() ?? '';
      expect(boxText.length).toBeGreaterThan(0);
      expect(logErrorMock).toHaveBeenCalledWith(
        'Systemfejl registreret: Beregningsfejl',
        expect.any(Object),
      );
    } finally {
      spy.mockRestore();
    }
  });

  it('promoverer en placeholder-række ved første ikke-tomme settle og skriver cellens canonical værdi (§1.11)', async () => {
    const user = userEvent.setup();
    hydrateAarsloen({ loenperiode: 'maaned', tableData: [] });
    renderAarsloen();

    // Ingen committede rækker endnu → alle rækker er placeholders. Skriv i første rækkes måned-celle og blur.
    const firstMonthInput = within(getDataRowCells(0)[0]).getByRole('textbox') as HTMLInputElement;
    await user.click(firstMonthInput);
    await user.click(firstMonthInput); // to-trins-aktivering: klik 2 åbner editoren
    await user.keyboard('3');
    await user.tab();

    // Rækken er promoveret: cellen viser den committede værdi, og en ny trailing placeholder er tilføjet.
    await waitFor(() => {
      const cells = getDataRowCells(0);
      const monthInput = within(cells[0]).getByRole('textbox') as HTMLInputElement;
      expect(monthInput.value).toBe('3');
    });
    // Mindst 2 rækker fortsat (den promoverede + en ny placeholder).
    expect(screen.getAllByRole('row').length).toBeGreaterThanOrEqual(3);
  });

  it('kan slette en promoveret række, der kun indeholder rejected råtekst', async () => {
    const user = userEvent.setup();
    hydrateAarsloen({ loenperiode: 'maaned', tableData: [] });
    renderAarsloen();

    const firstMonthInput = within(getDataRowCells(0)[0]).getByRole('textbox') as HTMLInputElement;
    await user.click(firstMonthInput);
    await user.click(firstMonthInput);
    await user.keyboard('13');
    await user.tab();

    await waitFor(() => expect(screen.getByRole('button', { name: 'Slet rækken' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Slet rækken' }));

    await waitFor(() => {
      const tableData = slimInputStore.getState().input.sections.aarsloen?.tableData ?? [];
      expect(tableData).toHaveLength(0);
      expect(slimInputStore.getState().input.rejectedInputs).toEqual({});
    });
  });

  it('omregning-toggle afspejler den committede canonical værdi', () => {
    hydrateAarsloen({
      loenperiode: 'maaned',
      omregningTilFuldtAar: false,
      tableData: [
        { id: 'r1', col0_maaned: '1', col1_maaned: '2024', col2: amount(50000) } as StandardLoenTableRow,
      ],
    });
    renderAarsloen();
    // StyledToggleSwitch eksponerer role="checkbox"; første = omregning-toggle. Committed false → ikke aktiveret.
    const toggles = screen.getAllByRole('checkbox');
    expect(toggles[0]).not.toBeChecked();
  });

  it('canonical datoordensfejl i stamdata blokerer årslønsdokumentet', async () => {
    const user = userEvent.setup();
    hydrateAarsloen({
      loenperiode: 'maaned',
      tableData: [
        { id: 'r1', col0_maaned: '1', col1_maaned: '2024', col2: amount(50000) } as StandardLoenTableRow,
      ],
    }, {
      skadelidteFodselsdato: toISODateString('2020-01-02'),
      skadedato: toISODateString('2020-01-01'),
    });
    renderAarsloen();

    /**
     * Tooltippen er KLASSETEKSTEN, ikke den konkrete kronologibesked.
     *
     * Testen fandt før knappen på `/Fødselsdato|Skadedato/`, fordi gaten citerede stamdata-issuet ordret.
     * Efter lempelsen 2026-08-13 (`error-contract.md` §4) citeres kun præcis ÉN felt-/rækkefejl, og en
     * kronologifejl er en regel over TO felter – et citat ville udpege ét af dem som "fejlen". Felterne
     * bærer selv den fulde besked i deres egne tooltips.
     *
     * Det væsentlige for gaten er uændret: knappen er disabled, og aktivering starter intet dokumentarbejde.
     */
    const downloadButton = screen.getByRole('button', { name: 'Ret fejlen i Stamdata' });
    expect(downloadButton).toBeDisabled();
    await user.click(downloadButton);
    expect(mockTriggerDocumentDownload).not.toHaveBeenCalled();
  });
});

// En placeholder beskriver UDELUKKENDE værdiens form. Årsløns månedstabel viste
// `åååå (≤2026)` – en valideringsgrænse i formvejledningens kanal, som desuden ændrede sig med
// kalenderåret. Formen ejes nu af feltfamilien (`utils/fieldFormatPlaceholders.ts`), og tabellen
// override'er kun, hvor domænets FORMAT reelt er en anden (månedens `mm`).
//
// Testen kører gennem den ÆGTE side og den ægte runtime, fordi det netop var visningslaget, der koblede
// grænsen på: en unittest af feltfamilien ville have været grøn hele tiden.
describe('Årsløn – placeholders viser kun værdiens FORM', () => {
  // Missing-markeringen scroller cellen ind (`scrollTargetIntoView`); jsdom implementerer slet ikke
  // `scrollIntoView` (den kan derfor ikke spy'es – den skal defineres). Vi stubber den, fordi det er
  // scroll-BIVIRKNINGEN vi ikke måler her; markeringen (selve rettelsen) læses fra cellens style nedenfor.
  const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
  beforeAll(() => {
    HTMLElement.prototype.scrollIntoView = function scrollIntoViewStub() { /* jsdom har ingen layout */ };
  });
  afterAll(() => {
    HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
  });

  beforeEach(() => {
    sessionStorage.clear();
  });

  /** Placeholderen på periodekolonnernes input i første datarække. */
  const periodPlaceholders = (): readonly [string, string] => {
    const cells = getDataRowCells(0);
    const from = within(cells[0]).getByRole('textbox') as HTMLInputElement;
    const to = within(cells[1]).getByRole('textbox') as HTMLInputElement;
    return [from.placeholder, to.placeholder];
  };

  it('månedstabellen viser `mm` og `åååå` – uden årstal eller grænsesymboler', () => {
    hydrateAarsloen({ loenperiode: 'maaned', tableData: [] });
    renderAarsloen();

    expect(periodPlaceholders()).toEqual(['mm', 'åååå']);
  });

  it('ugetabellen viser den rene uge-/år-form uden formatvejledning i grænsen', () => {
    // Ugecellerne mistede `uu/åååå` ved greenfield-cutoveren: `GridWeekCell` fik ingen semantisk default,
    // og tabellen udfyldte kun måned og år lokalt. Formen kommer nu fra familien.
    hydrateAarsloen({ loenperiode: 'uge', tableData: [] });
    renderAarsloen();

    expect(periodPlaceholders()).toEqual(['uu/åååå', 'uu/åååå']);
  });

  it('dagstabellen viser `dd-mm-åååå`', () => {
    hydrateAarsloen({ loenperiode: 'dag', tableData: [] });
    renderAarsloen();

    expect(periodPlaceholders()).toEqual(['dd-mm-åååå', 'dd-mm-åååå']);
  });

  it('beløbskolonnerne viser den centrale rene beløbsform sammen med kr.-adornmentet', () => {
    hydrateAarsloen({ loenperiode: 'maaned', tableData: [] });
    renderAarsloen();

    const amountInput = within(getDataRowCells(0)[2]).getByRole('textbox') as HTMLInputElement;
    expect(amountInput.placeholder).toBe('0,00');
    // Enheden er et adornment, ikke en del af placeholderteksten (ét enheds-sted).
    expect(amountInput.placeholder).not.toContain('kr');
    expect(getDataRowCells(0)[2]?.textContent).toContain('kr.');
  });

  it('«Indtastning mangler» overtager IKKE placeholderen; cellen markeres i stedet visuelt', async () => {
    // Brugergodkendt 2026-07-28: manglende-værdi-feedbacken bruger samme visuelle idiom
    // som en fejlflash – cellen scrolles ind og blinker rødt – i stedet for at erstatte formvejledningen.
    // Kæden er den ÆGTE: omregnings-toggle uden gyldig periode → tabellens imperative handle → markering.
    const user = userEvent.setup();
    hydrateAarsloen({ loenperiode: 'maaned', omregningTilFuldtAar: false, tableData: [] });
    renderAarsloen();

    const monthCell = getDataRowCells(0)[0];
    const monthInput = within(monthCell).getByRole('textbox') as HTMLInputElement;
    expect(monthInput.placeholder).toBe('mm');

    // StyledToggleSwitch eksponerer role="checkbox"; første = omregning-toggle.
    await user.click(screen.getAllByRole('checkbox')[0]);

    await waitFor(() => {
      // Markeringen er den DELTE blink-klasse – ikke en ny placeholdertekst og ikke en tabel-lokal
      // animation. Klassen sættes af `blinkFieldAttention` på feltets SYNLIGE flade (MUI-skallen),
      // så opslaget går på cellens undertræ frem for på `<td>` selv.
      expect(monthCell.querySelector(`.${FIELD_ATTENTION_BLINK_CLASS}`)).not.toBeNull();
    });
    expect((within(monthCell).getByRole('textbox') as HTMLInputElement).placeholder).toBe('mm');
    expect(screen.queryByPlaceholderText('Indtastning mangler')).toBeNull();
  });

  it('markerer cellen IGEN ved hvert nyt klik på omregnings-togglen', async () => {
    // Regression: markeringen kom kun ved FØRSTE klik. Tabellen satte blink-klassen deklarativt ud
    // fra `missingCell`-state, så andet klik skrev SAMME værdi, React bailede ud af re-renderen, og
    // brugeren fik intet svar. En «peg på dette felt»-markering er transient og skal komme igen,
    // hver gang den udløses.
    //
    // Testen måler den GENSTARTEDE markering, ikke blot at klassen «er der»: den venter på, at
    // klassen er væk igen efter animationens 1,5 s, og kræver, at næste klik bringer den tilbage.
    // Uden ventetiden ville en klasse, der blot BLEV stående, se ud som en bestået test.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      hydrateAarsloen({ loenperiode: 'maaned', omregningTilFuldtAar: false, tableData: [] });
      renderAarsloen();

      const monthCell = getDataRowCells(0)[0];
      const toggle = screen.getAllByRole('checkbox')[0];
      const isMarked = () => monthCell.querySelector(`.${FIELD_ATTENTION_BLINK_CLASS}`) !== null;

      for (const attempt of [1, 2, 3]) {
        await user.click(toggle);
        await waitFor(() => {
          expect(isMarked(), `klik #${String(attempt)} gav ingen markering`).toBe(true);
        });

        // Lad markeringen løbe helt ud, så næste runde måler en ÆGTE genstart.
        await act(async () => {
          vi.advanceTimersByTime(FIELD_ATTENTION_BLINK_DURATION_MS + 50);
          await Promise.resolve();
        });
        expect(isMarked(), `markeringen blev hængende efter klik #${String(attempt)}`).toBe(false);
      }
    } finally {
      vi.useRealTimers();
    }
  });

  it('INGEN placeholder i tabellen bærer et grænsesymbol eller et årstal', () => {
    // Bredere end de tre konkrete former ovenfor: et NYT grænsebærende placeholder-udtryk et vilkårligt
    // sted i tabellen gør denne rød, uden at nogen skal huske at tilføje en case.
    hydrateAarsloen({ loenperiode: 'maaned', tableData: [] });
    renderAarsloen();

    const placeholders = Array.from(document.querySelectorAll('input'))
      .map((input) => input.placeholder)
      .filter((text) => text !== '');
    expect(placeholders.length).toBeGreaterThan(0);
    for (const text of placeholders) {
      expect(text).not.toMatch(/[≤≥<>]/);
      expect(text).not.toMatch(/\d{4}/);
    }
  });
});
