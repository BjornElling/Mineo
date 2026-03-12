import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { CommitHandler } from '../../../../components/inputs/fieldEvents';
import type { VarigeMenValues } from '../../../../schemas/formSchemas';

const { mockDownloadVarigeMenPdf, mockBeregnVarigeMenGodtgoerelseWithRates, mockStamValues } = vi.hoisted(() => ({
  mockDownloadVarigeMenPdf: vi.fn(),
  mockBeregnVarigeMenGodtgoerelseWithRates: vi.fn(),
  mockStamValues: {
    fodselsdato: '1980-01-01',
    skadestype: 'Arbejdsulykke',
    skadesdato: '2025-01-01',
  },
}));

vi.mock('../../../../utils/pdf/pdfService', () => ({
  downloadVarigeMenPdf: mockDownloadVarigeMenPdf,
}));

vi.mock('../../../../domain/varigemen/varigeMenCalculations', () => ({
  beregnVarigeMenGodtgoerelseWithRates: mockBeregnVarigeMenGodtgoerelseWithRates,
}));

vi.mock('../../../../hooks/usePersistedForm', () => ({
  usePersistedForm: () => ({
    values: mockStamValues,
    handleChange: vi.fn(),
  }),
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
