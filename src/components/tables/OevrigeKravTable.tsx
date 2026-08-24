import * as React from 'react';
import { TableBody, TableCell, TableHead, TableRow } from '@mui/material';
import StandardLooseTable, { StandardLooseHeaderCell } from './StandardLooseTable';
import { RowDeleteButton, RowDeleteLaneCell } from './RowDeleteButton';
import { useCollectionTable } from './useCollectionTable';
import { useSortedCollectionTable } from './useSortedCollectionTable';
import type { TableSaveOrderPath } from '../../utils/tableSaveOrderRegistry';
import type { OevrigeKravRow } from '../../schemas/formSchemas';
import type { ISODateString } from '../../types/branded';
import type { AmountValue } from '../../schemas/amountExpressionSchema';
import { amountValueToNumber } from '../../utils/expressionAmount';
import { APP_ROUTES } from '../../config/pageNavigation';
import { EO_TAB_KEYS } from '../../config/eoTabKeys';
import {
  createEmptyOevrigeKravCommittedRow,
  createOevrigeKravRowId,
} from '../../domain/erstatningsopgoerelse/tables/oevrigeKravTableModel';
import type { CellSpec } from '../../inputCore/react/useCellEditor';
import type { FieldDescriptor } from '../../inputCore/fieldDescriptor';
import {
  collectionLocationPrefix,
  type CollectionRenderRow as RenderRow,
} from '../../inputCore/react/cellSpecBuilder';
import {
  GridAmountCell,
  GridDateCell,
} from '../../inputCore/react/fields/gridCells';
import GridTextCell from '../../inputCore/react/fields/GridTextCell';
import {
  eoOevrigeKravBeloebField,
  eoOevrigeKravDatoField,
  eoOevrigeKravPerioderCollection,
  eoOevrigeKravUdgiftTilField,
} from '../../inputCore/catalog/erstatningsopgoerelseDescriptors';
import type { CollectionRef } from '../../inputCore/fieldAddress';

// Øvrige krav-tabel: Rækkeinfrastruktur, celleværdier og celle-
// redigering går udelukkende gennem inputCore, som BeregnetRenteTable/StandardLoenTable:
//  - `useCollectionRows(eoOevrigeKravPerioderCollection)` ejer rækkernes id'er + insert/delete/reorder (§3.8) –
//    ingen draftkopi, fingerprint, invalidDrafts-reconcile eller persistence-effect.
//  - hver celle er en `Grid*Cell` over `useCellEditor`. Datoens dynamiske grænser er nu en descriptor-
//    bounds-validator (§1.6), så cellen selv viser den røde fejl – ingen minDate/maxDate/specialRangeErrors-props.
//  - en trailing PLACEHOLDER-række promoverer atomisk ved første ikke-tomme settle (§1.11).
// De committede rækker læses reader-afledt af forælderen, så der ikke er en konkurrerende celle-værdikopi (§3.8).

const collectionRef: CollectionRef = eoOevrigeKravPerioderCollection.template as CollectionRef;

// Kolonneindeks (matcher grid-core-koordinaten `{ rowId, colIndex }`): dato=0, udgiftTil=1, beloeb=2.
const COL = { dato: 0, udgiftTil: 1, beloeb: 2 } as const;

export type OevrigeKravTableProps = Readonly<{
  /** De committede rækker (læst reader-afledt af forælderen), i den afsluttede rækkefølge. */
  committedRows: readonly OevrigeKravRow[];
  saveOrderPath?: TableSaveOrderPath;
}>;


type OevrigeKravRowProps = Readonly<{
  renderRow: RenderRow;
  committed: OevrigeKravRow | undefined;
  rowHasSettledInput: boolean;
  onDeleteRow: (rowId: string) => void;
  buildCellSpec: <T>(renderRow: RenderRow, descriptor: FieldDescriptor<T>, colIdx: number) => CellSpec<T, OevrigeKravRow>;
}>;

const OevrigeKravTableRow = React.memo(({ renderRow, committed, rowHasSettledInput, onDeleteRow, buildCellSpec }: OevrigeKravRowProps) => {
  const rowId = renderRow.rowId;
  const gc = (colIndex: number) => ({ rowId, colIndex });
  const showDelete = renderRow.kind === 'existing' && committed !== undefined && rowHasSettledInput;

  return (
    <TableRow data-mineo-row-id={rowId}>
      <TableCell>
        <GridDateCell
          gridCell={gc(COL.dato)}
          cell={buildCellSpec<ISODateString | undefined>(renderRow, eoOevrigeKravDatoField, COL.dato)}
        />
      </TableCell>
      <TableCell>
        <GridTextCell<string>
          gridCell={gc(COL.udgiftTil)}
          cell={buildCellSpec<string>(renderRow, eoOevrigeKravUdgiftTilField, COL.udgiftTil)}
          sx={{ width: 400 }}
        />
      </TableCell>
      <RowDeleteLaneCell>
        <GridAmountCell
          gridCell={gc(COL.beloeb)}
          cell={buildCellSpec<AmountValue | undefined>(renderRow, eoOevrigeKravBeloebField, COL.beloeb)}
        />
        {showDelete && <RowDeleteButton onDelete={() => onDeleteRow(rowId)} />}
      </RowDeleteLaneCell>
    </TableRow>
  );
});

OevrigeKravTableRow.displayName = 'OevrigeKravTableRow';

const OevrigeKravTable = React.memo(({ committedRows, saveOrderPath }: OevrigeKravTableProps) => {
  const table = useCollectionTable<OevrigeKravRow>({
    collection: collectionRef,
    committedRows,
    createRowId: createOevrigeKravRowId,
    createEmptyRow: createEmptyOevrigeKravCommittedRow,
    locationPrefix: collectionLocationPrefix(collectionRef),
    locationNav: { route: APP_ROUTES.erstatningsopgoerelse, tabKey: EO_TAB_KEYS.EO_OPLYSNINGER },
  });

  const sortColumns = React.useMemo(() => [
    { colId: 'dato', getSortValue: (row: OevrigeKravRow) => row.dato },
    { colId: 'udgiftTil', getSortValue: (row: OevrigeKravRow) => row.udgiftTil },
    { colId: 'beloeb', getSortValue: (row: OevrigeKravRow) => amountValueToNumber(row.beloeb) },
  ], []);

  const { sortedRows, sortableHeader } = useSortedCollectionTable({
    committedRows,
    getRowId: (row) => row.id,
    isRowEmpty: (row) => table.isRowEmpty(row.id),
    columns: sortColumns,
    reorderRows: table.reorderRows,
    saveOrderPath,
  });

  const renderRows = table.buildRenderRows(sortedRows);
  const { committedById, buildCellSpec } = table;

  return (
    <StandardLooseTable
      sx={{
        width: '640px',
        tableLayout: 'fixed',
        mb: 3,
        '& .MuiTableCell-root': { textAlign: 'center', whiteSpace: 'nowrap' },
        '& thead th': { textAlign: 'center' },
      }}
    >
      <TableHead>
        <TableRow>
          <StandardLooseHeaderCell sx={{ width: 180 }} {...sortableHeader('dato')}>Dato</StandardLooseHeaderCell>
          <StandardLooseHeaderCell sx={{ width: 500 }} {...sortableHeader('udgiftTil')}>Udgift til</StandardLooseHeaderCell>
          <StandardLooseHeaderCell sx={{ width: 160 }} {...sortableHeader('beloeb')}>Beløb</StandardLooseHeaderCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {renderRows.map((renderRow) => (
          <OevrigeKravTableRow
            key={renderRow.rowId}
            renderRow={renderRow}
            committed={committedById.get(renderRow.rowId)}
            rowHasSettledInput={!table.isRowEmpty(renderRow.rowId)}
            onDeleteRow={table.removeRow}
            buildCellSpec={buildCellSpec}
          />
        ))}
      </TableBody>
    </StandardLooseTable>
  );
});

OevrigeKravTable.displayName = 'OevrigeKravTable';

export default OevrigeKravTable;
