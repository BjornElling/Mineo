import type { UseSliceRowDraftsResult } from '../../rowDrafts/useSliceRowDrafts';
import { useSliceRowDrafts } from '../../rowDrafts/useSliceRowDrafts';
import type { RenteberegningValues, RentekravRow } from '../../schemas/formSchemas';
import { type SetValuesUpdater } from '../../hooks/usePersistedForm';
import type { RentekravDraftRow } from '../../domain/renteberegning/tableDraftRows';
import { isRentekravRowEmpty } from '../../domain/renteberegning/rowEmpty';
import {
  committedToRentekravDraftRows,
  createEmptyRentekravCommittedRow,
  createRentekravRowId,
  ensureRentekravRows,
  rentekravDraftToCommittedRow,
} from '../../domain/renteberegning/rentekravTableModel';

export type UseRentekravRowsArgs = Readonly<{
  values: RenteberegningValues;
  setValues: SetValuesUpdater<RenteberegningValues>;
  resyncToken: unknown;
}>;

export type UseRentekravRowsResult = UseSliceRowDraftsResult<
  RentekravDraftRow,
  RentekravRow,
  'belob' | 'renterFra' | 'tillaegstid' | 'enhed'
>;

const useRentekravRows = ({ values, setValues, resyncToken }: UseRentekravRowsArgs): UseRentekravRowsResult => {
  return useSliceRowDrafts<RenteberegningValues, RentekravDraftRow, RentekravRow, 'belob' | 'renterFra' | 'tillaegstid' | 'enhed'>({
    values,
    setValues,
    resyncToken,
    getSlice: (v) => v.rentekravRows,
    setSlice: (v, rows) => ({ ...v, rentekravRows: rows }),
    toDraft: committedToRentekravDraftRows,
    toCommittedRow: (draft, prev) => rentekravDraftToCommittedRow(draft, prev),
    isRowEmpty: isRentekravRowEmpty,
    ensureRows: ensureRentekravRows,
    createId: createRentekravRowId,
    createEmptyCommittedRow: createEmptyRentekravCommittedRow,
    // colIndex matcher BeregnetRenteTable: belob=0, renterFra=1, tillaegstid=2, enhed=3
    fieldColIndex: { belob: 0, renterFra: 1, tillaegstid: 2, enhed: 3 },
  });
};

export default useRentekravRows;
