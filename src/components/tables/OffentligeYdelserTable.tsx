import React from 'react';
import TableAmountInput from '../inputs/table/TableAmountInput';
import TableDateInput from '../inputs/table/TableDateInput';
import TableDropdown, { type TableDropdownOption } from '../inputs/table/TableDropdown';
import type { TableInputErrorInfo } from '../inputs/table/tableInputContracts';
import { dateRanges_offentligeYdelser } from '../../config/dateRanges';
import { coerceToISODateString } from '../../types/branded';
import { initialOffentligYdelseRow, generateOffentligYdelseRowId } from '../../utils/eoConverters';
import type { OffentligeYdelserRow } from '../../schemas/formSchemas';
import type { AmountValue } from '../../schemas/amountExpressionSchema';
import { amountValueToNumber } from '../../utils/expressionAmount';
import { ydelsestyper, ydelsestypeKeys } from '../../data/ydelsestyper';
import { StandardGridHeaderCell, StandardGridTable, getStandardGridBodyRowStyle, getStandardGridCellStyle } from './StandardGridTable';
import { getGridSortRole, normalizeGridRows, sortGridRows, toggleGridSort, type GridSortDirection, type GridSortState } from './gridModel';

export type OffentligeYdelserDerivedCellValues = Readonly<{
  periodiseringLabel: string;
  antalDageDisplay: string;
  ydelsePerDagDisplay: string;
}>;

export type OffentligeYdelserTableProps = {
  tableData: OffentligeYdelserRow[];
  derivedByRowId?: ReadonlyMap<string, OffentligeYdelserDerivedCellValues>;
  onTableDataChange?: (data: OffentligeYdelserRow[]) => void;
  onValidationChange?: (hasErrors: boolean) => void;
};

const MIN_VISIBLE_ROWS = 2;

const isEffectivelyEmpty = (value: string | undefined): boolean => {
  return value === undefined || value.trim() === '';
};

const isAmountEmpty = (value: AmountValue | undefined): boolean => {
  return value === undefined;
};

const asValidDateBound = (raw: string | undefined): string | undefined => {
  if (typeof raw !== 'string') return undefined;
  const trimmed = raw.trim();
  if (trimmed === '') return undefined;
  return coerceToISODateString(trimmed);
};

const isRowEmpty = (row: OffentligeYdelserRow): boolean => {
  return (
    isEffectivelyEmpty(row.fraDato) &&
    isEffectivelyEmpty(row.tilDato) &&
    isAmountEmpty(row.ydelse) &&
    isAmountEmpty(row.tillaeg) &&
    isEffectivelyEmpty(row.ydelsestype)
  );
};

const fingerprintTableData = (rows: readonly OffentligeYdelserRow[]): string => {
  return JSON.stringify(
    rows.map((row) => [row.id, row.fraDato ?? null, row.tilDato ?? null, row.ydelse ?? null, row.tillaeg ?? null, row.ydelsestype ?? null])
  );
};

const OffentligeYdelserTable = React.forwardRef<HTMLDivElement, OffentligeYdelserTableProps>(
  ({ tableData, derivedByRowId, onTableDataChange, onValidationChange }, ref) => {
    const defaultTableData = React.useMemo<OffentligeYdelserRow[]>(
      () => [
        { ...initialOffentligYdelseRow, id: generateOffentligYdelseRowId() },
        { ...initialOffentligYdelseRow, id: generateOffentligYdelseRowId() },
      ],
      []
    );

    const lastPersistedFingerprintRef = React.useRef<string | null>(null);
    const pendingPersistRef = React.useRef<OffentligeYdelserRow[] | null>(null);

    const persistTableData = React.useCallback(
      (internalData: OffentligeYdelserRow[]) => {
        if (!onTableDataChange) return;
        lastPersistedFingerprintRef.current = fingerprintTableData(internalData);
        onTableDataChange(internalData);
        onValidationChange?.(Object.keys(cellErrorsByCellKeyRef.current).length > 0);
      },
      [onTableDataChange, onValidationChange]
    );

    const createEmptyRow = React.useCallback((): OffentligeYdelserRow => {
      return { ...initialOffentligYdelseRow, id: generateOffentligYdelseRowId() };
    }, []);

    const normalizeRows = React.useCallback(
      (rows: readonly OffentligeYdelserRow[]): OffentligeYdelserRow[] => {
        return normalizeGridRows({ rows, minRows: MIN_VISIBLE_ROWS, isRowEmpty, createEmptyRow });
      },
      [createEmptyRow]
    );

    const [internalTableData, setInternalTableData] = React.useState<OffentligeYdelserRow[]>(() => {
      const initial = tableData.length > 0 ? normalizeRows(tableData) : normalizeRows(defaultTableData);
      // Treat the initial normalized rows as "synced" so blur without edits does not trigger persistence.
      lastPersistedFingerprintRef.current = fingerprintTableData(initial);
      return initial;
    });

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
    }, [internalTableData]);

    const setRow = React.useCallback((rowId: string, updates: Partial<OffentligeYdelserRow>) => {
      setInternalTableData((prev) => prev.map((row) => (row.id === rowId ? { ...row, ...updates } : row)));
    }, []);

    const commitRowUpdate = React.useCallback(
      (rowId: string, updates: Partial<OffentligeYdelserRow>) => {
        setInternalTableData((prev) => {
          const updated = prev.map((row) => (row.id === rowId ? { ...row, ...updates } : row));
          const normalized = normalizeRows(updated);
          // Only persist when the normalized result differs from what we've last told the parent.
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
      },
      []
    );

    const ydelsestypeOptions = React.useMemo<readonly TableDropdownOption[]>(
      () => ydelsestypeKeys.map((key) => ({ value: key, label: ydelsestyper[key].label })),
      []
    );

    type YdelsestypeKey = (typeof ydelsestypeKeys)[number];

    const isYdelsestypeKey = React.useCallback((value: string): value is YdelsestypeKey => {
      return (ydelsestypeKeys as readonly string[]).includes(value);
    }, []);

    const [sortState, setSortState] = React.useState<GridSortState>({});

    const getSortDirection = React.useCallback(
      (colId: string): GridSortDirection => {
        if (sortState.primary?.colId === colId) return sortState.primary.dir;
        if (sortState.secondary?.colId === colId) return sortState.secondary.dir;
        return 'asc';
      },
      [sortState.primary?.colId, sortState.primary?.dir, sortState.secondary?.colId, sortState.secondary?.dir]
    );

  const parseAmountForSort = React.useCallback((raw: AmountValue | undefined): number | undefined => {
    return amountValueToNumber(raw);
  }, []);

    const getSortValueByColId = React.useCallback(
      (colId: string) => {
        switch (colId) {
          case 'fraDato':
            return (row: OffentligeYdelserRow) => coerceToISODateString(row.fraDato?.trim() ?? '') ?? '';
          case 'tilDato':
            return (row: OffentligeYdelserRow) => coerceToISODateString(row.tilDato?.trim() ?? '') ?? '';
          case 'ydelse':
            return (row: OffentligeYdelserRow) => parseAmountForSort(row.ydelse);
          case 'tillaeg':
            return (row: OffentligeYdelserRow) => parseAmountForSort(row.tillaeg);
          case 'ydelsestype':
            return (row: OffentligeYdelserRow) => {
              const key = row.ydelsestype?.trim() ?? '';
              if (key === '') return '';
              return isYdelsestypeKey(key) ? ydelsestyper[key].label : key;
            };
          case 'periodiseringLabel':
            return (row: OffentligeYdelserRow) => derivedByRowId?.get(row.id)?.periodiseringLabel ?? '';
          case 'antalDageDisplay':
            return (row: OffentligeYdelserRow) => derivedByRowId?.get(row.id)?.antalDageDisplay ?? '';
          case 'ydelsePerDagDisplay':
            return (row: OffentligeYdelserRow) => derivedByRowId?.get(row.id)?.ydelsePerDagDisplay ?? '';
          default:
            return undefined;
        }
      },
      [derivedByRowId, isYdelsestypeKey, parseAmountForSort]
    );

    const visibleRows = React.useMemo(() => {
      return sortGridRows({
        rows: internalTableData,
        getRowId: (row) => row.id,
        isRowEmpty,
        sortState,
        getSortValueByColId,
      });
    }, [getSortValueByColId, internalTableData, sortState]);

    return (
      <div ref={ref}>
        <StandardGridTable tableWidth="1130px">
          <colgroup>
            <col style={{ width: '120px' }} />
            <col style={{ width: '120px' }} />
            <col style={{ width: '130px' }} />
            <col style={{ width: '130px' }} />
            <col style={{ width: '200px' }} />
            <col style={{ width: '160px' }} />
            <col style={{ width: '110px' }} />
            <col style={{ width: '160px' }} />
          </colgroup>

          <thead>
            <tr>
              <StandardGridHeaderCell
                onClick={() => setSortState((prev) => toggleGridSort(prev, 'fraDato'))}
                sortRole={getGridSortRole(sortState, 'fraDato')}
                sortDirection={getSortDirection('fraDato')}
              >
                Fra-dato
              </StandardGridHeaderCell>
              <StandardGridHeaderCell
                onClick={() => setSortState((prev) => toggleGridSort(prev, 'tilDato'))}
                sortRole={getGridSortRole(sortState, 'tilDato')}
                sortDirection={getSortDirection('tilDato')}
              >
                Til-dato
              </StandardGridHeaderCell>
              <StandardGridHeaderCell
                onClick={() => setSortState((prev) => toggleGridSort(prev, 'ydelse'))}
                sortRole={getGridSortRole(sortState, 'ydelse')}
                sortDirection={getSortDirection('ydelse')}
              >
                Ydelse
              </StandardGridHeaderCell>
              <StandardGridHeaderCell
                onClick={() => setSortState((prev) => toggleGridSort(prev, 'tillaeg'))}
                sortRole={getGridSortRole(sortState, 'tillaeg')}
                sortDirection={getSortDirection('tillaeg')}
              >
                Evt. tillæg
              </StandardGridHeaderCell>
              <StandardGridHeaderCell
                onClick={() => setSortState((prev) => toggleGridSort(prev, 'ydelsestype'))}
                sortRole={getGridSortRole(sortState, 'ydelsestype')}
                sortDirection={getSortDirection('ydelsestype')}
              >
                Ydelsestype
              </StandardGridHeaderCell>
              <StandardGridHeaderCell
                onClick={() => setSortState((prev) => toggleGridSort(prev, 'periodiseringLabel'))}
                sortRole={getGridSortRole(sortState, 'periodiseringLabel')}
                sortDirection={getSortDirection('periodiseringLabel')}
              >
                Periodisering
              </StandardGridHeaderCell>
              <StandardGridHeaderCell
                onClick={() => setSortState((prev) => toggleGridSort(prev, 'antalDageDisplay'))}
                sortRole={getGridSortRole(sortState, 'antalDageDisplay')}
                sortDirection={getSortDirection('antalDageDisplay')}
              >
                Antal dage
              </StandardGridHeaderCell>
              <StandardGridHeaderCell
                onClick={() => setSortState((prev) => toggleGridSort(prev, 'ydelsePerDagDisplay'))}
                sortRole={getGridSortRole(sortState, 'ydelsePerDagDisplay')}
                sortDirection={getSortDirection('ydelsePerDagDisplay')}
              >
                Ydelse / dag
              </StandardGridHeaderCell>
            </tr>
          </thead>

          <tbody>
            {visibleRows.map((row, rowIndex) => {
              const derived = derivedByRowId?.get(row.id);
              return (
                <tr key={row.id} data-mineo-row-id={row.id} style={getStandardGridBodyRowStyle(rowIndex)}>
                  <td style={getStandardGridCellStyle({ align: 'center' })}>
                    <TableDateInput
                      gridCell={{ rowId: row.id, colIndex: 0 }}
                      value={row.fraDato}
                      onChange={(e) => setRow(row.id, { fraDato: e.target.value })}
                      onBlur={(e) => commitRowUpdate(row.id, { fraDato: e.target.value })}
                      onErrorChange={handleErrorChange(row.id, 'fraDato')}
                      minDate={dateRanges_offentligeYdelser.fraDato.min}
                      maxDate={asValidDateBound(row.tilDato) ?? dateRanges_offentligeYdelser.fraDato.fallbackMax}
                      specialRangeErrors={{ fraTilRole: 'fra' }}
                      noValidRangeCause="Til-dato i samme række"
                    />
                  </td>

                  <td style={getStandardGridCellStyle({ align: 'center' })}>
                    <TableDateInput
                      gridCell={{ rowId: row.id, colIndex: 1 }}
                      value={row.tilDato}
                      onChange={(e) => setRow(row.id, { tilDato: e.target.value })}
                      onBlur={(e) => commitRowUpdate(row.id, { tilDato: e.target.value })}
                      onErrorChange={handleErrorChange(row.id, 'tilDato')}
                      minDate={asValidDateBound(row.fraDato) ?? dateRanges_offentligeYdelser.tilDato.fallbackMin}
                      maxDate={dateRanges_offentligeYdelser.tilDato.max}
                      specialRangeErrors={{ fraTilRole: 'til' }}
                      noValidRangeCause="Fra-dato i samme række"
                    />
                  </td>

                  <td style={getStandardGridCellStyle({ align: 'center' })}>
                    <TableAmountInput
                      gridCell={{ rowId: row.id, colIndex: 2 }}
                      value={row.ydelse}
                      onBlur={(e) => commitRowUpdate(row.id, { ydelse: e.target.value })}
                      onErrorChange={handleErrorChange(row.id, 'ydelse')}
                      placeholder=""
                    />
                  </td>

                  <td style={getStandardGridCellStyle({ align: 'center' })}>
                    <TableAmountInput
                      gridCell={{ rowId: row.id, colIndex: 3 }}
                      value={row.tillaeg}
                      onBlur={(e) => commitRowUpdate(row.id, { tillaeg: e.target.value })}
                      onErrorChange={handleErrorChange(row.id, 'tillaeg')}
                      placeholder=""
                    />
                  </td>

                  <td style={getStandardGridCellStyle({ align: 'center' })}>
                    <TableDropdown
                      value={row.ydelsestype}
                      allowEmpty={true}
                      onChange={(e) => commitRowUpdate(row.id, { ydelsestype: e.target.value || '' })}
                      placeholder="Vælg..."
                      options={ydelsestypeOptions}
                    />
                  </td>

                  <td
                    style={{
                      padding: '4px 8px',
                      border: 'none',
                      textAlign: 'center',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      fontSize: '13px',
                      fontFamily: '"Montserrat", sans-serif',
                      color: 'rgba(0, 0, 0, 0.6)',
                    }}
                  >
                    {derived?.periodiseringLabel ?? ''}
                  </td>

                  <td
                    style={{
                      padding: '4px 8px',
                      border: 'none',
                      textAlign: 'center',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      fontSize: '13px',
                      fontFamily: '"Montserrat", sans-serif',
                      fontFeatureSettings: '"tnum"',
                      color: 'rgba(0, 0, 0, 0.6)',
                    }}
                  >
                    {derived?.antalDageDisplay ?? ''}
                  </td>

                  <td
                    style={{
                      padding: '4px 8px',
                      border: 'none',
                      textAlign: 'right',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      fontSize: '13px',
                      fontFamily: '"Montserrat", sans-serif',
                      fontFeatureSettings: '"tnum"',
                      color: 'rgba(0, 0, 0, 0.6)',
                    }}
                  >
                    {derived?.ydelsePerDagDisplay ?? ''}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </StandardGridTable>
      </div>
    );
  }
);

OffentligeYdelserTable.displayName = 'OffentligeYdelserTable';

export default OffentligeYdelserTable;
