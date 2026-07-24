import * as React from 'react';
import { TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import StandardLooseTable, { StandardLooseHeaderCell } from './StandardLooseTable';
import { RowDeleteButton } from './RowDeleteButton';
import { GreenfieldGridDateCell, GreenfieldGridIntegerCell } from '../../inputCore/react/fields/greenfieldGridCells';
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
import { useGreenfieldCollectionTable } from './useGreenfieldCollectionTable';
import { useTableSort } from './useTableSort';
import { useRegisterTableSaveOrder } from './useRegisterTableSaveOrder';
import type { TableSaveOrderPath } from '../../utils/tableSaveOrderRegistry';
import { APP_ROUTES } from '../../config/pageNavigation';
import { EO_TAB_KEYS } from '../../config/eoTabKeys';

export type GreenfieldTafPeriodeTableProps = Readonly<{
  committedRows: readonly TafPeriodeRow[];
  derivedById: Readonly<Record<string, number | null>>;
  derivedColumnHeader: string;
  saveOrderPath?: TableSaveOrderPath;
}>;

const createEmptyRow = (id: string): TafPeriodeRow => createEmptyTafCommittedRow(id);
const collection = eoTafPerioderCollection.template as CollectionRef;

const GreenfieldTafPeriodeTable = React.memo(({
  committedRows,
  derivedById,
  derivedColumnHeader,
  saveOrderPath,
}: GreenfieldTafPeriodeTableProps) => {
  const columns = React.useMemo(() => [
    { colId: 'fra', getSortValue: (row: TafPeriodeRow) => row.fra },
    { colId: 'til', getSortValue: (row: TafPeriodeRow) => row.til },
    { colId: 'loseFeriedage', getSortValue: (row: TafPeriodeRow) => row.loseFeriedage },
    { colId: 'beregnet', getSortValue: (row: TafPeriodeRow) => derivedById[row.id] ?? undefined },
  ], [derivedById]);
  const table = useGreenfieldCollectionTable({
    collection,
    committedRows,
    createRowId: createTafRowId,
    createEmptyRow,
    locationPrefix: 'erstatningsopgoerelse.tafPerioder',
    // route + tabKey er eksplicit navigation-metadata (§3.7); TAF-perioderne bor på EO-oplysningerfanen.
    locationNav: { route: APP_ROUTES.erstatningsopgoerelse, tabKey: EO_TAB_KEYS.EO_OPLYSNINGER },
  });
  const { sortedRows, getSortRole, getSortDirection, handleHeaderClick } = useTableSort({
    rows: committedRows,
    getRowId: (row) => row.id,
    isRowEmpty: isTafRowEmpty,
    columns,
    onSortedRowsChange: (next) => table.reorderRows(next.map((row) => row.id)),
  });
  const renderOrder = React.useMemo(() => {
    const existing = new Map(table.renderRows.map((row) => [row.rowId, row]));
    const placeholder = table.renderRows.find((row) => row.kind === 'placeholder');
    return [
      ...sortedRows.map((row) => existing.get(row.id)).filter((row) => row !== undefined),
      ...(placeholder === undefined ? [] : [placeholder]),
    ];
  }, [sortedRows, table.renderRows]);
  useRegisterTableSaveOrder(saveOrderPath, sortedRows.map((row) => row.id));

  return (
    <StandardLooseTable sx={{ width: '720px', tableLayout: 'fixed', mb: 3, '& .MuiTableCell-root': { textAlign: 'center', whiteSpace: 'nowrap' }, '& thead th': { textAlign: 'center' } }}>
      <TableHead><TableRow>
        <StandardLooseHeaderCell sx={{ width: 180 }} onClick={() => handleHeaderClick('fra')} sortRole={getSortRole('fra')} sortDirection={getSortDirection('fra')}>Fra o.m.</StandardLooseHeaderCell>
        <StandardLooseHeaderCell sx={{ width: 180 }} onClick={() => handleHeaderClick('til')} sortRole={getSortRole('til')} sortDirection={getSortDirection('til')}>Til o.m.</StandardLooseHeaderCell>
        <StandardLooseHeaderCell sx={{ width: 180 }} onClick={() => handleHeaderClick('loseFeriedage')} sortRole={getSortRole('loseFeriedage')} sortDirection={getSortDirection('loseFeriedage')}>Løse feriedage</StandardLooseHeaderCell>
        <StandardLooseHeaderCell sx={{ width: 180 }} onClick={() => handleHeaderClick('beregnet')} sortRole={getSortRole('beregnet')} sortDirection={getSortDirection('beregnet')}>{derivedColumnHeader}</StandardLooseHeaderCell>
      </TableRow></TableHead>
      <TableBody>{renderOrder.map((row) => {
        const committed = table.committedById.get(row.rowId);
        const calculated = committed === undefined ? null : (derivedById[committed.id] ?? null);
        return <TableRow key={row.rowId} data-mineo-row-id={row.rowId}>
          <TableCell><GreenfieldGridDateCell gridCell={{ rowId: row.rowId, colIndex: 0 }} cell={table.buildCellSpec(row, eoTafPeriodeFraField, 0)} /></TableCell>
          <TableCell><GreenfieldGridDateCell gridCell={{ rowId: row.rowId, colIndex: 1 }} cell={table.buildCellSpec(row, eoTafPeriodeTilField, 1)} /></TableCell>
          <TableCell><GreenfieldGridIntegerCell gridCell={{ rowId: row.rowId, colIndex: 2 }} cell={table.buildCellSpec(row, eoTafPeriodeLoseFeriedageField, 2)} /></TableCell>
          <TableCell sx={{ position: 'relative', paddingRight: '28px' }}>
            <Typography variant="body1">{calculated === null ? '' : formatAsAmountTrimmed(calculated)}</Typography>
            {committed !== undefined && !isTafRowEmpty(committed) ? <RowDeleteButton onDelete={() => table.removeRow(committed.id)} /> : null}
          </TableCell>
        </TableRow>;
      })}</TableBody>
    </StandardLooseTable>
  );
});

GreenfieldTafPeriodeTable.displayName = 'GreenfieldTafPeriodeTable';
export default GreenfieldTafPeriodeTable;
