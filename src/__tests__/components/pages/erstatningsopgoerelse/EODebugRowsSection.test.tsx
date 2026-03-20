import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import EODebugRowsSection from '../../../../components/pages/erstatningsopgoerelse/EODebugRowsSection';

vi.mock('../../../../contexts/useAppSettings', () => ({
  useAppSettings: () => ({ settings: { showContentBoxReportButton: false } }),
}));

describe('EODebugRowsSection', () => {
  it('renderer multiline displayValue med bevarende linjeskift', () => {
    render(
      <MemoryRouter>
        <EODebugRowsSection
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
});
