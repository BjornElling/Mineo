import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const { mockDownloadRentePdf } = vi.hoisted(() => ({
  mockDownloadRentePdf: vi.fn(),
}));

vi.mock('../../../utils/pdf/pdfService', () => ({
  downloadRentePdf: mockDownloadRentePdf,
}));

vi.mock('../../../hooks/usePersistedActiveTab', () => ({
  usePersistedActiveTab: () => ({
    activeTab: 'calculation',
    setActiveTab: vi.fn(),
    isAllowedTab: () => true,
  }),
}));

vi.mock('../../../hooks/usePersistedForm', async () => {
  const React = await import('react');
  return {
    usePersistedForm: () => {
      const [values, setValues] = React.useState({
        beregningsdato: undefined,
        kommentarer: undefined as string | undefined,
        rentekravRows: [],
      });
      return { values, setValues, formVersion: 0 };
    },
  };
});

vi.mock('../../../components/tables/useRentekravRows', () => ({
  __esModule: true,
  default: () => ({
    draftRows: [],
    onFieldChange: vi.fn(),
    onFieldBlur: vi.fn(),
    committedById: new Map(),
  }),
}));

vi.mock('../../../contexts/useFormPersistence', () => ({
  useFormPersistence: () => ({
    getPersistedData: () => ({ journalnr: 'J-1' }),
  }),
}));

vi.mock('../../../contexts/useAppSettings', () => ({
  useAppSettings: () => ({
    settings: { brevhovedIndstillinger: { renteberegning: false } },
  }),
}));

vi.mock('../../../components/pages/renteberegning/RenteberegningTab', () => ({
  __esModule: true,
  default: (props: {
    onKommentarerCommit: (event: { target: { value: string } }) => void;
    onDownloadSpecifikation: (ctx: {
      beloeb: number;
      actualInterestDate: string;
      beregningsdato: string;
    }) => Promise<void>;
  }) => (
    <div>
      <button
        onClick={() => {
          props.onKommentarerCommit({ target: { value: '  Min kommentar  ' } });
        }}
      >
        Commit kommentar
      </button>
      <button
        onClick={() => {
          props.onKommentarerCommit({ target: { value: '   ' } });
        }}
      >
        Commit tom kommentar
      </button>
      <button
        onClick={() => {
          void props.onDownloadSpecifikation({
            beloeb: 1000,
            actualInterestDate: '2024-01-01',
            beregningsdato: '2024-01-31',
          });
        }}
      >
        Download
      </button>
    </div>
  ),
}));

import Renteberegning from '../../../components/pages/Renteberegning';

describe('Renteberegning PDF-download', () => {
  beforeEach(() => {
    mockDownloadRentePdf.mockReset();
  });

  it('medsender normaliserede kommentarer i PDF-kaldet', async () => {
    mockDownloadRentePdf.mockResolvedValue({ success: true });
    const user = userEvent.setup();

    render(<Renteberegning />);

    await user.click(screen.getByRole('button', { name: 'Commit kommentar' }));
    await user.click(screen.getByRole('button', { name: 'Download' }));

    expect(mockDownloadRentePdf).toHaveBeenCalledTimes(1);
    expect(mockDownloadRentePdf).toHaveBeenCalledWith(
      expect.objectContaining({
        kommentarer: 'Min kommentar',
      })
    );
  });

  it('sender undefined når kommentar kun er whitespace', async () => {
    mockDownloadRentePdf.mockResolvedValue({ success: true });
    const user = userEvent.setup();

    render(<Renteberegning />);

    await user.click(screen.getByRole('button', { name: 'Commit tom kommentar' }));
    await user.click(screen.getByRole('button', { name: 'Download' }));

    expect(mockDownloadRentePdf).toHaveBeenCalledTimes(1);
    expect(mockDownloadRentePdf).toHaveBeenCalledWith(
      expect.objectContaining({
        kommentarer: undefined,
      })
    );
  });
});
