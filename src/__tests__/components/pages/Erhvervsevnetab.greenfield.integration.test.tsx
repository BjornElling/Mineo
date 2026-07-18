// @vitest-environment jsdom
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

const mocks = vi.hoisted(() => ({
  loebende: vi.fn(async () => ({ success: true as const })),
  kapitalisering: vi.fn(async () => ({ success: true as const })),
  efterEal: vi.fn(async () => ({ success: true as const })),
  differencekrav: vi.fn(async () => ({ success: true as const })),
}));

vi.mock('../../../document/service/documentService', async (importOriginal) => ({
  ...await importOriginal<typeof import('../../../document/service/documentService')>(),
  downloadLoebendeYdelserDokument: mocks.loebende,
  downloadKapitaliseringDokument: mocks.kapitalisering,
  downloadEfterEalDokument: mocks.efterEal,
  downloadDifferencekravDokument: mocks.differencekrav,
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
  slimInputStore.getState().hydrate(catalog.validateSettledInput({
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

describe('Erhvervsevnetab greenfield — samlet surface og reader-projektion', () => {
  beforeEach(() => {
    sessionStorage.clear();
    Object.values(mocks).forEach((mock) => mock.mockClear());
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

  it('settler friskt og sender tokenkontrol samt stamdata til løbende-ydelser-dokumentet', async () => {
    hydrate(validEet, validAarsloen, validStamdata);
    renderPage();
    const user = userEvent.setup();
    await user.click(screen.getByRole('tab', { name: 'Løbende ydelser' }));
    const download = await screen.findByRole('button', { name: /Download som/ });
    expect(download).toBeEnabled();
    await user.click(download);
    await waitFor(() => expect(mocks.loebende).toHaveBeenCalledTimes(1));
    expect(mocks.loebende).toHaveBeenCalledWith(expect.objectContaining({
      persistedStamdata: expect.objectContaining({ journalnr: 'J-2026-003' }),
      isSourceCurrent: expect.any(Function),
    }));
  });
});
