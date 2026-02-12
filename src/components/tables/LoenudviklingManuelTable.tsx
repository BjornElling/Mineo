import * as React from 'react';
import { InputBase, Tooltip } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';

import TableAmountInput from '../inputs/table/TableAmountInput';
import TableDateInput from '../inputs/table/TableDateInput';
import TablePercentInput from '../inputs/table/TablePercentInput';
import type { TableInputErrorInfo } from '../inputs/table/tableInputContracts';
import { assignRef } from '../inputs/table/assignRef';
import { useGridCore } from './gridCoreContext';
import type { GridCellCoord, GridCellEditorHandle } from './gridCoreTypes';
import { StandardGridHeaderCell, StandardGridTable, getStandardGridBodyRowStyle, getStandardGridCellStyle } from './StandardGridTable';
import { getGridSortRole, normalizeGridRows, sortGridRows, toggleGridSort, type GridSortDirection, type GridSortState } from './gridModel';
import { applyRowRemovalFocusPlan, buildRowRemovalFocusPlan, type RowRemovalFocusPlan } from './tableRowFocus';
import { coerceToISODateString } from '../../types/branded';
import { initialLoenudviklingManuelRow, generateLoenudviklingRowId } from '../../utils/eoConverters';
import type { LoenudviklingManuelRow } from '../../schemas/formSchemas';
import type { AmountValue } from '../../schemas/amountExpressionSchema';
import { amountValueToNumber } from '../../utils/expressionAmount';
import { parsePercentToDecimal } from '../../utils/formatUtils';

export type LoenudviklingManuelTableProps = Readonly<{
  tableData: LoenudviklingManuelRow[];
  onTableDataChange?: (data: LoenudviklingManuelRow[]) => void;
  onInputErrorChange?: (hasError: boolean) => void;
  baseDateDisplay: string;
  baseDateErrorMessage?: string;
  baseRowPercentErrors?: Partial<Record<'feriepenge' | 'shSoSats' | 'fritvalg' | 'agPension', string>>;
  useSmallFont?: boolean;
}>;

const MIN_VISIBLE_ROWS = 2;

const isEffectivelyEmpty = (value: string | undefined): boolean => {
  return value === undefined || value.trim() === '';
};

const isAmountEmpty = (value: AmountValue | undefined): boolean => {
  return value === undefined;
};

const isRowEmpty = (row: LoenudviklingManuelRow): boolean => {
  return (
    isEffectivelyEmpty(row.dato) &&
    isAmountEmpty(row.grundloen) &&
    isEffectivelyEmpty(row.feriepenge) &&
    isEffectivelyEmpty(row.shSoSats) &&
    isEffectivelyEmpty(row.fritvalg) &&
    isEffectivelyEmpty(row.agPension)
  );
};

const fingerprintTableData = (rows: readonly LoenudviklingManuelRow[]): string => {
  return JSON.stringify(
    rows.map((row) => [
      row.id,
      row.dato ?? null,
      row.grundloen ?? null,
      row.feriepenge ?? null,
      row.shSoSats ?? null,
      row.fritvalg ?? null,
      row.agPension ?? null,
    ])
  );
};

const parseAmountForSort = (raw: AmountValue | undefined): number | undefined => {
  return amountValueToNumber(raw);
};

const parsePercentForSort = (raw: string | undefined): number | undefined => {
  if (!raw || raw.trim() === '') return undefined;
  return parsePercentToDecimal(raw);
};

const ReadOnlyDateCell = React.memo(
  ({
    gridCell,
    value,
    errorMessage,
    inputRef,
    sx,
  }: {
    gridCell: GridCellCoord;
    value: string;
    errorMessage?: string;
    inputRef?: React.Ref<HTMLInputElement>;
    sx?: SxProps<Theme>;
  }) => {
    const grid = useGridCore();
    const inputElRef = React.useRef<HTMLInputElement | null>(null);

    const showError = Boolean(errorMessage && errorMessage.trim() !== '');

    const editorHandle = React.useMemo<GridCellEditorHandle>(() => {
      return {
        getElement: () => inputElRef.current,
        getIsLocked: () => true,
        commitCurrent: () => {
          // Locked: no-op
          return true;
        },
        clearAndCommit: () => {
          // Locked: no-op
        },
        cancelEdit: () => {
          grid.closeEditing();
        },
        prepareEditFromKey: () => false,
        selectAll: () => {
          // no-op
        },
      };
    }, [grid]);

    React.useEffect(() => {
      grid.registerEditor(gridCell, editorHandle);
      return () => {
        grid.unregisterEditor(gridCell);
      };
    }, [editorHandle, grid, gridCell]);

    const visuallyHiddenStyle: React.CSSProperties = {
      position: 'absolute',
      width: 1,
      height: 1,
      padding: 0,
      margin: -1,
      overflow: 'hidden',
      clip: 'rect(0, 0, 0, 0)',
      whiteSpace: 'nowrap',
      border: 0,
    };

    const a11yErrorId = React.useId();

    return (
      <Tooltip title={showError ? errorMessage : ''} arrow placement="top" disableHoverListener={!showError}>
        <span style={{ display: 'block', width: '100%', height: '100%' }}>
          <InputBase
            inputRef={(el) => {
              inputElRef.current = el;
              assignRef(inputRef, el);
            }}
            value={value}
            readOnly
            inputProps={{
              readOnly: true,
              inputMode: 'text',
              'data-mineo-grid-locked': 'true',
              'aria-describedby': showError ? a11yErrorId : undefined,
            }}
            placeholder=""
            sx={{
              width: '100%',
              height: '100%',
              font: 'inherit',
              fontSize: 'inherit',
              fontFamily: 'inherit',
              lineHeight: 'inherit',
              color: 'inherit',
              fontFeatureSettings: '"tnum"',
              paddingLeft: '8px',
              paddingRight: '8px',
              borderRadius: '4px',
              border: '1px solid',
              borderColor: showError ? '#d32f2f' : 'transparent',
              '&:focus-within': {
                borderColor: '#1976d2',
              },
              '& .MuiInputBase-input': {
                font: 'inherit',
                fontSize: 'inherit',
                lineHeight: 'inherit',
                color: 'rgba(0, 0, 0, 0.6)',
                textAlign: 'center',
                cursor: 'default',
                caretColor: 'transparent',
              },
              ...sx,
            }}
          />
          {showError ? (
            <span id={a11yErrorId} style={visuallyHiddenStyle}>
              {errorMessage}
            </span>
          ) : null}
        </span>
      </Tooltip>
    );
  }
);

ReadOnlyDateCell.displayName = 'ReadOnlyDateCell';

const LoenudviklingManuelTable = React.memo(
  ({
    tableData,
    onTableDataChange,
    onInputErrorChange,
    baseDateDisplay,
    baseDateErrorMessage,
    baseRowPercentErrors,
    useSmallFont = false,
  }: LoenudviklingManuelTableProps) => {
    const defaultTableData = React.useMemo<LoenudviklingManuelRow[]>(
      () => [
        { ...initialLoenudviklingManuelRow, id: generateLoenudviklingRowId() },
        { ...initialLoenudviklingManuelRow, id: generateLoenudviklingRowId() },
      ],
      []
    );

    const pendingPersistRef = React.useRef<LoenudviklingManuelRow[] | null>(null);
    const tableRef = React.useRef<HTMLTableElement | null>(null);
    const pendingRowFocusPlanRef = React.useRef<RowRemovalFocusPlan | null>(null);
    const visibleRowIdsRef = React.useRef<readonly string[]>([]);

    const createEmptyRow = React.useCallback((): LoenudviklingManuelRow => {
      return { ...initialLoenudviklingManuelRow, id: generateLoenudviklingRowId() };
    }, []);

    const normalizeRows = React.useCallback(
      (rows: readonly LoenudviklingManuelRow[]): LoenudviklingManuelRow[] => {
        const baseRow = rows[0] ?? createEmptyRow();
        const tail = rows.slice(1);
        const tailMinRows = Math.max(1, MIN_VISIBLE_ROWS - 1);
        const normalizedTail = normalizeGridRows({ rows: tail, minRows: tailMinRows, isRowEmpty, createEmptyRow });
        return [baseRow, ...normalizedTail];
      },
      [createEmptyRow]
    );

    const initialInternalTableData = React.useMemo(
      () => (tableData.length > 0 ? normalizeRows(tableData) : normalizeRows(defaultTableData)),
      [defaultTableData, normalizeRows, tableData]
    );

    const lastPersistedFingerprintRef = React.useRef<string | null>(
      fingerprintTableData(initialInternalTableData)
    );

    const persistTableData = React.useCallback(
      (internalData: LoenudviklingManuelRow[]) => {
        if (!onTableDataChange) return;
        lastPersistedFingerprintRef.current = fingerprintTableData(internalData);
        onTableDataChange(internalData);
      },
      [onTableDataChange]
    );

    const [internalTableData, setInternalTableData] = React.useState<LoenudviklingManuelRow[]>(
      () => initialInternalTableData
    );

    React.useEffect(() => {
      if (tableData.length > 0) {
        const normalizedData = normalizeRows(tableData);
        const fingerprint = fingerprintTableData(normalizedData);
        if (lastPersistedFingerprintRef.current === fingerprint) {
          return;
        }
        lastPersistedFingerprintRef.current = fingerprint;
        setInternalTableData(normalizedData);
        return;
      }
      const normalizedDefault = normalizeRows(defaultTableData);
      lastPersistedFingerprintRef.current = fingerprintTableData(normalizedDefault);
      setInternalTableData(normalizedDefault);
    }, [defaultTableData, normalizeRows, tableData]);

    const cellErrorsByCellKeyRef = React.useRef<Record<string, true>>({});
    const lastInputErrorStateRef = React.useRef<boolean | null>(null);

    const hasExternalBaseRowErrors = React.useMemo(() => {
      return Object.values(baseRowPercentErrors ?? {}).some((errorText) => (errorText ?? '').trim() !== '');
    }, [baseRowPercentErrors]);

    const notifyInputErrorChange = React.useCallback(() => {
      if (!onInputErrorChange) return;
      const hasError = Object.keys(cellErrorsByCellKeyRef.current).length > 0 || hasExternalBaseRowErrors;
      if (lastInputErrorStateRef.current === hasError) return;
      lastInputErrorStateRef.current = hasError;
      onInputErrorChange(hasError);
    }, [hasExternalBaseRowErrors, onInputErrorChange]);

    React.useEffect(() => {
      const validRowIds = new Set(internalTableData.map((row) => row.id));
      const current = cellErrorsByCellKeyRef.current;

      for (const cellKey of Object.keys(current)) {
        const separatorIdx = cellKey.indexOf(':');
        if (separatorIdx < 0) continue;
        const rowId = cellKey.slice(0, separatorIdx);
        if (!validRowIds.has(rowId)) {
          delete current[cellKey];
        }
      }
      notifyInputErrorChange();
    }, [internalTableData, notifyInputErrorChange]);

    const setRow = React.useCallback((rowId: string, updates: Partial<LoenudviklingManuelRow>) => {
      setInternalTableData((prev) => prev.map((row) => (row.id === rowId ? { ...row, ...updates } : row)));
    }, []);

    const commitRowUpdate = React.useCallback(
      (rowId: string, updates: Partial<LoenudviklingManuelRow>) => {
        setInternalTableData((prev) => {
          const updated = prev.map((row) => (row.id === rowId ? { ...row, ...updates } : row));
          const normalized = normalizeRows(updated);
          const focusPlan = buildRowRemovalFocusPlan({
            table: tableRef.current,
            prevRows: prev,
            nextRows: normalized,
            visibleRowIds: visibleRowIdsRef.current,
            getRowId: (row) => row.id,
          });
          if (focusPlan) {
            // Last-plan-wins by design: only the final commit in a render cycle should decide focus restoration.
            pendingRowFocusPlanRef.current = focusPlan;
          }

          if (lastPersistedFingerprintRef.current !== fingerprintTableData(normalized)) {
            pendingPersistRef.current = normalized;
          }
          return normalized;
        });
      },
      [normalizeRows]
    );

    React.useEffect(() => {
      if (pendingPersistRef.current === null) return;
      const dataToPersist = pendingPersistRef.current;
      pendingPersistRef.current = null;
      persistTableData(dataToPersist);
    }, [persistTableData, internalTableData]);

    const handleErrorChange = React.useCallback(
      (rowId: string, colKey: string) => (errorInfo: TableInputErrorInfo) => {
        const cellKey = `${rowId}:${colKey}`;
        if (errorInfo.hasError) {
          cellErrorsByCellKeyRef.current[cellKey] = true;
        } else {
          delete cellErrorsByCellKeyRef.current[cellKey];
        }
        notifyInputErrorChange();
      },
      [notifyInputErrorChange]
    );

    React.useEffect(() => {
      notifyInputErrorChange();
    }, [notifyInputErrorChange]);

    const [sortState, setSortState] = React.useState<GridSortState>({});
    const baseRowId = internalTableData[0]?.id ?? null;
    const isRowEmptyForSort = React.useCallback(
      (row: LoenudviklingManuelRow) => (row.id === baseRowId ? false : isRowEmpty(row)),
      [baseRowId]
    );

    const getSortDirection = (colId: string): GridSortDirection => {
      if (sortState.primary?.colId === colId) return sortState.primary.dir;
      if (sortState.secondary?.colId === colId) return sortState.secondary.dir;
      return 'asc';
    };

    const getSortValueByColId = React.useCallback(
      (colId: string) => {
        switch (colId) {
          case 'dato':
            return (row: LoenudviklingManuelRow) => {
              const raw = row.id === baseRowId ? baseDateDisplay : row.dato;
              return coerceToISODateString(raw?.trim() ?? '') ?? '';
            };
          case 'grundloen':
            return (row: LoenudviklingManuelRow) => parseAmountForSort(row.grundloen);
          case 'feriepenge':
            return (row: LoenudviklingManuelRow) => parsePercentForSort(row.feriepenge);
          case 'shSoSats':
            return (row: LoenudviklingManuelRow) => parsePercentForSort(row.shSoSats);
          case 'fritvalg':
            return (row: LoenudviklingManuelRow) => parsePercentForSort(row.fritvalg);
          case 'agPension':
            return (row: LoenudviklingManuelRow) => parsePercentForSort(row.agPension);
          default:
            return undefined;
        }
      },
      [baseDateDisplay, baseRowId]
    );

    const visibleRows = React.useMemo(() => {
      return sortGridRows({
        rows: internalTableData,
        getRowId: (row) => row.id,
        isRowEmpty: isRowEmptyForSort,
        sortState,
        getSortValueByColId,
      });
    }, [getSortValueByColId, internalTableData, isRowEmptyForSort, sortState]);
    const visibleRowIds = React.useMemo(() => visibleRows.map((row) => row.id), [visibleRows]);

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
          <col style={{ width: '140px' }} />
          <col style={{ width: '140px' }} />
          <col style={{ width: '140px' }} />
          <col style={{ width: '140px' }} />
          <col style={{ width: '140px' }} />
          <col style={{ width: '150px' }} />
        </colgroup>

        <thead>
          <tr>
            <StandardGridHeaderCell
              onClick={() => setSortState((prev) => toggleGridSort(prev, 'dato'))}
              sortRole={getGridSortRole(sortState, 'dato')}
              sortDirection={getSortDirection('dato')}
            >
              Dato
            </StandardGridHeaderCell>
            <StandardGridHeaderCell
              onClick={() => setSortState((prev) => toggleGridSort(prev, 'grundloen'))}
              sortRole={getGridSortRole(sortState, 'grundloen')}
              sortDirection={getSortDirection('grundloen')}
            >
              Grundløn
            </StandardGridHeaderCell>
            <StandardGridHeaderCell
              onClick={() => setSortState((prev) => toggleGridSort(prev, 'feriepenge'))}
              sortRole={getGridSortRole(sortState, 'feriepenge')}
              sortDirection={getSortDirection('feriepenge')}
            >
              Feriepenge
            </StandardGridHeaderCell>
            <StandardGridHeaderCell
              onClick={() => setSortState((prev) => toggleGridSort(prev, 'shSoSats'))}
              sortRole={getGridSortRole(sortState, 'shSoSats')}
              sortDirection={getSortDirection('shSoSats')}
            >
              SH/SO-sats
            </StandardGridHeaderCell>
            <StandardGridHeaderCell
              onClick={() => setSortState((prev) => toggleGridSort(prev, 'fritvalg'))}
              sortRole={getGridSortRole(sortState, 'fritvalg')}
              sortDirection={getSortDirection('fritvalg')}
            >
              Fritvalg
            </StandardGridHeaderCell>
            <StandardGridHeaderCell
              onClick={() => setSortState((prev) => toggleGridSort(prev, 'agPension'))}
              sortRole={getGridSortRole(sortState, 'agPension')}
              sortDirection={getSortDirection('agPension')}
            >
              AG pension
            </StandardGridHeaderCell>
          </tr>
        </thead>

        <tbody>
          {visibleRows.map((row, rowIndex) => {
            const isBaseRow = baseRowId === row.id;
            return (
              <tr key={row.id} data-mineo-row-id={row.id} style={getStandardGridBodyRowStyle(rowIndex)}>
                <td style={getStandardGridCellStyle({ align: 'center' })}>
                  {isBaseRow ? (
                    <ReadOnlyDateCell
                      gridCell={{ rowId: row.id, colIndex: 0 }}
                      value={baseDateDisplay}
                      errorMessage={baseDateErrorMessage}
                    />
                  ) : (
                    <TableDateInput
                      gridCell={{ rowId: row.id, colIndex: 0 }}
                      value={row.dato}
                      onChange={(e) => setRow(row.id, { dato: e.target.value })}
                      onBlur={(e) => commitRowUpdate(row.id, { dato: e.target.value })}
                      onErrorChange={handleErrorChange(row.id, 'dato')}
                    />
                  )}
                </td>

                <td style={getStandardGridCellStyle({ align: 'right' })}>
                  <TableAmountInput
                    gridCell={{ rowId: row.id, colIndex: 1 }}
                    value={row.grundloen}
                    onBlur={(e) => commitRowUpdate(row.id, { grundloen: e.target.value })}
                    onErrorChange={handleErrorChange(row.id, 'grundloen')}
                    placeholder=""
                  />
                </td>

                <td style={getStandardGridCellStyle({ align: 'right' })}>
                  <TablePercentInput
                    gridCell={{ rowId: row.id, colIndex: 2 }}
                    value={row.feriepenge}
                    onChange={(e) => setRow(row.id, { feriepenge: e.target.value })}
                    onBlur={(e) => commitRowUpdate(row.id, { feriepenge: e.target.value })}
                    onErrorChange={handleErrorChange(row.id, 'feriepenge')}
                    externalErrorMessage={isBaseRow ? baseRowPercentErrors?.feriepenge : undefined}
                    placeholder=""
                  />
                </td>

                <td style={getStandardGridCellStyle({ align: 'right' })}>
                  <TablePercentInput
                    gridCell={{ rowId: row.id, colIndex: 3 }}
                    value={row.shSoSats}
                    onChange={(e) => setRow(row.id, { shSoSats: e.target.value })}
                    onBlur={(e) => commitRowUpdate(row.id, { shSoSats: e.target.value })}
                    onErrorChange={handleErrorChange(row.id, 'shSoSats')}
                    externalErrorMessage={isBaseRow ? baseRowPercentErrors?.shSoSats : undefined}
                    placeholder=""
                  />
                </td>

                <td style={getStandardGridCellStyle({ align: 'right' })}>
                  <TablePercentInput
                    gridCell={{ rowId: row.id, colIndex: 4 }}
                    value={row.fritvalg}
                    onChange={(e) => setRow(row.id, { fritvalg: e.target.value })}
                    onBlur={(e) => commitRowUpdate(row.id, { fritvalg: e.target.value })}
                    onErrorChange={handleErrorChange(row.id, 'fritvalg')}
                    externalErrorMessage={isBaseRow ? baseRowPercentErrors?.fritvalg : undefined}
                    placeholder=""
                  />
                </td>

                <td style={getStandardGridCellStyle({ align: 'right' })}>
                  <TablePercentInput
                    gridCell={{ rowId: row.id, colIndex: 5 }}
                    value={row.agPension}
                    onChange={(e) => setRow(row.id, { agPension: e.target.value })}
                    onBlur={(e) => commitRowUpdate(row.id, { agPension: e.target.value })}
                    onErrorChange={handleErrorChange(row.id, 'agPension')}
                    externalErrorMessage={isBaseRow ? baseRowPercentErrors?.agPension : undefined}
                    placeholder=""
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </StandardGridTable>
    );
  }
);

LoenudviklingManuelTable.displayName = 'LoenudviklingManuelTable';

export default LoenudviklingManuelTable;
