import * as React from 'react';
import type { UseRowDraftsResult } from '../../rowDrafts/useRowDrafts';
import { useRowDrafts } from '../../rowDrafts/useRowDrafts';
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
    setCommitted: (updater, origin) => {
      setValues((prev) => {
        const nextRows = updater(prev[fieldName]);
        if (!nextRows) return prev;
        return { ...prev, [fieldName]: nextRows };
      }, origin);
    },
    toDraft: committedToFerieDraftRows,
    toCommittedRow: (draft) => ferieDraftToCommittedRow(draft),
    isRowEmpty: isFerieRowEmpty,
    ensureRows,
    createId,
    createEmptyCommittedRow: createEmptyFerieCommittedRow,
    // colIndex matcher Ferie-/BeregningsperiodeFerieTable: fra=0, til=1
    fieldColIndex: { fra: 0, til: 1 },
    resyncToken,
  });

  const committedRowsEnsured = React.useMemo(() => ensureRows(values[fieldName]), [ensureRows, fieldName, values]);
  const committedById = React.useMemo(() => new Map(committedRowsEnsured.map((row) => [row.id, row] as const)), [committedRowsEnsured]);

  return { ...ferieRows, committedRowsEnsured, committedById };
};

export default useFerieRows;

