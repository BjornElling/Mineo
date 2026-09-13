// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import EOInspektionRowsSection from '../../../../components/pages/erstatningsopgoerelse/EOInspektionRowsSection';
import type { EOInspektionDisplayTable } from '../../../../domain/eoInspektion/eoInspektionPageViewModel';

vi.mock('../../../../contexts/useAppSettings', () => ({
  useAppSettings: () => ({ settings: { showContentBoxReportButton: false } }),
}));

describe('EO-kontrol – reguleringstabel for offentlige ydelser', () => {
  it('viser en tabelbaseret EO-sektion, også når sektionen ikke har almindelige rækker', () => {
    const tables: readonly EOInspektionDisplayTable[] = [{
      id: 'offentligeYdelser.regulering.vaerdier',
      title: 'Reguleringsværdier:',
      columns: ['Reguleringsdato', 'Regulering', 'Akkumuleret regulering'],
      rows: [{
        id: 'offentligeYdelser.regulering.vaerdier.0',
        cells: ['01-01-2025', '3,9 %', '3,9 %'],
      }],
    }];

    render(
      <MemoryRouter>
        <EOInspektionRowsSection title="Offentlige ydelser" rows={[]} tables={tables} />
      </MemoryRouter>
    );

    expect(screen.getByText('Offentlige ydelser')).toBeVisible();
    expect(screen.getByText('Reguleringsværdier:')).toBeVisible();

    const table = screen.getByRole('table');
    expect(table).toBeVisible();
    expect(screen.getAllByRole('columnheader').map((header) => header.textContent)).toEqual([
      'Reguleringsdato',
      'Regulering',
      'Akkumuleret regulering',
    ]);
    expect(screen.getAllByRole('cell').map((cell) => cell.textContent)).toEqual([
      '01-01-2025',
      '3,9 %',
      '3,9 %',
    ]);
  });
});
