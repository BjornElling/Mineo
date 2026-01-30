import * as React from 'react';
import type { UseRowDraftsResult } from '../../rowDrafts/useRowDrafts';
import { useRowDrafts } from '../../rowDrafts/useRowDrafts';
import type { ErstatningsopgoerelseValues, FerieperiodeRow } from '../../schemas/formSchemas';
import { isFerieRowEmpty } from '../../domain/erstatningsopgoerelse/rowEmpty';
import type { FerieDraftRow } from '../../domain/erstatningsopgoerelse/tableDraftRows';
import {
  committedToFerieDraftRows,
  createEmptyFerieCommittedRow,
  createFravaerRowId,
  ensureFravaerRows,
  ferieDraftToCommittedRow,
} from '../../domain/erstatningsopgoerelse/ferieTableModel';

export type UseFravaerRowsArgs = Readonly<{
  values: ErstatningsopgoerelseValues;
  setValues: React.Dispatch<React.SetStateAction<ErstatningsopgoerelseValues>>;
  resyncToken: unknown;
}>;

export type UseFravaerRowsResult = UseRowDraftsResult<FerieDraftRow, 'fra' | 'til'> &
  Readonly<{
    committedRowsEnsured: readonly FerieperiodeRow[];
    committedById: ReadonlyMap<string, FerieperiodeRow>;
  }>;

const useFravaerRows = ({ values, setValues, resyncToken }: UseFravaerRowsArgs): UseFravaerRowsResult => {
  const fravaerRows = useRowDrafts<FerieDraftRow, FerieperiodeRow, 'fra' | 'til'>({
    getCommitted: () => values.fravaerPerioder,
    setCommitted: (updater) => {
      setValues((prev) => {
        const nextRows = updater(prev.fravaerPerioder);
        if (!nextRows) return prev;
        return { ...prev, fravaerPerioder: nextRows };
      });
    },
    toDraft: committedToFerieDraftRows,
    toCommittedRow: (draft) => ferieDraftToCommittedRow(draft),
    isRowEmpty: isFerieRowEmpty,
    ensureRows: ensureFravaerRows,
    createId: createFravaerRowId,
    createEmptyCommittedRow: createEmptyFerieCommittedRow,
    resyncToken,
  });

  const committedRowsEnsured = React.useMemo(() => ensureFravaerRows(values.fravaerPerioder), [values.fravaerPerioder]);
  const committedById = React.useMemo(() => new Map(committedRowsEnsured.map((row) => [row.id, row] as const)), [committedRowsEnsured]);

  return { ...fravaerRows, committedRowsEnsured, committedById };
};

export default useFravaerRows;

