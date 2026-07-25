// @vitest-environment jsdom
//
// Greenfield Forsørgertab-slice (§2.4 formularrækkefølge trin 6 / Fase 3): hele siden kører nu på den ENE
// greenfield input-runtime (ingen legacy FormPersistence/invalidDrafts/props). Denne integrationstest kører gennem
// den RIGTIGE migrerede side + den ægte produktions-runtime og beviser stien felt → settle → reader-projektion →
// download-gate (§1.5/§1.6/§3.9): et fuldt gyldigt input aktiverer download og når dokumentservicen med et frisk
// stamdata-snapshot; en canonical tilkendt-periode uden for 1..10 blokerer med en synlig rød feltfejl; en byttet
// stamdata-datoorden blokerer.
import { render, screen, waitFor } from '@testing-library/react';
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
} from '../../../inputCore/react/productionInputRuntime';
import type { StamdataValues } from '../../../schemas/formSchemas/sections/stamdataSchemas';
import type { FaellesAarsloenValues, ForsoergertabValues } from '../../../schemas/formSchemas';
import { toISODateString } from '../../../types/branded';

const mockDownloadForsoergertabDokument = vi.hoisted(() =>
  vi.fn(async () => ({ success: true as const }))
);

vi.mock('../../../document/service/documentService', async (importOriginal) => ({
  ...await importOriginal<typeof import('../../../document/service/documentService')>(),
  downloadForsoergertabDokument: mockDownloadForsoergertabDokument,
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
  slimInputStore.getState().hydrate(input);
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

describe('Forsoergertab greenfield — reader-projektion + download-gate', () => {
  beforeEach(() => {
    sessionStorage.clear();
    mockDownloadForsoergertabDokument.mockClear();
  });

  it('et fuldt gyldigt input aktiverer download og når dokumentservicen med frisk stamdata', async () => {
    const user = userEvent.setup();
    hydrate(validForsoergertab, validFaellesAarsloen, validStamdata);
    renderPage();

    const downloadButton = screen.getByTestId('forsoergertab-download');
    await waitFor(() => expect(downloadButton).toBeEnabled());

    await user.click(downloadButton);
    await waitFor(() => expect(mockDownloadForsoergertabDokument).toHaveBeenCalledTimes(1));
    expect(mockDownloadForsoergertabDokument).toHaveBeenCalledWith(
      expect.objectContaining({
        persistedStamdata: expect.objectContaining({ journalnr: 'J-2026-002' }),
        isSourceCurrent: expect.any(Function),
      })
    );
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
    // Værdien er committet canonical (kan gemmes i .eo) — den blev IKKE afvist af feltet.
    expect(slimInputStore.getState().input.sections.forsoergertab).toMatchObject({ tilkendtForPeriodeAar: 11 });

    const downloadButton = screen.getByTestId('forsoergertab-download');
    await waitFor(() => expect(downloadButton).toBeDisabled());
    await user.click(downloadButton);
    expect(mockDownloadForsoergertabDokument).not.toHaveBeenCalled();
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
});
