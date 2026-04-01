import { render, screen } from '@testing-library/react';
import type { TafPeriodeRow } from '../../../schemas/formSchemas';
import type { TafDraftRow } from '../../../domain/erstatningsopgoerelse/tables/tableDraftRows';
import { toISODateString } from '../../../types/branded';
import TAFPeriodeTable from '../../../components/tables/TAFPeriodeTable';

describe('TAFPeriodeTable', () => {
  it('shows internal overlap error on date fields when period overlaps another TAF period', () => {
    const row: TafDraftRow = { id: 'row1', fra: '', til: '', loseFeriedage: '' };
    const committedById = new Map<string, TafPeriodeRow>([
      [
        'row1',
        {
          id: 'row1',
          fra: toISODateString('2025-01-01'),
          til: toISODateString('2025-01-10'),
          loseFeriedage: undefined,
        },
      ],
    ]);

    render(
      <TAFPeriodeTable
        rows={[row]}
        committedById={committedById}
        overlappingIds={new Set(['row1'])}
        onFieldChange={() => () => undefined}
        onRowBlur={() => undefined}
        derivedById={{}}
        derivedColumnHeader="Antal måneder"
        overlapWithBeregningsperiodeByRowId={{}}
        skadesdatoISO={undefined}
        endeligEETBeregnetDato={undefined}
        differencekravDato={undefined}
        erErhvervssygdom={false}
        verserendeKlageEet={false}
      />
    );

    const input = screen.getByDisplayValue('01-01-2025');
    const describedBy = input.getAttribute('aria-describedby') ?? '';
    const errorId = describedBy
      .split(' ')
      .map((v) => v.trim())
      .find((v) => v.endsWith('-error'));

    expect(errorId).toBeTruthy();
    const errorNode = errorId ? document.getElementById(errorId) : null;
    expect(errorNode).not.toBeNull();
    expect(errorNode?.textContent).toBe('Der er overlappende perioder');
  });

  it('shows beregningsperiode-vs-TAF overlap error on the affected date fields', () => {
    const row: TafDraftRow = { id: 'row1', fra: '', til: '', loseFeriedage: '' };
    const committedById = new Map<string, TafPeriodeRow>([
      [
        'row1',
        {
          id: 'row1',
          fra: toISODateString('2023-05-15'),
          til: toISODateString('2023-05-20'),
          loseFeriedage: undefined,
        },
      ],
    ]);

    render(
      <TAFPeriodeTable
        rows={[row]}
        committedById={committedById}
        overlappingIds={new Set()}
        onFieldChange={() => () => undefined}
        onRowBlur={() => undefined}
        derivedById={{}}
        derivedColumnHeader="Antal arbejdsdage"
        overlapWithBeregningsperiodeByRowId={{
          row1:
            'Der er overlap mellem beregningsperioden (01-05-2023 - 31-05-2023) og en TAF-periode (15-05-2023 - 20-05-2023)',
        }}
        skadesdatoISO={undefined}
        endeligEETBeregnetDato={undefined}
        differencekravDato={undefined}
        erErhvervssygdom={false}
        verserendeKlageEet={false}
      />
    );

    const input = screen.getByDisplayValue('15-05-2023');
    const describedBy = input.getAttribute('aria-describedby') ?? '';
    const errorId = describedBy
      .split(' ')
      .map((v) => v.trim())
      .find((v) => v.endsWith('-error'));

    expect(errorId).toBeTruthy();
    const errorNode = errorId ? document.getElementById(errorId) : null;
    expect(errorNode).not.toBeNull();
    expect(errorNode?.textContent).toBe(
      'Der er overlap mellem beregningsperioden (01-05-2023 - 31-05-2023) og en TAF-periode (15-05-2023 - 20-05-2023)'
    );
  });

  it('shows special cutoff errors for differencekrav and endeligt EET (no appeal) when value is on/after cutoff dates', () => {
    const row: TafDraftRow = { id: 'row1', fra: '', til: '', loseFeriedage: '' };
    const committedById = new Map<string, TafPeriodeRow>([
      [
        'row1',
        {
          id: 'row1',
          fra: toISODateString('2023-05-10'),
          til: undefined,
          loseFeriedage: undefined,
        },
      ],
    ]);

    render(
      <TAFPeriodeTable
        rows={[row]}
        committedById={committedById}
        overlappingIds={new Set()}
        onFieldChange={() => () => undefined}
        onRowBlur={() => undefined}
        derivedById={{}}
        derivedColumnHeader="Antal arbejdsdage"
        overlapWithBeregningsperiodeByRowId={{}}
        skadesdatoISO={undefined}
        endeligEETBeregnetDato={toISODateString('2023-05-10')}
        differencekravDato={toISODateString('2023-05-09')}
        erErhvervssygdom={false}
        verserendeKlageEet={false}
      />
    );

    const input = screen.getByDisplayValue('10-05-2023');
    const describedBy = input.getAttribute('aria-describedby') ?? '';
    const errorId = describedBy
      .split(' ')
      .map((v) => v.trim())
      .find((v) => v.endsWith('-error'));

    expect(errorId).toBeTruthy();
    const errorNode = errorId ? document.getElementById(errorId) : null;
    expect(errorNode).not.toBeNull();
    expect(errorNode?.textContent).toBe(
      'Der er angivet tabt arbejdsfortjeneste, efter differencekrav er opgjort (09-05-2023); Der er angivet tabt arbejdsfortjeneste efter afgørelse om endeligt erhvervsevnetab (10-05-2023)'
    );
  });
});
