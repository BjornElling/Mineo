import * as React from 'react';
import { MenuItem } from '@mui/material';
import { StandardGridHeaderCell, StandardGridTable } from './StandardGridTable';
import { getStandardGridBodyRowStyle, getStandardGridCellStyle } from './gridCore/standardGridStyles';
import { RowDeleteButton } from './RowDeleteButton';
import { GreenfieldGridAmountCell, GreenfieldGridDateCell } from '../../inputCore/react/fields/greenfieldGridCells';
import GreenfieldGridChoiceCell from '../../inputCore/react/fields/GreenfieldGridChoiceCell';
import {
  eoOffentligeYdelserFraDatoField,
  eoOffentligeYdelserRowsCollection,
  eoOffentligeYdelserTillaegField,
  eoOffentligeYdelserTilDatoField,
  eoOffentligeYdelserYdelseField,
  eoOffentligeYdelserYdelsestypeField,
} from '../../inputCore/catalog/erstatningsopgoerelseDescriptors';
import type { CollectionRef } from '../../inputCore/fieldAddress';
import type { OffentligeYdelserRow } from '../../schemas/formSchemas';
import { generateOffentligYdelseRowId, initialOffentligYdelseRow } from '../../domain/erstatningsopgoerelse/helpers/eoRowInitialValues';
import { ydelsestyper, ydelsestypeKeys } from '../../data/ydelsestyper';
import { amountValueToNumber } from '../../utils/expressionAmount';
import { useGreenfieldCollectionTable } from './useGreenfieldCollectionTable';
import { useTableSort } from './useTableSort';
import { useRegisterTableSaveOrder } from './useRegisterTableSaveOrder';
import type { TableSaveOrderPath } from '../../utils/tableSaveOrderRegistry';
import { APP_ROUTES } from '../../config/pageNavigation';
import { EO_TAB_KEYS } from '../../config/eoTabKeys';

type DerivedRow = Readonly<{ periodiseringLabel: string; antalDageDisplay: string; ydelsePerDagDisplay: string }>;
export type GreenfieldOffentligeYdelserTableProps = Readonly<{
  committedRows: readonly OffentligeYdelserRow[];
  derivedByRowId: ReadonlyMap<string, DerivedRow>;
  disableMidlertidigtEetOption: boolean;
  saveOrderPath?: TableSaveOrderPath;
}>;

const collection = eoOffentligeYdelserRowsCollection.template as CollectionRef;
const createEmptyRow = (id: string): OffentligeYdelserRow => ({ ...initialOffentligYdelseRow, id });
const isRowEmpty = (row: OffentligeYdelserRow): boolean =>
  row.fraDato === undefined && row.tilDato === undefined && row.ydelse === undefined
  && row.tillaeg === undefined && (row.ydelsestype === undefined || row.ydelsestype.trim() === '');

const GreenfieldOffentligeYdelserTable = React.memo(({
  committedRows,
  derivedByRowId,
  disableMidlertidigtEetOption,
  saveOrderPath,
}: GreenfieldOffentligeYdelserTableProps) => {
  const table = useGreenfieldCollectionTable({
    collection,
    committedRows,
    createRowId: generateOffentligYdelseRowId,
    createEmptyRow,
    locationPrefix: 'erstatningsopgoerelse.offentligeYdelserRows',
    // route + tabKey er eksplicit navigation-metadata (§3.7); tabellen bor på Offentlige ydelser-fanen.
    locationNav: { route: APP_ROUTES.erstatningsopgoerelse, tabKey: EO_TAB_KEYS.OFFENTLIGE_YDELSER },
  });
  const columns = React.useMemo(() => [
    { colId: 'fraDato', getSortValue: (row: OffentligeYdelserRow) => row.fraDato ?? '' },
    { colId: 'tilDato', getSortValue: (row: OffentligeYdelserRow) => row.tilDato ?? '' },
    { colId: 'ydelse', getSortValue: (row: OffentligeYdelserRow) => amountValueToNumber(row.ydelse) },
    { colId: 'tillaeg', getSortValue: (row: OffentligeYdelserRow) => amountValueToNumber(row.tillaeg) },
    { colId: 'ydelsestype', getSortValue: (row: OffentligeYdelserRow) => row.ydelsestype ?? '' },
    { colId: 'periodisering', getSortValue: (row: OffentligeYdelserRow) => derivedByRowId.get(row.id)?.periodiseringLabel ?? '' },
    { colId: 'antalDage', getSortValue: (row: OffentligeYdelserRow) => derivedByRowId.get(row.id)?.antalDageDisplay ?? '' },
    { colId: 'ydelsePerDag', getSortValue: (row: OffentligeYdelserRow) => derivedByRowId.get(row.id)?.ydelsePerDagDisplay ?? '' },
  ], [derivedByRowId]);
  const { sortedRows, getSortRole, getSortDirection, handleHeaderClick } = useTableSort({
    rows: committedRows,
    getRowId: (row) => row.id,
    isRowEmpty,
    columns,
    onSortedRowsChange: (next) => table.reorderRows(next.map((row) => row.id)),
  });
  const renderOrder = React.useMemo(() => {
    const byId = new Map(table.renderRows.map((row) => [row.rowId, row]));
    const placeholder = table.renderRows.find((row) => row.kind === 'placeholder');
    return [...sortedRows.map((row) => byId.get(row.id)).filter((row) => row !== undefined), ...(placeholder ? [placeholder] : [])];
  }, [sortedRows, table.renderRows]);
  useRegisterTableSaveOrder(saveOrderPath, sortedRows.map((row) => row.id));

  const headers = ['Fra dato', 'Til dato', 'Ydelse', 'Tillæg', 'Ydelsestype', 'Periodisering', 'Antal dage', 'Ydelse per dag'];
  const sortIds = ['fraDato', 'tilDato', 'ydelse', 'tillaeg', 'ydelsestype', 'periodisering', 'antalDage', 'ydelsePerDag'] as const;
  return <StandardGridTable tableWidth="1130px">
    <colgroup>{['120px', '120px', '130px', '130px', '200px', '160px', '110px', '160px'].map((width, index) => <col key={index} style={{ width }} />)}</colgroup>
    <thead><tr>{headers.map((header, index) => <StandardGridHeaderCell key={header} onClick={() => handleHeaderClick(sortIds[index])} sortRole={getSortRole(sortIds[index])} sortDirection={getSortDirection(sortIds[index])}>{header}</StandardGridHeaderCell>)}</tr></thead>
    <tbody>{renderOrder.map((row, rowIndex) => {
      const committed = table.committedById.get(row.rowId);
      const derived = committed === undefined ? undefined : derivedByRowId.get(committed.id);
      const gc = (colIndex: number) => ({ rowId: row.rowId, colIndex });
      const derivedStyle = { ...getStandardGridCellStyle({ align: 'center' }), color: 'var(--mineo-color-grid-derived)' };
      return <tr key={row.rowId} data-mineo-row-id={row.rowId} style={getStandardGridBodyRowStyle(rowIndex)}>
        <td style={getStandardGridCellStyle({ align: 'center' })}><GreenfieldGridDateCell gridCell={gc(0)} cell={table.buildCellSpec(row, eoOffentligeYdelserFraDatoField, 0)} /></td>
        <td style={getStandardGridCellStyle({ align: 'center' })}><GreenfieldGridDateCell gridCell={gc(1)} cell={table.buildCellSpec(row, eoOffentligeYdelserTilDatoField, 1)} /></td>
        <td style={getStandardGridCellStyle({ align: 'center' })}><GreenfieldGridAmountCell gridCell={gc(2)} cell={table.buildCellSpec(row, eoOffentligeYdelserYdelseField, 2)} /></td>
        <td style={getStandardGridCellStyle({ align: 'center' })}><GreenfieldGridAmountCell gridCell={gc(3)} cell={table.buildCellSpec(row, eoOffentligeYdelserTillaegField, 3)} /></td>
        <td style={getStandardGridCellStyle({ align: 'center' })}><GreenfieldGridChoiceCell gridCell={gc(4)} cell={table.buildCellSpec(row, eoOffentligeYdelserYdelsestypeField, 4)} placeholder="Vælg...">
          {ydelsestypeKeys.map((key) => <MenuItem key={key} value={key} disabled={key === 'midlertidigt_eet' && disableMidlertidigtEetOption}>{ydelsestyper[key].label}</MenuItem>)}
        </GreenfieldGridChoiceCell></td>
        <td style={derivedStyle}>{derived?.periodiseringLabel ?? ''}</td>
        <td style={derivedStyle}>{derived?.antalDageDisplay ?? ''}</td>
        <td style={{ ...derivedStyle, position: 'relative', paddingRight: '28px', textAlign: 'right' }}>
          {derived?.ydelsePerDagDisplay ?? ''}
          {committed !== undefined && !isRowEmpty(committed) ? <RowDeleteButton onDelete={() => table.removeRow(committed.id)} /> : null}
        </td>
      </tr>;
    })}</tbody>
  </StandardGridTable>;
});

GreenfieldOffentligeYdelserTable.displayName = 'GreenfieldOffentligeYdelserTable';
export default GreenfieldOffentligeYdelserTable;
