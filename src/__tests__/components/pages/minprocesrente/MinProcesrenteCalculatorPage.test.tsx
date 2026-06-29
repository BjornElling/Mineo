// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const { mockDownloadStandaloneRentePdf } = vi.hoisted(() => ({
  mockDownloadStandaloneRentePdf: vi.fn(),
}));

vi.mock('../../../../pdf/infrastructure/standaloneRentePdfService', () => ({
  downloadStandaloneRentePdf: mockDownloadStandaloneRentePdf,
}));

vi.mock('../../../../hooks/usePersistedForm', async () => {
  const React = await import('react');
  return {
    usePersistedForm: () => {
      const [values, setValues] = React.useState({
        beregningsdato: toISODateString('2024-01-31'),
        kommentarer: undefined as string | undefined,
        rentekravRows: [{ id: 'r1', belob: undefined, renterFra: undefined, tillaegstid: undefined, enhed: 'dage' }],
      });
      const setFieldValue = <K extends keyof typeof values>(fieldName: K, value: (typeof values)[K]) => {
        setValues((prev) => ({ ...prev, [fieldName]: value }));
      };
      return { values, setValues, setFieldValue, formVersion: 0 };
    },
  };
});

vi.mock('../../../../components/tables/useRentekravRows', () => ({
  __esModule: true,
  default: () => ({
    draftRows: [{ id: 'r1', belob: '', renterFra: '', tillaegstid: '', enhed: 'dage' }],
    onFieldChange: vi.fn(),
    onRowBlur: vi.fn(),
    reorderRows: vi.fn(),
    committedById: new Map(),
  }),
}));

vi.mock('../../../../components/pages/renteberegning/RenteberegningTab', () => ({
  __esModule: true,
  default: (props: {
    onKommentarerCommit: (event: { target: { value: string } }) => void;
    onDownloadSpecifikation: (ctx: {
      beloeb: number;
      actualInterestDate: string;
      beregningsdato: string;
      periods: readonly [];
      latestReferenceRateDate?: string;
    }) => Promise<void>;
  }) => (
    <div>
      <div>MOCK_BEREGNINGSTAB</div>
      <button
        onClick={() => {
          props.onKommentarerCommit({ target: { value: '  Standalone kommentar  ' } });
        }}
      >
        Commit kommentar
      </button>
      <button
        onClick={() => {
          void props.onDownloadSpecifikation({
            beloeb: 1000,
            actualInterestDate: toISODateString('2024-01-01'),
            beregningsdato: toISODateString('2024-01-31'),
            periods: [],
            latestReferenceRateDate: toISODateString('2024-01-01'),
          });
        }}
      >
        Download
      </button>
    </div>
  ),
}));

import MinProcesrenteCalculatorPage from '../../../../components/pages/minprocesrente/MinProcesrenteCalculatorPage';
import { toISODateString } from '../../../../types/branded';

describe('MinProcesrenteCalculatorPage', () => {
  beforeEach(() => {
    mockDownloadStandaloneRentePdf.mockReset();
  });

  it('viser kun procesrente-beregneren uden rentesatser-tab', () => {
    render(<MinProcesrenteCalculatorPage />);

    expect(screen.getByRole('heading', { name: 'minProcesrente.dk' })).toBeInTheDocument();
    expect(screen.getByText('MOCK_BEREGNINGSTAB')).toBeInTheDocument();
    expect(screen.queryByText('Rentesatser')).not.toBeInTheDocument();
  });

  it('viser søskendeside-footeren med minProcesrente som aktiv side', () => {
    render(<MinProcesrenteCalculatorPage />);

    expect(screen.getByRole('link', { name: 'Kontakt bel@fho.dk' })).toHaveAttribute('href', 'mailto:bel@fho.dk');
    expect(screen.getByRole('navigation', { name: 'Søskendesider' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'minEO.dk' })).toHaveAttribute('href', 'https://mineo.dk');
    expect(screen.getAllByText('minProcesrente.dk').some((element) => element.closest('[aria-current="page"]'))).toBe(true);
  });

  it('bruger standalone PDF-adapteren uden Mineo-sagskontekst', async () => {
    mockDownloadStandaloneRentePdf.mockResolvedValue({ success: true });
    const user = userEvent.setup();

    render(<MinProcesrenteCalculatorPage />);

    await user.click(screen.getByRole('button', { name: 'Commit kommentar' }));
    await user.click(screen.getByRole('button', { name: 'Download' }));

    expect(mockDownloadStandaloneRentePdf).toHaveBeenCalledWith(
      expect.objectContaining({
        beloeb: 1000,
        actualInterestDate: '01-01-2024',
        beregningsdato: '31-01-2024',
        latestReferenceRateDate: '01-01-2024',
        kommentarer: 'Standalone kommentar',
      })
    );
  });
});
