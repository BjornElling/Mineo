import type { UseSliceRowDraftsResult } from '../../rowDrafts/useSliceRowDrafts';
import { useSliceRowDrafts } from '../../rowDrafts/useSliceRowDrafts';
import type { ErstatningsopgoerelseValues, FerieperiodeRow } from '../../schemas/formSchemas';
import { type SetValuesUpdater } from '../../hooks/usePersistedForm';
import { isFerieRowEmpty } from '../../domain/erstatningsopgoerelse/helpers/rowEmpty';
import type { FerieDraftRow } from '../../domain/erstatningsopgoerelse/tables/tableDraftRows';
import {
  committedToFerieDraftRows,
  createEmptyFerieCommittedRow,
  createFravaerRowId,
  ensureFravaerRows,
  ferieDraftToCommittedRow,
} from '../../domain/erstatningsopgoerelse/tables/ferieTableModel';

export type UseFravaerRowsArgs = Readonly<{
  values: ErstatningsopgoerelseValues;
  setValues: SetValuesUpdater<ErstatningsopgoerelseValues>;
  resyncToken: unknown;
}>;

export type UseFravaerRowsResult = UseSliceRowDraftsResult<FerieDraftRow, FerieperiodeRow, 'fra' | 'til'>;

const useFravaerRows = ({ values, setValues, resyncToken }: UseFravaerRowsArgs): UseFravaerRowsResult => {
  return useSliceRowDrafts<ErstatningsopgoerelseValues, FerieDraftRow, FerieperiodeRow, 'fra' | 'til'>({
    values,
    setValues,
    resyncToken,
    getSlice: (v) => v.fravaerPerioder,
    setSlice: (v, rows) => ({ ...v, fravaerPerioder: rows }),
    toDraft: committedToFerieDraftRows,
    toCommittedRow: (draft) => ferieDraftToCommittedRow(draft),
    isRowEmpty: isFerieRowEmpty,
    ensureRows: ensureFravaerRows,
    createId: createFravaerRowId,
    createEmptyCommittedRow: createEmptyFerieCommittedRow,
    // colIndex matcher fravær-tabellens fra=0, til=1
    fieldColIndex: { fra: 0, til: 1 },
  });
};

export default useFravaerRows;

