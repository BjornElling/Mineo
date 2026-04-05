import React from 'react';
import { render, screen } from '@testing-library/react';
import type { ErstatningsopgoerelseValues, SvieSmertePeriodeRow } from '../../../schemas/formSchemas';
import type { SvieSmerteDraftRow } from '../../../domain/erstatningsopgoerelse/tables/tableDraftRows';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import useSvieSmerteRows from '../../../components/tables/useSvieSmerteRows';
import { toISODateString } from '../../../types/branded';
import SvieSmerteTable from '../../../components/tables/SvieSmerteTable';

describe('SvieSmerteTable', () => {
  it('shows a special error message when svie/smerte is on/after the varige mén decision date (no appeal)', () => {
    const row: SvieSmerteDraftRow = { id: 'row1', fra: '', til: '', tilstand: '' };
    const committedById = new Map<string, SvieSmertePeriodeRow>([
      [
        'row1',
        {
          id: 'row1',
          fra: toISODateString('2023-05-10'),
          til: undefined,
          tilstand: undefined,
        },
      ],
    ]);

    render(
      <SvieSmerteTable
        rows={[row]}
        committedById={committedById}
        derivedById={{ row1: { hasRangeError: false, antalDage: null } }}
        overlappingIds={new Set()}
        skadedatoISO={undefined}
        menAfgoerelseDato={toISODateString('2023-05-10')}
        erErhvervssygdom={false}
        verserendeKlageMen={false}
        onFieldChange={() => () => undefined}
        onRowBlur={() => undefined}
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
    expect(errorNode?.textContent).toBe('Der er angivet svie/smerte efter afgørelse om varige mén (10-05-2023)');
  });

  it('shows inclusive day count for a DST-spanning svie/smerte period', () => {
    const values: ErstatningsopgoerelseValues = {
      ...createErstatningsopgoerelseInitialValues(),
      svieSmertePerioder: [
        {
          id: 'row-1',
          fra: toISODateString('2024-01-26'),
          til: toISODateString('2024-10-20'),
          tilstand: 'sygemeldt',
        },
      ],
    };

    const TestHarness = () => {
      const [state, setState] = React.useState<ErstatningsopgoerelseValues>(values);
      const svie = useSvieSmerteRows({ values: state, setValues: setState, resyncToken: 0 });

      return (
        <SvieSmerteTable
          rows={svie.draftRows}
          committedById={svie.committedById}
          derivedById={svie.derivedById}
          overlappingIds={svie.overlappingIds}
          skadedatoISO={undefined}
          menAfgoerelseDato={undefined}
          erErhvervssygdom={false}
          verserendeKlageMen={false}
          onFieldChange={svie.onFieldChange}
          onRowBlur={svie.onFieldBlur}
        />
      );
    };

    render(<TestHarness />);
    expect(screen.getByText('269')).toBeInTheDocument();
  });

  it('marks overlapping rows when svie/smerte periods overlap with different tilstand', () => {
    const values: ErstatningsopgoerelseValues = {
      ...createErstatningsopgoerelseInitialValues(),
      svieSmertePerioder: [
        {
          id: 'row-1',
          fra: toISODateString('2023-06-22'),
          til: toISODateString('2024-07-31'),
          tilstand: 'sygemeldt',
        },
        {
          id: 'row-2',
          fra: toISODateString('2024-09-01'),
          til: toISODateString('2024-09-16'),
          tilstand: 'sygemeldt',
        },
        {
          id: 'row-3',
          fra: toISODateString('2024-07-15'),
          til: toISODateString('2024-08-15'),
          tilstand: 'delvist-sygemeldt',
        },
      ],
    };

    const TestHarness = () => {
      const [state, setState] = React.useState<ErstatningsopgoerelseValues>(values);
      const svie = useSvieSmerteRows({ values: state, setValues: setState, resyncToken: 0 });
      const ids = Array.from(svie.overlappingIds).sort().join(',');
      return <div data-testid="overlap-ids">{ids}</div>;
    };

    render(<TestHarness />);
    expect(screen.getByTestId('overlap-ids').textContent).toBe('row-1,row-3');
  });
});
