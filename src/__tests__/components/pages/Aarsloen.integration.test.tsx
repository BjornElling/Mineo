// @vitest-environment jsdom
//
// Greenfield Årsløn-slice (§2.4 trin 3 / §2.5, Pass 2). Integrationstest gennem den RIGTIGE migrerede side + den
// ægte produktions-runtime (`ProductionInputRuntimeProvider` mod `slimInputStore`). Beviser den virkelige sti:
// hydreret sag → reader-projektion → StandardLoenTable over grid-adapteren (afledte kolonner, valideringssummary,
// række-infrastruktur) + beregningsprincip-blok, uden legacy `usePersistedForm`/`invalidDrafts`.
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Aarsloen from '../../../components/pages/Aarsloen';
import { AppSettingsProvider } from '../../../contexts/AppSettingsContext';
import { RoutePathnameProvider } from '../../../contexts/RoutePathnameProvider';
import { slimInputStore } from '../../../inputCore/runtime/slimInputStore';
import { getProductionInputCatalog } from '../../../inputCore/catalog/productionCatalog';
import {
  ProductionInputRuntimeProvider,
  createProductionInputRuntimeBinding,
} from '../../../inputCore/react/productionInputRuntime';
import type { StandardLoenTableRow } from '../../../schemas/formSchemas';
import type { StamdataValues } from '../../../schemas/formSchemas/sections/stamdataSchemas';
import { toISODateString } from '../../../types/branded';

/**
 * Fase 5: testen måler på livscyklussens IRREVERSIBLE handling (`triggerDocumentDownload`) frem for
 * på et servicekald — en strammere assertion, fordi den kræver at HELE kæden faktisk kørte.
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
  slimInputStore.getState().hydrate(input);
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

describe('Årsløn (greenfield) — migreret side + løntabel over grid-adapteren', () => {
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
    // Månedstabellens kolonneoverskrifter (default loenperiode = 'maaned') — scoped til tabellens header,
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

    const downloadButton = screen.getByRole('button', { name: /Fødselsdato|Skadedato/ });
    expect(downloadButton).toBeDisabled();
    await user.click(downloadButton);
    expect(mockTriggerDocumentDownload).not.toHaveBeenCalled();
  });
});
