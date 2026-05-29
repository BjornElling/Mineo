import * as React from 'react';
import type { UseRowDraftsResult } from '../../rowDrafts/useRowDrafts';
import { useRowDrafts } from '../../rowDrafts/useRowDrafts';
import type { ErstatningsopgoerelseValues, TafPeriodeRow } from '../../schemas/formSchemas';
import { type SetValuesUpdater } from '../../hooks/usePersistedForm';
import { isTafRowEmpty } from '../../domain/erstatningsopgoerelse/helpers/rowEmpty';
import type { TafDraftRow } from '../../domain/erstatningsopgoerelse/tables/tableDraftRows';
import {
  committedToTafDraftRows,
  createEmptyTafCommittedRow,
  createTafRowId,
  ensureTafRows,
  tafDraftToCommittedRow,
} from '../../domain/erstatningsopgoerelse/tables/tafTableModel';
import { detectOverlappingPeriods } from '../../domain/erstatningsopgoerelse/engines/periodOverlapDetection';

export type UseTafRowsArgs = Readonly<{
  values: ErstatningsopgoerelseValues;
  setValues: SetValuesUpdater<ErstatningsopgoerelseValues>;
  resyncToken: unknown;
}>;

export type UseTafRowsResult = UseRowDraftsResult<TafDraftRow, 'fra' | 'til' | 'loseFeriedage'> &
  Readonly<{
    committedRowsEnsured: readonly TafPeriodeRow[];
    committedById: ReadonlyMap<string, TafPeriodeRow>;
    overlappingIds: ReadonlySet<string>;
  }>;

const useTafRows = ({ values, setValues, resyncToken }: UseTafRowsArgs): UseTafRowsResult => {
  const tafRows = useRowDrafts<TafDraftRow, TafPeriodeRow, 'fra' | 'til' | 'loseFeriedage'>({
    getCommitted: () => values.tafPerioder,
    setCommitted: (updater, origin) => {
      setValues((prev) => {
        const nextRows = updater(prev.tafPerioder);
        if (!nextRows) return prev;
        return { ...prev, tafPerioder: nextRows };
      }, origin);
    },
    toDraft: committedToTafDraftRows,
    toCommittedRow: (draft) => tafDraftToCommittedRow(draft),
    isRowEmpty: isTafRowEmpty,
    ensureRows: ensureTafRows,
    createId: createTafRowId,
    createEmptyCommittedRow: createEmptyTafCommittedRow,
    // colIndex matcher TAFPeriodeTable: fra=0, til=1, loseFeriedage=2
    fieldColIndex: { fra: 0, til: 1, loseFeriedage: 2 },
    resyncToken,
  });

  const committedRowsEnsured = React.useMemo(() => ensureTafRows(values.tafPerioder), [values.tafPerioder]);
  const committedById = React.useMemo(() => new Map(committedRowsEnsured.map((row) => [row.id, row] as const)), [committedRowsEnsured]);

  const overlappingIds = React.useMemo(() => {
    return detectOverlappingPeriods(committedRowsEnsured);
  }, [committedRowsEnsured]);

  return { ...tafRows, committedRowsEnsured, committedById, overlappingIds };
};

export default useTafRows;
