// @vitest-environment jsdom
import { __hydrateSlimInputStoreForTest } from '../../../inputCore/runtime/slimInputStore';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Erhvervsevnetab from '../../../components/pages/Erhvervsevnetab';
import { AppSettingsProvider } from '../../../contexts/AppSettingsContext';
import { RoutePathnameProvider } from '../../../contexts/RoutePathnameProvider';
import { slimInputStore } from '../../../inputCore/runtime/slimInputStore';
import { getProductionInputCatalog } from '../../../inputCore/catalog/productionCatalog';
import {
  ProductionInputRuntimeProvider,
  createProductionInputRuntimeBinding,
} from '../../../inputCore/react/productionInputRuntime';
import { ERHVERVSEVNETAB_INITIAL_VALUES } from '../../../domain/erhvervsevnetab/erhvervsevnetabInitialValues';
import type { ErhvervsevnetabValues, FaellesAarsloenValues, StamdataValues } from '../../../schemas/formSchemas';
import { toISODateString } from '../../../types/branded';

/**
 * Fase 5: testen måler på livscyklussens IRREVERSIBLE handling (`triggerDocumentDownload`) frem for
 * på fire servicekald — en strammere assertion, fordi den kræver at HELE kæden faktisk kørte. Alle
 * fire EET-outputs går gennem samme handling.
 */
const mockTriggerDocumentDownload = vi.hoisted(() => vi.fn());

vi.mock('../../../document/downloadArtifact', async (importOriginal) => ({
  ...await importOriginal<typeof import('../../../document/downloadArtifact')>(),
  triggerDocumentDownload: mockTriggerDocumentDownload,
}));

const catalog = getProductionInputCatalog();
const amount = (value: number) => ({ kind: 'number' as const, value });

const validEet: ErhvervsevnetabValues = {
  ...ERHVERVSEVNETAB_INITIAL_VALUES,
  beregningsdato: toISODateString('2026-03-19'),
  koen: 'Kvinde',
  ealEetPct: 25,
  aslAfgoerelser: [{
    id: 'eet_asl_row1',
    afgoerelsesDato: toISODateString('2026-02-01'),
    virkningsDato: toISODateString('2026-02-01'),
    eetPct: 25,
    kapDato: undefined,
    kapPct: undefined,
    afgoerelseType: 'Midlertidig',
    tidlKapDato: undefined,
    fsTilbageholdtEet: 'Nej',
  }],
};
const validAarsloen: FaellesAarsloenValues = { aslAarsloen: amount(600000), ealAarsloen: amount(600000) };
const validStamdata: StamdataValues = {
  journalnr: 'J-2026-003', advokat: 'A', sagsbehandler: 'S', skadelidte: 'Test',
  skadestype: 'Arbejdsulykke', skadedato: toISODateString('2024-07-01'),
  skadelidteFodselsdato: toISODateString('1980-01-01'),
};

const hydrate = (
  erhvervsevnetab: ErhvervsevnetabValues | null,
  faellesAarsloen: FaellesAarsloenValues | null = null,
  stamdata: StamdataValues | null = null,
): void => {
  __hydrateSlimInputStoreForTest(slimInputStore, catalog.validateSettledInput({
    sections: {
      stamdata, satser: null, aarsloen: null, faellesAarsloen, renteberegning: null,
      varigemen: null, forsoergertab: null, erstatningsopgoerelse: null, erhvervsevnetab,
    },
    rejectedInputs: {},
  }));
};

const renderPage = () => render(
  <MemoryRouter initialEntries={['/erhvervsevnetab']}>
    <AppSettingsProvider>
      <RoutePathnameProvider>
        <ProductionInputRuntimeProvider binding={createProductionInputRuntimeBinding()}>
          <Erhvervsevnetab />
        </ProductionInputRuntimeProvider>
      </RoutePathnameProvider>
    </AppSettingsProvider>
  </MemoryRouter>
);

describe('Erhvervsevnetab — samlet surface og reader-projektion', () => {
  beforeEach(() => {
    sessionStorage.clear();
    mockTriggerDocumentDownload.mockClear();
  });

  it('renderer en fresh sag med schema-defaults og to synlige ASL-placeholder-rækker', () => {
    hydrate(null);
    renderPage();
    expect(screen.getByText('Grundlæggende oplysninger')).toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(3); // header + to placeholders
  });

  it('promoverer første placeholder atomisk ved et fejlende settle og sletter rækken med rejected input', async () => {
    hydrate(null);
    renderPage();
    const firstCell = within(screen.getAllByRole('row')[1]!).getAllByRole('cell')[0]!;
    const input = within(firstCell).getByRole('textbox') as HTMLInputElement;
    const user = userEvent.setup();
    await user.click(input);
    await user.click(input);
    await user.keyboard('1');
    expect(input.value).toBe('1');
    await user.tab();

    await waitFor(() => {
      expect(slimInputStore.getState().input.sections.erhvervsevnetab?.aslAfgoerelser ?? []).toHaveLength(1);
      expect(Object.keys(slimInputStore.getState().input.rejectedInputs)).toHaveLength(1);
    });
    await userEvent.setup().click(screen.getByRole('button', { name: 'Slet rækken' }));
    await waitFor(() => {
      expect(slimInputStore.getState().input.sections.erhvervsevnetab?.aslAfgoerelser ?? []).toHaveLength(0);
      expect(slimInputStore.getState().input.rejectedInputs).toEqual({});
    });
  });

  it('canonicaliserer 0 i EAL-EET-procent til feltets etablerede tomværdi', async () => {
    hydrate(validEet, validAarsloen, validStamdata);
    renderPage();
    const input = document.querySelector('input[name="ealEetPct"]') as HTMLInputElement;
    const user = userEvent.setup();
    await user.click(input);
    await user.keyboard('{Control>}a{/Control}0');
    await user.tab();
    await waitFor(() => expect(slimInputStore.getState().input.sections.erhvervsevnetab?.ealEetPct).toBeUndefined());
  });

  it('viser canonical ASL-årslønsregel som rød feltfejl og blokerer de afhængige faner', async () => {
    hydrate(validEet, { ...validAarsloen, aslAarsloen: amount(600500) }, validStamdata);
    renderPage();
    const input = document.querySelector('input[name="aslAarsloen"]') as HTMLInputElement;
    expect(input).toHaveAttribute('aria-invalid', 'true');
    await userEvent.setup().click(screen.getByRole('tab', { name: 'Løbende ydelser' }));
    expect(screen.getByText(/Årsløn skal være deleligt/)).toBeInTheDocument();
  });

  it('settler friskt og leverer løbende-ydelser-dokumentet med frisk stamdata', async () => {
    hydrate(validEet, validAarsloen, validStamdata);
    renderPage();
    const user = userEvent.setup();
    await user.click(screen.getByRole('tab', { name: 'Løbende ydelser' }));
    const download = await screen.findByRole('button', { name: /Download som/ });
    expect(download).toBeEnabled();
    await user.click(download);
    await waitFor(() => expect(mockTriggerDocumentDownload).toHaveBeenCalledTimes(1));
    // Journalnummeret kommer fra stamdata og indgår i filnavnet — beviser at den friske
    // stamdata-dependency nåede hele vejen ind i det leverede dokument.
    const artifact = mockTriggerDocumentDownload.mock.calls[0]?.[0] as { filename: string };
    expect(artifact.filename).toContain('J-2026-003');
  });
});
