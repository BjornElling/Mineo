// @vitest-environment jsdom
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
} from '../../../../inputCore/react/productionInputRuntime';
import type { StamdataValues } from '../../../../schemas/formSchemas/sections/stamdataSchemas';
import type { VarigeMenValues } from '../../../../schemas/formSchemas';
import { toISODateString } from '../../../../types/branded';

const mockDownloadVarigeMenDokument = vi.hoisted(() =>
  vi.fn(async () => ({ success: true as const }))
);

vi.mock('../../../../document/service/documentService', async (importOriginal) => ({
  ...await importOriginal<typeof import('../../../../document/service/documentService')>(),
  downloadVarigeMenDokument: mockDownloadVarigeMenDokument,
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
  slimInputStore.getState().hydrate(input);
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

describe('MenberegningTab greenfield — reader-projektion + download-gate', () => {
  beforeEach(() => {
    sessionStorage.clear();
    mockDownloadVarigeMenDokument.mockClear();
  });

  it('et fuldt gyldigt input aktiverer download og når dokumentservicen med frisk stamdata', async () => {
    const user = userEvent.setup();
    hydrate({ mengrad: 10, beregningsdato: toISODateString('2020-01-01') }, validStamdata);
    renderTab();

    const downloadButton = screen.getByTestId('varigemen-download');
    expect(downloadButton).toBeEnabled();

    await user.click(downloadButton);
    expect(mockDownloadVarigeMenDokument).toHaveBeenCalledTimes(1);
    expect(mockDownloadVarigeMenDokument).toHaveBeenCalledWith(
      expect.objectContaining({
        mengrad: 10,
        persistedStamdata: expect.objectContaining({ journalnr: 'J-2026-001' }),
      })
    );
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
    expect(mockDownloadVarigeMenDokument).not.toHaveBeenCalled();
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
    expect(mockDownloadVarigeMenDokument).not.toHaveBeenCalled();
  });
});
