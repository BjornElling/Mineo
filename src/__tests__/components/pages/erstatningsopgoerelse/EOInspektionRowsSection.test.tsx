// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import EOInspektionRowsSection from '../../../../components/pages/erstatningsopgoerelse/EOInspektionRowsSection';

vi.mock('../../../../contexts/useAppSettings', () => ({
  useAppSettings: () => ({ settings: { showContentBoxReportButton: false } }),
}));

describe('EOInspektionRowsSection', () => {
  it('renderer ingenting når rows er tom', () => {
    const { container } = render(
      <MemoryRouter>
        <EOInspektionRowsSection title="Svie og smerte" rows={[]} />
      </MemoryRouter>
    );

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText('Svie og smerte')).not.toBeInTheDocument();
  });

  it('renderer multiline displayValue med bevarende linjeskift', () => {
    render(
      <MemoryRouter>
        <EOInspektionRowsSection
          title="Svie og smerte"
          rows={[
            {
              id: 'sviesmerte.beregnetPeriode',
              label: 'Svie/smerte-perioder i erstatningsperioden',
              displayValue: '26-01-2024 - 20-10-2024\n12-08-2025 - 22-09-2025\n23-09-2025 - 02-11-2025 (delvist syg)',
              status: 'ok',
            },
          ]}
        />
      </MemoryRouter>
    );

    const value = screen.getByText(/26-01-2024 - 20-10-2024/);
    expect(value).toHaveStyle({ whiteSpace: 'pre-line', textAlign: 'right' });
    expect(value.textContent).toContain('\n12-08-2025 - 22-09-2025\n');
  });

  it('giver en ok-række med «-» intet mærke, men beholder ✓ ved en værdi og kryds ved en fejl', () => {
    render(
      <MemoryRouter>
        <EOInspektionRowsSection
          title="Indtægt før skadedatoen"
          rows={[
            { id: 'tom', label: 'Måneder', displayValue: '-', status: 'ok' },
            { id: 'vaerdi', label: 'Beregnes ud fra', displayValue: 'Beregningsperiode', status: 'ok' },
            { id: 'fejl', label: 'Periode', displayValue: '-', status: 'error' },
          ]}
        />
      </MemoryRouter>
    );

    expect(screen.getAllByTestId('CheckIcon')).toHaveLength(1);
    expect(screen.getAllByTestId('ErrorOutlinedIcon')).toHaveLength(1);
  });
});
