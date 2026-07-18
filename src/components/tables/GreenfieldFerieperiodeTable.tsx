import * as React from 'react';
import { TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import StandardLooseTable, { StandardLooseHeaderCell } from './StandardLooseTable';
import { RowDeleteButton } from './RowDeleteButton';
import { GreenfieldGridDateCell } from '../../inputCore/react/fields/greenfieldGridCells';
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
import { useGreenfieldCollectionTable } from './useGreenfieldCollectionTable';
import { useRegisterTableSaveOrder } from './useRegisterTableSaveOrder';
import type { TableSaveOrderPath } from '../../utils/tableSaveOrderRegistry';
import { useTableSort } from './useTableSort';

export type GreenfieldFerieperiodeTableProps = Readonly<{
  kind: 'taf' | 'beregningsperiode';
  committedRows: readonly FerieperiodeRow[];
  feriedageById: Readonly<Record<string, number | null>>;
  saveOrderPath?: TableSaveOrderPath;
}>;

const GreenfieldFerieperiodeTable = React.memo(({
  kind,
  committedRows,
  feriedageById,
  saveOrderPath,
}: GreenfieldFerieperiodeTableProps) => {
  const collection = (kind === 'taf' ? eoFerieperioderCollection.template : eoFravaerPerioderCollection.template) as CollectionRef;
  const fraField = kind === 'taf' ? eoFerieperiodeFraField : eoFravaerPeriodeFraField;
  const tilField = kind === 'taf' ? eoFerieperiodeTilField : eoFravaerPeriodeTilField;
  const createRowId = kind === 'taf' ? createTafFerieRowId : createFravaerRowId;
  const createEmptyRow = React.useCallback((id: string) => createEmptyFerieCommittedRow(id), []);
  const table = useGreenfieldCollectionTable({
    collection,
    committedRows,
    createRowId,
    createEmptyRow,
    locationPrefix: kind === 'taf'
      ? 'erstatningsopgoerelse.ferieperioder'
      : 'erstatningsopgoerelse.fravaerPerioder',
  });
  const columns = React.useMemo(() => [
    { colId: 'fra', getSortValue: (row: FerieperiodeRow) => row.fra },
    { colId: 'til', getSortValue: (row: FerieperiodeRow) => row.til },
    { colId: 'feriedage', getSortValue: (row: FerieperiodeRow) => feriedageById[row.id] ?? undefined },
  ], [feriedageById]);
  const sort = useTableSort({
    rows: committedRows,
    getRowId: (row) => row.id,
    isRowEmpty: isFerieRowEmpty,
    columns,
    onSortedRowsChange: (next) => table.reorderRows(next.map((row) => row.id)),
  });
  const renderRows = React.useMemo(() => {
    const byId = new Map(table.renderRows.map((row) => [row.rowId, row]));
    const placeholder = table.renderRows.find((row) => row.kind === 'placeholder');
    return [
      ...sort.sortedRows.map((row) => byId.get(row.id)).filter((row) => row !== undefined),
      ...(placeholder === undefined ? [] : [placeholder]),
    ];
  }, [sort.sortedRows, table.renderRows]);
  useRegisterTableSaveOrder(saveOrderPath, sort.sortedRows.map((row) => row.id));

  return (
    <StandardLooseTable sx={{
      width: '520px', tableLayout: 'fixed', mb: 3,
      '& .MuiTableCell-root': { textAlign: 'center', whiteSpace: 'nowrap' },
      '& thead th': { textAlign: 'center' },
    }}>
      <TableHead>
        <TableRow>
          <StandardLooseHeaderCell sx={{ width: 180 }} onClick={() => sort.handleHeaderClick('fra')} sortRole={sort.getSortRole('fra')} sortDirection={sort.getSortDirection('fra')}>Fra o.m.</StandardLooseHeaderCell>
          <StandardLooseHeaderCell sx={{ width: 180 }} onClick={() => sort.handleHeaderClick('til')} sortRole={sort.getSortRole('til')} sortDirection={sort.getSortDirection('til')}>Til o.m.</StandardLooseHeaderCell>
          <StandardLooseHeaderCell sx={{ width: 160 }} onClick={() => sort.handleHeaderClick('feriedage')} sortRole={sort.getSortRole('feriedage')} sortDirection={sort.getSortDirection('feriedage')}>Feriedage</StandardLooseHeaderCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {renderRows.map((row) => {
          const committed = table.committedById.get(row.rowId);
          return (
            <TableRow key={row.rowId} data-mineo-row-id={row.rowId}>
              <TableCell>
                <GreenfieldGridDateCell
                  gridCell={{ rowId: row.rowId, colIndex: 0 }}
                  cell={table.buildCellSpec(row, fraField, 0)}
                />
              </TableCell>
              <TableCell>
                <GreenfieldGridDateCell
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

GreenfieldFerieperiodeTable.displayName = 'GreenfieldFerieperiodeTable';

export default GreenfieldFerieperiodeTable;
