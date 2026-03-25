import * as React from 'react';
import type { UseRowDraftsResult } from '../../rowDrafts/useRowDrafts';
import { useRowDrafts } from '../../rowDrafts/useRowDrafts';
import type { ErstatningsopgoerelseValues, FerieperiodeRow } from '../../schemas/formSchemas';
import { isFerieRowEmpty } from '../../domain/erstatningsopgoerelse/rowEmpty';
import type { FerieDraftRow } from '../../domain/erstatningsopgoerelse/tableDraftRows';
import {
  committedToFerieDraftRows,
  createEmptyFerieCommittedRow,
  createSfggSygeperiodeRowId,
  createTafFerieRowId,
  ensureSfggSygeperioderRows,
  ensureTafFerieRows,
  ferieDraftToCommittedRow,
} from '../../domain/erstatningsopgoerelse/ferieTableModel';

export type UseFerieRowsArgs = Readonly<{
  values: ErstatningsopgoerelseValues;
  setValues: React.Dispatch<React.SetStateAction<ErstatningsopgoerelseValues>>;
  resyncToken: unknown;
  fieldName?: 'ferieperioder' | 'sfggSygeperioderFoer2015';
}>;

export type UseFerieRowsResult = UseRowDraftsResult<FerieDraftRow, 'fra' | 'til'> &
  Readonly<{
    committedRowsEnsured: readonly FerieperiodeRow[];
    committedById: ReadonlyMap<string, FerieperiodeRow>;
  }>;

const useFerieRows = ({ values, setValues, resyncToken, fieldName = 'ferieperioder' }: UseFerieRowsArgs): UseFerieRowsResult => {
  const ensureRows = fieldName === 'sfggSygeperioderFoer2015' ? ensureSfggSygeperioderRows : ensureTafFerieRows;
  const createId = fieldName === 'sfggSygeperioderFoer2015' ? createSfggSygeperiodeRowId : createTafFerieRowId;
  const ferieRows = useRowDrafts<FerieDraftRow, FerieperiodeRow, 'fra' | 'til'>({
    getCommitted: () => values[fieldName],
    setCommitted: (updater) => {
      setValues((prev) => {
        const nextRows = updater(prev[fieldName]);
        if (!nextRows) return prev;
        return { ...prev, [fieldName]: nextRows };
      });
    },
    toDraft: committedToFerieDraftRows,
    toCommittedRow: (draft) => ferieDraftToCommittedRow(draft),
    isRowEmpty: isFerieRowEmpty,
    ensureRows,
    createId,
    createEmptyCommittedRow: createEmptyFerieCommittedRow,
    resyncToken,
  });

  const committedRowsEnsured = React.useMemo(() => ensureRows(values[fieldName]), [ensureRows, fieldName, values]);
  const committedById = React.useMemo(() => new Map(committedRowsEnsured.map((row) => [row.id, row] as const)), [committedRowsEnsured]);

  return { ...ferieRows, committedRowsEnsured, committedById };
};

export default useFerieRows;

