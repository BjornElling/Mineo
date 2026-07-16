import type { UseSliceRowDraftsResult } from '../../rowDrafts/useSliceRowDrafts';
import { useSliceRowDrafts } from '../../rowDrafts/useSliceRowDrafts';
import type { ErstatningsopgoerelseValues, FerieperiodeRow } from '../../schemas/formSchemas';
import { type SetValuesUpdater } from '../../hooks/usePersistedForm';
import { isFerieRowEmpty } from '../../domain/erstatningsopgoerelse/helpers/rowEmpty';
import type { FerieDraftRow } from '../../domain/erstatningsopgoerelse/tables/tableDraftRows';
import {
  committedToFerieDraftRows,
  createEmptyFerieCommittedRow,
  createTafFerieRowId,
  ensureTafFerieRows,
  ferieDraftToCommittedRow,
} from '../../domain/erstatningsopgoerelse/tables/ferieTableModel';

export type UseFerieRowsArgs = Readonly<{
  values: ErstatningsopgoerelseValues;
  setValues: SetValuesUpdater<ErstatningsopgoerelseValues>;
  resyncToken: unknown;
}>;

export type UseFerieRowsResult = UseSliceRowDraftsResult<FerieDraftRow, FerieperiodeRow, 'fra' | 'til'>;

const useFerieRows = ({ values, setValues, resyncToken }: UseFerieRowsArgs): UseFerieRowsResult => {
  return useSliceRowDrafts<ErstatningsopgoerelseValues, FerieDraftRow, FerieperiodeRow, 'fra' | 'til'>({
    values,
    setValues,
    resyncToken,
    getSlice: (v) => v.ferieperioder,
    setSlice: (v, rows) => ({ ...v, ferieperioder: rows }),
    toDraft: committedToFerieDraftRows,
    toCommittedRow: (draft) => ferieDraftToCommittedRow(draft),
    isRowEmpty: isFerieRowEmpty,
    ensureRows: ensureTafFerieRows,
    createId: createTafFerieRowId,
    createEmptyCommittedRow: createEmptyFerieCommittedRow,
    // colIndex matcher Ferie-/BeregningsperiodeFerieTable: fra=0, til=1
    fieldColIndex: { fra: 0, til: 1 },
  });
};

export default useFerieRows;
