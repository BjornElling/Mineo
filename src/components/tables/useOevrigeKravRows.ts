import * as React from 'react';
import type { UseRowDraftsResult } from '../../rowDrafts/useRowDrafts';
import { useRowDrafts } from '../../rowDrafts/useRowDrafts';
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

export type UseOevrigeKravRowsResult = UseRowDraftsResult<OevrigeKravDraftRow, 'dato' | 'udgiftTil' | 'beloeb'> &
  Readonly<{
    committedRowsEnsured: readonly OevrigeKravRow[];
    committedById: ReadonlyMap<string, OevrigeKravRow>;
  }>;

const useOevrigeKravRows = ({ values, setValues, resyncToken }: UseOevrigeKravRowsArgs): UseOevrigeKravRowsResult => {
  const rows = useRowDrafts<OevrigeKravDraftRow, OevrigeKravRow, 'dato' | 'udgiftTil' | 'beloeb'>({
    getCommitted: () => values.oevrigeKravPerioder,
    setCommitted: (updater) => {
      setValues((prev) => {
        const nextRows = updater(prev.oevrigeKravPerioder);
        if (!nextRows) return prev;
        return { ...prev, oevrigeKravPerioder: nextRows };
      });
    },
    toDraft: committedToOevrigeKravDraftRows,
    toCommittedRow: (draft, prev) => oevrigeKravDraftToCommittedRow(draft, prev),
    isRowEmpty: isOevrigeKravRowEmpty,
    ensureRows: ensureOevrigeKravRows,
    createId: createOevrigeKravRowId,
    createEmptyCommittedRow: createEmptyOevrigeKravCommittedRow,
    resyncToken,
  });

  const committedRowsEnsured = React.useMemo(
    () => ensureOevrigeKravRows(values.oevrigeKravPerioder),
    [values.oevrigeKravPerioder]
  );
  const committedById = React.useMemo(() => new Map(committedRowsEnsured.map((row) => [row.id, row] as const)), [committedRowsEnsured]);

  return { ...rows, committedRowsEnsured, committedById };
};

export default useOevrigeKravRows;

