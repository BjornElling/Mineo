// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import RenteberegningTab from '../../../components/pages/renteberegning/RenteberegningTab';
import ContentBoxFrame from '../../../components/layout/ContentBoxFrame';
import type { RentekravRow } from '../../../schemas/formSchemas';
import type { RentekravDraftRow } from '../../../domain/renteberegning/tableDraftRows';
import { rentekravDraftToCommittedRow } from '../../../domain/renteberegning/rentekravTableModel';
import { referenceRates, surchargeRates, type RateEntry } from '../../../data/interestRates';
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
  referenceRates?: readonly RateEntry[];
  surchargeRates?: readonly RateEntry[];
  onDownloadOversigt?: ComponentProps<typeof RenteberegningTab>['onDownloadOversigt'];
}) => {
  return render(
    <RenteberegningTab
      beregningsdato={args.beregningsdato ?? VALID_BEREGNINGSDATO}
      kommentarer={undefined}
      onBeregningsdatoCommit={() => true}
      onKommentarerCommit={() => true}
      rentekravRows={args.draftRows}
      onRentekravChange={() => () => undefined}
      onRentekravBlur={() => undefined}
      onRentekravReorder={() => undefined}
      onDownloadSpecifikation={async () => undefined}
      committedRentekravById={args.committedById}
      onError={() => undefined}
      pdfErrorMessage={null}
      referenceRates={args.referenceRates ?? referenceRates}
      surchargeRates={args.surchargeRates ?? surchargeRates}
      ContentBoxComponent={ContentBoxFrame}
      onDownloadOversigt={args.onDownloadOversigt ?? (async () => undefined)}
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

  it('sender seneste referenceperiode-slutdato med ved samlet oversigt', async () => {
    const onDownloadOversigt = vi.fn(async () => undefined);
    const committed = makeCommittedRow('r1', { belob: '1000,00', renterFra: '01-01-2024' });
    renderTab({
      draftRows: [makeDraftRow('r1', { belob: '1.000,00', renterFra: '01-01-2024' })],
      committedById: new Map([['r1', committed]]),
      beregningsdato: toISODateString('2024-07-01'),
      referenceRates: [{ effectiveDate: toISODateString('2024-01-01'), ratePct: 1 }],
      surchargeRates: [{ effectiveDate: toISODateString('2024-01-01'), ratePct: 8 }],
      onDownloadOversigt,
    });

    await userEvent.click(getOversigtButton());

    expect(onDownloadOversigt).toHaveBeenCalledWith(
      [{ beloeb: 1000, renterFra: toISODateString('2024-01-01'), beregnetRente: expect.any(Number) }],
      toISODateString('2024-07-01'),
      toISODateString('2024-06-30')
    );
  });
});
