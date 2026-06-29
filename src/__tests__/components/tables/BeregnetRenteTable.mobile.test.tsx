// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import BeregnetRenteTable from '../../../components/tables/BeregnetRenteTable';
import type { RentekravDraftRow } from '../../../domain/renteberegning/tableDraftRows';
import type { RentekravRow } from '../../../schemas/formSchemas';
import { DEFAULT_DOCUMENT_DOWNLOAD_FORMAT } from '../../../document/documentFormat';

vi.mock('../../../contexts/useFormPersistence', () => ({
  useFormPersistence: () => ({
    getPersistedData: () => undefined,
  }),
}));

const makeRow = (id: string): RentekravDraftRow => ({
  id,
  belob: '',
  renterFra: '',
  tillaegstid: '',
  enhed: 'dage',
});

const makeCommittedRow = (id: string): RentekravRow => ({
  id,
  belob: undefined,
  renterFra: undefined,
  tillaegstid: undefined,
  enhed: 'dage',
});

const baseProps = {
  rows: [makeRow('r1')],
  committedById: new Map([['r1', makeCommittedRow('r1')]]),
  onFieldChange: vi.fn(() => vi.fn()),
  onRowBlur: vi.fn(),
  beregningsdato: undefined,
  onDownloadSpecifikation: vi.fn(async () => undefined),
  onError: () => undefined,
  beregningsdatoHasError: false,
  referenceRates: [],
  surchargeRates: [],
  documentDownloadFormat: DEFAULT_DOCUMENT_DOWNLOAD_FORMAT,
};

describe('BeregnetRenteTable mobilkolonner', () => {
  it('renderer mobilkolonner (belob, renterFra, beregnetRente) når isMobile=true', () => {
    render(<BeregnetRenteTable {...baseProps} isMobile={true} />);

    expect(screen.getByRole('columnheader', { name: /beløb/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /renter fra/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /beregnet rente/i })).toBeInTheDocument();
  });

  it('skjuler desktop-kolonner (tillægstid, rentedato, specifikation) når isMobile=true', () => {
    render(<BeregnetRenteTable {...baseProps} isMobile={true} />);

    expect(screen.queryByRole('columnheader', { name: /tillægstid/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: /rentedato/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: /specifikation/i })).not.toBeInTheDocument();
  });

  it('renderer alle desktop-kolonner når isMobile=false', () => {
    render(<BeregnetRenteTable {...baseProps} isMobile={false} />);

    expect(screen.getByRole('columnheader', { name: /beløb/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /renter fra/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /tillægstid/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /rentedato/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /beregnet rente/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /specifikation/i })).toBeInTheDocument();
  });
});
