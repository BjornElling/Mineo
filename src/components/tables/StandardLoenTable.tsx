import * as React from 'react';

import TableAmountInput from '../inputs/table/TableAmountInput';
import TableIntegerInput from '../inputs/table/TableIntegerInput';
import TableYearInput from '../inputs/table/TableYearInput';
import TableWeekInput from '../inputs/table/TableWeekInput';
import TableDateInput from '../inputs/table/TableDateInput';
import type { TableInputErrorInfo } from '../../utils/tableInputContracts';

import { CURRENT_YEAR, MIN_YEAR, dateRanges_aarsloen } from '../../config/dateRanges';
import type { StandardLoenTableRow, Loenperiode, TillaegAngivesSom } from '../../schemas/formSchemas';
import { formatKr } from '../../utils/formatUtils';
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
  getStandardLoenPeriodKeys,
  getStandardLoenTableValidation,
  isStandardLoenTableValueEffectivelyEmptyForValidation,
} from '../../domain/aarsloen/standardLoenTableValidation';
import { getStandardLoenTableHeaderNodes } from '../../domain/aarsloen/standardLoenTableColumns';

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
  // Beløb-tilstand: kolonnerne "FP/FV/SH/SO/St.B." og "Arb.g. Pension" bliver redigerbare
  // beløbsfelter i stedet for beregnede visningsfelter. Default 'procent' (nuværende adfærd).
  tillaegAngivesSom?: TillaegAngivesSom;
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
  // Load-bearing: uden disse persisteres Beløb-tilstandens tillægsbeløb ikke ved commit.
  'fpFvShSoBeloeb',
  'pensionBeloeb',
] as const satisfies ReadonlyArray<keyof StandardLoenTableRow>;

const fingerprintTableData = (rows: readonly StandardLoenTableRow[]): string => {
  return JSON.stringify(rows.map((row) => TABLE_FINGERPRINT_KEYS.map((key) => row[key] ?? null)));
};

const fingerprintValidationSummary = (summary: StandardLoenTableValidationSummary): string => {
  return JSON.stringify(summary);
};

const resolveColIdxFromKey = (colKey: StandardLoenTableColumnKey): number => {
  if (colKey === 'fpFvShSoBeloeb') return 6;
  if (colKey === 'pensionBeloeb') return 7;
  return colKey.startsWith('col0_') ? 0 : colKey.startsWith('col1_') ? 1 : Number.parseInt(colKey.slice(3), 10);
};

const buildCellKey = (rowId: string, colKey: StandardLoenTableColumnKey): string => {
  return `${rowId}:${resolveColIdxFromKey(colKey)}`;
};

const StandardLoenTable = React.memo(React.forwardRef<StandardLoenTableHandle, StandardLoenTableProps>(
  ({ loenperiode, satser, tableData, tillaegAngivesSom = 'procent', onTableDataChange, onValidationChange, externalCellErrorMessagesByCellKey = {}, useSmallFont = false, saveOrderPath, calculateDerivedRow }, ref) => {
    const beloebMode = tillaegAngivesSom === 'beloeb';
    const defaultTableData = React.useMemo<StandardLoenTableRow[]>(() => {
      return [
        { ...initialRow, id: generateRowId() },
        { ...initialRow, id: generateRowId() },
      ];
    }, []);

    const tableRef = React.useRef<HTMLTableElement | null>(null);
    const pendingRowFocusPlanRef = React.useRef<RowRemovalFocusPlan | null>(null);
    const visibleRowIdsRef = React.useRef<readonly string[]>([]);

    const isRowEmpty = React.useCallback(
      (row: StandardLoenTableRow): boolean => isStandardLoenRowEffectivelyEmpty(row, loenperiode, tillaegAngivesSom),
      [loenperiode, tillaegAngivesSom]
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

    const { internalTableData, setInternalTableData, lastPersistedFingerprintRef, getStrippedFingerprint, queuePersist, getUndoFieldPathAliases } =
      useGridRowPersistenceCore<StandardLoenTableRow>({
        tableData: tableData && tableData.length > 0 ? tableData : defaultTableData,
        onTableDataChange,
        normalizeRows: manageRows,
        isRowEmpty,
        getRowId: (row) => row.id,
        withRowId: (row, id) => ({ ...row, id }),
        fingerprint: fingerprintTableData,
      });

    const committedTableData = internalTableData;

    // Bevidst: ændring af loenperiode committer alle draft-edits og re-evaluerer rækkers tomhed
    // mod de nyligt aktive periode-kolonner, så forældede skjulte periodeværdier ikke kan holde rækker i live.
    React.useEffect(() => {
      setInternalTableData((current) => manageRows(current));
    }, [loenperiode, manageRows, setInternalTableData]);

    const reorderRows = React.useCallback((nextRows: StandardLoenTableRow[]) => {
      const managed = manageRows(nextRows);
      if (getStrippedFingerprint(managed) !== lastPersistedFingerprintRef.current) {
        queuePersist(managed);
      }
      setInternalTableData(managed);
    }, [getStrippedFingerprint, lastPersistedFingerprintRef, manageRows, queuePersist, setInternalTableData]);

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
          case 'fpFvShSoBeloeb':
            return row.fpFvShSoBeloeb === value ? row : { ...row, fpFvShSoBeloeb: value as StandardLoenTableRow['fpFvShSoBeloeb'] };
          case 'pensionBeloeb':
            return row.pensionBeloeb === value ? row : { ...row, pensionBeloeb: value as StandardLoenTableRow['pensionBeloeb'] };
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
        setInternalTableData((prev) => {
          const updated = updateCellValueInTable(prev, rowId, colKey, value);
          const managed = manageRows(updated);

          // Commit-handler: hvis blur ikke ændrede noget (managed === nuværende committed state),
          // skip setState/fokus-plan/persist helt.
          if (fingerprintTableData(managed) === fingerprintTableData(prev)) return prev;

          const commitEval = evaluateRowCommit({
            table: tableRef.current,
            prevRows: prev,
            nextRows: managed,
            rowId,
            colIndex: resolveColIdxFromKey(colKey),
            visibleRowIds: visibleRowIdsRef.current,
            isRowEmpty,
            getRowId: (row) => row.id,
            getFingerprint: getStrippedFingerprint,
            lastPersistedFingerprint: lastPersistedFingerprintRef.current,
          });

          if (commitEval.focusPlan) {
            // Last-plan-wins by design: kun det sidste commit i en render-cyklus skal afgøre fokus-gendannelse.
            pendingRowFocusPlanRef.current = commitEval.focusPlan;
          }

          if (commitEval.shouldPersist) {
            queuePersist(managed, `${rowId}:${resolveColIdxFromKey(colKey)}`);
          }
          return managed;
        });
      },
      [getStrippedFingerprint, isRowEmpty, lastPersistedFingerprintRef, manageRows, queuePersist, setInternalTableData, updateCellValueInTable]
    );

    // Slet hele rækken i én undo-handling: filtrér rækken ud, re-normalisér (manageRows fjerner
    // tomme rækker og genskaber den efterfølgende tomme), og persistér én gang. Ét queuePersist =
    // ét history-frame, så undo genskaber hele rækken og alle dens indtastninger.
    const handleDeleteRow = React.useCallback(
      (rowId: string) => {
        setInternalTableData((prev) => {
          const managed = manageRows(prev.filter((row) => row.id !== rowId));
          if (fingerprintTableData(managed) === fingerprintTableData(prev)) return prev;
          queuePersist(managed);
          return managed;
        });
      },
      [manageRows, queuePersist, setInternalTableData]
    );

    const committedById = React.useMemo(() => new Map(committedTableData.map((row) => [row.id, row])), [committedTableData]);
    const resolveCommittedRow = React.useCallback((row: StandardLoenTableRow) => committedById.get(row.id) ?? row, [committedById]);

    const cellErrorTracker = useTableCellErrorTracker();

    // Renderede rækker (inkl. efterfølgende tom række) — liveness-grundlag for BÅDE celle-fejl-trackeren
    // og `invalidDrafts`-reconcile, så en slettet rækkes celle-fejl/rå-draft ikke kan overleve i Gem-gaten.
    const liveRowIds = React.useMemo(() => new Set(internalTableData.map((row) => row.id)), [internalTableData]);

    React.useEffect(() => {
      cellErrorTracker.pruneToValidRowIds(liveRowIds);
    }, [cellErrorTracker, liveRowIds]);

    useReconcileInvalidDraftsToLiveRows(liveRowIds);

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
        const derived = calculateDerivedRow ? calculateDerivedRow(row) : calculateStandardLoenRowDerived(row, getSatserInput(), { mode: tillaegAngivesSom });
        return {
          col6: derived.fpFvShSo,
          col7: derived.pension,
          col8: roundStandardLoenAmountToTwoDecimals(derived.samlet),
        };
      },
      [calculateDerivedRow, getSatserInput, tillaegAngivesSom]
    );

    const periodOrderCellErrorMessagesByCellKey = React.useMemo(
      () => buildStandardLoenPeriodOrderCellErrorMessages(committedTableData, loenperiode),
      [committedTableData, loenperiode]
    );

    // Celle-fejl læses via trackerens read-time-filtrering (mod gyldige rækker), så resultatet
    // altid er aktuelt uanset hvornår React kalder dette — og en fjernet rækkes fejl aldrig
    // overlever ind i valideringen, selv før prune-effecten er nået at køre.
    const getValidationResult = React.useCallback(() => {
      const validRowIds = new Set(committedTableData.map((row) => row.id));
      const combinedCellErrorsByCellKey: Record<string, true> = {};
      for (const cellKey of cellErrorTracker.getActiveCellKeys(validRowIds)) {
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
        tillaegAngivesSom,
      });
    }, [cellErrorTracker, committedTableData, externalCellErrorMessagesByCellKey, loenperiode, periodOrderCellErrorMessagesByCellKey, tillaegAngivesSom]);

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
      if (cellErrorTracker.setCellError(buildCellKey(rowId, colKey), info.hasError)) {
        notifyValidationChange();
      }
    }, [cellErrorTracker, notifyValidationChange]);

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
      {
        colId: 'col-6',
        getSortValue: (row: StandardLoenTableRow) => beloebMode
          ? amountValueToNumber(resolveCommittedRow(row).fpFvShSoBeloeb)
          : calculateRow(resolveCommittedRow(row)).col6,
      },
      {
        colId: 'col-7',
        getSortValue: (row: StandardLoenTableRow) => beloebMode
          ? amountValueToNumber(resolveCommittedRow(row).pensionBeloeb)
          : calculateRow(resolveCommittedRow(row)).col7,
      },
      { colId: 'col-8', getSortValue: (row: StandardLoenTableRow) => calculateRow(resolveCommittedRow(row)).col8 },
    ], [beloebMode, calculateRow, loenperiode, parseSortableInteger, parseSortableWeekKey, resolveCommittedRow]);

    const { sortedRows: visibleRows, getSortRole, getSortDirection, handleHeaderClick } = useTableSort({
      rows: internalTableData,
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
      const hasInputError = cellErrorTracker.getActiveCellKeys(new Set([externalCellError.rowId])).includes(cellKey);
      if (!isEmpty || hasInputError) {
        setExternalCellError(null);
      }
    }, [cellErrorTracker, committedTableData, externalCellError, isVisibleColKey]);

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
        showNeedsPeriodHint: () => {
          // Ingen konkret fejlcelle (typisk en helt tom tabel): peg på første periodecelle med samme
          // "Indtastning mangler"-visning som øvrige manglende felter, så omregning-aktivering uden
          // gyldig periode giver en konkret pegepind frem for en stum rystelse.
          const firstRow = committedTableData[0];
          if (!firstRow) return;
          const [periodStartKey] = getStandardLoenPeriodKeys(loenperiode);
          if (!isVisibleColKey(periodStartKey)) return;
          setExternalCellError({ rowId: firstRow.id, colKey: periodStartKey, message: 'Indtastning mangler' });
          const colIdx = resolveColIdxFromKey(periodStartKey);
          if (!Number.isFinite(colIdx)) return;
          const el = cellRefsByCellKeyRef.current[`${firstRow.id}:${colIdx}`];
          if (!el) return;
          scrollTargetIntoView(el, { force: true });
        },
      }),
      [committedTableData, getValidationResult, isVisibleColKey, loenperiode]
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
                      undoFieldPathAliases={getUndoFieldPathAliases(row.id, 0)}
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
                      undoFieldPathAliases={getUndoFieldPathAliases(row.id, 0)}
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
                      undoFieldPathAliases={getUndoFieldPathAliases(row.id, 0)}
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
                      undoFieldPathAliases={getUndoFieldPathAliases(row.id, 1)}
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
                      undoFieldPathAliases={getUndoFieldPathAliases(row.id, 1)}
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
                      undoFieldPathAliases={getUndoFieldPathAliases(row.id, 1)}
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
                        undoFieldPathAliases={getUndoFieldPathAliases(row.id, colIdx)}
                        inputRef={registerCellRef(row.id, colIdx)}
                        value={row[colKey]}
                        onBlur={(e) => handleFieldBlur(row.id, colKey, e.target.value)}
                        onErrorChange={(info) => handleErrorChange(row.id, colKey, info)}
                        externalErrorMessage={getExternalErrorMessage(row.id, colKey)}
                      />
                    </td>
                  );
                })}

                {beloebMode ? (
                  <td
                    style={getCellStyle(row.id, 6, {
                      ...getStandardGridCellStyle({ align: 'right' }),
                    })}
                  >
                    <TableAmountInput
                      gridCell={{ rowId: row.id, colIndex: 6 }}
                      undoFieldPathAliases={getUndoFieldPathAliases(row.id, 6)}
                      inputRef={registerCellRef(row.id, 6)}
                      value={row.fpFvShSoBeloeb}
                      onBlur={(e) => handleFieldBlur(row.id, 'fpFvShSoBeloeb', e.target.value)}
                      onErrorChange={(info) => handleErrorChange(row.id, 'fpFvShSoBeloeb', info)}
                      externalErrorMessage={getExternalErrorMessage(row.id, 'fpFvShSoBeloeb')}
                    />
                  </td>
                ) : (
                  <td
                    style={{
                      ...getStandardGridCellStyle({ align: 'right' }),
                      padding: '4px',
                      color: calculated.col6 === 0 ? 'var(--mineo-color-grid-derived)' : 'inherit',
                    }}
                  >
                    {formatKr(calculated.col6, 2)}
                  </td>
                )}

                {beloebMode ? (
                  <td
                    style={getCellStyle(row.id, 7, {
                      ...getStandardGridCellStyle({ align: 'right' }),
                    })}
                  >
                    <TableAmountInput
                      gridCell={{ rowId: row.id, colIndex: 7 }}
                      undoFieldPathAliases={getUndoFieldPathAliases(row.id, 7)}
                      inputRef={registerCellRef(row.id, 7)}
                      value={row.pensionBeloeb}
                      onBlur={(e) => handleFieldBlur(row.id, 'pensionBeloeb', e.target.value)}
                      onErrorChange={(info) => handleErrorChange(row.id, 'pensionBeloeb', info)}
                      externalErrorMessage={getExternalErrorMessage(row.id, 'pensionBeloeb')}
                    />
                  </td>
                ) : (
                  <td
                    style={{
                      ...getStandardGridCellStyle({ align: 'right' }),
                      padding: '4px',
                      color: calculated.col7 === 0 ? 'var(--mineo-color-grid-derived)' : 'inherit',
                    }}
                  >
                    {formatKr(calculated.col7, 2)}
                  </td>
                )}

                <td
                  style={{
                    ...getStandardGridCellStyle({ align: 'right' }),
                    padding: '4px',
                    // Reserveret bane til højre for værdien, hvor slet-ikonet vises (dækker ikke "I alt").
                    paddingRight: '28px',
                    position: 'relative',
                    color: calculated.col8 === 0 ? 'var(--mineo-color-grid-derived)' : 'inherit',
                  }}
                >
                  {formatKr(calculated.col8, 2)}
                  {!isRowEmpty(committedRow) && (
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
));

StandardLoenTable.displayName = 'StandardLoenTable';

export default StandardLoenTable;
