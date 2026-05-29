import * as React from 'react';
import type { UseRowDraftsResult } from '../../rowDrafts/useRowDrafts';
import { useRowDrafts } from '../../rowDrafts/useRowDrafts';
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

export type UseRentekravRowsResult = UseRowDraftsResult<
  RentekravDraftRow,
  'belob' | 'renterFra' | 'tillaegstid' | 'enhed'
> &
  Readonly<{
    committedRowsEnsured: readonly RentekravRow[];
    committedById: ReadonlyMap<string, RentekravRow>;
  }>;

const useRentekravRows = ({ values, setValues, resyncToken }: UseRentekravRowsArgs): UseRentekravRowsResult => {
  const rows = useRowDrafts<RentekravDraftRow, RentekravRow, 'belob' | 'renterFra' | 'tillaegstid' | 'enhed'>({
    getCommitted: () => values.rentekravRows,
    setCommitted: (updater, origin) => {
      setValues((prev) => {
        const nextRows = updater(prev.rentekravRows);
        if (!nextRows) return prev;
        return { ...prev, rentekravRows: nextRows };
      }, origin);
    },
    toDraft: committedToRentekravDraftRows,
    toCommittedRow: (draft, prev) => rentekravDraftToCommittedRow(draft, prev),
    isRowEmpty: isRentekravRowEmpty,
    ensureRows: ensureRentekravRows,
    createId: createRentekravRowId,
    createEmptyCommittedRow: createEmptyRentekravCommittedRow,
    // colIndex matcher BeregnetRenteTable: belob=0, renterFra=1, tillaegstid=2, enhed=3
    fieldColIndex: { belob: 0, renterFra: 1, tillaegstid: 2, enhed: 3 },
    resyncToken,
  });

  const committedRowsEnsured = React.useMemo(() => ensureRentekravRows(values.rentekravRows), [values.rentekravRows]);
  const committedById = React.useMemo(
    () => new Map(committedRowsEnsured.map((row) => [row.id, row] as const)),
    [committedRowsEnsured]
  );

  return { ...rows, committedRowsEnsured, committedById };
};

export default useRentekravRows;
