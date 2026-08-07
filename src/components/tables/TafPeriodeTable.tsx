import * as React from 'react';
import { TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import StandardLooseTable, { StandardLooseHeaderCell } from './StandardLooseTable';
import { RowDeleteButton, RowDeleteLaneCell } from './RowDeleteButton';
import { GridDateCell, GridIntegerCell } from '../../inputCore/react/fields/gridCells';
import {
  eoTafPeriodeFraField,
  eoTafPeriodeLoseFeriedageField,
  eoTafPeriodeTilField,
  eoTafPerioderCollection,
} from '../../inputCore/catalog/erstatningsopgoerelseDescriptors';
import type { CollectionRef } from '../../inputCore/fieldAddress';
import type { TafPeriodeRow } from '../../schemas/formSchemas';
import { createEmptyTafCommittedRow, createTafRowId } from '../../domain/erstatningsopgoerelse/tables/tafTableModel';
import { isTafRowEmpty } from '../../domain/erstatningsopgoerelse/helpers/rowEmpty';
import { formatAsAmountTrimmed } from '../../utils/formatUtils';
import { useCollectionTable } from './useCollectionTable';
import { useSortedCollectionTable } from './useSortedCollectionTable';
import type { TableSaveOrderPath } from '../../utils/tableSaveOrderRegistry';
import { APP_ROUTES } from '../../config/pageNavigation';
import { EO_TAB_KEYS } from '../../config/eoTabKeys';

export type TafPeriodeTableProps = Readonly<{
  committedRows: readonly TafPeriodeRow[];
  derivedById: Readonly<Record<string, number | null>>;
  derivedColumnHeader: string;
  saveOrderPath?: TableSaveOrderPath;
}>;

const createEmptyRow = (id: string): TafPeriodeRow => createEmptyTafCommittedRow(id);
const collection = eoTafPerioderCollection.template as CollectionRef;

const TafPeriodeTable = React.memo(({
  committedRows,
  derivedById,
  derivedColumnHeader,
  saveOrderPath,
}: TafPeriodeTableProps) => {
  const columns = React.useMemo(() => [
    { colId: 'fra', getSortValue: (row: TafPeriodeRow) => row.fra },
    { colId: 'til', getSortValue: (row: TafPeriodeRow) => row.til },
    { colId: 'loseFeriedage', getSortValue: (row: TafPeriodeRow) => row.loseFeriedage },
    { colId: 'beregnet', getSortValue: (row: TafPeriodeRow) => derivedById[row.id] ?? undefined },
  ], [derivedById]);
  const table = useCollectionTable({
    collection,
    committedRows,
    createRowId: createTafRowId,
    createEmptyRow,
    locationPrefix: 'erstatningsopgoerelse.tafPerioder',
    // route + tabKey er eksplicit navigation-metadata (§3.7); TAF-perioderne bor på EO-oplysningerfanen.
    locationNav: { route: APP_ROUTES.erstatningsopgoerelse, tabKey: EO_TAB_KEYS.EO_OPLYSNINGER },
  });
  const { sortedRows, sortableHeader } = useSortedCollectionTable({
    committedRows,
    getRowId: (row) => row.id,
    isRowEmpty: isTafRowEmpty,
    columns,
    reorderRows: table.reorderRows,
    saveOrderPath,
  });
  const renderOrder = table.buildRenderRows(sortedRows);

  return (
    <StandardLooseTable sx={{ width: '720px', tableLayout: 'fixed', mb: 3, '& .MuiTableCell-root': { textAlign: 'center', whiteSpace: 'nowrap' }, '& thead th': { textAlign: 'center' } }}>
      <TableHead><TableRow>
        <StandardLooseHeaderCell sx={{ width: 180 }} {...sortableHeader('fra')}>Fra o.m.</StandardLooseHeaderCell>
        <StandardLooseHeaderCell sx={{ width: 180 }} {...sortableHeader('til')}>Til o.m.</StandardLooseHeaderCell>
        <StandardLooseHeaderCell sx={{ width: 180 }} {...sortableHeader('loseFeriedage')}>Løse feriedage</StandardLooseHeaderCell>
        <StandardLooseHeaderCell sx={{ width: 180 }} {...sortableHeader('beregnet')}>{derivedColumnHeader}</StandardLooseHeaderCell>
      </TableRow></TableHead>
      <TableBody>{renderOrder.map((row) => {
        const committed = table.committedById.get(row.rowId);
        const calculated = committed === undefined ? null : (derivedById[committed.id] ?? null);
        return <TableRow key={row.rowId} data-mineo-row-id={row.rowId}>
          <TableCell><GridDateCell gridCell={{ rowId: row.rowId, colIndex: 0 }} cell={table.buildCellSpec(row, eoTafPeriodeFraField, 0)} /></TableCell>
          <TableCell><GridDateCell gridCell={{ rowId: row.rowId, colIndex: 1 }} cell={table.buildCellSpec(row, eoTafPeriodeTilField, 1)} /></TableCell>
          <TableCell><GridIntegerCell gridCell={{ rowId: row.rowId, colIndex: 2 }} cell={table.buildCellSpec(row, eoTafPeriodeLoseFeriedageField, 2)} /></TableCell>
          <RowDeleteLaneCell>
            <Typography variant="body1">{calculated === null ? '' : formatAsAmountTrimmed(calculated)}</Typography>
            {committed !== undefined && !isTafRowEmpty(committed) ? <RowDeleteButton onDelete={() => table.removeRow(committed.id)} /> : null}
          </RowDeleteLaneCell>
        </TableRow>;
      })}</TableBody>
    </StandardLooseTable>
  );
});

TafPeriodeTable.displayName = 'TafPeriodeTable';
export default TafPeriodeTable;
