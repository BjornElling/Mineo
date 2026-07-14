// @vitest-environment jsdom
import React from 'react';
import { render as rtlRender, screen, fireEvent } from '@testing-library/react';
import { FormPersistenceProvider, initializePersistenceRuntime } from '../../../contexts/FormPersistenceContext';

// RenteberegningTab binder nu beregningsdato til invalidDrafts (useFormFieldErrorReporter) og læser
// sektionens invalidDrafts, så den kræver en FormPersistenceProvider. StyledDateField/BeregnetRenteTable
// er mocket ud i denne layout-test, så provideren er kun til stede for de tab-interne hooks.
const render = (ui: React.ReactElement) =>
  rtlRender(<FormPersistenceProvider runtime={initializePersistenceRuntime()}>{ui}</FormPersistenceProvider>);

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
import { toISODateString } from '../../../types/branded';
import { DEFAULT_DOCUMENT_DOWNLOAD_FORMAT } from '../../../document/documentFormat';

const TestContentBox = ({ children, className }: { children?: React.ReactNode; className?: string }) => (
  <div className={className}>{children}</div>
);

describe('RenteberegningTab', () => {
  it('renderer beregningsdato-rækken som standard hover-row med label til venstre og input til højre', () => {
    render(
      <RenteberegningTab
        beregningsdato={toISODateString('2026-04-18')}
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
        ContentBoxComponent={TestContentBox}
        documentDownloadFormat={DEFAULT_DOCUMENT_DOWNLOAD_FORMAT}
      />
    );

    const row = screen.getByText('Rente beregnes til og med').closest('.row--label-right-hover');
    expect(row).not.toBeNull();
    expect(screen.getByTestId('beregningsdato-input').closest('.row--label-right-hover__content')).not.toBeNull();
  });

  it('renderer beregningstekniske forudsætninger som almindelig brødtekst', () => {
    render(
      <RenteberegningTab
        beregningsdato={toISODateString('2026-04-18')}
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
        ContentBoxComponent={TestContentBox}
        documentDownloadFormat={DEFAULT_DOCUMENT_DOWNLOAD_FORMAT}
      />
    );

    const firstPrinciple = screen.getByText('Rente beregnes i henhold til renteloven.');
    expect(firstPrinciple).toHaveClass('row--text');
    expect(firstPrinciple.closest('.flow--16')).not.toBeNull();
    expect(firstPrinciple.closest('.row--label-right-hover')).toBeNull();
    expect(screen.getByText('Som beregningsprincip anvendes 365 årlige rentedage (366 i skudår).').closest('.row--label-right-hover')).toBeNull();
    expect(screen.getByText('Rentesatsen udgør nationalbankens udlånsrente + 8 % (ved forfaldsdato før 01-03-2013 dog + 7 %)').closest('.row--label-right-hover')).toBeNull();
    expect(screen.getByText('Der beregnes ikke renters rente.').closest('.row--label-right-hover')).toBeNull();
  });

  it('viser "Slet alle indtastninger" på desktop og kalder onClearAll efter bekræftelse', () => {
    const onClearAll = vi.fn();
    render(
      <RenteberegningTab
        beregningsdato={toISODateString('2026-04-18')}
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
        ContentBoxComponent={TestContentBox}
        onClearAll={onClearAll}
        documentDownloadFormat={DEFAULT_DOCUMENT_DOWNLOAD_FORMAT}
      />
    );

    const row = screen.getByText('Slet alle indtastninger').closest('.row--label-right-hover');
    expect(row).not.toBeNull();

    // Klik på skraldespand-ikonet åbner bekræftelses-overlayet; onClearAll må ikke kaldes endnu.
    fireEvent.click(screen.getByRole('button', { name: 'Slet alle indtastninger' }));
    expect(onClearAll).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Ja, slet' }));
    expect(onClearAll).toHaveBeenCalledTimes(1);
  });

  it('deaktiverer "Slet alle indtastninger" når siden er tom (intet committed input)', () => {
    const onClearAll = vi.fn();
    render(
      <RenteberegningTab
        beregningsdato={undefined}
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
        ContentBoxComponent={TestContentBox}
        onClearAll={onClearAll}
        documentDownloadFormat={DEFAULT_DOCUMENT_DOWNLOAD_FORMAT}
      />
    );

    const button = screen.getByRole('button', { name: 'Slet alle indtastninger' });
    expect(button).toBeDisabled();

    // Klik på deaktiveret knap åbner ikke overlayet og kalder ikke onClearAll.
    fireEvent.click(button);
    expect(onClearAll).not.toHaveBeenCalled();
  });

  it('skjuler "Slet alle indtastninger" på mobil (isMobile)', () => {
    render(
      <RenteberegningTab
        beregningsdato={toISODateString('2026-04-18')}
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
        ContentBoxComponent={TestContentBox}
        isMobile
        onClearAll={vi.fn()}
        documentDownloadFormat={DEFAULT_DOCUMENT_DOWNLOAD_FORMAT}
      />
    );

    expect(screen.queryByText('Slet alle indtastninger')).toBeNull();
  });
});
