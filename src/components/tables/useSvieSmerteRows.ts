import * as React from 'react';
import type { UseSliceRowDraftsResult } from '../../rowDrafts/useSliceRowDrafts';
import { useSliceRowDrafts } from '../../rowDrafts/useSliceRowDrafts';
import type { ErstatningsopgoerelseValues, SvieSmertePeriodeRow } from '../../schemas/formSchemas';
import { type SetValuesUpdater } from '../../hooks/usePersistedForm';
import { calculateKalenderdageInclusive } from '../../domain/erstatningsopgoerelse/engines/tafCalculations';
import { isSvieSmerteRowEmpty } from '../../domain/erstatningsopgoerelse/helpers/rowEmpty';
import type { SvieSmerteDraftRow } from '../../domain/erstatningsopgoerelse/tables/tableDraftRows';
import { committedToSvieDraftRows, createEmptySvieCommittedRow, createSvieRowId, ensureSvieRows, svieDraftToCommittedRow, type SvieSmerteDerived } from '../../domain/erstatningsopgoerelse/tables/svieSmerteTableModel';
import { detectOverlappingPeriods } from '../../domain/erstatningsopgoerelse/engines/periodOverlapDetection';

export type UseSvieSmerteRowsArgs = Readonly<{
  values: ErstatningsopgoerelseValues;
  setValues: SetValuesUpdater<ErstatningsopgoerelseValues>;
  resyncToken: unknown;
}>;

export type UseSvieSmerteRowsResult = UseSliceRowDraftsResult<SvieSmerteDraftRow, SvieSmertePeriodeRow, 'fra' | 'til' | 'tilstand'> &
  Readonly<{
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
  const svieRows = useSliceRowDrafts<ErstatningsopgoerelseValues, SvieSmerteDraftRow, SvieSmertePeriodeRow, 'fra' | 'til' | 'tilstand'>({
    values,
    setValues,
    resyncToken,
    getSlice: (v) => v.svieSmertePerioder,
    setSlice: (v, rows) => ({ ...v, svieSmertePerioder: rows }),
    toDraft: committedToSvieDraftRows,
    toCommittedRow: (draft) => svieDraftToCommittedRow(draft),
    isRowEmpty: isSvieSmerteRowEmpty,
    ensureRows: ensureSvieRows,
    createId: createSvieRowId,
    createEmptyCommittedRow: createEmptySvieCommittedRow,
    // colIndex matcher SvieSmerteTable: fra=0, til=1, tilstand=3 (colIndex 2 er ikke-redigerbar)
    fieldColIndex: { fra: 0, til: 1, tilstand: 3 },
  });

  const { committedRowsEnsured } = svieRows;

  const derivedById = React.useMemo(() => deriveSvieSmerteById(committedRowsEnsured), [committedRowsEnsured]);

  // Alle overlap (også samme tilstand) afvises — validator og svieSmerteEngine afviser
  // ethvert overlap (svieSmerteEngine returnerer null ved overlap.size > 0). Tabellen skal
  // derfor markere ethvert overlap rødt, så fejlen er synlig FØR brugeren forsøger at gemme.
  const overlappingIds = React.useMemo(
    () => detectOverlappingPeriods(committedRowsEnsured),
    [committedRowsEnsured]
  );

  return {
    ...svieRows,
    derivedById,
    overlappingIds,
  };
};

export default useSvieSmerteRows;
