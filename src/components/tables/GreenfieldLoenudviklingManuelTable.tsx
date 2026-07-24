import * as React from 'react';
import { StandardGridHeaderCell, StandardGridTable } from './StandardGridTable';
import { RowDeleteButton } from './RowDeleteButton';
import { GridReadOnlyLockedCell } from './GridReadOnlyLockedCell';
import { getStandardGridBodyRowStyle, getStandardGridCellStyle } from './gridCore/standardGridStyles';
import { useTableSort } from './useTableSort';
import { useGreenfieldCollectionTable } from './useGreenfieldCollectionTable';
import {
  GreenfieldGridAmountCell,
  GreenfieldGridDateCell,
  GreenfieldGridPercentCell,
} from '../../inputCore/react/fields/greenfieldGridCells';
import type { CollectionRef } from '../../inputCore/fieldAddress';
import type { ManualBindings } from '../../inputCore/catalog/erstatningsopgoerelseLoenDescriptors';
import type { LoenudviklingManuelRow } from '../../schemas/formSchemas';
import { amountValueToNumber } from '../../utils/expressionAmount';
import { formatPercentDisplay } from '../../utils/percentDraftCore';
import { INPUT_UNIT_SUFFIX, appendInputUnitSuffix, withInputUnitPlaceholderSuffix } from '../../utils/inputUnit';
import { TWO_DECIMAL_PERCENT_PLACEHOLDER } from '../../utils/percentInputUtils';
import {
  generateLoenudviklingRowId,
  initialLoenudviklingManuelRow,
} from '../../domain/erstatningsopgoerelse/helpers/eoRowInitialValues';

const LOCKED_PERCENT_PLACEHOLDER = withInputUnitPlaceholderSuffix(
  TWO_DECIMAL_PERCENT_PLACEHOLDER,
  INPUT_UNIT_SUFFIX.percent
);
const formatLockedPercent = (value: number | undefined) =>
  appendInputUnitSuffix(formatPercentDisplay(value, true), INPUT_UNIT_SUFFIX.percent);
const isRowEmpty = (row: LoenudviklingManuelRow) =>
  row.dato === undefined && row.grundloen === undefined && row.feriepenge === undefined &&
  row.shSoSats === undefined && row.fritvalg === undefined && row.agPension === undefined;
const createEmptyRow = (id: string): LoenudviklingManuelRow => ({ ...initialLoenudviklingManuelRow, id });

export type GreenfieldLoenudviklingManuelTableProps = Readonly<{
  bindings: ManualBindings;
  collection: CollectionRef;
  fieldOwnerIds?: readonly string[];
  committedRows: readonly LoenudviklingManuelRow[];
  baseDateDisplay: string;
  baseDateISO?: string;
  baseDateErrorMessage?: string;
  baseDateInfoTooltipText?: string;
  baseRowPercentErrors?: Partial<Record<'feriepenge' | 'shSoSats' | 'fritvalg' | 'agPension', string>>;
  readOnlyBaseRowPercentFields?: boolean;
  useSmallFont?: boolean;
  locationPrefix: string;
  /**
   * route + tabKey er eksplicit navigation-metadata (§3.7). Tabellen renderes i to fane-kontekster
   * (Lønindkomst under et ansættelsesforhold og EO-oplysninger under "Indtægt før skaden"), så
   * kalderen leverer den korrekte fane — den kan ikke udledes af `locationPrefix`.
   */
  locationNav?: Readonly<{ route?: string; tabKey?: string | null }>;
}>;

export default function GreenfieldLoenudviklingManuelTable({
  bindings,
  collection,
  fieldOwnerIds,
  committedRows,
  baseDateDisplay,
  baseDateISO,
  baseDateErrorMessage,
  baseDateInfoTooltipText,
  baseRowPercentErrors,
  readOnlyBaseRowPercentFields = false,
  useSmallFont = false,
  locationPrefix,
  locationNav,
}: GreenfieldLoenudviklingManuelTableProps) {
  const baseRowId = committedRows[0]?.id;
  const table = useGreenfieldCollectionTable({
    collection,
    committedRows,
    createRowId: generateLoenudviklingRowId,
    createEmptyRow,
    locationPrefix,
    locationNav,
    fieldOwnerIds,
  });
  const columns = React.useMemo(() => [
    { colId: 'dato', getSortValue: (row: LoenudviklingManuelRow) => row.id === baseRowId ? baseDateISO : row.dato },
    { colId: 'grundloen', getSortValue: (row: LoenudviklingManuelRow) => amountValueToNumber(row.grundloen) },
    { colId: 'feriepenge', getSortValue: (row: LoenudviklingManuelRow) => row.feriepenge },
    { colId: 'shSoSats', getSortValue: (row: LoenudviklingManuelRow) => row.shSoSats },
    { colId: 'fritvalg', getSortValue: (row: LoenudviklingManuelRow) => row.fritvalg },
    { colId: 'agPension', getSortValue: (row: LoenudviklingManuelRow) => row.agPension },
  ], [baseDateISO, baseRowId]);
  const sort = useTableSort({
    rows: committedRows,
    getRowId: (row) => row.id,
    isRowEmpty: (row) => row.id === baseRowId ? false : isRowEmpty(row),
    columns,
    onSortedRowsChange: (next) => {
      const anchored = baseRowId === undefined
        ? next
        : [committedRows[0], ...next.filter((row) => row.id !== baseRowId)].filter(
          (row): row is LoenudviklingManuelRow => row !== undefined
        );
      table.reorderRows(anchored.map((row) => row.id));
    },
  });
  const orderedRows = React.useMemo(() => {
    const existing = baseRowId === undefined
      ? sort.sortedRows
      : [committedRows[0], ...sort.sortedRows.filter((row) => row.id !== baseRowId)].filter(
        (row): row is LoenudviklingManuelRow => row !== undefined
      );
    const byId = new Map(table.renderRows.map((row) => [row.rowId, row]));
    return [...existing.map((row) => byId.get(row.id)).filter((row) => row !== undefined), table.renderRows.at(-1)!];
  }, [baseRowId, committedRows, sort.sortedRows, table.renderRows]);
  const headers = ['Dato', 'Grundløn', 'Feriepenge', 'SH/SO-sats', 'Fritvalg', 'AG pension'] as const;
  const keys = ['dato', 'grundloen', 'feriepenge', 'shSoSats', 'fritvalg', 'agPension'] as const;

  return (
    <StandardGridTable tableWidth="1130px" useSmallFont={useSmallFont}>
      <colgroup>{[140, 140, 140, 140, 140, 150].map((width, index) => <col key={index} style={{ width }} />)}</colgroup>
      <thead><tr>{headers.map((header, index) => (
        <StandardGridHeaderCell key={header} onClick={() => sort.handleHeaderClick(keys[index]!)} sortRole={sort.getSortRole(keys[index]!)} sortDirection={sort.getSortDirection(keys[index]!)}>{header}</StandardGridHeaderCell>
      ))}</tr></thead>
      <tbody>{orderedRows.map((renderRow, rowIndex) => {
        const row = table.committedById.get(renderRow.rowId);
        const isBase = renderRow.kind === 'existing' && renderRow.rowId === baseRowId;
        const gc = (colIndex: number) => ({ rowId: renderRow.rowId, colIndex });
        const lockedPercent = (key: 'feriepenge' | 'shSoSats' | 'fritvalg' | 'agPension', colIndex: number) => (
          <GridReadOnlyLockedCell gridCell={gc(colIndex)} displayValue={formatLockedPercent(row?.[key])} align="right" errorMessage={baseRowPercentErrors?.[key]} infoTooltipText="Værdien angives ovenfor" placeholder={LOCKED_PERCENT_PLACEHOLDER} />
        );
        return <tr key={renderRow.rowId} data-mineo-row-id={renderRow.rowId} style={getStandardGridBodyRowStyle(rowIndex)}>
          <td style={getStandardGridCellStyle({ align: 'center' })}>{isBase
            ? <GridReadOnlyLockedCell gridCell={gc(0)} displayValue={baseDateDisplay} align="center" errorMessage={baseDateErrorMessage} infoTooltipText={baseDateInfoTooltipText} />
            : <GreenfieldGridDateCell gridCell={gc(0)} cell={table.buildCellSpec(renderRow, bindings.manualFields.dato, 0)} />}</td>
          <td style={getStandardGridCellStyle({ align: 'right' })}><GreenfieldGridAmountCell gridCell={gc(1)} cell={table.buildCellSpec(renderRow, bindings.manualFields.grundloen, 1)} /></td>
          {(['feriepenge', 'shSoSats', 'fritvalg'] as const).map((key, index) => <td key={key} style={getStandardGridCellStyle({ align: 'right' })}>{isBase && readOnlyBaseRowPercentFields ? lockedPercent(key, index + 2) : <GreenfieldGridPercentCell gridCell={gc(index + 2)} cell={table.buildCellSpec(renderRow, bindings.manualFields[key], index + 2)} />}</td>)}
          <td style={{ ...getStandardGridCellStyle({ align: 'right' }), position: 'relative', paddingRight: 28 }}>{isBase && readOnlyBaseRowPercentFields ? lockedPercent('agPension', 5) : <GreenfieldGridPercentCell gridCell={gc(5)} cell={table.buildCellSpec(renderRow, bindings.manualFields.agPension, 5)} />}{renderRow.kind === 'existing' && !isBase && row !== undefined && !isRowEmpty(row) ? <RowDeleteButton onDelete={() => table.removeRow(row.id)} /> : null}</td>
        </tr>;
      })}</tbody>
    </StandardGridTable>
  );
}
