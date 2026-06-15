import * as React from 'react';
import type { UseSliceRowDraftsResult } from '../../rowDrafts/useSliceRowDrafts';
import { useSliceRowDrafts } from '../../rowDrafts/useSliceRowDrafts';
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

export type UseTafRowsResult = UseSliceRowDraftsResult<TafDraftRow, TafPeriodeRow, 'fra' | 'til' | 'loseFeriedage'> &
  Readonly<{
    overlappingIds: ReadonlySet<string>;
  }>;

const useTafRows = ({ values, setValues, resyncToken }: UseTafRowsArgs): UseTafRowsResult => {
  const tafRows = useSliceRowDrafts<ErstatningsopgoerelseValues, TafDraftRow, TafPeriodeRow, 'fra' | 'til' | 'loseFeriedage'>({
    values,
    setValues,
    resyncToken,
    getSlice: (v) => v.tafPerioder,
    setSlice: (v, rows) => ({ ...v, tafPerioder: rows }),
    toDraft: committedToTafDraftRows,
    toCommittedRow: (draft) => tafDraftToCommittedRow(draft),
    isRowEmpty: isTafRowEmpty,
    ensureRows: ensureTafRows,
    createId: createTafRowId,
    createEmptyCommittedRow: createEmptyTafCommittedRow,
    // colIndex matcher TAFPeriodeTable: fra=0, til=1, loseFeriedage=2
    fieldColIndex: { fra: 0, til: 1, loseFeriedage: 2 },
  });

  const overlappingIds = React.useMemo(() => {
    return detectOverlappingPeriods(tafRows.committedRowsEnsured);
  }, [tafRows.committedRowsEnsured]);

  return { ...tafRows, overlappingIds };
};

export default useTafRows;
