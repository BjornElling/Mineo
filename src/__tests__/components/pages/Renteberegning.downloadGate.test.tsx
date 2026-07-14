// @vitest-environment jsdom
import { render, screen, act, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import RenteberegningTab from '../../../components/pages/renteberegning/RenteberegningTab';
import ContentBoxFrame from '../../../components/layout/ContentBoxFrame';
import { FormPersistenceProvider, initializePersistenceRuntime } from '../../../contexts/FormPersistenceContext';
import { formPersistenceStore } from '../../../stores/formPersistenceStore';
import { PERSISTED_DATA_VERSION } from '../../../config/persistenceVersion';
import { buildCellInvalidDraftFieldPath, CELL_TABLE_IDS } from '../../../config/cellInvalidDraftScopes';
import type { RentekravRow } from '../../../schemas/formSchemas';
import type { RentekravDraftRow } from '../../../domain/renteberegning/tableDraftRows';
import { rentekravDraftToCommittedRow } from '../../../domain/renteberegning/rentekravTableModel';
import { referenceRates, surchargeRates, type RateEntry } from '../../../data/interestRates';
import { DEFAULT_DOCUMENT_DOWNLOAD_FORMAT } from '../../../document/documentFormat';
import { toISODateString } from '../../../types/branded';

// §2.4 (renteberegning-contract): download-gaten skal udledes fra den AFSLUTTEDE inputtilstand — committed
// input via computeRentekravRow OG afsluttede ugyldige inputs (invalidDrafts). Denne test kører gennem en
// rigtig FormPersistenceProvider (ikke en mock), så den både beviser committed-only-reglen OG at et
// afsluttet ugyldigt input blokerer download (document-output-contract.md §A2.1, design §5.4).

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

// Seed EFTER mount: initializePersistenceRuntime() hydrerer invalidDrafts fra (tom) sessionStorage ved
// render, så en seeding før render ville blive nulstillet. act() sikrer at store-opdateringen flusher
// re-renderet, så gaten reagerer — dette svarer til en afsluttet ugyldig celle-/felt-tilstand i storen.
const seedInvalidDraftAfterMount = (fieldPath: string, raw: string): void => {
  act(() => {
    formPersistenceStore.getState().setInvalidDraft('renteberegning', fieldPath, raw);
  });
};

const cellFieldPath = (rowId: string, col: number): string =>
  buildCellInvalidDraftFieldPath(CELL_TABLE_IDS.renteBeregnet, '', `${rowId}:${col}`);

const renderTab = (args: {
  draftRows: RentekravDraftRow[];
  committedById: ReadonlyMap<string, RentekravRow>;
  beregningsdato?: ReturnType<typeof toISODateString>;
  referenceRates?: readonly RateEntry[];
  surchargeRates?: readonly RateEntry[];
  onDownloadOversigt?: ComponentProps<typeof RenteberegningTab>['onDownloadOversigt'];
}) => {
  return render(
    <FormPersistenceProvider runtime={initializePersistenceRuntime()}>
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
      />
    </FormPersistenceProvider>,
  );
};

const getOversigtButton = () => screen.getByRole('button', { name: 'Download samlet oversigt' });

describe('Renteberegning download-gate (§2.4: udledt fra afsluttet input)', () => {
  beforeEach(() => {
    sessionStorage.clear();
    formPersistenceStore.setState({
      meta: { hydrated: true, persistedDataVersion: PERSISTED_DATA_VERSION },
    });
    formPersistenceStore.getState().clearAllFieldErrors();
    formPersistenceStore.getState().clearAllInvalidDrafts();
  });

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

  it('et afsluttet ugyldigt renterFra oven på en gyldig committed række blokerer den samlede gate', () => {
    // Committed input er gyldigt, men brugeren har AFSLUTTET et uparseligt renterFra i cellen →
    // invalidDrafts-entry. Tidligere holdt gaten download AKTIV (renterFraHasError var ekskluderet);
    // nu blokerer den afsluttede ugyldige tilstand aggregat-downloaden.
    const onDownloadOversigt = vi.fn(async () => undefined);
    const committed = makeCommittedRow('r1', { belob: '1000,00', renterFra: '01-01-2020' });
    renderTab({
      draftRows: [makeDraftRow('r1', { belob: '1.000,00', renterFra: '01-01-2020' })],
      committedById: new Map([['r1', committed]]),
      onDownloadOversigt,
    });
    expect(getOversigtButton()).toBeEnabled();

    seedInvalidDraftAfterMount(cellFieldPath('r1', 1), '99-99-9999');

    expect(getOversigtButton()).toBeDisabled();
    fireEvent.click(getOversigtButton());
    expect(onDownloadOversigt).not.toHaveBeenCalled();
  });

  it('et afsluttet ugyldigt beregningsdato (global) blokerer den samlede gate', () => {
    const onDownloadOversigt = vi.fn(async () => undefined);
    const committed = makeCommittedRow('r1', { belob: '1000,00', renterFra: '01-01-2020' });
    renderTab({
      draftRows: [makeDraftRow('r1', { belob: '1.000,00', renterFra: '01-01-2020' })],
      committedById: new Map([['r1', committed]]),
      onDownloadOversigt,
    });
    expect(getOversigtButton()).toBeEnabled();

    seedInvalidDraftAfterMount('beregningsdato', '99-99-9999');

    expect(getOversigtButton()).toBeDisabled();
    fireEvent.click(getOversigtButton());
    expect(onDownloadOversigt).not.toHaveBeenCalled();
  });

  it('en parsebar renterFra efter beregningsdato blokerer visuelt og funktionelt', () => {
    const onDownloadOversigt = vi.fn(async () => undefined);
    const committed = makeCommittedRow('r1', { belob: '1000,00', renterFra: '01-01-2025' });
    renderTab({
      draftRows: [makeDraftRow('r1', { belob: '1.000,00', renterFra: '01-01-2025' })],
      committedById: new Map([['r1', committed]]),
      beregningsdato: VALID_BEREGNINGSDATO,
      onDownloadOversigt,
    });

    expect(getOversigtButton()).toBeDisabled();
    fireEvent.click(getOversigtButton());
    expect(onDownloadOversigt).not.toHaveBeenCalled();
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
      toISODateString('2024-06-30'),
      expect.any(Number)
    );
  });
});
