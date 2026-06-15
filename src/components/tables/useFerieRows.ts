import type { UseSliceRowDraftsResult } from '../../rowDrafts/useSliceRowDrafts';
import { useSliceRowDrafts } from '../../rowDrafts/useSliceRowDrafts';
import type { ErstatningsopgoerelseValues, FerieperiodeRow } from '../../schemas/formSchemas';
import { type SetValuesUpdater } from '../../hooks/usePersistedForm';
import { isFerieRowEmpty } from '../../domain/erstatningsopgoerelse/helpers/rowEmpty';
import type { FerieDraftRow } from '../../domain/erstatningsopgoerelse/tables/tableDraftRows';
import {
  committedToFerieDraftRows,
  createEmptyFerieCommittedRow,
  createSfggSygeperiodeRowId,
  createTafFerieRowId,
  ensureSfggSygeperioderRows,
  ensureTafFerieRows,
  ferieDraftToCommittedRow,
} from '../../domain/erstatningsopgoerelse/tables/ferieTableModel';

export type UseFerieRowsArgs = Readonly<{
  values: ErstatningsopgoerelseValues;
  setValues: SetValuesUpdater<ErstatningsopgoerelseValues>;
  resyncToken: unknown;
  fieldName?: 'ferieperioder' | 'sfggSygeperioderFoer2015';
}>;

export type UseFerieRowsResult = UseSliceRowDraftsResult<FerieDraftRow, FerieperiodeRow, 'fra' | 'til'>;

const useFerieRows = ({ values, setValues, resyncToken, fieldName = 'ferieperioder' }: UseFerieRowsArgs): UseFerieRowsResult => {
  const ensureRows = fieldName === 'sfggSygeperioderFoer2015' ? ensureSfggSygeperioderRows : ensureTafFerieRows;
  const createId = fieldName === 'sfggSygeperioderFoer2015' ? createSfggSygeperiodeRowId : createTafFerieRowId;
  return useSliceRowDrafts<ErstatningsopgoerelseValues, FerieDraftRow, FerieperiodeRow, 'fra' | 'til'>({
    values,
    setValues,
    resyncToken,
    getSlice: (v) => v[fieldName],
    setSlice: (v, rows) => ({ ...v, [fieldName]: rows }),
    toDraft: committedToFerieDraftRows,
    toCommittedRow: (draft) => ferieDraftToCommittedRow(draft),
    isRowEmpty: isFerieRowEmpty,
    ensureRows,
    createId,
    createEmptyCommittedRow: createEmptyFerieCommittedRow,
    // colIndex matcher Ferie-/BeregningsperiodeFerieTable: fra=0, til=1
    fieldColIndex: { fra: 0, til: 1 },
  });
};

export default useFerieRows;

