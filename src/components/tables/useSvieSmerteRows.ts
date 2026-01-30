import * as React from 'react';
import type { UseRowDraftsResult } from '../../rowDrafts/useRowDrafts';
import { useRowDrafts } from '../../rowDrafts/useRowDrafts';
import type { ErstatningsopgoerelseValues, SvieSmertePeriodeRow } from '../../schemas/formSchemas';
import { calculateKalenderdageInclusive } from '../../domain/erstatningsopgoerelse/tafCalculations';
import { isSvieSmerteRowEmpty } from '../../domain/erstatningsopgoerelse/rowEmpty';
import type { SvieSmerteDraftRow } from '../../domain/erstatningsopgoerelse/tableDraftRows';
import { committedToSvieDraftRows, createEmptySvieCommittedRow, createSvieRowId, ensureSvieRows, svieDraftToCommittedRow, type SvieSmerteDerived } from '../../domain/erstatningsopgoerelse/svieSmerteTableModel';
import { detectOverlappingPeriods } from '../../domain/erstatningsopgoerelse/periodOverlapDetection';

export type UseSvieSmerteRowsArgs = Readonly<{
  values: ErstatningsopgoerelseValues;
  setValues: React.Dispatch<React.SetStateAction<ErstatningsopgoerelseValues>>;
  resyncToken: unknown;
}>;

export type UseSvieSmerteRowsResult = UseRowDraftsResult<SvieSmerteDraftRow, 'fra' | 'til' | 'tilstand'> &
  Readonly<{
    committedRowsEnsured: readonly SvieSmertePeriodeRow[];
    committedById: ReadonlyMap<string, SvieSmertePeriodeRow>;
    derivedById: Record<string, SvieSmerteDerived>;
    overlappingIds: ReadonlySet<string>;
  }>;

const deriveSvieSmerteById = (rows: readonly SvieSmertePeriodeRow[] | undefined): Record<string, SvieSmerteDerived> => {
  const derived: Record<string, SvieSmerteDerived> = {};
  if (!rows) return derived;

  for (const row of rows) {
    const fra = row.fra;
    const til = row.til;
    const hasRangeError = fra !== undefined && til !== undefined && fra > til;
    const antalDage = hasRangeError ? null : calculateKalenderdageInclusive(fra, til);
    derived[row.id] = { hasRangeError, antalDage };
  }

  return derived;
};

const useSvieSmerteRows = ({ values, setValues, resyncToken }: UseSvieSmerteRowsArgs): UseSvieSmerteRowsResult => {
  const svieRows = useRowDrafts<SvieSmerteDraftRow, SvieSmertePeriodeRow, 'fra' | 'til' | 'tilstand'>({
    getCommitted: () => values.svieSmertePerioder,
    setCommitted: (updater) => {
      setValues((prev) => {
        const nextRows = updater(prev.svieSmertePerioder);
        if (!nextRows) return prev;
        return { ...prev, svieSmertePerioder: nextRows };
      });
    },
    toDraft: committedToSvieDraftRows,
    toCommittedRow: (draft) => svieDraftToCommittedRow(draft),
    isRowEmpty: isSvieSmerteRowEmpty,
    ensureRows: ensureSvieRows,
    createId: createSvieRowId,
    createEmptyCommittedRow: createEmptySvieCommittedRow,
    resyncToken,
  });

  const committedRowsEnsured = React.useMemo(
    () => ensureSvieRows(values.svieSmertePerioder),
    [values.svieSmertePerioder]
  );

  const committedById = React.useMemo(
    () => new Map(committedRowsEnsured.map((row) => [row.id, row] as const)),
    [committedRowsEnsured]
  );

  const derivedById = React.useMemo(() => deriveSvieSmerteById(committedRowsEnsured), [committedRowsEnsured]);

  const overlappingIds = React.useMemo(() => {
    return detectOverlappingPeriods(committedRowsEnsured);
  }, [committedRowsEnsured]);

  return {
    ...svieRows,
    committedRowsEnsured,
    committedById,
    derivedById,
    overlappingIds,
  };
};

export default useSvieSmerteRows;

