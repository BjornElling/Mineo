import * as React from 'react';
import { TableBody, TableCell, TableHead, TableRow } from '@mui/material';
import StandardLooseTable, { StandardLooseHeaderCell } from './StandardLooseTable';
import { RowDeleteButton } from './RowDeleteButton';
import { useTableSort } from './useTableSort';
import { useRegisterTableSaveOrder } from './useRegisterTableSaveOrder';
import type { TableSaveOrderPath } from '../../utils/tableSaveOrderRegistry';
import type { OevrigeKravRow } from '../../schemas/formSchemas';
import type { ISODateString } from '../../types/branded';
import type { AmountValue } from '../../schemas/amountExpressionSchema';
import { amountValueToNumber } from '../../utils/expressionAmount';
import { isOevrigeKravRowEmpty } from '../../domain/erstatningsopgoerelse/helpers/rowEmpty';
import { APP_ROUTES } from '../../config/pageNavigation';
import { EO_TAB_KEYS } from '../../config/eoTabKeys';
import {
  createEmptyOevrigeKravCommittedRow,
  createOevrigeKravRowId,
} from '../../domain/erstatningsopgoerelse/tables/oevrigeKravTableModel';
import { useCollectionRows } from '../../inputCore/react';
import type { CellSpec } from '../../inputCore/react/useCellEditor';
import type { FieldDescriptor, FieldRef } from '../../inputCore/fieldDescriptor';
import {
  GreenfieldGridAmountCell,
  GreenfieldGridDateCell,
} from '../../inputCore/react/fields/greenfieldGridCells';
import GreenfieldGridTextCell from '../../inputCore/react/fields/GreenfieldGridTextCell';
import {
  eoOevrigeKravBeloebField,
  eoOevrigeKravDatoField,
  eoOevrigeKravPerioderCollection,
  eoOevrigeKravUdgiftTilField,
} from '../../inputCore/catalog/erstatningsopgoerelseDescriptors';
import type { CollectionRef } from '../../inputCore/fieldAddress';

// Greenfield-migreret Øvrige krav-tabel (§2.5 trin 9, EO-slice). Rækkeinfrastruktur, celleværdier og celle-
// redigering går udelukkende gennem greenfield-inputCore, som BeregnetRenteTable/StandardLoenTable:
//  - `useCollectionRows(eoOevrigeKravPerioderCollection)` ejer rækkernes id'er + insert/delete/reorder (§3.8) —
//    ingen draftkopi, fingerprint, invalidDrafts-reconcile eller persistence-effect.
//  - hver celle er en `GreenfieldGrid*Cell` over `useCellEditor`. Datoens dynamiske grænser er nu en descriptor-
//    bounds-validator (§1.6), så cellen selv viser den røde fejl — ingen minDate/maxDate/specialRangeErrors-props.
//  - en trailing PLACEHOLDER-række promoverer atomisk ved første ikke-tomme settle (§1.11).
// De committede rækker læses reader-afledt af forælderen, så der ikke er en konkurrerende celle-værdikopi (§3.8).

const collectionRef: CollectionRef = eoOevrigeKravPerioderCollection.template as CollectionRef;

// Kolonneindeks (matcher grid-core-koordinaten `{ rowId, colIndex }`): dato=0, udgiftTil=1, beloeb=2.
const COL = { dato: 0, udgiftTil: 1, beloeb: 2 } as const;

export type GreenfieldOevrigeKravTableProps = Readonly<{
  /** De committede rækker (læst reader-afledt af forælderen), i den afsluttede rækkefølge. */
  committedRows: readonly OevrigeKravRow[];
  saveOrderPath?: TableSaveOrderPath;
}>;

type RenderRow = Readonly<{ rowId: string; kind: 'existing' | 'placeholder' }>;

type OevrigeKravRowProps = Readonly<{
  renderRow: RenderRow;
  committed: OevrigeKravRow | undefined;
  onDeleteRow: (rowId: string) => void;
  buildCellSpec: <T>(renderRow: RenderRow, descriptor: FieldDescriptor<T>, colIdx: number) => CellSpec<T, OevrigeKravRow>;
}>;

const OevrigeKravTableRow = React.memo(({ renderRow, committed, onDeleteRow, buildCellSpec }: OevrigeKravRowProps) => {
  const rowId = renderRow.rowId;
  const gc = (colIndex: number) => ({ rowId, colIndex });
  const showDelete = renderRow.kind === 'existing' && committed !== undefined && !isOevrigeKravRowEmpty(committed);

  return (
    <TableRow data-mineo-row-id={rowId}>
      <TableCell>
        <GreenfieldGridDateCell
          gridCell={gc(COL.dato)}
          cell={buildCellSpec<ISODateString | undefined>(renderRow, eoOevrigeKravDatoField, COL.dato)}
        />
      </TableCell>
      <TableCell>
        <GreenfieldGridTextCell<string>
          gridCell={gc(COL.udgiftTil)}
          cell={buildCellSpec<string>(renderRow, eoOevrigeKravUdgiftTilField, COL.udgiftTil)}
          sx={{ width: 400 }}
        />
      </TableCell>
      <TableCell sx={{ position: 'relative', paddingRight: '28px' }}>
        <GreenfieldGridAmountCell
          gridCell={gc(COL.beloeb)}
          cell={buildCellSpec<AmountValue | undefined>(renderRow, eoOevrigeKravBeloebField, COL.beloeb)}
        />
        {showDelete && <RowDeleteButton onDelete={() => onDeleteRow(rowId)} />}
      </TableCell>
    </TableRow>
  );
});

OevrigeKravTableRow.displayName = 'OevrigeKravTableRow';

const GreenfieldOevrigeKravTable = React.memo(({ committedRows, saveOrderPath }: GreenfieldOevrigeKravTableProps) => {
  const rows = useCollectionRows<OevrigeKravRow>(collectionRef);

  const sortColumns = React.useMemo(() => [
    { colId: 'dato', getSortValue: (row: OevrigeKravRow) => row.dato },
    { colId: 'udgiftTil', getSortValue: (row: OevrigeKravRow) => row.udgiftTil },
    { colId: 'beloeb', getSortValue: (row: OevrigeKravRow) => amountValueToNumber(row.beloeb) },
  ], []);

  const handleSortedRowsChange = React.useCallback((next: OevrigeKravRow[]) => {
    rows.reorder(next.map((row) => row.id));
  }, [rows]);

  const { sortedRows: sortedCommittedRows, getSortRole, getSortDirection, handleHeaderClick } = useTableSort({
    rows: committedRows,
    getRowId: (row) => row.id,
    isRowEmpty: isOevrigeKravRowEmpty,
    columns: sortColumns,
    onSortedRowsChange: handleSortedRowsChange,
  });

  // ── Trailing placeholder-række (§1.11) ──────────────────────────────────────
  const placeholderIdRef = React.useRef<string | undefined>(undefined);
  const committedIdSet = React.useMemo(() => new Set(sortedCommittedRows.map((row) => row.id)), [sortedCommittedRows]);
  const placeholderId = React.useMemo(() => {
    let id = placeholderIdRef.current;
    if (id === undefined || committedIdSet.has(id)) {
      id = createOevrigeKravRowId();
      placeholderIdRef.current = id;
    }
    return id;
  }, [committedIdSet]);

  const renderRows: readonly RenderRow[] = React.useMemo(() => [
    ...sortedCommittedRows.map((row) => ({ rowId: row.id, kind: 'existing' as const })),
    { rowId: placeholderId, kind: 'placeholder' as const },
  ], [sortedCommittedRows, placeholderId]);

  const committedById = React.useMemo(
    () => new Map(sortedCommittedRows.map((row) => [row.id, row])),
    [sortedCommittedRows]
  );

  const savedRowIds = React.useMemo(() => sortedCommittedRows.map((row) => row.id), [sortedCommittedRows]);
  useRegisterTableSaveOrder(saveOrderPath, savedRowIds);

  const buildCellSpec = React.useCallback(<T,>(
    renderRow: RenderRow,
    descriptor: FieldDescriptor<T>,
    colIdx: number
  ): CellSpec<T, OevrigeKravRow> => {
    // route + tabKey er eksplicit navigation-metadata (§3.7); øvrige krav bor på EO-oplysninger-fanen.
    const location = { locationId: `erstatningsopgoerelse.oevrigeKravPerioder:${renderRow.rowId}:${colIdx}`, route: APP_ROUTES.erstatningsopgoerelse, tabKey: EO_TAB_KEYS.EO_OPLYSNINGER };
    if (renderRow.kind === 'existing') {
      const field: FieldRef<T> = descriptor.bind(renderRow.rowId);
      return { kind: 'existing', field, location };
    }
    return {
      kind: 'placeholder',
      descriptor,
      collection: collectionRef,
      entity: createEmptyOevrigeKravCommittedRow(renderRow.rowId),
      entityId: renderRow.rowId,
      location,
    };
  }, []);

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
          <StandardLooseHeaderCell sx={{ width: 180 }} onClick={() => handleHeaderClick('dato')} sortRole={getSortRole('dato')} sortDirection={getSortDirection('dato')}>Dato</StandardLooseHeaderCell>
          <StandardLooseHeaderCell sx={{ width: 500 }} onClick={() => handleHeaderClick('udgiftTil')} sortRole={getSortRole('udgiftTil')} sortDirection={getSortDirection('udgiftTil')}>Udgift til</StandardLooseHeaderCell>
          <StandardLooseHeaderCell sx={{ width: 160 }} onClick={() => handleHeaderClick('beloeb')} sortRole={getSortRole('beloeb')} sortDirection={getSortDirection('beloeb')}>Beløb</StandardLooseHeaderCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {renderRows.map((renderRow) => (
          <OevrigeKravTableRow
            key={renderRow.rowId}
            renderRow={renderRow}
            committed={committedById.get(renderRow.rowId)}
            onDeleteRow={rows.remove}
            buildCellSpec={buildCellSpec}
          />
        ))}
      </TableBody>
    </StandardLooseTable>
  );
});

GreenfieldOevrigeKravTable.displayName = 'GreenfieldOevrigeKravTable';

export default GreenfieldOevrigeKravTable;
