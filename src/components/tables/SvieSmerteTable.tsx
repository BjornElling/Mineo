import * as React from 'react';
import { MenuItem, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import StandardLooseTable, { StandardLooseHeaderCell } from './StandardLooseTable';
import { RowDeleteButton } from './RowDeleteButton';
import { GridDateCell } from '../../inputCore/react/fields/gridCells';
import GridChoiceCell from '../../inputCore/react/fields/GridChoiceCell';
import {
  eoSvieSmertePeriodeFraField,
  eoSvieSmertePeriodeTilField,
  eoSvieSmertePeriodeTilstandField,
  eoSvieSmertePerioderCollection,
} from '../../inputCore/catalog/erstatningsopgoerelseDescriptors';
import type { CollectionRef } from '../../inputCore/fieldAddress';
import type { SvieSmertePeriodeRow } from '../../schemas/formSchemas';
import { createEmptySvieCommittedRow, createSvieRowId } from '../../domain/erstatningsopgoerelse/tables/svieSmerteTableModel';
import { isSvieSmerteRowEmpty } from '../../domain/erstatningsopgoerelse/helpers/rowEmpty';
import { useCollectionTable } from './useCollectionTable';
import { useTableSort } from './useTableSort';
import { useRegisterTableSaveOrder } from './useRegisterTableSaveOrder';
import type { TableSaveOrderPath } from '../../utils/tableSaveOrderRegistry';
import { APP_ROUTES } from '../../config/pageNavigation';
import { EO_TAB_KEYS } from '../../config/eoTabKeys';

type SvieSmerteDerived = Readonly<{ hasRangeError: boolean; antalDage: number | null }>;

export type SvieSmerteTableProps = Readonly<{
  committedRows: readonly SvieSmertePeriodeRow[];
  derivedById: Readonly<Record<string, SvieSmerteDerived>>;
  saveOrderPath?: TableSaveOrderPath;
}>;

const createEmptyRow = (id: string): SvieSmertePeriodeRow => createEmptySvieCommittedRow(id);
const collection = eoSvieSmertePerioderCollection.template as CollectionRef;

const SvieSmerteTable = React.memo(({ committedRows, derivedById, saveOrderPath }: SvieSmerteTableProps) => {
  const table = useCollectionTable({
    collection,
    committedRows,
    createRowId: createSvieRowId,
    createEmptyRow,
    locationPrefix: 'erstatningsopgoerelse.svieSmertePerioder',
    // route + tabKey er eksplicit navigation-metadata (§3.7); svie/smerte-perioderne bor på EO-oplysningerfanen.
    locationNav: { route: APP_ROUTES.erstatningsopgoerelse, tabKey: EO_TAB_KEYS.EO_OPLYSNINGER },
  });
  const columns = React.useMemo(() => [
    { colId: 'fra', getSortValue: (row: SvieSmertePeriodeRow) => row.fra },
    { colId: 'til', getSortValue: (row: SvieSmertePeriodeRow) => row.til },
    { colId: 'antalDage', getSortValue: (row: SvieSmertePeriodeRow) => derivedById[row.id]?.antalDage ?? undefined },
    { colId: 'tilstand', getSortValue: (row: SvieSmertePeriodeRow) => row.tilstand },
  ], [derivedById]);
  const { sortedRows, getSortRole, getSortDirection, handleHeaderClick } = useTableSort({
    rows: committedRows,
    getRowId: (row) => row.id,
    isRowEmpty: isSvieSmerteRowEmpty,
    columns,
    onSortedRowsChange: (next) => table.reorderRows(next.map((row) => row.id)),
  });
  const renderRows = React.useMemo(() => {
    const byId = new Map(table.renderRows.map((row) => [row.rowId, row]));
    const placeholder = table.renderRows.find((row) => row.kind === 'placeholder');
    return [
      ...sortedRows.map((row) => byId.get(row.id)).filter((row) => row !== undefined),
      ...(placeholder === undefined ? [] : [placeholder]),
    ];
  }, [sortedRows, table.renderRows]);
  useRegisterTableSaveOrder(saveOrderPath, sortedRows.map((row) => row.id));

  return (
    <StandardLooseTable sx={{ width: '760px', tableLayout: 'fixed', mb: 3, '& .MuiTableCell-root': { textAlign: 'center', whiteSpace: 'nowrap' }, '& thead th': { textAlign: 'center' } }}>
      <TableHead><TableRow>
        <StandardLooseHeaderCell sx={{ width: 180 }} onClick={() => handleHeaderClick('fra')} sortRole={getSortRole('fra')} sortDirection={getSortDirection('fra')}>Fra o.m.</StandardLooseHeaderCell>
        <StandardLooseHeaderCell sx={{ width: 180 }} onClick={() => handleHeaderClick('til')} sortRole={getSortRole('til')} sortDirection={getSortDirection('til')}>Til o.m.</StandardLooseHeaderCell>
        <StandardLooseHeaderCell sx={{ width: 100 }} onClick={() => handleHeaderClick('antalDage')} sortRole={getSortRole('antalDage')} sortDirection={getSortDirection('antalDage')}>Antal dage</StandardLooseHeaderCell>
        <StandardLooseHeaderCell sx={{ width: 220 }} onClick={() => handleHeaderClick('tilstand')} sortRole={getSortRole('tilstand')} sortDirection={getSortDirection('tilstand')}>Tilstand</StandardLooseHeaderCell>
      </TableRow></TableHead>
      <TableBody>{renderRows.map((row) => {
        const committed = table.committedById.get(row.rowId);
        return <TableRow key={row.rowId} data-mineo-row-id={row.rowId}>
          <TableCell><GridDateCell gridCell={{ rowId: row.rowId, colIndex: 0 }} cell={table.buildCellSpec(row, eoSvieSmertePeriodeFraField, 0)} /></TableCell>
          <TableCell><GridDateCell gridCell={{ rowId: row.rowId, colIndex: 1 }} cell={table.buildCellSpec(row, eoSvieSmertePeriodeTilField, 1)} /></TableCell>
          <TableCell><Typography variant="body1">{committed === undefined ? '' : (derivedById[committed.id]?.antalDage ?? '')}</Typography></TableCell>
          <TableCell sx={{ position: 'relative', paddingRight: '28px' }}>
            <GridChoiceCell
              gridCell={{ rowId: row.rowId, colIndex: 3 }}
              cell={table.buildCellSpec(row, eoSvieSmertePeriodeTilstandField, 3)}
              placeholder="Vælg tilstand"
            >
              <MenuItem value="sygemeldt">Sygemeldt</MenuItem>
              <MenuItem value="delvist-sygemeldt">Delvist Sygemeldt</MenuItem>
            </GridChoiceCell>
            {committed !== undefined && !isSvieSmerteRowEmpty(committed) ? <RowDeleteButton onDelete={() => table.removeRow(committed.id)} /> : null}
          </TableCell>
        </TableRow>;
      })}</TableBody>
    </StandardLooseTable>
  );
});

SvieSmerteTable.displayName = 'SvieSmerteTable';
export default SvieSmerteTable;
