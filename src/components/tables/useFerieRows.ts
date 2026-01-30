import * as React from 'react';
import type { UseRowDraftsResult } from '../../rowDrafts/useRowDrafts';
import { useRowDrafts } from '../../rowDrafts/useRowDrafts';
import type { ErstatningsopgoerelseValues, FerieperiodeRow } from '../../schemas/formSchemas';
import { isFerieRowEmpty } from '../../domain/erstatningsopgoerelse/rowEmpty';
import type { FerieDraftRow } from '../../domain/erstatningsopgoerelse/tableDraftRows';
import {
  committedToFerieDraftRows,
  createEmptyFerieCommittedRow,
  createTafFerieRowId,
  ensureTafFerieRows,
  ferieDraftToCommittedRow,
} from '../../domain/erstatningsopgoerelse/ferieTableModel';

export type UseFerieRowsArgs = Readonly<{
  values: ErstatningsopgoerelseValues;
  setValues: React.Dispatch<React.SetStateAction<ErstatningsopgoerelseValues>>;
  resyncToken: unknown;
}>;

export type UseFerieRowsResult = UseRowDraftsResult<FerieDraftRow, 'fra' | 'til'> &
  Readonly<{
    committedRowsEnsured: readonly FerieperiodeRow[];
    committedById: ReadonlyMap<string, FerieperiodeRow>;
  }>;

const useFerieRows = ({ values, setValues, resyncToken }: UseFerieRowsArgs): UseFerieRowsResult => {
  const ferieRows = useRowDrafts<FerieDraftRow, FerieperiodeRow, 'fra' | 'til'>({
    getCommitted: () => values.ferieperioder,
    setCommitted: (updater) => {
      setValues((prev) => {
        const nextRows = updater(prev.ferieperioder);
        if (!nextRows) return prev;
        return { ...prev, ferieperioder: nextRows };
      });
    },
    toDraft: committedToFerieDraftRows,
    toCommittedRow: (draft) => ferieDraftToCommittedRow(draft),
    isRowEmpty: isFerieRowEmpty,
    ensureRows: ensureTafFerieRows,
    createId: createTafFerieRowId,
    createEmptyCommittedRow: createEmptyFerieCommittedRow,
    resyncToken,
  });

  const committedRowsEnsured = React.useMemo(() => ensureTafFerieRows(values.ferieperioder), [values.ferieperioder]);
  const committedById = React.useMemo(() => new Map(committedRowsEnsured.map((row) => [row.id, row] as const)), [committedRowsEnsured]);

  return { ...ferieRows, committedRowsEnsured, committedById };
};

export default useFerieRows;

