import { render, screen } from '@testing-library/react';
import RenteberegningTab from '../../../components/pages/renteberegning/RenteberegningTab';
import ContentBoxFrame from '../../../components/layout/ContentBoxFrame';
import type { RentekravRow } from '../../../schemas/formSchemas';
import type { RentekravDraftRow } from '../../../domain/renteberegning/tableDraftRows';
import { rentekravDraftToCommittedRow } from '../../../domain/renteberegning/rentekravTableModel';
import { referenceRates, surchargeRates } from '../../../data/interestRates';
import { DEFAULT_DOCUMENT_DOWNLOAD_FORMAT } from '../../../document/documentFormat';
import { toISODateString } from '../../../types/branded';

// §2.4 (renteberegning-contract): download-gaten skal udledes fra COMMITTED input
// hos parent (RenteberegningTab) via computeRentekravRow — ikke fra draft-state via
// en child→parent callback. Disse tests beviser at gaten reagerer på committed input
// og IKKE på draft-kun fejl.

vi.mock('../../../contexts/useFormPersistence', () => ({
  useFormPersistence: () => ({
    getPersistedData: () => undefined,
  }),
}));

const makeDraftRow = (id: string, overrides: Partial<RentekravDraftRow> = {}): RentekravDraftRow => ({
  id,
  belob: '',
  renterFra: '',
  tillaegstid: '',
  enhed: 'dage',
  ...overrides,
});

const makeCommittedRow = (
  id: string,
  fields: { belob?: string; renterFra?: string } = {},
): RentekravRow =>
  rentekravDraftToCommittedRow(
    makeDraftRow(id, {
      belob: fields.belob ?? '',
      renterFra: fields.renterFra ?? '',
    }),
  );

const VALID_BEREGNINGSDATO = toISODateString('2024-12-31');

const renderTab = (args: {
  draftRows: RentekravDraftRow[];
  committedById: ReadonlyMap<string, RentekravRow>;
  beregningsdato?: ReturnType<typeof toISODateString>;
}) => {
  return render(
    <RenteberegningTab
      beregningsdato={args.beregningsdato ?? VALID_BEREGNINGSDATO}
      kommentarer={undefined}
      onBeregningsdatoCommit={() => undefined}
      onKommentarerCommit={() => undefined}
      rentekravRows={args.draftRows}
      onRentekravChange={() => () => undefined}
      onRentekravBlur={() => undefined}
      onRentekravReorder={() => undefined}
      onDownloadSpecifikation={async () => undefined}
      committedRentekravById={args.committedById}
      onError={() => undefined}
      pdfErrorMessage={null}
      referenceRates={referenceRates}
      surchargeRates={surchargeRates}
      ContentBoxComponent={ContentBoxFrame}
      onDownloadOversigt={async () => undefined}
      oversigtErrorMessage={null}
      showOversigtBox
      documentDownloadFormat={DEFAULT_DOCUMENT_DOWNLOAD_FORMAT}
    />,
  );
};

const getOversigtButton = () => screen.getByRole('button', { name: 'Download samlet oversigt' });

describe('Renteberegning download-gate (§2.4: udledt fra committed input)', () => {
  it('aktiverer download når en committed række er fuldt gyldig', () => {
    const committed = makeCommittedRow('r1', { belob: '1000,00', renterFra: '01-01-2020' });
    renderTab({
      draftRows: [makeDraftRow('r1', { belob: '1.000,00', renterFra: '01-01-2020' })],
      committedById: new Map([['r1', committed]]),
    });

    expect(getOversigtButton()).toBeEnabled();
  });

  it('deaktiverer download når en committed række er delvist udfyldt (kun beløb, ingen renterFra)', () => {
    const committed = makeCommittedRow('r1', { belob: '1000,00' });
    renderTab({
      draftRows: [makeDraftRow('r1', { belob: '1.000,00' })],
      committedById: new Map([['r1', committed]]),
    });

    expect(getOversigtButton()).toBeDisabled();
  });

  it('deaktiverer download når der ingen committed rækker er (kun tom række)', () => {
    const committed = makeCommittedRow('r1');
    renderTab({
      draftRows: [makeDraftRow('r1')],
      committedById: new Map([['r1', committed]]),
    });

    expect(getOversigtButton()).toBeDisabled();
  });

  it('en draft-kun dato-fejl driver IKKE den samlede gate (committed input forbliver gyldigt)', () => {
    // committed input er gyldigt; draft-rækken indeholder en ugyldig dato-tekst der ville
    // udløse renterFraHasError i feltet, men §2.4 udelukker det fra den samlede gate.
    const committed = makeCommittedRow('r1', { belob: '1000,00', renterFra: '01-01-2020' });
    renderTab({
      draftRows: [makeDraftRow('r1', { belob: '1.000,00', renterFra: '99-99-9999' })],
      committedById: new Map([['r1', committed]]),
    });

    expect(getOversigtButton()).toBeEnabled();
  });
});
