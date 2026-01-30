import * as React from 'react';

import TableAmountInput from '../inputs/table/TableAmountInput';
import TableIntegerInput from '../inputs/table/TableIntegerInput';
import TableYearInput from '../inputs/table/TableYearInput';
import TableWeekInput from '../inputs/table/TableWeekInput';
import TableDateInput from '../inputs/table/TableDateInput';
import type { TableInputErrorInfo } from '../inputs/table/tableInputContracts';

import { MAX_YEAR, MIN_YEAR, dateRanges_aarsloen, formatToISO } from '../../config/dateRanges';
import type { AarsloenTableRow, Loenperiode } from '../../schemas/formSchemas';
import type { AmountValue } from '../../schemas/amountExpressionSchema';
import { amountValueToNumber } from '../../utils/expressionAmount';
import type { AarsloenTableColumnKey, AarsloenTableHandle, TableError } from '../../types/common';
import { initialRow, generateRowId } from '../../utils/eoConverters';
import { calculateAarsloenRowDerived, hasAtLeastOneValidRow, isAarsloenRowEffectivelyEmpty } from '../../utils/aarsloenTableCalculations';

import { StandardGridHeaderCell, StandardGridTable, getStandardGridBodyRowStyle, getStandardGridCellStyle } from './StandardGridTable';
import { getGridSortRole, normalizeGridRows, sortGridRows, toggleGridSort, type GridSortDirection, type GridSortState } from './gridModel';

export type AarsloenTableSatser = {
  ferie?: number;
  fritvalg?: number;
  shSo?: number;
  bededag?: number;
  pension?: number;
};

export type AarsloenTableProps = {
  loenperiode: Loenperiode;
  satser: AarsloenTableSatser;
  tableData: AarsloenTableRow[];
  onTableDataChange?: (data: AarsloenTableRow[]) => void;
  onValidationChange?: (errors: TableError[]) => void;
  useSmallFont?: boolean;
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
] as const satisfies ReadonlyArray<keyof AarsloenTableRow>;

const fingerprintTableData = (rows: readonly AarsloenTableRow[]): string => {
  return JSON.stringify(rows.map((row) => TABLE_FINGERPRINT_KEYS.map((key) => row[key] ?? null)));
};

const isRowEmpty = (row: AarsloenTableRow): boolean => isAarsloenRowEffectivelyEmpty(row);

type TableRowsState = {
  draft: AarsloenTableRow[];
  committed: AarsloenTableRow[];
};

const AarsloenTable = React.forwardRef<AarsloenTableHandle, AarsloenTableProps>(
  ({ loenperiode, satser, tableData, onTableDataChange, onValidationChange, useSmallFont = false }, ref) => {
    const defaultTableData = React.useMemo<AarsloenTableRow[]>(() => {
      return [
        { ...initialRow, id: generateRowId() },
        { ...initialRow, id: generateRowId() },
      ];
    }, []);

    const lastPersistedDataRef = React.useRef<AarsloenTableRow[] | null>(null);
    const lastPersistedFingerprintRef = React.useRef<string | null>(null);
    const pendingPersistRef = React.useRef<AarsloenTableRow[] | null>(null);

    const persistTableData = React.useCallback(
      (internalData: AarsloenTableRow[]) => {
        if (!onTableDataChange) return;
        lastPersistedDataRef.current = internalData;
        lastPersistedFingerprintRef.current = fingerprintTableData(internalData);
        onTableDataChange(internalData);
      },
      [onTableDataChange]
    );

    const createEmptyRow = React.useCallback((): AarsloenTableRow => {
      return { ...initialRow, id: generateRowId() };
    }, []);

    const manageRows = React.useCallback(
      (rows: readonly AarsloenTableRow[]): AarsloenTableRow[] => {
        return normalizeGridRows({ rows, minRows: MIN_VISIBLE_ROWS, isRowEmpty, createEmptyRow });
      },
      [createEmptyRow]
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
        lastPersistedDataRef.current = managedData;
        setRowsState({ draft: managedData, committed: managedData });
        return;
      }
      if (tableData && tableData.length === 0) {
        const managed = manageRows(defaultTableData);
        setRowsState({ draft: managed, committed: managed });
      }
    }, [defaultTableData, manageRows, tableData]);

    React.useEffect(() => {
      setRowsState((current) => {
        const managed = manageRows(current.draft);
        return { draft: managed, committed: managed };
      });
    }, [loenperiode, manageRows]);

    const queuePersist = React.useCallback((dataToPersist: AarsloenTableRow[]) => {
      pendingPersistRef.current = dataToPersist;
    }, []);

    React.useEffect(() => {
      if (!pendingPersistRef.current) return;

      // KRITISK: Match via fingerprint i stedet for reference-equality
      // fordi React kan returnere ny reference selvom data er det samme
      const pendingFingerprint = fingerprintTableData(pendingPersistRef.current);
      const draftFingerprint = fingerprintTableData(rowsState.draft);

      if (pendingFingerprint !== draftFingerprint) return;

      const previousData = lastPersistedDataRef.current;
      const onlyAddedEmptyRow =
        previousData &&
        rowsState.draft.length === previousData.length + 1 &&
        fingerprintTableData(rowsState.draft.slice(0, -1)) === fingerprintTableData(previousData) &&
        isRowEmpty(rowsState.draft[rowsState.draft.length - 1]);

      if (onlyAddedEmptyRow) {
        pendingPersistRef.current = null;
        return;
      }

      persistTableData(rowsState.draft);
      pendingPersistRef.current = null;
    }, [rowsState.draft, persistTableData]);

    const setCellValue = React.useCallback(
      (row: AarsloenTableRow, colKey: AarsloenTableColumnKey, value: AarsloenTableRow[AarsloenTableColumnKey]): AarsloenTableRow => {
        switch (colKey) {
          case 'col0_maaned':
            return (row.col0_maaned ?? '') === value ? row : { ...row, col0_maaned: value as AarsloenTableRow['col0_maaned'] };
          case 'col1_maaned':
            return (row.col1_maaned ?? '') === value ? row : { ...row, col1_maaned: value as AarsloenTableRow['col1_maaned'] };
          case 'col0_uge':
            return (row.col0_uge ?? '') === value ? row : { ...row, col0_uge: value as AarsloenTableRow['col0_uge'] };
          case 'col1_uge':
            return (row.col1_uge ?? '') === value ? row : { ...row, col1_uge: value as AarsloenTableRow['col1_uge'] };
          case 'col0_dag':
            return (row.col0_dag ?? '') === value ? row : { ...row, col0_dag: value as AarsloenTableRow['col0_dag'] };
          case 'col1_dag':
            return (row.col1_dag ?? '') === value ? row : { ...row, col1_dag: value as AarsloenTableRow['col1_dag'] };
          case 'col2':
            return row.col2 === value ? row : { ...row, col2: value as AarsloenTableRow['col2'] };
          case 'col3':
            return row.col3 === value ? row : { ...row, col3: value as AarsloenTableRow['col3'] };
          case 'col4':
            return row.col4 === value ? row : { ...row, col4: value as AarsloenTableRow['col4'] };
          case 'col5':
            return row.col5 === value ? row : { ...row, col5: value as AarsloenTableRow['col5'] };
          default:
            return row;
        }
      },
      []
    );

    const updateCellValueInTable = React.useCallback(
      (rows: AarsloenTableRow[], rowId: string, colKey: AarsloenTableColumnKey, value: AarsloenTableRow[AarsloenTableColumnKey]): AarsloenTableRow[] => {
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

    const handleInputChange = React.useCallback(
      (rowId: string, colKey: AarsloenTableColumnKey, value: AarsloenTableRow[AarsloenTableColumnKey]) => {
        setRowsState((prev) => ({
          ...prev,
          draft: updateCellValueInTable(prev.draft, rowId, colKey, value),
        }));
      },
      [updateCellValueInTable]
    );

    const handleFieldBlur = React.useCallback(
      (rowId: string, colKey: AarsloenTableColumnKey, value: AarsloenTableRow[AarsloenTableColumnKey]) => {
        setRowsState((prev) => {
          const updated = updateCellValueInTable(prev.draft, rowId, colKey, value);
          const managed = manageRows(updated);
          // KRITISK: Sammenlign mod prev.committed (ikke prev.draft)
          // handleFieldBlur er en commit-handler - baseline skal ALTID være committed
          const managedFingerprint = fingerprintTableData(managed);
          const committedFingerprint = fingerprintTableData(prev.committed);
          if (managedFingerprint === committedFingerprint) return prev;
          queuePersist(managed);
          return { draft: managed, committed: managed };
        });
      },
      [manageRows, queuePersist, updateCellValueInTable]
    );

    const committedById = React.useMemo(() => new Map(committedTableData.map((row) => [row.id, row])), [committedTableData]);
    const resolveCommittedRow = React.useCallback((row: AarsloenTableRow) => committedById.get(row.id) ?? row, [committedById]);

    const cellErrorsByCellKeyRef = React.useRef<Record<string, true>>({});

    React.useEffect(() => {
      const validRowIds = new Set(rowsState.draft.map((row) => row.id));
      const current = cellErrorsByCellKeyRef.current;
      for (const cellKey of Object.keys(current)) {
        const separatorIdx = cellKey.indexOf(':');
        if (separatorIdx < 0) continue;
        const rowId = cellKey.slice(0, separatorIdx);
        if (!validRowIds.has(rowId)) {
          delete current[cellKey];
        }
      }
    }, [rowsState.draft]);

    const handleErrorChange = React.useCallback((rowId: string, colKey: AarsloenTableColumnKey, info: TableInputErrorInfo) => {
      const key = `${rowId}:${colKey}`;
      if (info.hasError) cellErrorsByCellKeyRef.current[key] = true;
      else delete cellErrorsByCellKeyRef.current[key];
    }, []);

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
      (row: AarsloenTableRow): { col6: number; col7: number; col8: number; col9: number } => {
        const derived = calculateAarsloenRowDerived(row, getSatserInput());
        return { col6: derived.ferieberet, col7: derived.fpFvShSo, col8: derived.pension, col9: derived.samlet };
      },
      [getSatserInput]
    );

    const getAllErrors = React.useCallback((): TableError[] => {
      const errors: TableError[] = [];
      const editableColIdxs = [0, 1, 2, 3, 4, 5] as const;

      const getEditableColKey = (colIdx: (typeof editableColIdxs)[number]): AarsloenTableColumnKey => {
        if (colIdx === 0) return loenperiode === 'maaned' ? 'col0_maaned' : loenperiode === 'uge' ? 'col0_uge' : 'col0_dag';
        if (colIdx === 1) return loenperiode === 'maaned' ? 'col1_maaned' : loenperiode === 'uge' ? 'col1_uge' : 'col1_dag';
        if (colIdx === 2) return 'col2';
        if (colIdx === 3) return 'col3';
        if (colIdx === 4) return 'col4';
        return 'col5';
      };

      for (const row of rowsState.draft) {
        for (const colIdx of editableColIdxs) {
          const colKey = getEditableColKey(colIdx);
          const cellKey = `${row.id}:${colKey}`;
          if (cellErrorsByCellKeyRef.current[cellKey]) {
            errors.push({ kind: 'cell', issue: 'invalid', rowId: row.id, colKey });
          }
        }
      }

      for (const row of rowsState.draft) {
        if (isRowEmpty(row)) continue;

        if (loenperiode === 'maaned') {
          if (row.col0_maaned && !row.col1_maaned) errors.push({ kind: 'cell', issue: 'partial_period', rowId: row.id, colKey: 'col1_maaned' });
          if (!row.col0_maaned && row.col1_maaned) errors.push({ kind: 'cell', issue: 'partial_period', rowId: row.id, colKey: 'col0_maaned' });
        } else if (loenperiode === 'uge') {
          if (row.col0_uge && !row.col1_uge) errors.push({ kind: 'cell', issue: 'partial_period', rowId: row.id, colKey: 'col1_uge' });
          if (!row.col0_uge && row.col1_uge) errors.push({ kind: 'cell', issue: 'partial_period', rowId: row.id, colKey: 'col0_uge' });
        } else {
          if (row.col0_dag && !row.col1_dag) errors.push({ kind: 'cell', issue: 'partial_period', rowId: row.id, colKey: 'col1_dag' });
          if (!row.col0_dag && row.col1_dag) errors.push({ kind: 'cell', issue: 'partial_period', rowId: row.id, colKey: 'col0_dag' });
        }
      }

      const hasAtLeastOneValidRowResult = hasAtLeastOneValidRow(rowsState.draft, loenperiode, getSatserInput());
      if (!hasAtLeastOneValidRowResult) {
        errors.push({ kind: 'table', reason: 'no_valid_rows' });
      }

      return errors;
    }, [getSatserInput, rowsState.draft, loenperiode]);

    const notifyValidationChange = React.useCallback(() => {
      if (!onValidationChange) return;
      onValidationChange(getAllErrors());
    }, [getAllErrors, onValidationChange]);

    React.useEffect(() => {
      notifyValidationChange();
    }, [committedTableData, loenperiode, notifyValidationChange]);

    const [sortState, setSortState] = React.useState<GridSortState>({});

    const getSortDirection = React.useCallback(
      (colId: string): GridSortDirection => {
        if (sortState.primary?.colId === colId) return sortState.primary.dir;
        if (sortState.secondary?.colId === colId) return sortState.secondary.dir;
        return 'asc';
      },
      [sortState.primary, sortState.secondary]
    );

    const getSortValueByColId = React.useCallback(
      (colId: string) => {
        const colIdx = Number.parseInt(colId.replace('col-', ''), 10);
        if (!Number.isFinite(colIdx)) return undefined;

        const parseSortableInteger = (value: string | undefined): number | undefined => {
          const trimmed = value?.trim() ?? '';
          if (trimmed === '') return undefined;
          const parsed = Number.parseInt(trimmed, 10);
          return Number.isFinite(parsed) ? parsed : undefined;
        };

        const parseSortableWeekKey = (value: string | undefined): string | undefined => {
          const trimmed = value?.trim() ?? '';
          if (trimmed === '') return undefined;
          const parts = trimmed.split('/');
          if (parts.length !== 2) return undefined;
          const week = Number.parseInt(parts[0] ?? '', 10);
          const year = Number.parseInt(parts[1] ?? '', 10);
          if (!Number.isFinite(week) || !Number.isFinite(year)) return undefined;
          if (week < 1 || week > 53) return undefined;
          return `${year.toString().padStart(4, '0')}-${week.toString().padStart(2, '0')}`;
        };

        const parseSortableAmount = (value: AmountValue | undefined): number | undefined => {
          return amountValueToNumber(value);
        };

        if (colIdx === 0) {
          return (row: AarsloenTableRow) => {
            const committed = resolveCommittedRow(row);
            if (loenperiode === 'maaned') return parseSortableInteger(committed.col0_maaned);
            if (loenperiode === 'uge') return parseSortableWeekKey(committed.col0_uge);
            return formatToISO(committed.col0_dag ?? '');
          };
        }

        if (colIdx === 1) {
          return (row: AarsloenTableRow) => {
            const committed = resolveCommittedRow(row);
            if (loenperiode === 'maaned') return parseSortableInteger(committed.col1_maaned);
            if (loenperiode === 'uge') return parseSortableWeekKey(committed.col1_uge);
            return formatToISO(committed.col1_dag ?? '');
          };
        }

        if (colIdx >= 2 && colIdx <= 5) {
          const colKey = `col${colIdx}` as const;
          return (row: AarsloenTableRow) => parseSortableAmount(resolveCommittedRow(row)[colKey]);
        }

        if (colIdx >= 6 && colIdx <= 9) {
          return (row: AarsloenTableRow) => {
            const derived = calculateRow(resolveCommittedRow(row));
            if (colIdx === 6) return derived.col6;
            if (colIdx === 7) return derived.col7;
            if (colIdx === 8) return derived.col8;
            return derived.col9;
          };
        }

        return undefined;
      },
      [calculateRow, loenperiode, resolveCommittedRow]
    );

    const visibleRows = React.useMemo(() => {
      return sortGridRows({
        rows: rowsState.draft,
        getRowId: (row) => row.id,
        isRowEmpty,
        sortState,
        getSortValueByColId,
      });
    }, [getSortValueByColId, rowsState.draft, sortState]);

    const [errorCell, setErrorCell] = React.useState<{ rowId: string; colIdx: number } | null>(null);
    const cellRefsByCellKeyRef = React.useRef<Record<string, HTMLInputElement | null>>({});
    const registerCellRef = React.useCallback(
      (rowId: string, colIdx: number) => (el: HTMLInputElement | null) => {
        cellRefsByCellKeyRef.current[`${rowId}:${colIdx}`] = el;
      },
      []
    );

    const getCellStyle = (rowId: string, colIdx: number, baseStyle: React.CSSProperties = {}): React.CSSProperties => {
      return {
        ...baseStyle,
        animation: errorCell?.rowId === rowId && errorCell?.colIdx === colIdx ? 'errorFlash 0.5s ease-in-out 3' : 'none',
      };
    };

    React.useImperativeHandle(
      ref,
      () => ({
        getErrors: () => getAllErrors(),
        flashError: (error) => {
          const colKey = error.colKey;
          const colIdx = colKey.startsWith('col0_') ? 0 : colKey.startsWith('col1_') ? 1 : Number.parseInt(colKey.slice(3), 10);
          if (!Number.isFinite(colIdx)) return;
          const el = cellRefsByCellKeyRef.current[`${error.rowId}:${colIdx}`];
          if (!el) return;
          setErrorCell({ rowId: error.rowId, colIdx });
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          window.setTimeout(() => setErrorCell(null), 2000);
        },
      }),
      [getAllErrors]
    );

    const formatNumber = React.useCallback((num: number | null | undefined): string => {
      if (num === null || num === undefined) return '';
      const rounded = Math.round(num * 100) / 100;
      const [int, dec] = rounded.toFixed(2).split('.');
      const formatted = int.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
      return `${formatted},${dec}`;
    }, []);

    const headers = React.useMemo(() => {
      const PERIOD: Record<Loenperiode, [string, string]> = {
        maaned: ['Måned', 'År'],
        uge: ['Uge fra', 'Uge til'],
        dag: ['Dato fra', 'Dato til'],
      };

      return [
        ...PERIOD[loenperiode],
        'Grundløn',
        'Tillæg',
        'Ikke-pensions-\ngivende løn',
        'ATP og anden\nikke FB-løn',
        'Ferieberet.\nløn',
        'FP/FV/SH/\nSO/St.B.',
        'Arb.g.\nPension',
        'Samlet løn',
      ];
    }, [loenperiode]);

    return (
      <StandardGridTable
        tableWidth="1130px"
        useSmallFont={useSmallFont}
        beforeTable={
          <style>
            {`
              @keyframes errorFlash {
                0%, 100% { background-color: transparent; }
                50% { background-color: rgba(211, 47, 47, 0.2); }
              }
            `}
          </style>
        }
      >
        <colgroup>
          <col style={{ width: '113px' }} />
          <col style={{ width: '113px' }} />
          <col style={{ width: '113px' }} />
          <col style={{ width: '113px' }} />
          <col style={{ width: '113px' }} />
          <col style={{ width: '113px' }} />
          <col style={{ width: '113px' }} />
          <col style={{ width: '113px' }} />
          <col style={{ width: '113px' }} />
          <col style={{ width: '113px' }} />
        </colgroup>

        <thead>
          <tr>
            {headers.map((header, idx) => {
              const colId = `col-${idx}`;
              return (
                <StandardGridHeaderCell
                  key={colId}
                  onClick={() => setSortState((prev) => toggleGridSort(prev, colId))}
                  sortRole={getGridSortRole(sortState, colId)}
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
                      onChange={(e) => handleInputChange(row.id, 'col0_maaned', e.target.value)}
                      onBlur={(e) => handleFieldBlur(row.id, 'col0_maaned', e.target.value)}
                      onErrorChange={(info) => handleErrorChange(row.id, 'col0_maaned', info)}
                      minValue={1}
                      maxValue={12}
                    />
                  ) : loenperiode === 'uge' ? (
                    <TableWeekInput
                      key={`${row.id}-col0-${loenperiode}`}
                      gridCell={{ rowId: row.id, colIndex: 0 }}
                      inputRef={registerCellRef(row.id, 0)}
                      value={row.col0_uge}
                      onChange={(e) => handleInputChange(row.id, 'col0_uge', e.target.value)}
                      onBlur={(e) => handleFieldBlur(row.id, 'col0_uge', e.target.value)}
                      onErrorChange={(info) => handleErrorChange(row.id, 'col0_uge', info)}
                      minYear={MIN_YEAR}
                      maxYear={MAX_YEAR}
                    />
                  ) : (
                    <TableDateInput
                      key={`${row.id}-col0-${loenperiode}`}
                      gridCell={{ rowId: row.id, colIndex: 0 }}
                      inputRef={registerCellRef(row.id, 0)}
                      value={row.col0_dag}
                      onChange={(e) => handleInputChange(row.id, 'col0_dag', e.target.value)}
                      onBlur={(e) => handleFieldBlur(row.id, 'col0_dag', e.target.value)}
                      onErrorChange={(info) => handleErrorChange(row.id, 'col0_dag', info)}
                      minDate={dateRanges_aarsloen.tabelAarsloenFra.min}
                      maxDate={formatToISO(committedRow.col1_dag ?? '') || dateRanges_aarsloen.tabelAarsloenFra.fallbackMax}
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
                      onChange={(e) => handleInputChange(row.id, 'col1_maaned', e.target.value)}
                      onBlur={(e) => handleFieldBlur(row.id, 'col1_maaned', e.target.value)}
                      onErrorChange={(info) => handleErrorChange(row.id, 'col1_maaned', info)}
                      minYear={MIN_YEAR}
                      maxYear={MAX_YEAR}
                    />
                  ) : loenperiode === 'uge' ? (
                    <TableWeekInput
                      key={`${row.id}-col1-${loenperiode}`}
                      gridCell={{ rowId: row.id, colIndex: 1 }}
                      inputRef={registerCellRef(row.id, 1)}
                      value={row.col1_uge}
                      onChange={(e) => handleInputChange(row.id, 'col1_uge', e.target.value)}
                      onBlur={(e) => handleFieldBlur(row.id, 'col1_uge', e.target.value)}
                      onErrorChange={(info) => handleErrorChange(row.id, 'col1_uge', info)}
                      minYear={MIN_YEAR}
                      maxYear={MAX_YEAR}
                    />
                  ) : (
                    <TableDateInput
                      key={`${row.id}-col1-${loenperiode}`}
                      gridCell={{ rowId: row.id, colIndex: 1 }}
                      inputRef={registerCellRef(row.id, 1)}
                      value={row.col1_dag}
                      onChange={(e) => handleInputChange(row.id, 'col1_dag', e.target.value)}
                      onBlur={(e) => handleFieldBlur(row.id, 'col1_dag', e.target.value)}
                      onErrorChange={(info) => handleErrorChange(row.id, 'col1_dag', info)}
                      minDate={formatToISO(committedRow.col0_dag ?? '') || dateRanges_aarsloen.tabelAarsloenTil.fallbackMin}
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
                        placeholder=""
                      />
                    </td>
                  );
                })}

                <td
                  style={{
                    ...getStandardGridCellStyle({ align: 'right' }),
                    padding: '4px',
                    userSelect: 'none',
                    color: calculated.col6 === 0 ? 'rgba(0, 0, 0, 0.4)' : 'inherit',
                  }}
                >
                  {formatNumber(calculated.col6)}
                </td>

                <td
                  style={{
                    ...getStandardGridCellStyle({ align: 'right' }),
                    padding: '4px',
                    userSelect: 'none',
                    color: calculated.col7 === 0 ? 'rgba(0, 0, 0, 0.4)' : 'inherit',
                  }}
                >
                  {formatNumber(calculated.col7)}
                </td>

                <td
                  style={{
                    ...getStandardGridCellStyle({ align: 'right' }),
                    padding: '4px',
                    userSelect: 'none',
                    color: calculated.col8 === 0 ? 'rgba(0, 0, 0, 0.4)' : 'inherit',
                  }}
                >
                  {formatNumber(calculated.col8)}
                </td>

                <td
                  style={{
                    ...getStandardGridCellStyle({ align: 'right' }),
                    padding: '4px',
                    userSelect: 'none',
                    color: calculated.col9 === 0 ? 'rgba(0, 0, 0, 0.4)' : 'inherit',
                  }}
                >
                  {formatNumber(calculated.col9)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </StandardGridTable>
    );
  }
);

AarsloenTable.displayName = 'AarsloenTable';

export default AarsloenTable;

