import * as React from 'react';
import { StandardGridHeaderCell, StandardGridTable } from './StandardGridTable';
import { RowDeleteButton, rowDeleteLaneStyle } from './RowDeleteButton';
import { GridReadOnlyLockedCell } from './GridReadOnlyLockedCell';
import { getStandardGridBodyRowStyle, getStandardGridCellStyle } from './gridCore/standardGridStyles';
import { bindSortableHeader, useTableSort } from './useTableSort';
import { usePersistSortedCollectionOrder } from './useSortedCollectionTable';
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
import { resolveManualRegulationBasisRowId } from '../../domain/erstatningsopgoerelse/manualRegulationBasisCommit';
import { activeFieldIssue, type FieldIssueSet } from '../../inputCore/inputIssue';
import { serializeFieldAddress, type FieldAddress, type SerializedFieldAddress } from '../../inputCore/fieldAddress';
import type { FieldWarning } from '../../inputCore/fieldWarning';

const LOCKED_PERCENT_PLACEHOLDER = withInputUnitPlaceholderSuffix(TWO_DECIMAL_PERCENT_PLACEHOLDER, INPUT_UNIT_SUFFIX.percent);
const createEmptyRow = (id: string): LoenudviklingManuelProcentsatsRow => ({ ...initialLoenudviklingManuelProcentsatsRow, id });

export type LoenudviklingManuelProcentsatsTableProps = Readonly<{
  bindings: ManualBindings;
  collection: CollectionRef;
  committedRows: readonly LoenudviklingManuelProcentsatsRow[];
  /** Projekterede celleregler (dato før basisdatoen, dublet-dato) – rød ring på cellen. */
  ruleIssues: FieldIssueSet;
  /** Gule celler: ingen ændringer i lang tid, en sats over 10 % (BB-302, BB-313). */
  cellWarnings?: ReadonlyMap<SerializedFieldAddress, FieldWarning>;
  baseDateDisplay: string;
  baseDateISO?: string;
  baseDateErrorMessage?: string;
  baseDateInfoTooltipText?: string;
  useSmallFont?: boolean;
  locationPrefix: string;
  /**
   * route + tabKey er eksplicit navigation-metadata (§3.7). Tabellen renderes i to fane-kontekster
   * (Lønindkomst under et ansættelsesforhold og EO-oplysninger under "Indtægt før skaden"), så
   * kalderen leverer den korrekte fane – den kan ikke udledes af `locationPrefix`.
   */
  locationNav: Readonly<{ route: string; tabKey: string | null }>;
}>;

export default function LoenudviklingManuelProcentsatsTable({ bindings, collection, committedRows, ruleIssues, cellWarnings, baseDateDisplay, baseDateISO, baseDateErrorMessage, baseDateInfoTooltipText, useSmallFont = false, locationPrefix, locationNav }: LoenudviklingManuelProcentsatsTableProps) {
  const baseRowId = committedRows[0]?.id;
  const table = useCollectionTable({ collection, committedRows, createRowId: generateLoenudviklingRowId, createEmptyRow, locationPrefix, locationNav });
  const persistSortedOrder = usePersistSortedCollectionOrder(collection);
  const entries = React.useMemo(() => buildManuelProcentsatsEntries({ anvendtReguleringsdato: isISODateString(baseDateISO) ? baseDateISO : undefined, rows: committedRows }), [baseDateISO, committedRows]);
  const entryById = React.useMemo(() => new Map(entries.map((entry) => [entry.rowId, entry])), [entries]);
  const columns = React.useMemo(() => [
    { colId: 'dato', getSortValue: (row: LoenudviklingManuelProcentsatsRow) => row.id === baseRowId ? baseDateISO : row.dato },
    { colId: 'procent', getSortValue: (row: LoenudviklingManuelProcentsatsRow) => row.procent },
    { colId: 'indeks', getSortValue: (row: LoenudviklingManuelProcentsatsRow) => entryById.get(row.id)?.anvendtIndeks },
    { colId: 'akkumuleret', getSortValue: (row: LoenudviklingManuelProcentsatsRow) => entryById.get(row.id)?.anvendtPct },
  ], [baseDateISO, baseRowId, entryById]);
  const getRowId = React.useCallback((row: LoenudviklingManuelProcentsatsRow) => row.id, []);
  const sort = useTableSort({
    rows: committedRows,
    anchorRowId: baseRowId,
    getRowId,
    isRowEmpty: (row) => table.isRowEmpty(row.id),
    columns,
    onSortedRowsChange: (next) => persistSortedOrder(next.map(getRowId)),
  });
  // Basisrækken er programstyret og ankres først; resten følger sorteringen. Den orden er
  // tabellens visningsorden, og render-modellen bygges af den ÉT sted (`buildRenderRows`) –
  // ikke ved at permutere en færdigbygget model på plads bagefter.
  const renderRows = table.buildRenderRows(sort.sortedRows);
  // Fail-closed for ældre/ufuldstændig state: en manglende canonical basisrække må aldrig gøre første dato
  // redigerbar. Normale valg opretter basisrækken atomisk før tabellen vises.
  const visibleBaseRowId = resolveManualRegulationBasisRowId(committedRows, renderRows);
  const headers = ['Dato', 'Procent', 'Indeks', 'Akkumuleret'] as const;
  const keys = ['dato', 'procent', 'indeks', 'akkumuleret'] as const;
  return <StandardGridTable tableWidth="1130px" useSmallFont={useSmallFont}>
    <colgroup>{[280, 280, 280, 290].map((width, index) => <col key={index} style={{ width }} />)}</colgroup>
    <thead><tr>{headers.map((header, index) => <StandardGridHeaderCell key={header} {...bindSortableHeader(sort, keys[index]!)}>{header}</StandardGridHeaderCell>)}</tr></thead>
    <tbody>{renderRows.map((renderRow, index) => {
      const row = table.committedById.get(renderRow.rowId);
      const isBase = renderRow.rowId === visibleBaseRowId;
      const entry = isBase ? entries[0] : entryById.get(renderRow.rowId);
      const gc = (colIndex: number) => ({ rowId: renderRow.rowId, colIndex });
      const dateCell = table.buildCellSpec(renderRow, bindings.manualPercentFields.dato, 0);
      const procentCell = table.buildCellSpec(renderRow, bindings.manualPercentFields.procent, 1);
      // Samme opslag som i `LoenudviklingManuelTable`: på cellens egen bundne adresse.
      const cellProps = (address: FieldAddress) => {
        const key = serializeFieldAddress(address);
        const ruleIssue = activeFieldIssue(ruleIssues, key);
        const warning = cellWarnings?.get(key);
        return {
          ...(ruleIssue === undefined ? {} : { collectionRuleIssue: ruleIssue }),
          ...(warning === undefined ? {} : { warning }),
        };
      };
      return <tr key={renderRow.rowId} data-mineo-row-id={renderRow.rowId} style={getStandardGridBodyRowStyle(index)}>
        <td style={getStandardGridCellStyle({ align: 'center' })}>{isBase ? <GridReadOnlyLockedCell gridCell={gc(0)} displayValue={baseDateDisplay} align="center" errorMessage={baseDateErrorMessage} infoTooltipText={baseDateInfoTooltipText} /> : <GridDateCell gridCell={gc(0)} cell={dateCell} {...cellProps(dateCell.field.address)} />}</td>
        <td style={getStandardGridCellStyle({ align: 'right' })}>{isBase ? <GridReadOnlyLockedCell gridCell={gc(1)} displayValue={appendInputUnitSuffix(formatPercentDisplay(0, true), INPUT_UNIT_SUFFIX.percent)} align="right" placeholder={LOCKED_PERCENT_PLACEHOLDER} /> : <GridPercentCell gridCell={gc(1)} cell={procentCell} {...cellProps(procentCell.field.address)} />}</td>
        <td style={getStandardGridCellStyle({ align: 'right' })}><GridReadOnlyLockedCell gridCell={gc(2)} displayValue={entry ? formatAsAmount(entry.anvendtIndeks, 2) : ''} align="right" /></td>
        <td style={rowDeleteLaneStyle(getStandardGridCellStyle({ align: 'right' }))}><GridReadOnlyLockedCell gridCell={gc(3)} displayValue={entry ? `${entry.anvendtPct >= 0 ? '+ ' : '- '}${formatAsAmount(Math.abs(entry.anvendtPct), 2)} %` : ''} align="right" />{renderRow.kind === 'existing' && !isBase && row !== undefined && !table.isRowEmpty(row.id) ? <RowDeleteButton onDelete={() => table.removeRow(row.id)} /> : null}</td>
      </tr>;
    })}</tbody>
  </StandardGridTable>;
}
