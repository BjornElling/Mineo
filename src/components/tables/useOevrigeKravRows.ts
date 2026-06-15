import type { UseSliceRowDraftsResult } from '../../rowDrafts/useSliceRowDrafts';
import { useSliceRowDrafts } from '../../rowDrafts/useSliceRowDrafts';
import type { ErstatningsopgoerelseValues, OevrigeKravRow } from '../../schemas/formSchemas';
import { type SetValuesUpdater } from '../../hooks/usePersistedForm';
import { isOevrigeKravRowEmpty } from '../../domain/erstatningsopgoerelse/helpers/rowEmpty';
import type { OevrigeKravDraftRow } from '../../domain/erstatningsopgoerelse/tables/tableDraftRows';
import {
  committedToOevrigeKravDraftRows,
  createEmptyOevrigeKravCommittedRow,
  createOevrigeKravRowId,
  ensureOevrigeKravRows,
  oevrigeKravDraftToCommittedRow,
} from '../../domain/erstatningsopgoerelse/tables/oevrigeKravTableModel';

export type UseOevrigeKravRowsArgs = Readonly<{
  values: ErstatningsopgoerelseValues;
  setValues: SetValuesUpdater<ErstatningsopgoerelseValues>;
  resyncToken: unknown;
}>;

export type UseOevrigeKravRowsResult = UseSliceRowDraftsResult<OevrigeKravDraftRow, OevrigeKravRow, 'dato' | 'udgiftTil' | 'beloeb'>;

const useOevrigeKravRows = ({ values, setValues, resyncToken }: UseOevrigeKravRowsArgs): UseOevrigeKravRowsResult => {
  return useSliceRowDrafts<ErstatningsopgoerelseValues, OevrigeKravDraftRow, OevrigeKravRow, 'dato' | 'udgiftTil' | 'beloeb'>({
    values,
    setValues,
    resyncToken,
    getSlice: (v) => v.oevrigeKravPerioder,
    setSlice: (v, rows) => ({ ...v, oevrigeKravPerioder: rows }),
    toDraft: committedToOevrigeKravDraftRows,
    toCommittedRow: (draft, prev) => oevrigeKravDraftToCommittedRow(draft, prev),
    isRowEmpty: isOevrigeKravRowEmpty,
    ensureRows: ensureOevrigeKravRows,
    createId: createOevrigeKravRowId,
    createEmptyCommittedRow: createEmptyOevrigeKravCommittedRow,
    // colIndex matcher OevrigeKravTable: dato=0, udgiftTil=1, beloeb=2
    fieldColIndex: { dato: 0, udgiftTil: 1, beloeb: 2 },
  });
};

export default useOevrigeKravRows;

