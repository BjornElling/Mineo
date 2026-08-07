import * as React from 'react';
import { TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import StandardLooseTable, { StandardLooseHeaderCell } from './StandardLooseTable';
import { RowDeleteButton } from './RowDeleteButton';
import { GridDateCell } from '../../inputCore/react/fields/gridCells';
import {
  eoFerieperiodeFraField,
  eoFerieperiodeTilField,
  eoFerieperioderCollection,
  eoFravaerPeriodeFraField,
  eoFravaerPeriodeTilField,
  eoFravaerPerioderCollection,
} from '../../inputCore/catalog/erstatningsopgoerelseDescriptors';
import type { CollectionRef } from '../../inputCore/fieldAddress';
import type { FerieperiodeRow } from '../../schemas/formSchemas';
import { createEmptyFerieCommittedRow, createFravaerRowId, createTafFerieRowId } from '../../domain/erstatningsopgoerelse/tables/ferieTableModel';
import { isFerieRowEmpty } from '../../domain/erstatningsopgoerelse/helpers/rowEmpty';
import { useCollectionTable } from './useCollectionTable';
import type { TableSaveOrderPath } from '../../utils/tableSaveOrderRegistry';
import { useSortedCollectionTable } from './useSortedCollectionTable';
import { APP_ROUTES } from '../../config/pageNavigation';
import { EO_TAB_KEYS } from '../../config/eoTabKeys';

export type FerieperiodeTableProps = Readonly<{
  kind: 'taf' | 'beregningsperiode';
  committedRows: readonly FerieperiodeRow[];
  feriedageById: Readonly<Record<string, number | null>>;
  saveOrderPath?: TableSaveOrderPath;
}>;

const FerieperiodeTable = React.memo(({
  kind,
  committedRows,
  feriedageById,
  saveOrderPath,
}: FerieperiodeTableProps) => {
  const collection = (kind === 'taf' ? eoFerieperioderCollection.template : eoFravaerPerioderCollection.template) as CollectionRef;
  const fraField = kind === 'taf' ? eoFerieperiodeFraField : eoFravaerPeriodeFraField;
  const tilField = kind === 'taf' ? eoFerieperiodeTilField : eoFravaerPeriodeTilField;
  const createRowId = kind === 'taf' ? createTafFerieRowId : createFravaerRowId;
  const createEmptyRow = React.useCallback((id: string) => createEmptyFerieCommittedRow(id), []);
  const table = useCollectionTable({
    collection,
    committedRows,
    createRowId,
    createEmptyRow,
    locationPrefix: kind === 'taf'
      ? 'erstatningsopgoerelse.ferieperioder'
      : 'erstatningsopgoerelse.fravaerPerioder',
    // route + tabKey er eksplicit navigation-metadata (§3.7); begge render-steder (TAF- og
    // beregningsperiode-varianten) bor på EO-oplysningerfanen.
    locationNav: { route: APP_ROUTES.erstatningsopgoerelse, tabKey: EO_TAB_KEYS.EO_OPLYSNINGER },
  });
  const columns = React.useMemo(() => [
    { colId: 'fra', getSortValue: (row: FerieperiodeRow) => row.fra },
    { colId: 'til', getSortValue: (row: FerieperiodeRow) => row.til },
    { colId: 'feriedage', getSortValue: (row: FerieperiodeRow) => feriedageById[row.id] ?? undefined },
  ], [feriedageById]);
  const { renderRows, sortableHeader } = useSortedCollectionTable({
    committedRows,
    renderRows: table.renderRows,
    getRowId: (row) => row.id,
    isRowEmpty: isFerieRowEmpty,
    columns,
    reorderRows: table.reorderRows,
    saveOrderPath,
  });

  return (
    <StandardLooseTable sx={{
      width: '520px', tableLayout: 'fixed', mb: 3,
      '& .MuiTableCell-root': { textAlign: 'center', whiteSpace: 'nowrap' },
      '& thead th': { textAlign: 'center' },
    }}>
      <TableHead>
        <TableRow>
          <StandardLooseHeaderCell sx={{ width: 180 }} {...sortableHeader('fra')}>Fra o.m.</StandardLooseHeaderCell>
          <StandardLooseHeaderCell sx={{ width: 180 }} {...sortableHeader('til')}>Til o.m.</StandardLooseHeaderCell>
          <StandardLooseHeaderCell sx={{ width: 160 }} {...sortableHeader('feriedage')}>Feriedage</StandardLooseHeaderCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {renderRows.map((row) => {
          const committed = table.committedById.get(row.rowId);
          return (
            <TableRow key={row.rowId} data-mineo-row-id={row.rowId}>
              <TableCell>
                <GridDateCell
                  gridCell={{ rowId: row.rowId, colIndex: 0 }}
                  cell={table.buildCellSpec(row, fraField, 0)}
                />
              </TableCell>
              <TableCell>
                <GridDateCell
                  gridCell={{ rowId: row.rowId, colIndex: 1 }}
                  cell={table.buildCellSpec(row, tilField, 1)}
                />
              </TableCell>
              <TableCell sx={{ position: 'relative', paddingRight: '28px' }}>
                <Typography variant="body1" sx={{ textAlign: 'center', py: 0.5 }}>
                  {committed === undefined ? '' : (feriedageById[committed.id] ?? '')}
                </Typography>
                {committed !== undefined && !isFerieRowEmpty(committed) ? (
                  <RowDeleteButton onDelete={() => table.removeRow(committed.id)} />
                ) : null}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </StandardLooseTable>
  );
});

FerieperiodeTable.displayName = 'FerieperiodeTable';

export default FerieperiodeTable;
