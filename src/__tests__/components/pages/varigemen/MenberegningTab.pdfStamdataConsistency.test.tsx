import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

const { mockDownloadVarigeMenPdf, mockBeregnVarigeMenGodtgoerelseWithRates, mockStamValues } = vi.hoisted(() => ({
  mockDownloadVarigeMenPdf: vi.fn(),
  mockBeregnVarigeMenGodtgoerelseWithRates: vi.fn(),
  mockStamValues: {
    journalnr: 'J-2026-001',
    advokat: 'Test Advokat',
    sagsbehandler: 'Test Sagsbehandler',
    skadestype: 'Arbejdsulykke',
    skadedato: '2025-01-01',
    skadelidteFodselsdato: '1980-01-01',
  },
}));

vi.mock('../../../../pdf/infrastructure/pdfService', () => ({
  downloadVarigeMenPdf: mockDownloadVarigeMenPdf,
}));

vi.mock('../../../../domain/varigemen/varigeMenCalculations', () => ({
  beregnVarigeMenGodtgoerelseWithRates: mockBeregnVarigeMenGodtgoerelseWithRates,
}));

vi.mock('../../../../contexts/useAppSettings', () => ({
  useAppSettings: () => ({
    settings: {},
  }),
}));

import MenberegningTab from '../../../../components/pages/varigemen/MenberegningTab';

const setFieldValue = vi.fn();

describe('MenberegningTab', () => {
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
        <MenberegningTab
          values={{ mengrad: 10, beregningsdato: '2026-01-01' }}
          setValues={vi.fn()}
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
  });
});
