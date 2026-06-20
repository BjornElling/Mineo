import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import type { ErstatningsopgoerelseValues, OffentligeYdelserRow } from '../../../schemas/formSchemas';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import type { SetValuesUpdater } from '../../../hooks/usePersistedForm';
import useSvieSmerteRows from '../../../components/tables/useSvieSmerteRows';
import SvieSmerteTable from '../../../components/tables/SvieSmerteTable';
import OffentligeYdelserTable from '../../../components/tables/OffentligeYdelserTable';
import { toISODateString } from '../../../types/branded';

describe('Slet-række (RowDeleteButton-integration)', () => {
  describe('Grid-familie (OffentligeYdelserTable)', () => {
    it('viser ikke slet-ikon på tomme rækker', () => {
      render(<OffentligeYdelserTable tableData={[]} />);
      // To tomme default-rækker + efterfølgende tom — ingen bruger-indtastning, intet ikon.
      expect(screen.queryAllByLabelText('Slet rækken')).toHaveLength(0);
    });

    it('viser slet-ikon på en udfyldt række og fjerner præcis den række i ét persist-kald', () => {
      const filled: OffentligeYdelserRow = { id: 'row1', ydelsestype: 'andet' };
      const onTableDataChange = vi.fn();
      render(<OffentligeYdelserTable tableData={[filled]} onTableDataChange={onTableDataChange} />);

      const buttons = screen.getAllByLabelText('Slet rækken');
      expect(buttons).toHaveLength(1);

      fireEvent.click(buttons[0]);

      // Ét persist-kald (= ét undo-frame), og 'row1' er ikke længere blandt de persisterede rækker.
      expect(onTableDataChange).toHaveBeenCalledTimes(1);
      const persistedRows = onTableDataChange.mock.calls[0][0] as OffentligeYdelserRow[];
      expect(persistedRows.some((row) => row.id === 'row1')).toBe(false);
    });
  });

  describe('Draft-familie (SvieSmerteTable)', () => {
    it('viser slet-ikon kun på committede ikke-tomme rækker og fjerner rækken i ét commit', () => {
      const initial: ErstatningsopgoerelseValues = {
        ...createErstatningsopgoerelseInitialValues(),
        svieSmertePerioder: [
          { id: 'row-1', fra: toISODateString('2024-01-01'), til: toISODateString('2024-01-31'), tilstand: 'sygemeldt' },
        ],
      };

      let commitCount = 0;
      const TestHarness = () => {
        const [state, setState] = React.useState(initial);
        const setValues = React.useCallback<SetValuesUpdater<ErstatningsopgoerelseValues>>((updater) => {
          commitCount += 1;
          setState((prev) => ({ ...prev, ...updater(prev) }));
        }, []);
        const svie = useSvieSmerteRows({ values: state, setValues, resyncToken: 0 });
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
            onRowBlur={svie.onRowBlur}
            onDeleteRow={svie.removeRow}
          />
        );
      };

      render(<TestHarness />);

      // Kun den ene committede række har et ikon (den efterfølgende tomme draft-række har ingen).
      const buttons = screen.getAllByLabelText('Slet rækken');
      expect(buttons).toHaveLength(1);
      expect(screen.getByDisplayValue('01-01-2024')).toBeInTheDocument();

      fireEvent.click(buttons[0]);

      // Rækken er fjernet (datoen væk, intet ikon tilbage) via netop ét commit.
      expect(screen.queryByDisplayValue('01-01-2024')).not.toBeInTheDocument();
      expect(screen.queryAllByLabelText('Slet rækken')).toHaveLength(0);
      expect(commitCount).toBe(1);
    });
  });
});
