import * as React from 'react';
import { InputBase, Tooltip } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';

import TableAmountInput from '../inputs/table/TableAmountInput';
import TableDateInput from '../inputs/table/TableDateInput';
import TablePercentInput from '../inputs/table/TablePercentInput';
import type { TableInputErrorInfo } from '../../utils/tableInputContracts';
import { assignRef } from '../inputs/table/assignRef';
import { useGridCoreApi } from './useGridCore';
import type { GridCellCoord, GridCellEditorHandle } from './gridCore/gridCoreTypes';
import { gridCellKey } from './gridCore/gridCoreUtils';
import { StandardGridHeaderCell, StandardGridTable } from './StandardGridTable';
import { getStandardGridBodyRowStyle, getStandardGridCellStyle } from './gridCore/standardGridStyles';
import { normalizeGridRows, reconcileRowIdsByPosition } from './gridCore/gridModel';
import { useTableSort } from './useTableSort';
import {
  applyRowRemovalFocusPlan,
  evaluateRowCommit,
  type RowRemovalFocusPlan,
} from './gridCore/tableRowFocus';
import { coerceToISODateString } from '../../types/branded';
import { initialLoenudviklingManuelRow, generateLoenudviklingRowId } from '../../domain/erstatningsopgoerelse/helpers/eoRowInitialValues';
import { createEmptyRowId } from '../../utils/rowId';
import type { LoenudviklingManuelRow } from '../../schemas/formSchemas';
import type { AmountValue } from '../../schemas/amountExpressionSchema';
import { amountValueToNumber } from '../../utils/expressionAmount';
import { formatPercentDisplay } from '../../utils/percentDraftCore';
import { visuallyHiddenStyle } from '../shared/visuallyHiddenStyle';

export type LoenudviklingManuelTableProps = Readonly<{
  tableData: LoenudviklingManuelRow[];
  onTableDataChange?: (data: LoenudviklingManuelRow[], origin?: { fieldPath?: string }) => void;
  onInputErrorChange?: (hasError: boolean) => void;
  baseDateDisplay: string;
  baseDateErrorMessage?: string;
  baseDateInfoTooltipText?: string;
  baseRowPercentErrors?: Partial<Record<'feriepenge' | 'shSoSats' | 'fritvalg' | 'agPension', string>>;
  readOnlyBaseRowPercentFields?: boolean;
  useSmallFont?: boolean;
}>;

const MIN_VISIBLE_ROWS = 2;

const isEffectivelyEmpty = (value: string | number | undefined): boolean => {
  if (typeof value === 'number') return !Number.isFinite(value);
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

const parsePercentForSort = (raw: number | undefined): number | undefined => {
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : undefined;
};

const ReadOnlyDateCell = React.memo(
  ({
    gridCell,
    value,
    errorMessage,
    infoTooltipText,
    inputRef,
    sx,
  }: {
    gridCell: GridCellCoord;
    value: string;
    errorMessage?: string;
    infoTooltipText?: string;
    inputRef?: React.Ref<HTMLInputElement>;
    sx?: SxProps<Theme>;
  }) => {
    const grid = useGridCoreApi();
    const inputElRef = React.useRef<HTMLInputElement | null>(null);

    const showError = Boolean(errorMessage && errorMessage.trim() !== '');
    const tooltipText = showError ? (errorMessage ?? '') : (infoTooltipText ?? '');

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

    const a11yErrorId = React.useId();
    const a11yInputId = React.useId();
    const htmlInputName = gridCellKey(gridCell);

    return (
      <Tooltip title={tooltipText} arrow placement="top" disableHoverListener={tooltipText.trim() === ''}>
        <span style={{ display: 'block', width: '100%', height: '100%' }}>
          <InputBase
            inputRef={(el) => {
              inputElRef.current = el;
              assignRef(inputRef, el);
            }}
            value={value}
            readOnly
            inputProps={{
              id: a11yInputId,
              name: htmlInputName,
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
              borderColor: showError ? 'var(--color-input-border-error)' : 'transparent',
              '&:focus-within': {
                borderColor: 'var(--color-input-border-focus)',
              },
              '& .MuiInputBase-input': {
                font: 'inherit',
                fontSize: 'inherit',
                lineHeight: 'inherit',
                color: 'var(--color-grid-derived-text)',
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

const ReadOnlyPercentCell = React.memo(
  ({
    gridCell,
    value,
    errorMessage,
    infoTooltipText,
    inputRef,
    sx,
  }: {
    gridCell: GridCellCoord;
    value: number | undefined;
    errorMessage?: string;
    infoTooltipText?: string;
    inputRef?: React.Ref<HTMLInputElement>;
    sx?: SxProps<Theme>;
  }) => {
    const grid = useGridCoreApi();
    const inputElRef = React.useRef<HTMLInputElement | null>(null);

    const showError = Boolean(errorMessage && errorMessage.trim() !== '');
    const tooltipText = showError ? (errorMessage ?? '') : (infoTooltipText ?? '');

    const editorHandle = React.useMemo<GridCellEditorHandle>(() => {
      return {
        getElement: () => inputElRef.current,
        getIsLocked: () => true,
        commitCurrent: () => true,
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

    const a11yErrorId = React.useId();
    const a11yInputId = React.useId();
    const htmlInputName = gridCellKey(gridCell);

    return (
      <Tooltip title={tooltipText} arrow placement="top" disableHoverListener={tooltipText.trim() === ''}>
        <span style={{ display: 'block', width: '100%', height: '100%' }}>
          <InputBase
            inputRef={(el) => {
              inputElRef.current = el;
              assignRef(inputRef, el);
            }}
            value={formatPercentDisplay(value, true) ? `${formatPercentDisplay(value, true)} %` : ''}
            readOnly
            inputProps={{
              id: a11yInputId,
              name: htmlInputName,
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
              borderColor: showError ? 'var(--color-input-border-error)' : 'transparent',
              '&:focus-within': {
                borderColor: 'var(--color-input-border-focus)',
              },
              '& .MuiInputBase-input': {
                font: 'inherit',
                fontSize: 'inherit',
                lineHeight: 'inherit',
                color: 'var(--color-grid-derived-text)',
                textAlign: 'right',
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

ReadOnlyPercentCell.displayName = 'ReadOnlyPercentCell';

const LoenudviklingManuelTable = React.memo(
  ({
    tableData,
    onTableDataChange,
    onInputErrorChange,
    baseDateDisplay,
    baseDateErrorMessage,
    baseDateInfoTooltipText,
    baseRowPercentErrors,
    readOnlyBaseRowPercentFields = false,
    useSmallFont = false,
  }: LoenudviklingManuelTableProps) => {
    const defaultTableData = React.useMemo<LoenudviklingManuelRow[]>(
      () => [
        { ...initialLoenudviklingManuelRow, id: generateLoenudviklingRowId() },
        { ...initialLoenudviklingManuelRow, id: generateLoenudviklingRowId() },
      ],
      []
    );

    const pendingPersistRef = React.useRef<{ rows: LoenudviklingManuelRow[]; fieldPath?: string } | null>(null);
    const tableRef = React.useRef<HTMLTableElement | null>(null);
    const pendingRowFocusPlanRef = React.useRef<RowRemovalFocusPlan | null>(null);
    const visibleRowIdsRef = React.useRef<readonly string[]>([]);

    // Determinisme-kontrakt (se normalizeGridRows): id'et udledes af seed'et, ikke en RNG,
    // så StrictMode-dobbeltinvokering af setState-updateren ikke giver divergerende id'er.
    const createEmptyRow = React.useCallback((seed: number): LoenudviklingManuelRow => {
      return { ...initialLoenudviklingManuelRow, id: createEmptyRowId('loenudvikling', seed) };
    }, []);

    const normalizeRows = React.useCallback(
      (rows: readonly LoenudviklingManuelRow[]): LoenudviklingManuelRow[] => {
        // Basisrækken har sit eget id-namespace ('loenudvikling_base'), så dens deterministiske
        // fallback-id aldrig kolliderer med tail-rækkernes seed-baserede id'er.
        const baseRow = rows[0] ?? { ...initialLoenudviklingManuelRow, id: createEmptyRowId('loenudvikling_base', 0) };
        const tail = rows.slice(1);
        const tailMinRows = Math.max(1, MIN_VISIBLE_ROWS - 1);
        const normalizedTail = normalizeGridRows({ rows: tail, minRows: tailMinRows, getRowId: (row) => row.id, isRowEmpty, createEmptyRow });
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
      (internalData: LoenudviklingManuelRow[], fieldPath?: string) => {
        if (!onTableDataChange) return;
        lastPersistedFingerprintRef.current = fingerprintTableData(internalData);
        onTableDataChange(internalData, fieldPath ? { fieldPath } : undefined);
      },
      [onTableDataChange]
    );

    const [internalTableData, setInternalTableData] = React.useState<LoenudviklingManuelRow[]>(
      () => initialInternalTableData
    );

    React.useEffect(() => {
      // Bevar rækkernes DOM-identitet positionelt ved resync (fx undo der tømmer en række),
      // så en celles undo-fokus-mål (rowId:colIndex) ikke peger på et element der ikke længere
      // findes. Se reconcileRowIdsByPosition.
      const reconcileWithCurrent = (incoming: LoenudviklingManuelRow[]) =>
        setInternalTableData((current) =>
          reconcileRowIdsByPosition({
            incoming,
            current,
            getRowId: (row) => row.id,
            withRowId: (row, id) => ({ ...row, id }),
          })
        );
      if (tableData.length > 0) {
        const normalizedData = normalizeRows(tableData);
        const fingerprint = fingerprintTableData(normalizedData);
        if (lastPersistedFingerprintRef.current === fingerprint) {
          return;
        }
        lastPersistedFingerprintRef.current = fingerprint;
        reconcileWithCurrent(normalizedData);
        return;
      }
      const normalizedDefault = normalizeRows(defaultTableData);
      lastPersistedFingerprintRef.current = fingerprintTableData(normalizedDefault);
      reconcileWithCurrent(normalizedDefault);
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

    // Bevidst tabel-lokal commit-model: rækker styres med manuel ordning/fokus-evaluering
    // her, mens hvert Table*Input stadig ejer draft-state indtil commit.
    const commitRowUpdate = React.useCallback(
      (rowId: string, updates: Partial<LoenudviklingManuelRow>, colIndex: number) => {
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
            getFingerprint: fingerprintTableData,
            lastPersistedFingerprint: lastPersistedFingerprintRef.current,
          });
          if (commitEval.focusPlan) {
            // Last-plan-wins by design: kun det sidste commit i en render-cyklus skal afgøre fokus-gendannelse.
            pendingRowFocusPlanRef.current = commitEval.focusPlan;
          }

          if (commitEval.shouldPersist) {
            // Tag commit'et med den redigerede celles identitet, så undo/redo lander fokus korrekt.
            pendingPersistRef.current = { rows: normalized, fieldPath: `${rowId}:${colIndex}` };
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
      persistTableData(dataToPersist.rows, dataToPersist.fieldPath);
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

    const baseRowId = internalTableData[0]?.id ?? null;
    const isRowEmptyForSort = React.useCallback(
      (row: LoenudviklingManuelRow) => (row.id === baseRowId ? false : isRowEmpty(row)),
      [baseRowId]
    );

    const sortColumns = React.useMemo(() => [
      {
        colId: 'dato',
        getSortValue: (row: LoenudviklingManuelRow) => {
          // baseDateDisplay er en display-streng-prop, ikke ISO; konvertér før sortering.
          if (row.id === baseRowId) return coerceToISODateString(baseDateDisplay) ?? '';
          return row.dato ?? '';
        },
      },
      { colId: 'grundloen', getSortValue: (row: LoenudviklingManuelRow) => parseAmountForSort(row.grundloen) },
      { colId: 'feriepenge', getSortValue: (row: LoenudviklingManuelRow) => parsePercentForSort(row.feriepenge) },
      { colId: 'shSoSats', getSortValue: (row: LoenudviklingManuelRow) => parsePercentForSort(row.shSoSats) },
      { colId: 'fritvalg', getSortValue: (row: LoenudviklingManuelRow) => parsePercentForSort(row.fritvalg) },
      { colId: 'agPension', getSortValue: (row: LoenudviklingManuelRow) => parsePercentForSort(row.agPension) },
    ], [baseDateDisplay, baseRowId]);

    const { sortedRows: visibleRows, getSortRole, getSortDirection, handleHeaderClick } = useTableSort({
      rows: internalTableData,
      getRowId: (row) => row.id,
      isRowEmpty: isRowEmptyForSort,
      columns: sortColumns,
      onSortedRowsChange: (nextRows) => {
        const nextFingerprint = fingerprintTableData(nextRows);
        if (nextFingerprint !== lastPersistedFingerprintRef.current) {
          // Sortering er ikke en celle-redigering; fieldPath udelades.
          pendingPersistRef.current = { rows: nextRows };
        }
        setInternalTableData(nextRows);
      },
    });
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
            <StandardGridHeaderCell onClick={() => handleHeaderClick('dato')} sortRole={getSortRole('dato')} sortDirection={getSortDirection('dato')}>
              Dato
            </StandardGridHeaderCell>
            <StandardGridHeaderCell onClick={() => handleHeaderClick('grundloen')} sortRole={getSortRole('grundloen')} sortDirection={getSortDirection('grundloen')}>
              Grundløn
            </StandardGridHeaderCell>
            <StandardGridHeaderCell onClick={() => handleHeaderClick('feriepenge')} sortRole={getSortRole('feriepenge')} sortDirection={getSortDirection('feriepenge')}>
              Feriepenge
            </StandardGridHeaderCell>
            <StandardGridHeaderCell onClick={() => handleHeaderClick('shSoSats')} sortRole={getSortRole('shSoSats')} sortDirection={getSortDirection('shSoSats')}>
              SH/SO-sats
            </StandardGridHeaderCell>
            <StandardGridHeaderCell onClick={() => handleHeaderClick('fritvalg')} sortRole={getSortRole('fritvalg')} sortDirection={getSortDirection('fritvalg')}>
              Fritvalg
            </StandardGridHeaderCell>
            <StandardGridHeaderCell onClick={() => handleHeaderClick('agPension')} sortRole={getSortRole('agPension')} sortDirection={getSortDirection('agPension')}>
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
                      infoTooltipText={baseDateInfoTooltipText}
                    />
                  ) : (
                    <TableDateInput
                      gridCell={{ rowId: row.id, colIndex: 0 }}
                      value={row.dato}
                      onBlur={(e) => commitRowUpdate(row.id, { dato: e.target.value }, 0)}
                      onErrorChange={handleErrorChange(row.id, 'dato')}
                    />
                  )}
                </td>

                <td style={getStandardGridCellStyle({ align: 'right' })}>
                  <TableAmountInput
                    gridCell={{ rowId: row.id, colIndex: 1 }}
                    value={row.grundloen}
                    onBlur={(e) => commitRowUpdate(row.id, { grundloen: e.target.value }, 1)}
                    onErrorChange={handleErrorChange(row.id, 'grundloen')}
                  />
                </td>

                <td style={getStandardGridCellStyle({ align: 'right' })}>
                  {isBaseRow && readOnlyBaseRowPercentFields ? (
                    <ReadOnlyPercentCell
                      gridCell={{ rowId: row.id, colIndex: 2 }}
                      value={row.feriepenge}
                      errorMessage={baseRowPercentErrors?.feriepenge}
                      infoTooltipText="Værdien angives ovenfor"
                    />
                  ) : (
                    <TablePercentInput
                      gridCell={{ rowId: row.id, colIndex: 2 }}
                      value={row.feriepenge}
                      onBlur={(e) => commitRowUpdate(row.id, { feriepenge: e.target.value }, 2)}
                      onErrorChange={handleErrorChange(row.id, 'feriepenge')}
                      externalErrorMessage={isBaseRow ? baseRowPercentErrors?.feriepenge : undefined}
                    />
                  )}
                </td>

                <td style={getStandardGridCellStyle({ align: 'right' })}>
                  {isBaseRow && readOnlyBaseRowPercentFields ? (
                    <ReadOnlyPercentCell
                      gridCell={{ rowId: row.id, colIndex: 3 }}
                      value={row.shSoSats}
                      errorMessage={baseRowPercentErrors?.shSoSats}
                      infoTooltipText="Værdien angives ovenfor"
                    />
                  ) : (
                    <TablePercentInput
                      gridCell={{ rowId: row.id, colIndex: 3 }}
                      value={row.shSoSats}
                      onBlur={(e) => commitRowUpdate(row.id, { shSoSats: e.target.value }, 3)}
                      onErrorChange={handleErrorChange(row.id, 'shSoSats')}
                      externalErrorMessage={isBaseRow ? baseRowPercentErrors?.shSoSats : undefined}
                    />
                  )}
                </td>

                <td style={getStandardGridCellStyle({ align: 'right' })}>
                  {isBaseRow && readOnlyBaseRowPercentFields ? (
                    <ReadOnlyPercentCell
                      gridCell={{ rowId: row.id, colIndex: 4 }}
                      value={row.fritvalg}
                      errorMessage={baseRowPercentErrors?.fritvalg}
                      infoTooltipText="Værdien angives ovenfor"
                    />
                  ) : (
                    <TablePercentInput
                      gridCell={{ rowId: row.id, colIndex: 4 }}
                      value={row.fritvalg}
                      onBlur={(e) => commitRowUpdate(row.id, { fritvalg: e.target.value }, 4)}
                      onErrorChange={handleErrorChange(row.id, 'fritvalg')}
                      externalErrorMessage={isBaseRow ? baseRowPercentErrors?.fritvalg : undefined}
                    />
                  )}
                </td>

                <td style={getStandardGridCellStyle({ align: 'right' })}>
                  {isBaseRow && readOnlyBaseRowPercentFields ? (
                    <ReadOnlyPercentCell
                      gridCell={{ rowId: row.id, colIndex: 5 }}
                      value={row.agPension}
                      errorMessage={baseRowPercentErrors?.agPension}
                      infoTooltipText="Værdien angives ovenfor"
                    />
                  ) : (
                    <TablePercentInput
                      gridCell={{ rowId: row.id, colIndex: 5 }}
                      value={row.agPension}
                      onBlur={(e) => commitRowUpdate(row.id, { agPension: e.target.value }, 5)}
                      onErrorChange={handleErrorChange(row.id, 'agPension')}
                      externalErrorMessage={isBaseRow ? baseRowPercentErrors?.agPension : undefined}
                    />
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

LoenudviklingManuelTable.displayName = 'LoenudviklingManuelTable';

export default LoenudviklingManuelTable;
