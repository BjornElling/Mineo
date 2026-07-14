// @vitest-environment jsdom
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { FormPersistenceProvider, initializePersistenceRuntime } from '../../../../contexts/FormPersistenceContext';
import { formPersistenceStore } from '../../../../stores/formPersistenceStore';
import type { ISODateString } from '../../../../types/branded';

const { mockDownloadVarigeMenPdf, mockBeregnVarigeMenGodtgoerelseWithRates, mockStamValues } = vi.hoisted(() => ({
  mockDownloadVarigeMenPdf: vi.fn(),
  mockBeregnVarigeMenGodtgoerelseWithRates: vi.fn(),
  mockStamValues: {
    journalnr: 'J-2026-001',
    advokat: 'Test Advokat',
    sagsbehandler: 'Test Sagsbehandler',
    skadestype: 'Arbejdsulykke' as const,
    skadedato: '2025-01-01' as ISODateString,
    skadelidteFodselsdato: '1980-01-01' as ISODateString,
  },
}));

vi.mock('../../../../document/service/documentService', () => ({
  downloadVarigeMenDokument: mockDownloadVarigeMenPdf,
}));

vi.mock('../../../../domain/varigemen/varigeMenCalculations', () => ({
  beregnVarigeMenGodtgoerelseWithRates: mockBeregnVarigeMenGodtgoerelseWithRates,
  resolveMenSatsForBeregningsdato: () => undefined,
}));

vi.mock('../../../../contexts/useAppSettings', () => ({
  useAppSettings: () => ({
    settings: {},
  }),
}));

import MenberegningTab from '../../../../components/pages/varigemen/MenberegningTab';
import { toISODateString } from '../../../../types/branded';

const setFieldValue = vi.fn();

describe('MenberegningTab', () => {
  const ASYNC_TEST_TIMEOUT_MS = 15_000;

  beforeEach(() => {
    mockDownloadVarigeMenPdf.mockReset();
    mockBeregnVarigeMenGodtgoerelseWithRates.mockReset();
    mockBeregnVarigeMenGodtgoerelseWithRates.mockReturnValue({
      satsPerMengrad: 1000,
      grundbeloebUdenReduktion: 10000,
      aldersreduktionPct: 0,
      beregnetGodtgoerelse: 10000,
    });
  });

  it('bruger aktuelle stamdata i persistedStamdata ved PDF-download', async () => {
    mockDownloadVarigeMenPdf.mockResolvedValue({ success: true });
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <FormPersistenceProvider runtime={initializePersistenceRuntime()}>
          <MenberegningTab
            values={{ mengrad: 10, beregningsdato: toISODateString('2026-01-01') }}
            setFieldValue={setFieldValue}
            stamdata={{
              journalnr: mockStamValues.journalnr,
              advokat: mockStamValues.advokat,
              sagsbehandler: mockStamValues.sagsbehandler,
              skadelidteFodselsdato: mockStamValues.skadelidteFodselsdato,
              skadedato: mockStamValues.skadedato,
              skadestype: mockStamValues.skadestype,
            }}
          />
        </FormPersistenceProvider>
      </MemoryRouter>
    );

    await user.click(screen.getByTestId('varigemen-download'));

    expect(mockDownloadVarigeMenPdf).toHaveBeenCalledTimes(1);
    expect(mockDownloadVarigeMenPdf).toHaveBeenCalledWith(
      expect.objectContaining({
        persistedStamdata: {
          journalnr: mockStamValues.journalnr,
          advokat: mockStamValues.advokat,
          sagsbehandler: mockStamValues.sagsbehandler,
          skadelidteFodselsdato: mockStamValues.skadelidteFodselsdato,
          skadedato: mockStamValues.skadedato,
          skadestype: mockStamValues.skadestype,
        },
      })
    );
  }, ASYNC_TEST_TIMEOUT_MS);

  it('renderer stamdata- og resultatrækker som hover-rækker', () => {
    render(
      <MemoryRouter>
        <FormPersistenceProvider runtime={initializePersistenceRuntime()}>
          <MenberegningTab
            values={{ mengrad: 10, beregningsdato: toISODateString('2026-01-01') }}
            setFieldValue={setFieldValue}
            stamdata={{
              journalnr: mockStamValues.journalnr,
              advokat: mockStamValues.advokat,
              sagsbehandler: mockStamValues.sagsbehandler,
              skadelidteFodselsdato: mockStamValues.skadelidteFodselsdato,
              skadedato: mockStamValues.skadedato,
              skadestype: mockStamValues.skadestype,
            }}
          />
        </FormPersistenceProvider>
      </MemoryRouter>
    );

    expect(screen.getByText('Fødselsdato').closest('.row--label-right-hover')).not.toBeNull();
    expect(screen.getByText('Alder på skadestidspunkt').closest('.row--label-right-hover')).not.toBeNull();
    const resultRows = screen.getAllByText('Beregnet méngodtgørelse');
    expect(resultRows[1]?.closest('.row--label-right-hover')).not.toBeNull();
  });

  it('en ugyldig méngrad-draft (rød ring) blokerer download — også når den committede værdi er gyldig', async () => {
    // Regression for det arkitektoniske hul: en ikke-committbar ugyldig indtastning (invalid draft)
    // skal blokere download præcis som en committet ugyldig værdi. Her er den committede mengrad
    // gyldig (10) — download-knappen vises. Når méngrad-feltet får en invalid draft (fx efter at
    // brugeren har tastet 0, jf. StyledPercentField's afvisning af værdier under minValue), skal den
    // centralt syntetiserede blokerende feltfejl fjerne beregningsresultatet og dermed download-knappen.
    const runtime = initializePersistenceRuntime();
    render(
      <MemoryRouter>
        <FormPersistenceProvider runtime={runtime}>
          <MenberegningTab
            values={{ mengrad: 10, beregningsdato: toISODateString('2026-01-01') }}
            setFieldValue={setFieldValue}
            stamdata={{
              journalnr: mockStamValues.journalnr,
              advokat: mockStamValues.advokat,
              sagsbehandler: mockStamValues.sagsbehandler,
              skadelidteFodselsdato: mockStamValues.skadelidteFodselsdato,
              skadedato: mockStamValues.skadedato,
              skadestype: mockStamValues.skadestype,
            }}
          />
        </FormPersistenceProvider>
      </MemoryRouter>
    );

    // Gyldig committet værdi → download-knappen er til stede og aktiv.
    expect(screen.getByTestId('varigemen-download')).toBeInTheDocument();
    expect(screen.getByTestId('varigemen-download')).toBeEnabled();

    // Feltet får en ikke-committbar rå draft (det StyledPercentField skriver, når 0 afvises).
    act(() => {
      formPersistenceStore.getState().setInvalidDraft('varigemen', 'mengrad', '0');
    });

    // Download er nu blokeret: den syntetiske invalid-draft-feltfejl gater beregningsresultatet.
    // Download-ikonet forbliver synligt (dets tekstlinje vises stadig) men bliver nedtonet/inaktivt
    // — præcis som ved en committet ugyldig værdi.
    await waitFor(() => {
      expect(screen.getByTestId('varigemen-download')).toBeDisabled();
    });
  }, ASYNC_TEST_TIMEOUT_MS);
});
