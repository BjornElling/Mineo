import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { CommitHandler } from '../../../../types/fieldEvents';
import type { VarigeMenValues } from '../../../../schemas/formSchemas';

const { mockDownloadVarigeMenPdf, mockBeregnVarigeMenGodtgoerelseWithRates, mockStamValues, mockFaellesPersondataValues } = vi.hoisted(() => ({
  mockDownloadVarigeMenPdf: vi.fn(),
  mockBeregnVarigeMenGodtgoerelseWithRates: vi.fn(),
  mockStamValues: {
    skadestype: 'Arbejdsulykke',
    skadesdato: '2025-01-01',
  },
  mockFaellesPersondataValues: {
    skadelidteFodselsdato: '1980-01-01',
  },
}));

vi.mock('../../../../pdf/infrastructure/pdfService', () => ({
  downloadVarigeMenPdf: mockDownloadVarigeMenPdf,
}));

vi.mock('../../../../domain/varigemen/varigeMenCalculations', () => ({
  beregnVarigeMenGodtgoerelseWithRates: mockBeregnVarigeMenGodtgoerelseWithRates,
}));

vi.mock('../../../../hooks/usePersistedForm', () => ({
  usePersistedForm: (_schema: unknown, pageKey: string) => {
    if (pageKey === 'faellesPersondata') {
      return {
        values: mockFaellesPersondataValues,
        handleChange: vi.fn(),
      };
    }
    return {
      values: mockStamValues,
      handleChange: vi.fn(),
    };
  },
}));

vi.mock('../../../../contexts/useAppSettings', () => ({
  useAppSettings: () => ({
    settings: {},
  }),
}));

import MenberegningTab from '../../../../components/pages/varigemen/MenberegningTab';

const handleChange: <K extends keyof VarigeMenValues>(key: K) => CommitHandler<VarigeMenValues[K]> = () => vi.fn();

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
          handleChange={handleChange}
        />
      </MemoryRouter>
    );

    await user.click(screen.getByTestId('DownloadIcon'));

    expect(mockDownloadVarigeMenPdf).toHaveBeenCalledTimes(1);
    expect(mockDownloadVarigeMenPdf).toHaveBeenCalledWith(
      expect.objectContaining({
        persistedStamdata: mockStamValues,
      })
    );
  });
});
