import React from 'react';
import { act, render, screen, fireEvent } from '@testing-library/react';
import type { ErstatningsopgoerelseValues, OffentligeYdelserRow } from '../../../schemas/formSchemas';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import type { SetValuesUpdater } from '../../../hooks/usePersistedForm';
import useSvieSmerteRows from '../../../components/tables/useSvieSmerteRows';
import SvieSmerteTable from '../../../components/tables/SvieSmerteTable';
import OffentligeYdelserTable from '../../../components/tables/OffentligeYdelserTable';
import { toISODateString } from '../../../types/branded';
import { FormPersistenceProvider } from '../../../contexts/FormPersistenceContext';
import { CellInvalidDraftScopeProvider } from '../../../contexts/CellInvalidDraftScopeContext';
import { formPersistenceStore } from '../../../stores/formPersistenceStore';
import { PERSISTED_DATA_VERSION } from '../../../config/persistenceVersion';
import { CELL_TABLE_IDS, buildCellInvalidDraftFieldPath } from '../../../config/cellInvalidDraftScopes';
import { getFirstBlockingInputErrorTarget } from '../../../utils/saveBlockedFocus';
import {
  getFieldErrorsBySourceSnapshot,
  getInvalidDraftsForSectionSnapshot,
} from '../../../stores/formPersistenceReadModel';

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

    it('B7: sletter en rækkes forældreløse celle-invalidDraft, så Gem ikke blokeres af et spøgelses-mål', () => {
      const gatePageKey = 'erstatningsopgoerelse' as const;
      const draftPath = buildCellInvalidDraftFieldPath(CELL_TABLE_IDS.eoOffentligeYdelser, '', 'row1:3');
      const gateTarget = () =>
        getFirstBlockingInputErrorTarget(getFieldErrorsBySourceSnapshot, getInvalidDraftsForSectionSnapshot);

      sessionStorage.clear();
      formPersistenceStore.getState().clearAll({ hydrated: true, schemaFingerprint: PERSISTED_DATA_VERSION, lastCommittedAt: 1 });

      const filled: OffentligeYdelserRow = { id: 'row1', ydelsestype: 'andet' };
      render(
        <FormPersistenceProvider>
          <CellInvalidDraftScopeProvider pageKey={gatePageKey} tableId={CELL_TABLE_IDS.eoOffentligeYdelser} rowScope="">
            <OffentligeYdelserTable tableData={[filled]} onTableDataChange={vi.fn()} />
          </CellInvalidDraftScopeProvider>
        </FormPersistenceProvider>
      );

      // Efter provider-mount (hydrate har ryddet): læg en ikke-committbar rå draft på den udfyldte rækkes celle.
      act(() => { formPersistenceStore.getState().setInvalidDraft(gatePageKey, draftPath, 'abc'); });
      expect(gateTarget()?.fieldName).toBe(draftPath); // Gem blokeret af draften

      // Slet rækken: dens id forsvinder fra de renderede rækker → reconcile rydder den forældreløse draft.
      fireEvent.click(screen.getByLabelText('Slet rækken'));

      expect(formPersistenceStore.getState().invalidDrafts[gatePageKey][draftPath]).toBeUndefined();
      expect(gateTarget()).toBeNull(); // Gem ikke længere blokeret af et spøgelses-mål
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
