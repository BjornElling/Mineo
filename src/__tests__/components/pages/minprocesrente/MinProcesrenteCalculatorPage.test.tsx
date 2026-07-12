// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
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
    isMobile?: boolean;
  }) => (
    <div>
      <div>MOCK_BEREGNINGSTAB</div>
      <output data-testid="is-mobile">{String(props.isMobile)}</output>
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
import { CriticalActionProvider } from '../../../../criticalActions/CriticalActionContext';

const renderPage = () => render(
  <CriticalActionProvider>
    <MinProcesrenteCalculatorPage />
  </CriticalActionProvider>,
);

const createMediaQueryList = (matches: boolean, media = ''): MediaQueryList => ({
  matches,
  media,
  onchange: null,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  addListener: vi.fn(),
  removeListener: vi.fn(),
  dispatchEvent: vi.fn(),
});

const configureDevice = ({
  maxTouchPoints = 0,
  screenWidth = 1024,
  screenHeight = 768,
  viewportWidth = 1024,
  viewportHeight = 768,
  coarsePointer = false,
}: {
  maxTouchPoints?: number;
  screenWidth?: number;
  screenHeight?: number;
  viewportWidth?: number;
  viewportHeight?: number;
  coarsePointer?: boolean;
} = {}): void => {
  Object.defineProperty(navigator, 'maxTouchPoints', {
    configurable: true,
    value: maxTouchPoints,
  });
  Object.defineProperty(window.screen, 'width', {
    configurable: true,
    value: screenWidth,
  });
  Object.defineProperty(window.screen, 'height', {
    configurable: true,
    value: screenHeight,
  });
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    value: viewportWidth,
  });
  Object.defineProperty(window, 'innerHeight', {
    configurable: true,
    value: viewportHeight,
  });
  window.matchMedia = vi.fn((query: string) => {
    const maxWidth = /\(max-width:\s*([\d.]+)px\)/.exec(query);
    const matches =
      query === '(pointer: coarse)'
        ? coarsePointer
        : query === '(hover: none)'
          ? coarsePointer
          : maxWidth
            ? viewportWidth <= Number(maxWidth[1])
            : false;
    return createMediaQueryList(matches, query);
  });
};

describe('MinProcesrenteCalculatorPage', () => {
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    mockDownloadStandaloneRentePdf.mockReset();
    configureDevice();
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it('viser kun procesrente-beregneren uden rentesatser-tab', () => {
    renderPage();

    expect(screen.getByRole('heading', { name: 'minProcesrente.dk' })).toBeInTheDocument();
    expect(screen.getByText('MOCK_BEREGNINGSTAB')).toBeInTheDocument();
    expect(screen.queryByText('Rentesatser')).not.toBeInTheDocument();
  });

  it('viser søskendeside-footeren med minProcesrente som aktiv side', () => {
    renderPage();

    expect(screen.getByRole('link', { name: 'Kontakt bel@fho.dk' })).toHaveAttribute('href', 'mailto:bel@fho.dk');
    expect(screen.getByRole('navigation', { name: 'Søskendesider' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'minEO.dk' })).toHaveAttribute('href', 'https://mineo.dk');
    expect(screen.getAllByText('minProcesrente.dk').some((element) => element.closest('[aria-current="page"]'))).toBe(true);
  });

  it('fastholder mobil-layout på telefon i landskab', () => {
    configureDevice({
      maxTouchPoints: 5,
      screenWidth: 844,
      screenHeight: 390,
      viewportWidth: 844,
      viewportHeight: 390,
      coarsePointer: true,
    });

    renderPage();

    expect(screen.getByTestId('is-mobile')).toHaveTextContent('true');
  });

  it('fastholder mobil-layout når screen API returnerer fysiske device-pixels', () => {
    configureDevice({
      maxTouchPoints: 5,
      screenWidth: 2556,
      screenHeight: 1179,
      viewportWidth: 844,
      viewportHeight: 390,
      coarsePointer: true,
    });

    renderPage();

    expect(screen.getByTestId('is-mobile')).toHaveTextContent('true');
  });

  it('bruger standalone PDF-adapteren uden Mineo-sagskontekst', async () => {
    mockDownloadStandaloneRentePdf.mockResolvedValue({ success: true });
    const user = userEvent.setup();

    renderPage();

    await user.click(screen.getByRole('button', { name: 'Commit kommentar' }));
    await user.click(screen.getByRole('button', { name: 'Download' }));

    // PDF-tjenesten lazy-loades (dynamisk import) inde i download-handleren, så kaldet
    // sker et async-tick efter klikket — vent på det frem for at antage synkront kald.
    await waitFor(() =>
      expect(mockDownloadStandaloneRentePdf).toHaveBeenCalledWith(
        expect.objectContaining({
          beloeb: 1000,
          actualInterestDate: '01-01-2024',
          beregningsdato: '31-01-2024',
          latestReferenceRateDate: '01-01-2024',
          kommentarer: 'Standalone kommentar',
        })
      )
    );
  });
});
