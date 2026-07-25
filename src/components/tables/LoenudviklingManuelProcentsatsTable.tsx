import * as React from 'react';
import { StandardGridHeaderCell, StandardGridTable } from './StandardGridTable';
import { RowDeleteButton } from './RowDeleteButton';
import { GridReadOnlyLockedCell } from './GridReadOnlyLockedCell';
import { getStandardGridBodyRowStyle, getStandardGridCellStyle } from './gridCore/standardGridStyles';
import { useTableSort } from './useTableSort';
import { useCollectionTable } from './useCollectionTable';
import { GridDateCell, GridPercentCell } from '../../inputCore/react/fields/gridCells';
import type { CollectionRef } from '../../inputCore/fieldAddress';
import type { ManualBindings } from '../../inputCore/catalog/erstatningsopgoerelseLoenDescriptors';
import type { LoenudviklingManuelProcentsatsRow } from '../../schemas/formSchemas';
import { buildManuelProcentsatsEntries } from '../../domain/erstatningsopgoerelse/engines/manuelProcentsatsRegulering';
import { generateLoenudviklingRowId, initialLoenudviklingManuelProcentsatsRow } from '../../domain/erstatningsopgoerelse/helpers/eoRowInitialValues';
import { formatAsAmount } from '../../utils/formatUtils';
import { formatPercentDisplay } from '../../utils/percentDraftCore';
import { INPUT_UNIT_SUFFIX, appendInputUnitSuffix, withInputUnitPlaceholderSuffix } from '../../utils/inputUnit';
import { TWO_DECIMAL_PERCENT_PLACEHOLDER } from '../../utils/percentInputUtils';
import { isISODateString } from '../../types/branded';

const LOCKED_PERCENT_PLACEHOLDER = withInputUnitPlaceholderSuffix(TWO_DECIMAL_PERCENT_PLACEHOLDER, INPUT_UNIT_SUFFIX.percent);
const createEmptyRow = (id: string): LoenudviklingManuelProcentsatsRow => ({ ...initialLoenudviklingManuelProcentsatsRow, id });
const isRowEmpty = (row: LoenudviklingManuelProcentsatsRow) => row.dato === undefined && row.procent === undefined;

export type LoenudviklingManuelProcentsatsTableProps = Readonly<{
  bindings: ManualBindings;
  collection: CollectionRef;
  fieldOwnerIds?: readonly string[];
  committedRows: readonly LoenudviklingManuelProcentsatsRow[];
  baseDateDisplay: string;
  baseDateISO?: string;
  baseDateErrorMessage?: string;
  baseDateInfoTooltipText?: string;
  useSmallFont?: boolean;
  locationPrefix: string;
  /**
   * route + tabKey er eksplicit navigation-metadata (§3.7). Tabellen renderes i to fane-kontekster
   * (Lønindkomst under et ansættelsesforhold og EO-oplysninger under "Indtægt før skaden"), så
   * kalderen leverer den korrekte fane — den kan ikke udledes af `locationPrefix`.
   */
  locationNav: Readonly<{ route: string; tabKey: string | null }>;
}>;

export default function LoenudviklingManuelProcentsatsTable({ bindings, collection, fieldOwnerIds, committedRows, baseDateDisplay, baseDateISO, baseDateErrorMessage, baseDateInfoTooltipText, useSmallFont = false, locationPrefix, locationNav }: LoenudviklingManuelProcentsatsTableProps) {
  const baseRowId = committedRows[0]?.id;
  const table = useCollectionTable({ collection, committedRows, createRowId: generateLoenudviklingRowId, createEmptyRow, locationPrefix, locationNav, fieldOwnerIds });
  const entries = React.useMemo(() => buildManuelProcentsatsEntries({ anvendtReguleringsdato: isISODateString(baseDateISO) ? baseDateISO : undefined, rows: committedRows }), [baseDateISO, committedRows]);
  const entryById = React.useMemo(() => new Map(entries.map((entry) => [entry.rowId, entry])), [entries]);
  const columns = React.useMemo(() => [
    { colId: 'dato', getSortValue: (row: LoenudviklingManuelProcentsatsRow) => row.id === baseRowId ? baseDateISO : row.dato },
    { colId: 'procent', getSortValue: (row: LoenudviklingManuelProcentsatsRow) => row.procent },
    { colId: 'indeks', getSortValue: (row: LoenudviklingManuelProcentsatsRow) => entryById.get(row.id)?.indeks },
    { colId: 'akkumuleret', getSortValue: (row: LoenudviklingManuelProcentsatsRow) => entryById.get(row.id)?.akkumuleretPct },
  ], [baseDateISO, baseRowId, entryById]);
  const sort = useTableSort({ rows: committedRows, getRowId: (row) => row.id, isRowEmpty: (row) => row.id === baseRowId ? false : isRowEmpty(row), columns, onSortedRowsChange: (next) => table.reorderRows((baseRowId === undefined ? next : [committedRows[0], ...next.filter((row) => row.id !== baseRowId)]).filter((row): row is LoenudviklingManuelProcentsatsRow => row !== undefined).map((row) => row.id)) });
  const existing = baseRowId === undefined ? sort.sortedRows : [committedRows[0], ...sort.sortedRows.filter((row) => row.id !== baseRowId)].filter((row): row is LoenudviklingManuelProcentsatsRow => row !== undefined);
  const renderById = new Map(table.renderRows.map((row) => [row.rowId, row]));
  const renderRows = [...existing.map((row) => renderById.get(row.id)).filter((row) => row !== undefined), table.renderRows.at(-1)!];
  const headers = ['Dato', 'Procent', 'Indeks', 'Akkumuleret'] as const;
  const keys = ['dato', 'procent', 'indeks', 'akkumuleret'] as const;
  return <StandardGridTable tableWidth="1130px" useSmallFont={useSmallFont}>
    <colgroup>{[280, 280, 280, 290].map((width, index) => <col key={index} style={{ width }} />)}</colgroup>
    <thead><tr>{headers.map((header, index) => <StandardGridHeaderCell key={header} onClick={() => sort.handleHeaderClick(keys[index]!)} sortRole={sort.getSortRole(keys[index]!)} sortDirection={sort.getSortDirection(keys[index]!)}>{header}</StandardGridHeaderCell>)}</tr></thead>
    <tbody>{renderRows.map((renderRow, index) => {
      const row = table.committedById.get(renderRow.rowId);
      const isBase = renderRow.kind === 'existing' && renderRow.rowId === baseRowId;
      const entry = entryById.get(renderRow.rowId);
      const gc = (colIndex: number) => ({ rowId: renderRow.rowId, colIndex });
      return <tr key={renderRow.rowId} data-mineo-row-id={renderRow.rowId} style={getStandardGridBodyRowStyle(index)}>
        <td style={getStandardGridCellStyle({ align: 'center' })}>{isBase ? <GridReadOnlyLockedCell gridCell={gc(0)} displayValue={baseDateDisplay} align="center" errorMessage={baseDateErrorMessage} infoTooltipText={baseDateInfoTooltipText} /> : <GridDateCell gridCell={gc(0)} cell={table.buildCellSpec(renderRow, bindings.manualPercentFields.dato, 0)} />}</td>
        <td style={getStandardGridCellStyle({ align: 'right' })}>{isBase ? <GridReadOnlyLockedCell gridCell={gc(1)} displayValue={appendInputUnitSuffix(formatPercentDisplay(0, true), INPUT_UNIT_SUFFIX.percent)} align="right" placeholder={LOCKED_PERCENT_PLACEHOLDER} /> : <GridPercentCell gridCell={gc(1)} cell={table.buildCellSpec(renderRow, bindings.manualPercentFields.procent, 1)} />}</td>
        <td style={getStandardGridCellStyle({ align: 'right' })}><GridReadOnlyLockedCell gridCell={gc(2)} displayValue={entry ? formatAsAmount(entry.indeks, 2) : ''} align="right" /></td>
        <td style={{ ...getStandardGridCellStyle({ align: 'right' }), position: 'relative', paddingRight: 28 }}><GridReadOnlyLockedCell gridCell={gc(3)} displayValue={entry ? `${entry.akkumuleretPct >= 0 ? '+ ' : '- '}${formatAsAmount(Math.abs(entry.akkumuleretPct), 2)} %` : ''} align="right" />{renderRow.kind === 'existing' && !isBase && row !== undefined && !isRowEmpty(row) ? <RowDeleteButton onDelete={() => table.removeRow(row.id)} /> : null}</td>
      </tr>;
    })}</tbody>
  </StandardGridTable>;
}

