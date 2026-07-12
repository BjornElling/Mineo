import * as React from 'react';

import TableDateInput from '../inputs/table/TableDateInput';
import TablePercentInput from '../inputs/table/TablePercentInput';
import type { TableInputErrorInfo } from '../../utils/tableInputContracts';
import { StandardGridHeaderCell, StandardGridTable } from './StandardGridTable';
import { RowDeleteButton } from './RowDeleteButton';
import { getStandardGridBodyRowStyle, getStandardGridCellStyle } from './gridCore/standardGridStyles';
import { normalizeGridRows } from './gridCore/gridModel';
import { useGridRowPersistenceCore } from './gridCore/useGridRowPersistenceCore';
import { useTableCellErrorTracker } from './gridCore/useTableCellErrorTracker';
import { useReconcileInvalidDraftsToLiveRows } from '../../hooks/tableInput';
import { useTableSort } from './useTableSort';
import {
  applyRowRemovalFocusPlan,
  evaluateRowCommit,
  type RowRemovalFocusPlan,
} from './gridCore/tableRowFocus';
import {
  generateLoenudviklingRowId,
  initialLoenudviklingManuelProcentsatsRow,
} from '../../domain/erstatningsopgoerelse/helpers/eoRowInitialValues';
import {
  buildManuelProcentsatsEntries,
  type ManuelProcentsatsEntry,
} from '../../domain/erstatningsopgoerelse/engines/manuelProcentsatsRegulering';
import { createEmptyRowId } from '../../utils/rowId';
import type { LoenudviklingManuelProcentsatsRow } from '../../schemas/formSchemas';
import { isISODateString } from '../../types/branded';
import { formatAsAmount } from '../../utils/formatUtils';
import { formatPercentDisplay } from '../../utils/percentDraftCore';
import { TWO_DECIMAL_PERCENT_PLACEHOLDER } from '../../utils/percentInputUtils';
import { INPUT_UNIT_SUFFIX, appendInputUnitSuffix, withInputUnitPlaceholderSuffix } from '../../utils/inputUnit';
import { GridReadOnlyLockedCell } from './GridReadOnlyLockedCell';

export type LoenudviklingManuelProcentsatsTableProps = Readonly<{
  tableData: LoenudviklingManuelProcentsatsRow[];
  onTableDataChange?: (data: LoenudviklingManuelProcentsatsRow[], origin?: { fieldPath?: string }) => boolean;
  onInputErrorChange?: (hasError: boolean) => void;
  baseDateDisplay: string;
  baseDateISO?: string;
  baseDateErrorMessage?: string;
  baseDateInfoTooltipText?: string;
  useSmallFont?: boolean;
}>;

const MIN_VISIBLE_ROWS = 2;
const LOCKED_PERCENT_PLACEHOLDER = withInputUnitPlaceholderSuffix(TWO_DECIMAL_PERCENT_PLACEHOLDER, INPUT_UNIT_SUFFIX.percent);

const isEffectivelyEmpty = (value: string | number | undefined): boolean => {
  if (typeof value === 'number') return !Number.isFinite(value);
  return value === undefined || value.trim() === '';
};

const isRowEmpty = (row: LoenudviklingManuelProcentsatsRow): boolean =>
  isEffectivelyEmpty(row.dato) && isEffectivelyEmpty(row.procent);

const fingerprintTableData = (rows: readonly LoenudviklingManuelProcentsatsRow[]): string => {
  return JSON.stringify(rows.map((row) => [row.id, row.dato ?? null, row.procent ?? null]));
};

const parsePercentForSort = (raw: number | undefined): number | undefined =>
  typeof raw === 'number' && Number.isFinite(raw) ? raw : undefined;

const formatLockedPercentDisplay = (value: number | undefined): string =>
  appendInputUnitSuffix(formatPercentDisplay(value, true), INPUT_UNIT_SUFFIX.percent);

const formatDerivedPercent = (value: number): string => {
  const sign = value >= 0 ? '+ ' : '- ';
  // Akkumuleret-kolonnen vises altid med to decimaler (ikke trimmet), som resten af tabellens procentvisning.
  return `${sign}${formatAsAmount(Math.abs(value), 2)} %`;
};

// Indeks-kolonnen vises altid med to decimaler (ikke trimmet), så den matcher tabellens øvrige procentvisning.
const formatDerivedIndex = (value: number): string => formatAsAmount(value, 2);

const LoenudviklingManuelProcentsatsTable = React.memo(
  ({
    tableData,
    onTableDataChange,
    onInputErrorChange,
    baseDateDisplay,
    baseDateISO,
    baseDateErrorMessage,
    baseDateInfoTooltipText,
    useSmallFont = false,
  }: LoenudviklingManuelProcentsatsTableProps) => {
    const defaultTableData = React.useMemo<LoenudviklingManuelProcentsatsRow[]>(
      () => [
        { ...initialLoenudviklingManuelProcentsatsRow, id: generateLoenudviklingRowId(), procent: 0 },
        { ...initialLoenudviklingManuelProcentsatsRow, id: generateLoenudviklingRowId() },
      ],
      []
    );

    const tableRef = React.useRef<HTMLTableElement | null>(null);
    const pendingRowFocusPlanRef = React.useRef<RowRemovalFocusPlan | null>(null);
    const visibleRowIdsRef = React.useRef<readonly string[]>([]);

    const createEmptyRow = React.useCallback((seed: number): LoenudviklingManuelProcentsatsRow => {
      return { ...initialLoenudviklingManuelProcentsatsRow, id: createEmptyRowId('loenudvikling_procentsats', seed) };
    }, []);

    const normalizeRows = React.useCallback(
      (rows: readonly LoenudviklingManuelProcentsatsRow[]): LoenudviklingManuelProcentsatsRow[] => {
        const baseRow = rows[0] ?? {
          ...initialLoenudviklingManuelProcentsatsRow,
          id: createEmptyRowId('loenudvikling_procentsats_base', 0),
        };
        const tail = rows.slice(1);
        const tailMinRows = Math.max(1, MIN_VISIBLE_ROWS - 1);
        const normalizedTail = normalizeGridRows({ rows: tail, minRows: tailMinRows, getRowId: (row) => row.id, isRowEmpty, createEmptyRow });
        return [{ ...baseRow, dato: undefined, procent: 0 }, ...normalizedTail];
      },
      [createEmptyRow]
    );

    const { internalTableData, setInternalTableData, lastPersistedFingerprintRef, getStrippedFingerprint, queuePersist, getUndoFieldPathAliases } =
      useGridRowPersistenceCore<LoenudviklingManuelProcentsatsRow>({
        tableData: tableData.length > 0 ? tableData : defaultTableData,
        onTableDataChange,
        normalizeRows,
        isRowEmpty,
        getRowId: (row) => row.id,
        withRowId: (row, id) => ({ ...row, id }),
        fingerprint: fingerprintTableData,
        keepLeadingRows: 1,
      });

    const baseRowId = internalTableData[0]?.id ?? null;
    const effectiveBaseIso = isISODateString(baseDateISO) ? baseDateISO : undefined;
    const entries = React.useMemo(
      () => buildManuelProcentsatsEntries({ anvendtReguleringsdato: effectiveBaseIso, rows: internalTableData }),
      [effectiveBaseIso, internalTableData]
    );
    const entryByRowId = React.useMemo(() => new Map(entries.map((entry) => [entry.rowId, entry] as const)), [entries]);

    const cellErrorTracker = useTableCellErrorTracker();
    const lastInputErrorStateRef = React.useRef<boolean | null>(null);
    const validRowIds = React.useMemo(() => new Set(internalTableData.map((row) => row.id)), [internalTableData]);
    const validRowIdsRef = React.useRef<ReadonlySet<string>>(validRowIds);
    React.useLayoutEffect(() => {
      validRowIdsRef.current = validRowIds;
    }, [validRowIds]);

    useReconcileInvalidDraftsToLiveRows(validRowIds);

    const notifyInputErrorChange = React.useCallback(() => {
      if (!onInputErrorChange) return;
      const hasError = cellErrorTracker.hasAnyError(validRowIdsRef.current) || Boolean(baseDateErrorMessage);
      if (lastInputErrorStateRef.current === hasError) return;
      lastInputErrorStateRef.current = hasError;
      onInputErrorChange(hasError);
    }, [baseDateErrorMessage, cellErrorTracker, onInputErrorChange]);

    React.useEffect(() => {
      cellErrorTracker.pruneToValidRowIds(validRowIds);
      notifyInputErrorChange();
    }, [cellErrorTracker, notifyInputErrorChange, validRowIds]);

    const commitRowUpdate = React.useCallback(
      (rowId: string, updates: Partial<LoenudviklingManuelProcentsatsRow>, colIndex: number) => {
        if (rowId === baseRowId) return;
        setInternalTableData((prev) => {
          const updated = prev.map((row) => (row.id === rowId ? { ...row, ...updates } : row));
          const normalized = normalizeRows(updated);
          const commitEval = evaluateRowCommit({
            table: tableRef.current,
            prevRows: prev,
            nextRows: normalized,
            rowId,
            colIndex,
            visibleRowIds: visibleRowIdsRef.current,
            isRowEmpty,
            getRowId: (row) => row.id,
            getFingerprint: getStrippedFingerprint,
            lastPersistedFingerprint: lastPersistedFingerprintRef.current,
          });
          if (commitEval.focusPlan) {
            pendingRowFocusPlanRef.current = commitEval.focusPlan;
          }

          if (commitEval.shouldPersist) {
            queuePersist(normalized, `${rowId}:${colIndex}`);
          }
          return normalized;
        });
      },
      [baseRowId, getStrippedFingerprint, lastPersistedFingerprintRef, normalizeRows, queuePersist, setInternalTableData]
    );

    const handleErrorChange = React.useCallback(
      (rowId: string, colKey: string) => (errorInfo: TableInputErrorInfo) => {
        if (cellErrorTracker.setCellError(`${rowId}:${colKey}`, errorInfo.hasError)) {
          notifyInputErrorChange();
        }
      },
      [cellErrorTracker, notifyInputErrorChange]
    );

    React.useEffect(() => {
      notifyInputErrorChange();
    }, [notifyInputErrorChange]);

    const handleDeleteRow = React.useCallback(
      (rowId: string) => {
        if (rowId === baseRowId) return;
        setInternalTableData((prev) => {
          const normalized = normalizeRows(prev.filter((row) => row.id !== rowId));
          if (fingerprintTableData(normalized) === fingerprintTableData(prev)) return prev;
          queuePersist(normalized);
          return normalized;
        });
      },
      [baseRowId, normalizeRows, queuePersist, setInternalTableData]
    );

    const isRowEmptyForSort = React.useCallback(
      (row: LoenudviklingManuelProcentsatsRow) => (row.id === baseRowId ? false : isRowEmpty(row)),
      [baseRowId]
    );

    const getDerivedEntry = React.useCallback(
      (row: LoenudviklingManuelProcentsatsRow): ManuelProcentsatsEntry | undefined => entryByRowId.get(row.id),
      [entryByRowId]
    );

    const sortColumns = React.useMemo(() => [
      {
        colId: 'dato',
        getSortValue: (row: LoenudviklingManuelProcentsatsRow) => {
          if (row.id === baseRowId) return baseDateISO ?? '';
          return row.dato ?? '';
        },
      },
      { colId: 'procent', getSortValue: (row: LoenudviklingManuelProcentsatsRow) => parsePercentForSort(row.procent) },
      { colId: 'indeks', getSortValue: (row: LoenudviklingManuelProcentsatsRow) => getDerivedEntry(row)?.indeks },
      { colId: 'akkumuleret', getSortValue: (row: LoenudviklingManuelProcentsatsRow) => getDerivedEntry(row)?.akkumuleretPct },
    ], [baseDateISO, baseRowId, getDerivedEntry]);

    const { sortedRows: visibleRows, getSortRole, getSortDirection, handleHeaderClick } = useTableSort({
      rows: internalTableData,
      getRowId: (row) => row.id,
      isRowEmpty: isRowEmptyForSort,
      columns: sortColumns,
      onSortedRowsChange: (nextRows) => {
        const anchoredRows = baseRowId
          ? [internalTableData[0], ...nextRows.filter((row) => row.id !== baseRowId)]
          : nextRows;
        if (getStrippedFingerprint(anchoredRows) !== lastPersistedFingerprintRef.current) {
          queuePersist(anchoredRows);
        }
        setInternalTableData(anchoredRows);
      },
    });
    const anchoredVisibleRows = React.useMemo(() => {
      if (!baseRowId) return visibleRows;
      const baseRow = internalTableData[0];
      if (!baseRow) return visibleRows;
      return [baseRow, ...visibleRows.filter((row) => row.id !== baseRowId)];
    }, [baseRowId, internalTableData, visibleRows]);
    const visibleRowIds = React.useMemo(() => anchoredVisibleRows.map((row) => row.id), [anchoredVisibleRows]);

    React.useLayoutEffect(() => {
      visibleRowIdsRef.current = visibleRowIds;
    }, [visibleRowIds]);

    React.useLayoutEffect(() => {
      const plan = pendingRowFocusPlanRef.current;
      if (!plan) return;
      applyRowRemovalFocusPlan({ table: tableRef.current, plan, visibleRowIds });
      pendingRowFocusPlanRef.current = null;
    }, [visibleRowIds]);

    return (
      <StandardGridTable tableWidth="1130px" useSmallFont={useSmallFont} tableRef={tableRef}>
        <colgroup>
          <col style={{ width: '280px' }} />
          <col style={{ width: '280px' }} />
          <col style={{ width: '280px' }} />
          <col style={{ width: '290px' }} />
        </colgroup>

        <thead>
          <tr>
            <StandardGridHeaderCell onClick={() => handleHeaderClick('dato')} sortRole={getSortRole('dato')} sortDirection={getSortDirection('dato')}>
              Dato
            </StandardGridHeaderCell>
            <StandardGridHeaderCell onClick={() => handleHeaderClick('procent')} sortRole={getSortRole('procent')} sortDirection={getSortDirection('procent')}>
              Procent
            </StandardGridHeaderCell>
            <StandardGridHeaderCell onClick={() => handleHeaderClick('indeks')} sortRole={getSortRole('indeks')} sortDirection={getSortDirection('indeks')}>
              Indeks
            </StandardGridHeaderCell>
            <StandardGridHeaderCell onClick={() => handleHeaderClick('akkumuleret')} sortRole={getSortRole('akkumuleret')} sortDirection={getSortDirection('akkumuleret')}>
              Akkumuleret
            </StandardGridHeaderCell>
          </tr>
        </thead>

        <tbody>
          {anchoredVisibleRows.map((row, rowIndex) => {
            const isBaseRow = baseRowId === row.id;
            const derivedEntry = getDerivedEntry(row);
            return (
              <tr key={row.id} data-mineo-row-id={row.id} style={getStandardGridBodyRowStyle(rowIndex)}>
                <td style={getStandardGridCellStyle({ align: 'center' })}>
                  {isBaseRow ? (
                    <GridReadOnlyLockedCell
                      gridCell={{ rowId: row.id, colIndex: 0 }}
                      displayValue={baseDateDisplay}
                      align="center"
                      errorMessage={baseDateErrorMessage}
                      infoTooltipText={baseDateInfoTooltipText}
                    />
                  ) : (
                    <TableDateInput
                      gridCell={{ rowId: row.id, colIndex: 0 }}
                      undoFieldPathAliases={getUndoFieldPathAliases(row.id, 0)}
                      value={row.dato}
                      onBlur={(e) => commitRowUpdate(row.id, { dato: e.target.value }, 0)}
                      onErrorChange={handleErrorChange(row.id, 'dato')}
                    />
                  )}
                </td>

                <td style={getStandardGridCellStyle({ align: 'right' })}>
                  {isBaseRow ? (
                    <GridReadOnlyLockedCell
                      gridCell={{ rowId: row.id, colIndex: 1 }}
                      displayValue={formatLockedPercentDisplay(0)}
                      align="right"
                      placeholder={LOCKED_PERCENT_PLACEHOLDER}
                    />
                  ) : (
                    <TablePercentInput
                      gridCell={{ rowId: row.id, colIndex: 1 }}
                      undoFieldPathAliases={getUndoFieldPathAliases(row.id, 1)}
                      value={row.procent}
                      placeholder={TWO_DECIMAL_PERCENT_PLACEHOLDER}
                      onBlur={(e) => commitRowUpdate(row.id, { procent: e.target.value }, 1)}
                      onErrorChange={handleErrorChange(row.id, 'procent')}
                    />
                  )}
                </td>

                <td style={getStandardGridCellStyle({ align: 'right' })}>
                  <GridReadOnlyLockedCell
                    gridCell={{ rowId: row.id, colIndex: 2 }}
                    displayValue={derivedEntry ? formatDerivedIndex(derivedEntry.indeks) : ''}
                    align="right"
                  />
                </td>

                <td style={{ ...getStandardGridCellStyle({ align: 'right' }), position: 'relative', paddingRight: '28px' }}>
                  <GridReadOnlyLockedCell
                    gridCell={{ rowId: row.id, colIndex: 3 }}
                    displayValue={derivedEntry ? formatDerivedPercent(derivedEntry.akkumuleretPct) : ''}
                    align="right"
                  />
                  {!isBaseRow && !isRowEmpty(row) && (
                    <RowDeleteButton onDelete={() => handleDeleteRow(row.id)} />
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </StandardGridTable>
    );
  }
);

LoenudviklingManuelProcentsatsTable.displayName = 'LoenudviklingManuelProcentsatsTable';

export default LoenudviklingManuelProcentsatsTable;
