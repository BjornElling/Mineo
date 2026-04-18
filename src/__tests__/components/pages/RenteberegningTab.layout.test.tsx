import React from 'react';
import { render, screen } from '@testing-library/react';

vi.mock('../../../components/layout/ContentBox', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('../../../components/inputs/StyledDateField', () => ({
  __esModule: true,
  default: () => <input data-testid="beregningsdato-input" readOnly value="18-04-2026" />,
}));

vi.mock('../../../components/inputs/InsertTodayDateButton', () => ({
  __esModule: true,
  default: () => <button type="button">I dag</button>,
}));

vi.mock('../../../components/inputs/StyledTextField', () => ({
  __esModule: true,
  default: () => <textarea readOnly />,
}));

vi.mock('../../../components/tables/BeregnetRenteTable', () => ({
  __esModule: true,
  default: () => <div data-testid="beregnet-rente-table" />,
}));

import RenteberegningTab from '../../../components/pages/renteberegning/RenteberegningTab';

describe('RenteberegningTab', () => {
  it('renderer beregningsdato-rækken som standard hover-row med label til venstre og input til højre', () => {
    render(
      <RenteberegningTab
        beregningsdato={'2026-04-18'}
        kommentarer={undefined}
        onBeregningsdatoCommit={vi.fn()}
        onKommentarerCommit={vi.fn()}
        rentekravRows={[]}
        onRentekravChange={vi.fn(() => vi.fn())}
        onRentekravBlur={vi.fn()}
        onRentekravReorder={vi.fn()}
        onDownloadSpecifikation={vi.fn(async () => undefined)}
        committedRentekravById={new Map()}
        onError={vi.fn()}
        pdfErrorMessage={null}
        referenceRates={[]}
        surchargeRates={[]}
      />
    );

    const row = screen.getByText('Rente beregnes til og med').closest('.row--label-right-hover');
    expect(row).not.toBeNull();
    expect(screen.getByTestId('beregningsdato-input').closest('.row--label-right-hover__content')).not.toBeNull();
  });

  it('renderer beregningstekniske forudsætninger som hover-rækker', () => {
    render(
      <RenteberegningTab
        beregningsdato={'2026-04-18'}
        kommentarer={undefined}
        onBeregningsdatoCommit={vi.fn()}
        onKommentarerCommit={vi.fn()}
        rentekravRows={[]}
        onRentekravChange={vi.fn(() => vi.fn())}
        onRentekravBlur={vi.fn()}
        onRentekravReorder={vi.fn()}
        onDownloadSpecifikation={vi.fn(async () => undefined)}
        committedRentekravById={new Map()}
        onError={vi.fn()}
        pdfErrorMessage={null}
        referenceRates={[]}
        surchargeRates={[]}
      />
    );

    expect(screen.getByText('Rente beregnes i henhold til renteloven.').closest('.row--label-right-hover')).not.toBeNull();
    expect(screen.getByText('Som beregningsprincip anvendes 365 årlige rentedage (366 i skudår).').closest('.row--label-right-hover')).not.toBeNull();
    expect(screen.getByText('Rentesatsen udgør nationalbankens udlånsrente + 8 % (ved forfaldsdato før 01-03-2013 dog + 7 %)').closest('.row--label-right-hover')).not.toBeNull();
    expect(screen.getByText('Der beregnes ikke renters rente.').closest('.row--label-right-hover')).not.toBeNull();
  });
});
