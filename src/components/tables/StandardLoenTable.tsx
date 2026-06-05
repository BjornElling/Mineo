import * as React from 'react';

import TableAmountInput from '../inputs/table/TableAmountInput';
import TableIntegerInput from '../inputs/table/TableIntegerInput';
import TableYearInput from '../inputs/table/TableYearInput';
import TableWeekInput from '../inputs/table/TableWeekInput';
import TableDateInput from '../inputs/table/TableDateInput';
import type { TableInputErrorInfo } from '../../utils/tableInputContracts';

import { CURRENT_YEAR, MIN_YEAR, dateRanges_aarsloen } from '../../config/dateRanges';
import type { StandardLoenTableRow, Loenperiode } from '../../schemas/formSchemas';
import { formatAsAmount } from '../../utils/formatUtils';
import { amountValueToNumber } from '../../utils/expressionAmount';
import type {
  StandardLoenTableColumnKey,
  StandardLoenTableFirstErrorCell,
  StandardLoenTableValidationSummary,
  TableError,
} from '../../types/table';
import type { StandardLoenTableHandle } from '../../types/handles';
import { initialRow, generateRowId } from '../../domain/erstatningsopgoerelse/helpers/eoRowInitialValues';
import { createEmptyRowId } from '../../utils/rowId';
import { scrollTargetIntoView } from '../../utils/scrollTargetIntoView';
import {
  calculateStandardLoenRowDerived,
  isStandardLoenRowEffectivelyEmpty,
  roundStandardLoenAmountToTwoDecimals,
  type StandardLoenRowDerived,
} from '../../domain/aarsloen/standardLoenRowCalculations';
import {
  buildStandardLoenPeriodOrderCellErrorMessages,
  getStandardLoenTableValidation,
  isStandardLoenTableValueEffectivelyEmptyForValidation,
} from '../../domain/aarsloen/standardLoenTableValidation';
import { getStandardLoenTableHeaderNodes } from '../../domain/aarsloen/standardLoenTableColumns';

import { StandardGridHeaderCell, StandardGridTable } from './StandardGridTable';
import { getStandardGridBodyRowStyle, getStandardGridCellStyle } from './gridCore/standardGridStyles';
import { normalizeGridRows } from './gridCore/gridModel';
import { useTableSort } from './useTableSort';
import {
  applyRowRemovalFocusPlan,
  evaluateRowCommit,
  type RowRemovalFocusPlan,
} from './gridCore/tableRowFocus';
import { useRegisterTableSaveOrder } from './useRegisterTableSaveOrder';
import type { TableSaveOrderPath } from '../../utils/tableSaveOrderRegistry';

export type StandardLoenTableSatser = {
  ferie?: number;
  fritvalg?: number;
  shSo?: number;
  bededag?: number;
  pension?: number;
};

export type StandardLoenTableProps = {
  loenperiode: Loenperiode;
  satser: StandardLoenTableSatser;
  tableData: StandardLoenTableRow[];
  onTableDataChange?: (data: StandardLoenTableRow[], options?: Readonly<{ fieldPath?: string }>) => void;
  onValidationChange?: (summary: StandardLoenTableValidationSummary) => void;
  externalCellErrorMessagesByCellKey?: Readonly<Record<string, string>>;
  useSmallFont?: boolean;
  saveOrderPath?: TableSaveOrderPath;
  calculateDerivedRow?: (row: StandardLoenTableRow) => StandardLoenRowDerived;
};

const MIN_VISIBLE_ROWS = 2;

const TABLE_FINGERPRINT_KEYS = [
  'id',
  'col0_maaned',
  'col1_maaned',
  'col0_uge',
  'col1_uge',
  'col0_dag',
  'col1_dag',
  'col2',
  'col3',
  'col4',
  'col5',
] as const satisfies ReadonlyArray<keyof StandardLoenTableRow>;

const fingerprintTableData = (rows: readonly StandardLoenTableRow[]): string => {
  return JSON.stringify(rows.map((row) => TABLE_FINGERPRINT_KEYS.map((key) => row[key] ?? null)));
};

const fingerprintValidationSummary = (summary: StandardLoenTableValidationSummary): string => {
  return JSON.stringify(summary);
};

const resolveColIdxFromKey = (colKey: StandardLoenTableColumnKey): number => {
  return colKey.startsWith('col0_') ? 0 : colKey.startsWith('col1_') ? 1 : Number.parseInt(colKey.slice(3), 10);
};

const buildCellKey = (rowId: string, colKey: StandardLoenTableColumnKey): string => {
  return `${rowId}:${resolveColIdxFromKey(colKey)}`;
};

type TableRowsState = {
  draft: StandardLoenTableRow[];
  committed: StandardLoenTableRow[];
};

type PendingPersist = Readonly<{
  data: StandardLoenTableRow[];
  fieldPath?: string;
}>;

const StandardLoenTable = React.memo(React.forwardRef<StandardLoenTableHandle, StandardLoenTableProps>(
  ({ loenperiode, satser, tableData, onTableDataChange, onValidationChange, externalCellErrorMessagesByCellKey = {}, useSmallFont = false, saveOrderPath, calculateDerivedRow }, ref) => {
    const defaultTableData = React.useMemo<StandardLoenTableRow[]>(() => {
      return [
        { ...initialRow, id: generateRowId() },
        { ...initialRow, id: generateRowId() },
      ];
    }, []);

    const lastPersistedFingerprintRef = React.useRef<string | null>(null);
    const pendingPersistRef = React.useRef<PendingPersist | null>(null);
    const tableRef = React.useRef<HTMLTableElement | null>(null);
    const pendingRowFocusPlanRef = React.useRef<RowRemovalFocusPlan | null>(null);
    const visibleRowIdsRef = React.useRef<readonly string[]>([]);

    const persistTableData = React.useCallback(
      (internalData: StandardLoenTableRow[], options?: Readonly<{ fieldPath?: string }>) => {
        if (!onTableDataChange) return;
        lastPersistedFingerprintRef.current = fingerprintTableData(internalData);
        onTableDataChange(internalData, options);
      },
      [onTableDataChange]
    );

    const isRowEmpty = React.useCallback(
      (row: StandardLoenTableRow): boolean => isStandardLoenRowEffectivelyEmpty(row, loenperiode),
      [loenperiode]
    );

    // Determinisme-kontrakt (se normalizeGridRows): id'et udledes af seed'et, ikke en RNG,
    // så StrictMode-dobbeltinvokering af setState-updateren ikke giver divergerende id'er.
    const createEmptyRow = React.useCallback((seed: number): StandardLoenTableRow => {
      return { ...initialRow, id: createEmptyRowId('row', seed) };
    }, []);

    const manageRows = React.useCallback(
      (rows: readonly StandardLoenTableRow[]): StandardLoenTableRow[] => {
        return normalizeGridRows({ rows, minRows: MIN_VISIBLE_ROWS, getRowId: (row) => row.id, isRowEmpty, createEmptyRow });
      },
      [createEmptyRow, isRowEmpty]
    );

    const [rowsState, setRowsState] = React.useState<TableRowsState>(() => {
      const managed = tableData && tableData.length > 0 ? manageRows(tableData) : manageRows(defaultTableData);
      return { draft: managed, committed: managed };
    });

    // KRITISK: Brug rowsState.draft direkte i stedet for at destructure
    // Dette sikrer at persist-effekten altid ser den nyeste state
    const committedTableData = rowsState.committed;

    React.useEffect(() => {
      if (tableData && tableData.length > 0) {
        const managedData = manageRows(tableData);
        const managedFingerprint = fingerprintTableData(managedData);
        if (lastPersistedFingerprintRef.current === managedFingerprint) return;
        // Opdater ref når vi synkroniserer fra prop (fx sessionStorage load)
        lastPersistedFingerprintRef.current = managedFingerprint;
        setRowsState({ draft: managedData, committed: managedData });
        return;
      }
      if (tableData && tableData.length === 0) {
        const managed = manageRows(defaultTableData);
        setRowsState({ draft: managed, committed: managed });
      }
    }, [defaultTableData, manageRows, tableData]);

    // Bevidst: ændring af loenperiode committer alle draft-edits og re-evaluerer rækkers tomhed
    // mod de nyligt aktive periode-kolonner, så forældede skjulte periodeværdier ikke kan holde rækker i live.
    React.useEffect(() => {
      setRowsState((current) => {
        const managed = manageRows(current.draft);
        return { draft: managed, committed: managed };
      });
    }, [loenperiode, manageRows]);

    const queuePersist = React.useCallback((dataToPersist: StandardLoenTableRow[], options?: Readonly<{ fieldPath?: string }>) => {
      pendingPersistRef.current = { data: dataToPersist, fieldPath: options?.fieldPath };
    }, []);

    const reorderRows = React.useCallback((nextRows: StandardLoenTableRow[]) => {
      const managed = manageRows(nextRows);
      const managedFingerprint = fingerprintTableData(managed);
      const committedFingerprint = fingerprintTableData(rowsState.committed);
      if (managedFingerprint === committedFingerprint) return;
      queuePersist(managed);
      setRowsState({ draft: managed, committed: managed });
    }, [manageRows, queuePersist, rowsState.committed]);

    React.useEffect(() => {
      if (!pendingPersistRef.current) return;

      // KRITISK: Match via fingerprint i stedet for reference-equality
      // fordi React kan returnere ny reference selvom data er det samme
      const pending = pendingPersistRef.current;
      const pendingFingerprint = fingerprintTableData(pending.data);
      const draftFingerprint = fingerprintTableData(rowsState.draft);

      if (pendingFingerprint !== draftFingerprint) return;

      // Bevidst konvergens: efterfølgende tomme rækker produceret af tabel-normaliseringen
      // persisteres på samme måde som i andre dynamiske tabeller.
      persistTableData(rowsState.draft, { fieldPath: pending.fieldPath });
      pendingPersistRef.current = null;
    }, [rowsState.draft, persistTableData]);

    const setCellValue = React.useCallback(
      (row: StandardLoenTableRow, colKey: StandardLoenTableColumnKey, value: StandardLoenTableRow[StandardLoenTableColumnKey]): StandardLoenTableRow => {
        switch (colKey) {
          case 'col0_maaned':
            return (row.col0_maaned ?? '') === value ? row : { ...row, col0_maaned: value as StandardLoenTableRow['col0_maaned'] };
          case 'col1_maaned':
            return (row.col1_maaned ?? '') === value ? row : { ...row, col1_maaned: value as StandardLoenTableRow['col1_maaned'] };
          case 'col0_uge':
            return (row.col0_uge ?? '') === value ? row : { ...row, col0_uge: value as StandardLoenTableRow['col0_uge'] };
          case 'col1_uge':
            return (row.col1_uge ?? '') === value ? row : { ...row, col1_uge: value as StandardLoenTableRow['col1_uge'] };
          case 'col0_dag':
            return (row.col0_dag ?? '') === value ? row : { ...row, col0_dag: value as StandardLoenTableRow['col0_dag'] };
          case 'col1_dag':
            return (row.col1_dag ?? '') === value ? row : { ...row, col1_dag: value as StandardLoenTableRow['col1_dag'] };
          case 'col2':
            return row.col2 === value ? row : { ...row, col2: value as StandardLoenTableRow['col2'] };
          case 'col3':
            return row.col3 === value ? row : { ...row, col3: value as StandardLoenTableRow['col3'] };
          case 'col4':
            return row.col4 === value ? row : { ...row, col4: value as StandardLoenTableRow['col4'] };
          case 'col5':
            return row.col5 === value ? row : { ...row, col5: value as StandardLoenTableRow['col5'] };
          default:
            return row;
        }
      },
      []
    );

    const updateCellValueInTable = React.useCallback(
      (rows: StandardLoenTableRow[], rowId: string, colKey: StandardLoenTableColumnKey, value: StandardLoenTableRow[StandardLoenTableColumnKey]): StandardLoenTableRow[] => {
        const rowIdx = rows.findIndex((row) => row.id === rowId);
        if (rowIdx < 0) return rows;
        const currentRow = rows[rowIdx];
        const nextRow = setCellValue(currentRow, colKey, value);
        if (nextRow === currentRow) return rows;
        const nextRows = rows.slice();
        nextRows[rowIdx] = nextRow;
        return nextRows;
      },
      [setCellValue]
    );

    const handleFieldBlur = React.useCallback(
      (rowId: string, colKey: StandardLoenTableColumnKey, value: StandardLoenTableRow[StandardLoenTableColumnKey]) => {
        setRowsState((prev) => {
          const updated = updateCellValueInTable(prev.draft, rowId, colKey, value);
          const managed = manageRows(updated);

          // Bevidst Mineo-kontrakt: tabel-edits forbliver i draft mens man typer.
          // Afledte værdier og downstream-beregninger må kun opdatere fra committede rækker ved blur.
          // KRITISK: Sammenlign mod prev.committed (ikke prev.draft)
          // handleFieldBlur er en commit-handler - baseline skal ALTID være committed
          const managedFingerprint = fingerprintTableData(managed);
          const committedFingerprint = fingerprintTableData(prev.committed);
          if (managedFingerprint === committedFingerprint) return prev;

          const commitEval = evaluateRowCommit({
            table: tableRef.current,
            prevRows: prev.draft,
            nextRows: managed,
            rowId,
            colIndex: resolveColIdxFromKey(colKey),
            visibleRowIds: visibleRowIdsRef.current,
            isRowEmpty,
            getRowId: (row) => row.id,
            getFingerprint: fingerprintTableData,
            lastPersistedFingerprint: lastPersistedFingerprintRef.current,
          });

          if (commitEval.focusPlan) {
            // Last-plan-wins by design: kun det sidste commit i en render-cyklus skal afgøre fokus-gendannelse.
            pendingRowFocusPlanRef.current = commitEval.focusPlan;
          }

          if (commitEval.shouldPersist) {
            queuePersist(managed, { fieldPath: `${rowId}:${resolveColIdxFromKey(colKey)}` });
          }
          return { draft: managed, committed: managed };
        });
      },
      [isRowEmpty, manageRows, queuePersist, updateCellValueInTable]
    );

    const committedById = React.useMemo(() => new Map(committedTableData.map((row) => [row.id, row])), [committedTableData]);
    const resolveCommittedRow = React.useCallback((row: StandardLoenTableRow) => committedById.get(row.id) ?? row, [committedById]);

    const cellErrorsByCellKeyRef = React.useRef<Set<string>>(new Set());

    React.useEffect(() => {
      const validRowIds = new Set(rowsState.draft.map((row) => row.id));
      const current = cellErrorsByCellKeyRef.current;
      for (const cellKey of current) {
        const separatorIdx = cellKey.indexOf(':');
        if (separatorIdx < 0) continue;
        const rowId = cellKey.slice(0, separatorIdx);
        if (!validRowIds.has(rowId)) {
          current.delete(cellKey);
        }
      }
    }, [rowsState.draft]);

    // KRITISK INVARIANT: Table*Input-komponenter SKAL kalde handleErrorChange deterministisk
    // ved alle transitions mellem {ingen fejl ↔ fejl} og {fejl A ↔ fejl B}.
    // Hvis error-emission throttles/debounces/kun sker på blur, kan tabel-validering blive stale.
    const getSatserInput = React.useCallback(() => {
      return {
        feriePct: satser?.ferie,
        fritvalgPct: satser?.fritvalg,
        shSoPct: satser?.shSo,
        storeBededagPct: satser?.bededag,
        pensionPct: satser?.pension,
      };
    }, [satser?.bededag, satser?.ferie, satser?.fritvalg, satser?.pension, satser?.shSo]);

    const calculateRow = React.useCallback(
      (row: StandardLoenTableRow): { col6: number; col7: number; col8: number } => {
        const derived = calculateDerivedRow ? calculateDerivedRow(row) : calculateStandardLoenRowDerived(row, getSatserInput());
        return {
          col6: derived.fpFvShSo,
          col7: derived.pension,
          col8: roundStandardLoenAmountToTwoDecimals(derived.samlet),
        };
      },
      [calculateDerivedRow, getSatserInput]
    );

    const periodOrderCellErrorMessagesByCellKey = React.useMemo(
      () => buildStandardLoenPeriodOrderCellErrorMessages(committedTableData, loenperiode),
      [committedTableData, loenperiode]
    );

    // cellErrorsByCellKeyRef er bevidst IKKE i deps-arrayet — det er en mutable ref og
    // læses altid på call-tidspunktet, så resultatet er altid aktuelt uanset hvornår React kalder dette.
    const getValidationResult = React.useCallback(() => {
      const combinedCellErrorsByCellKey: Record<string, true> = {};
      for (const cellKey of cellErrorsByCellKeyRef.current) {
        combinedCellErrorsByCellKey[cellKey] = true;
      }
      for (const [cellKey, message] of Object.entries(periodOrderCellErrorMessagesByCellKey)) {
        if (message.trim() === '') continue;
        combinedCellErrorsByCellKey[cellKey] = true;
      }
      for (const [cellKey, message] of Object.entries(externalCellErrorMessagesByCellKey)) {
        if (message.trim() === '') continue;
        combinedCellErrorsByCellKey[cellKey] = true;
      }
      return getStandardLoenTableValidation({
        rows: committedTableData,
        loenperiode,
        cellErrorsByCellKey: combinedCellErrorsByCellKey,
      });
    }, [committedTableData, externalCellErrorMessagesByCellKey, loenperiode, periodOrderCellErrorMessagesByCellKey]);

    const lastValidationSummaryRef = React.useRef<string | null>(null);

    const notifyValidationChange = React.useCallback(() => {
      if (!onValidationChange) return;
      const summary = getValidationResult().summary;
      const summaryFingerprint = fingerprintValidationSummary(summary);
      if (lastValidationSummaryRef.current === summaryFingerprint) return;
      lastValidationSummaryRef.current = summaryFingerprint;
      onValidationChange(summary);
    }, [getValidationResult, onValidationChange]);

    const handleErrorChange = React.useCallback((rowId: string, colKey: StandardLoenTableColumnKey, info: TableInputErrorInfo) => {
      const key = buildCellKey(rowId, colKey);
      const hadError = cellErrorsByCellKeyRef.current.has(key);
      if (info.hasError) {
        if (hadError) return;
        cellErrorsByCellKeyRef.current.add(key);
      } else {
        if (!hadError) return;
        cellErrorsByCellKeyRef.current.delete(key);
      }
      notifyValidationChange();
    }, [notifyValidationChange]);

    React.useEffect(() => {
      notifyValidationChange();
    }, [committedTableData, loenperiode, notifyValidationChange]);

    const parseSortableInteger = React.useCallback((value: string | undefined): number | undefined => {
      const trimmed = value?.trim() ?? '';
      if (trimmed === '') return undefined;
      const parsed = Number.parseInt(trimmed, 10);
      return Number.isFinite(parsed) ? parsed : undefined;
    }, []);

    const parseSortableWeekKey = React.useCallback((value: string | undefined): string | undefined => {
      const trimmed = value?.trim() ?? '';
      if (trimmed === '') return undefined;
      const parts = trimmed.split('/');
      if (parts.length !== 2) return undefined;
      const week = Number.parseInt(parts[0] ?? '', 10);
      const year = Number.parseInt(parts[1] ?? '', 10);
      if (!Number.isFinite(week) || !Number.isFinite(year)) return undefined;
      if (week < 1 || week > 53) return undefined;
      return `${year.toString().padStart(4, '0')}-${week.toString().padStart(2, '0')}`;
    }, []);

    const sortColumns = React.useMemo(() => [
      {
        colId: 'col-0',
        getSortValue: (row: StandardLoenTableRow) => {
          const committed = resolveCommittedRow(row);
          if (loenperiode === 'maaned') return parseSortableInteger(committed.col0_maaned);
          if (loenperiode === 'uge') return parseSortableWeekKey(committed.col0_uge);
          return committed.col0_dag ?? '';
        },
      },
      {
        colId: 'col-1',
        getSortValue: (row: StandardLoenTableRow) => {
          const committed = resolveCommittedRow(row);
          if (loenperiode === 'maaned') return parseSortableInteger(committed.col1_maaned);
          if (loenperiode === 'uge') return parseSortableWeekKey(committed.col1_uge);
          return committed.col1_dag ?? '';
        },
      },
      { colId: 'col-2', getSortValue: (row: StandardLoenTableRow) => amountValueToNumber(resolveCommittedRow(row).col2) },
      { colId: 'col-3', getSortValue: (row: StandardLoenTableRow) => amountValueToNumber(resolveCommittedRow(row).col3) },
      { colId: 'col-4', getSortValue: (row: StandardLoenTableRow) => amountValueToNumber(resolveCommittedRow(row).col4) },
      { colId: 'col-5', getSortValue: (row: StandardLoenTableRow) => amountValueToNumber(resolveCommittedRow(row).col5) },
      { colId: 'col-6', getSortValue: (row: StandardLoenTableRow) => calculateRow(resolveCommittedRow(row)).col6 },
      { colId: 'col-7', getSortValue: (row: StandardLoenTableRow) => calculateRow(resolveCommittedRow(row)).col7 },
      { colId: 'col-8', getSortValue: (row: StandardLoenTableRow) => calculateRow(resolveCommittedRow(row)).col8 },
    ], [calculateRow, loenperiode, parseSortableInteger, parseSortableWeekKey, resolveCommittedRow]);

    const { sortedRows: visibleRows, getSortRole, getSortDirection, handleHeaderClick } = useTableSort({
      rows: rowsState.draft,
      getRowId: (row) => row.id,
      isRowEmpty,
      columns: sortColumns,
      onSortedRowsChange: reorderRows,
    });
    const visibleRowIds = React.useMemo(() => visibleRows.map((row) => row.id), [visibleRows]);
    useRegisterTableSaveOrder(saveOrderPath, visibleRowIds);

    React.useLayoutEffect(() => {
      visibleRowIdsRef.current = visibleRowIds;
    }, [visibleRowIds]);

    React.useLayoutEffect(() => {
      const plan = pendingRowFocusPlanRef.current;
      if (!plan) return;
      applyRowRemovalFocusPlan({ table: tableRef.current, plan, visibleRowIds });
      pendingRowFocusPlanRef.current = null;
    }, [visibleRowIds]);

    const [errorCell, setErrorCell] = React.useState<{ rowId: string; colIdx: number } | null>(null);
    const [externalCellError, setExternalCellError] = React.useState<{ rowId: string; colKey: StandardLoenTableColumnKey; message: string } | null>(null);
    const cellRefsByCellKeyRef = React.useRef<Record<string, HTMLInputElement | null>>({});
    const registerCellRef = React.useCallback(
      (rowId: string, colIdx: number) => (el: HTMLInputElement | null) => {
        cellRefsByCellKeyRef.current[`${rowId}:${colIdx}`] = el;
      },
      []
    );

    const isVisibleColKey = React.useCallback(
      (colKey: StandardLoenTableColumnKey): boolean => {
        if (colKey === 'col0_maaned' || colKey === 'col1_maaned') return loenperiode === 'maaned';
        if (colKey === 'col0_uge' || colKey === 'col1_uge') return loenperiode === 'uge';
        if (colKey === 'col0_dag' || colKey === 'col1_dag') return loenperiode === 'dag';
        return true;
      },
      [loenperiode]
    );

    const getExternalErrorMessage = React.useCallback(
      (rowId: string, colKey: StandardLoenTableColumnKey): string | undefined => {
        const numericCellKey = buildCellKey(rowId, colKey);
        const periodOrderMessage = periodOrderCellErrorMessagesByCellKey[numericCellKey];
        if (periodOrderMessage && isVisibleColKey(colKey)) {
          return periodOrderMessage;
        }
        if (externalCellError && externalCellError.rowId === rowId && externalCellError.colKey === colKey && isVisibleColKey(colKey)) {
          return externalCellError.message;
        }
        const propErrorMessage = externalCellErrorMessagesByCellKey[`${rowId}:${colKey}`];
        if (!propErrorMessage || !isVisibleColKey(colKey)) return undefined;
        return propErrorMessage;
      },
      [externalCellError, externalCellErrorMessagesByCellKey, isVisibleColKey, periodOrderCellErrorMessagesByCellKey]
    );

    React.useEffect(() => {
      if (!externalCellError) return;
      if (!isVisibleColKey(externalCellError.colKey)) {
        setExternalCellError(null);
        return;
      }
      const row = committedTableData.find((item) => item.id === externalCellError.rowId);
      if (!row) {
        setExternalCellError(null);
        return;
      }
      const value = row[externalCellError.colKey];
      const isEmpty = isStandardLoenTableValueEffectivelyEmptyForValidation(value);
      const cellKey = buildCellKey(externalCellError.rowId, externalCellError.colKey);
      const hasInputError = cellErrorsByCellKeyRef.current.has(cellKey);
      if (!isEmpty || hasInputError) {
        setExternalCellError(null);
      }
    }, [committedTableData, externalCellError, isVisibleColKey]);

    const getCellStyle = (rowId: string, colIdx: number, baseStyle: React.CSSProperties = {}): React.CSSProperties => {
      return {
        ...baseStyle,
        animation: errorCell?.rowId === rowId && errorCell?.colIdx === colIdx ? 'errorFlash 0.5s ease-in-out 3' : 'none',
      };
    };

    React.useImperativeHandle(
      ref,
      () => ({
        getErrors: (): TableError[] => getValidationResult().errors,
        getValidationSummary: (): StandardLoenTableValidationSummary => getValidationResult().summary,
        showMissingEntryError: (cell: StandardLoenTableFirstErrorCell) => {
          if (cell.reason !== 'missing') return;
          if (!isVisibleColKey(cell.colKey)) return;
          setExternalCellError({
            rowId: cell.rowId,
            colKey: cell.colKey,
            message: 'Indtastning mangler',
          });
          const colIdx = resolveColIdxFromKey(cell.colKey);
          if (!Number.isFinite(colIdx)) return;
          const el = cellRefsByCellKeyRef.current[`${cell.rowId}:${colIdx}`];
          if (!el) return;
          // Valideringsfejl peger brugeren på et konkret problem; centrér altid cellen.
          scrollTargetIntoView(el, { force: true });
        },
        flashError: (error) => {
          const colKey = error.colKey;
          const colIdx = resolveColIdxFromKey(colKey);
          if (!Number.isFinite(colIdx)) return;
          const el = cellRefsByCellKeyRef.current[`${error.rowId}:${colIdx}`];
          if (!el) return;
          setErrorCell({ rowId: error.rowId, colIdx });
          scrollTargetIntoView(el, { force: true });
          window.setTimeout(() => setErrorCell(null), 2000);
        },
      }),
      [getValidationResult, isVisibleColKey]
    );

    const headers = React.useMemo(() => getStandardLoenTableHeaderNodes(loenperiode), [loenperiode]);

    return (
      <StandardGridTable
        tableWidth="1130px"
        tableRef={tableRef}
        useSmallFont={useSmallFont}
        beforeTable={
          <style>
            {`
              @keyframes errorFlash {
                0%, 100% { background-color: transparent; }
                50% { background-color: color-mix(in srgb, var(--color-status-error) 20%, transparent); }
              }
            `}
          </style>
        }
      >
        <colgroup>
          <col style={{ width: '125px' }} />
          <col style={{ width: '125px' }} />
          <col style={{ width: '125px' }} />
          <col style={{ width: '125px' }} />
          <col style={{ width: '125px' }} />
          <col style={{ width: '125px' }} />
          <col style={{ width: '125px' }} />
          <col style={{ width: '125px' }} />
          <col style={{ width: '130px' }} />
        </colgroup>

        <thead>
          <tr>
            {headers.map((header, idx) => {
              const colId = `col-${idx}`;
              return (
                <StandardGridHeaderCell
                  key={colId}
                  onClick={() => handleHeaderClick(colId)}
                  sortRole={getSortRole(colId)}
                  sortDirection={getSortDirection(colId)}
                >
                  <span style={{ whiteSpace: 'pre-line' }}>{header}</span>
                </StandardGridHeaderCell>
              );
            })}
          </tr>
        </thead>

        <tbody>
          {visibleRows.map((row, rowIndex) => {
            const committedRow = resolveCommittedRow(row);
            const calculated = calculateRow(committedRow);

            return (
              <tr key={row.id} data-mineo-row-id={row.id} style={getStandardGridBodyRowStyle(rowIndex)}>
                <td
                  style={getCellStyle(row.id, 0, {
                    ...getStandardGridCellStyle({ align: 'center' }),
                  })}
                >
                  {loenperiode === 'maaned' ? (
                    <TableIntegerInput
                      key={`${row.id}-col0-${loenperiode}`}
                      gridCell={{ rowId: row.id, colIndex: 0 }}
                      inputRef={registerCellRef(row.id, 0)}
                      value={row.col0_maaned}
                      onBlur={(e) => handleFieldBlur(row.id, 'col0_maaned', e.target.value)}
                      onErrorChange={(info) => handleErrorChange(row.id, 'col0_maaned', info)}
                      externalErrorMessage={getExternalErrorMessage(row.id, 'col0_maaned')}
                      minValue={1}
                      maxValue={12}
                      placeholder="mm"
                    />
                  ) : loenperiode === 'uge' ? (
                    <TableWeekInput
                      key={`${row.id}-col0-${loenperiode}`}
                      gridCell={{ rowId: row.id, colIndex: 0 }}
                      inputRef={registerCellRef(row.id, 0)}
                      value={row.col0_uge}
                      onBlur={(e) => handleFieldBlur(row.id, 'col0_uge', e.target.value)}
                      onErrorChange={(info) => handleErrorChange(row.id, 'col0_uge', info)}
                      externalErrorMessage={getExternalErrorMessage(row.id, 'col0_uge')}
                      minYear={MIN_YEAR}
                      maxYear={CURRENT_YEAR}
                    />
                  ) : (
                    <TableDateInput
                      key={`${row.id}-col0-${loenperiode}`}
                      gridCell={{ rowId: row.id, colIndex: 0 }}
                      inputRef={registerCellRef(row.id, 0)}
                      value={row.col0_dag}
                      onBlur={(e) => handleFieldBlur(row.id, 'col0_dag', e.target.value)}
                      onErrorChange={(info) => handleErrorChange(row.id, 'col0_dag', info)}
                      externalErrorMessage={getExternalErrorMessage(row.id, 'col0_dag')}
                      minDate={dateRanges_aarsloen.tabelAarsloenFra.min}
                      maxDate={committedRow.col1_dag ?? dateRanges_aarsloen.tabelAarsloenFra.fallbackMax}
                      specialRangeErrors={{ fraTilRole: 'fra' }}
                      noValidRangeCause="Dato til i samme række"
                    />
                  )}
                </td>

                <td
                  style={getCellStyle(row.id, 1, {
                    ...getStandardGridCellStyle({ align: 'center' }),
                  })}
                >
                  {loenperiode === 'maaned' ? (
                    <TableYearInput
                      key={`${row.id}-col1-${loenperiode}`}
                      gridCell={{ rowId: row.id, colIndex: 1 }}
                      inputRef={registerCellRef(row.id, 1)}
                      value={row.col1_maaned}
                      onBlur={(e) => handleFieldBlur(row.id, 'col1_maaned', e.target.value)}
                      onErrorChange={(info) => handleErrorChange(row.id, 'col1_maaned', info)}
                      externalErrorMessage={getExternalErrorMessage(row.id, 'col1_maaned')}
                      minYear={MIN_YEAR}
                      maxYear={CURRENT_YEAR}
                    />
                  ) : loenperiode === 'uge' ? (
                    <TableWeekInput
                      key={`${row.id}-col1-${loenperiode}`}
                      gridCell={{ rowId: row.id, colIndex: 1 }}
                      inputRef={registerCellRef(row.id, 1)}
                      value={row.col1_uge}
                      onBlur={(e) => handleFieldBlur(row.id, 'col1_uge', e.target.value)}
                      onErrorChange={(info) => handleErrorChange(row.id, 'col1_uge', info)}
                      externalErrorMessage={getExternalErrorMessage(row.id, 'col1_uge')}
                      minYear={MIN_YEAR}
                      maxYear={CURRENT_YEAR}
                    />
                  ) : (
                    <TableDateInput
                      key={`${row.id}-col1-${loenperiode}`}
                      gridCell={{ rowId: row.id, colIndex: 1 }}
                      inputRef={registerCellRef(row.id, 1)}
                      value={row.col1_dag}
                      onBlur={(e) => handleFieldBlur(row.id, 'col1_dag', e.target.value)}
                      onErrorChange={(info) => handleErrorChange(row.id, 'col1_dag', info)}
                      externalErrorMessage={getExternalErrorMessage(row.id, 'col1_dag')}
                      minDate={committedRow.col0_dag ?? dateRanges_aarsloen.tabelAarsloenTil.fallbackMin}
                      maxDate={dateRanges_aarsloen.tabelAarsloenTil.max}
                      specialRangeErrors={{ fraTilRole: 'til' }}
                      noValidRangeCause="Dato fra i samme række"
                    />
                  )}
                </td>

                {(['col2', 'col3', 'col4', 'col5'] as const).map((colKey, index) => {
                  const colIdx = index + 2;
                  return (
                    <td
                      key={`${row.id}:${colKey}`}
                      style={getCellStyle(row.id, colIdx, {
                        ...getStandardGridCellStyle({ align: 'right' }),
                      })}
                    >
                      <TableAmountInput
                        gridCell={{ rowId: row.id, colIndex: colIdx }}
                        inputRef={registerCellRef(row.id, colIdx)}
                        value={row[colKey]}
                        onBlur={(e) => handleFieldBlur(row.id, colKey, e.target.value)}
                        onErrorChange={(info) => handleErrorChange(row.id, colKey, info)}
                        externalErrorMessage={getExternalErrorMessage(row.id, colKey)}
                      />
                    </td>
                  );
                })}

                <td
                  style={{
                    ...getStandardGridCellStyle({ align: 'right' }),
                    padding: '4px',
                    color: calculated.col6 === 0 ? 'var(--color-text-secondary)' : 'inherit',
                  }}
                >
                  {formatAsAmount(calculated.col6)}
                </td>

                <td
                  style={{
                    ...getStandardGridCellStyle({ align: 'right' }),
                    padding: '4px',
                    color: calculated.col7 === 0 ? 'var(--color-text-secondary)' : 'inherit',
                  }}
                >
                  {formatAsAmount(calculated.col7)}
                </td>

                <td
                  style={{
                    ...getStandardGridCellStyle({ align: 'right' }),
                    padding: '4px',
                    color: calculated.col8 === 0 ? 'var(--color-text-secondary)' : 'inherit',
                  }}
                >
                  {formatAsAmount(calculated.col8)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </StandardGridTable>
    );
  }
));

StandardLoenTable.displayName = 'StandardLoenTable';

export default StandardLoenTable;
