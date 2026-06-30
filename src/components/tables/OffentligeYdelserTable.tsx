import React from 'react';
import TableAmountInput from '../inputs/table/TableAmountInput';
import TableDateInput from '../inputs/table/TableDateInput';
import TableDropdown, { type TableDropdownOption } from '../inputs/table/TableDropdown';
import type { TableInputErrorInfo } from '../../utils/tableInputContracts';
import { dateRanges_offentligeYdelser } from '../../config/dateRanges';
import { initialOffentligYdelseRow, generateOffentligYdelseRowId } from '../../domain/erstatningsopgoerelse/helpers/eoRowInitialValues';
import { createEmptyRowId } from '../../utils/rowId';
import { scrollTargetIntoView } from '../../utils/scrollTargetIntoView';
import type { OffentligeYdelserRow } from '../../schemas/formSchemas';
import type { AmountValue } from '../../schemas/amountExpressionSchema';
import { amountValueToNumber } from '../../utils/expressionAmount';
import { ydelsestyper, ydelsestypeKeys } from '../../data/ydelsestyper';
import type {
  OffentligeYdelserTableColumnKey,
  OffentligeYdelserTableFirstErrorCell,
  OffentligeYdelserTableValidationSummary,
} from '../../types/table';
import type { OffentligeYdelserTableHandle } from '../../types/handles';
import {
  buildOffentligeYdelserCellKey,
  getOffentligeYdelserTableValidation,
  isOffentligeYdelserTableValueEffectivelyEmptyForValidation,
} from '../../domain/erstatningsopgoerelse/validation/offentligeYdelserTableValidation';
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
import { getOffentligeYdelserTableHeaderNodes } from '../../domain/erstatningsopgoerelse/tables/offentligeYdelserTableColumns';
import { useRegisterTableSaveOrder } from './useRegisterTableSaveOrder';
import type { ISODateString } from '../../types/branded';
import type { TableSaveOrderPath } from '../../utils/tableSaveOrderRegistry';

export type OffentligeYdelserDerivedCellValues = Readonly<{
  periodiseringLabel: string;
  antalDageDisplay: string;
  ydelsePerDagDisplay: string;
}>;

export type OffentligeYdelserTableProps = {
  tableData: OffentligeYdelserRow[];
  derivedByRowId?: ReadonlyMap<string, OffentligeYdelserDerivedCellValues>;
  onTableDataChange?: (data: OffentligeYdelserRow[], origin?: { fieldPath?: string }) => void;
  onValidationChange?: (summary: OffentligeYdelserTableValidationSummary) => void;
  saveOrderPath?: TableSaveOrderPath;
  /**
   * Når sand, deaktiveres ydelsestype-optionen `midlertidigt_eet` i dropdown'en.
   * Anvendes når togglen "Midlertidigt EET indsættes fra Erhvervsevnetab-siden"
   * er aktiveret — så er manuel indtastning af midlertidigt_eet-rækker ikke mulig
   * for at bevare invariant: kun én kilde til midlertidigt EET-data ad gangen.
   */
  disableMidlertidigtEetOption?: boolean;
};

const MIN_VISIBLE_ROWS = 2;

const isIsoDateEmpty = (value: ISODateString | undefined): boolean => {
  return value === undefined;
};

const isEffectivelyEmpty = (value: string | undefined): boolean => {
  return value === undefined || value.trim() === '';
};

const isAmountEmpty = (value: AmountValue | undefined): boolean => {
  return value === undefined;
};

const isRowEmpty = (row: OffentligeYdelserRow): boolean => {
  return (
    isIsoDateEmpty(row.fraDato) &&
    isIsoDateEmpty(row.tilDato) &&
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

const OffentligeYdelserTable = React.memo(React.forwardRef<OffentligeYdelserTableHandle, OffentligeYdelserTableProps>(
  ({ tableData, derivedByRowId, onTableDataChange, onValidationChange, saveOrderPath, disableMidlertidigtEetOption = false }, ref) => {
    const headers = React.useMemo(() => getOffentligeYdelserTableHeaderNodes(), []);
    const defaultTableData = React.useMemo<OffentligeYdelserRow[]>(
      () => [
        { ...initialOffentligYdelseRow, id: generateOffentligYdelseRowId() },
        { ...initialOffentligYdelseRow, id: generateOffentligYdelseRowId() },
      ],
      []
    );

    const tableRef = React.useRef<HTMLTableElement | null>(null);
    const pendingRowFocusPlanRef = React.useRef<RowRemovalFocusPlan | null>(null);
    const visibleRowIdsRef = React.useRef<readonly string[]>([]);
    const cellErrorTracker = useTableCellErrorTracker();

    // Determinisme-kontrakt (se normalizeGridRows): id'et udledes af seed'et, ikke en RNG,
    // så StrictMode-dobbeltinvokering af setState-updateren ikke giver divergerende id'er.
    const createEmptyRow = React.useCallback((seed: number): OffentligeYdelserRow => {
      return { ...initialOffentligYdelseRow, id: createEmptyRowId('offentlig_ydelse', seed) };
    }, []);

    const normalizeRows = React.useCallback(
      (rows: readonly OffentligeYdelserRow[]): OffentligeYdelserRow[] => {
        return normalizeGridRows({ rows, minRows: MIN_VISIBLE_ROWS, getRowId: (row) => row.id, isRowEmpty, createEmptyRow });
      },
      [createEmptyRow]
    );

    const { internalTableData, setInternalTableData, lastPersistedFingerprintRef, getStrippedFingerprint, queuePersist, getUndoFieldPathAliases } =
      useGridRowPersistenceCore<OffentligeYdelserRow>({
        tableData: tableData.length > 0 ? tableData : defaultTableData,
        onTableDataChange,
        normalizeRows,
        isRowEmpty,
        getRowId: (row) => row.id,
        withRowId: (row, id) => ({ ...row, id }),
        fingerprint: fingerprintTableData,
      });

    // Renderede rækker (inkl. efterfølgende tom række) — fælles liveness-grundlag for celle-fejl-trackeren
    // og `invalidDrafts`-reconcile (en slettet rækkes rå draft må ikke blokere Gem som spøgelses-mål).
    const liveRowIds = React.useMemo(() => new Set(internalTableData.map((row) => row.id)), [internalTableData]);
    useReconcileInvalidDraftsToLiveRows(liveRowIds);

    const getValidationResult = React.useCallback(() => {
      const validRowIds = new Set(internalTableData.map((row) => row.id));
      const filteredCellErrorsByCellKey: Record<string, true> = {};
      for (const cellKey of cellErrorTracker.getActiveCellKeys(validRowIds)) {
        filteredCellErrorsByCellKey[cellKey] = true;
      }
      return getOffentligeYdelserTableValidation({
        rows: internalTableData,
        cellErrorsByCellKey: filteredCellErrorsByCellKey,
      });
    }, [cellErrorTracker, internalTableData]);

    const notifyValidationChange = React.useCallback(() => {
      if (!onValidationChange) return;
      onValidationChange(getValidationResult().summary);
    }, [getValidationResult, onValidationChange]);

    // Notificér validering når den committede rækkeliste ændrer sig (commit, reorder, resync).
    React.useEffect(() => {
      notifyValidationChange();
    }, [notifyValidationChange]);

    // Bevidst tabel-lokal commit-model: rækker styres med manuel ordning/fokus-evaluering
    // her, mens hvert Table*Input stadig ejer draft-state indtil commit. Strip/reconcile/flush
    // ejes af useGridRowPersistenceCore.
    const commitRowUpdate = React.useCallback(
      (rowId: string, updates: Partial<OffentligeYdelserRow>, colIndex: number) => {
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
            // Last-plan-wins by design: kun det sidste commit i en render-cyklus skal afgøre fokus-gendannelse.
            pendingRowFocusPlanRef.current = commitEval.focusPlan;
          }

          // Persistér kun når det normaliserede resultat afviger fra det, vi sidst har fortalt forælderen.
          if (commitEval.shouldPersist) {
            // Tag commit'et med den redigerede celles identitet, så undo/redo lander fokus korrekt.
            queuePersist(normalized, `${rowId}:${colIndex}`);
          }
          return normalized;
        });
      },
      [getStrippedFingerprint, lastPersistedFingerprintRef, normalizeRows, queuePersist, setInternalTableData]
    );

    // Slet hele rækken i én undo-handling: filtrér rækken ud, re-normalisér og persistér én gang.
    // Ét queuePersist = ét history-frame, så undo genskaber hele rækken og alle dens indtastninger.
    const handleDeleteRow = React.useCallback(
      (rowId: string) => {
        setInternalTableData((prev) => {
          const normalized = normalizeRows(prev.filter((row) => row.id !== rowId));
          if (fingerprintTableData(normalized) === fingerprintTableData(prev)) return prev;
          queuePersist(normalized);
          return normalized;
        });
      },
      [normalizeRows, queuePersist, setInternalTableData]
    );

    const handleErrorChange = React.useCallback(
      (rowId: string, colKey: OffentligeYdelserTableColumnKey) => (errorInfo: TableInputErrorInfo) => {
        // Bevidst INGEN committed-row-gate her (jf. konvergens med StandardLoenTable/LoenudviklingManuelTable):
        // en gate på committede rækker kunne tabe en reel celle-fejl, hvis inputtet emitterer fejlen før
        // den committede rækkeliste-effect har opdateret sættet (fx ved indsæt/reconcile) — så Gem ikke
        // blokeredes som det burde. Oprydning af forældede rækkers fejl sker i stedet deterministisk via
        // trackerens read-time-filtrering på validRowIds, så en fjernet rækkes fejl aldrig overlever.
        if (cellErrorTracker.setCellError(buildOffentligeYdelserCellKey(rowId, colKey), errorInfo.hasError)) {
          notifyValidationChange();
        }
      },
      [cellErrorTracker, notifyValidationChange]
    );

    const ydelsestypeOptions = React.useMemo<readonly TableDropdownOption[]>(() => {
      const keysBeforeTail = ydelsestypeKeys.filter((key) => key !== 'midlertidigt_eet' && key !== 'andet');
      return [
        ...keysBeforeTail.map((key) => ({ value: key, label: ydelsestyper[key].label })),
        { kind: 'divider', id: 'ydelsestype-divider-foer-midlertidigt-eet' },
        {
          value: 'midlertidigt_eet',
          label: ydelsestyper.midlertidigt_eet.label,
          disabled: disableMidlertidigtEetOption,
          disabledReason: disableMidlertidigtEetOption
            ? 'Midlertidigt EET indsættes automatisk fra Erhvervsevnetab-siden. Slå funktionen fra i "Tilføj særligt" for at indtaste manuelt.'
            : undefined,
        },
        { value: 'andet', label: ydelsestyper.andet.label },
      ];
    }, [disableMidlertidigtEetOption]);

    type YdelsestypeKey = (typeof ydelsestypeKeys)[number];

    const isYdelsestypeKey = React.useCallback((value: string): value is YdelsestypeKey => {
      return (ydelsestypeKeys as readonly string[]).includes(value);
    }, []);

    const sortColumns = React.useMemo(() => [
      { colId: 'fraDato', getSortValue: (row: OffentligeYdelserRow) => row.fraDato ?? '' },
      { colId: 'tilDato', getSortValue: (row: OffentligeYdelserRow) => row.tilDato ?? '' },
      { colId: 'ydelse', getSortValue: (row: OffentligeYdelserRow) => amountValueToNumber(row.ydelse) },
      { colId: 'tillaeg', getSortValue: (row: OffentligeYdelserRow) => amountValueToNumber(row.tillaeg) },
      {
        colId: 'ydelsestype',
        getSortValue: (row: OffentligeYdelserRow) => {
          const key = row.ydelsestype?.trim() ?? '';
          if (key === '') return '';
          return isYdelsestypeKey(key) ? ydelsestyper[key].label : key;
        },
      },
      { colId: 'periodiseringLabel', getSortValue: (row: OffentligeYdelserRow) => derivedByRowId?.get(row.id)?.periodiseringLabel ?? '' },
      { colId: 'antalDageDisplay', getSortValue: (row: OffentligeYdelserRow) => derivedByRowId?.get(row.id)?.antalDageDisplay ?? '' },
      { colId: 'ydelsePerDagDisplay', getSortValue: (row: OffentligeYdelserRow) => derivedByRowId?.get(row.id)?.ydelsePerDagDisplay ?? '' },
    ], [derivedByRowId, isYdelsestypeKey]);

    const reorderRows = React.useCallback((nextRows: OffentligeYdelserRow[]) => {
      if (getStrippedFingerprint(nextRows) !== lastPersistedFingerprintRef.current) {
        // Reorder er ikke en celle-redigering; fieldPath udelades (falder tilbage til focus-tracker).
        queuePersist(nextRows);
      }
      setInternalTableData(nextRows);
    }, [getStrippedFingerprint, lastPersistedFingerprintRef, queuePersist, setInternalTableData]);

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

    const [externalCellError, setExternalCellError] = React.useState<{ rowId: string; colKey: OffentligeYdelserTableColumnKey; message: string } | null>(null);
    const cellRefsByCellKeyRef = React.useRef<Record<string, HTMLElement | null>>({});
    const registerCellRef = React.useCallback(
      (rowId: string, colIdx: number) => (el: HTMLElement | null) => {
        cellRefsByCellKeyRef.current[`${rowId}:${colIdx}`] = el;
      },
      []
    );

    const resolveColIdxFromKey = React.useCallback((colKey: OffentligeYdelserTableColumnKey): number => {
      switch (colKey) {
        case 'fraDato':
          return 0;
        case 'tilDato':
          return 1;
        case 'ydelse':
          return 2;
        case 'tillaeg':
          return 3;
        case 'ydelsestype':
          return 4;
        default:
          return -1;
      }
    }, []);

    const getExternalErrorMessage = React.useCallback(
      (rowId: string, colKey: OffentligeYdelserTableColumnKey): string | undefined => {
        if (!externalCellError) return undefined;
        if (externalCellError.rowId !== rowId) return undefined;
        if (externalCellError.colKey !== colKey) return undefined;
        return externalCellError.message;
      },
      [externalCellError]
    );

    React.useEffect(() => {
      if (!externalCellError) return;
      const row = internalTableData.find((item) => item.id === externalCellError.rowId);
      if (!row) {
        setExternalCellError(null);
        return;
      }
      const value = row[externalCellError.colKey];
      const isEmpty = isOffentligeYdelserTableValueEffectivelyEmptyForValidation(value);
      const cellKey = buildOffentligeYdelserCellKey(externalCellError.rowId, externalCellError.colKey);
      const hasInputError = cellErrorTracker.getActiveCellKeys(new Set([externalCellError.rowId])).includes(cellKey);
      if (!isEmpty || hasInputError) {
        setExternalCellError(null);
      }
    }, [cellErrorTracker, externalCellError, internalTableData]);

    // Housekeeping: fjern forældede rækkers celle-fejl fra det bagvedliggende sæt. Korrektheden
    // hviler på trackerens read-time-filtrering (getValidationResult); denne effect holder blot sættet rent.
    React.useEffect(() => {
      cellErrorTracker.pruneToValidRowIds(liveRowIds);
    }, [cellErrorTracker, liveRowIds]);

    React.useImperativeHandle(
      ref,
      () => ({
        getValidationSummary: (): OffentligeYdelserTableValidationSummary => getValidationResult().summary,
        showMissingEntryError: (cell: OffentligeYdelserTableFirstErrorCell) => {
          if (cell.reason !== 'missing') return;
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
      }),
      [getValidationResult, resolveColIdxFromKey]
    );

    return (
      <div>
        <StandardGridTable tableWidth="1130px" tableRef={tableRef}>
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
              <StandardGridHeaderCell onClick={() => handleHeaderClick('fraDato')} sortRole={getSortRole('fraDato')} sortDirection={getSortDirection('fraDato')}>{headers[0]}</StandardGridHeaderCell>
              <StandardGridHeaderCell onClick={() => handleHeaderClick('tilDato')} sortRole={getSortRole('tilDato')} sortDirection={getSortDirection('tilDato')}>{headers[1]}</StandardGridHeaderCell>
              <StandardGridHeaderCell onClick={() => handleHeaderClick('ydelse')} sortRole={getSortRole('ydelse')} sortDirection={getSortDirection('ydelse')}>{headers[2]}</StandardGridHeaderCell>
              <StandardGridHeaderCell onClick={() => handleHeaderClick('tillaeg')} sortRole={getSortRole('tillaeg')} sortDirection={getSortDirection('tillaeg')}>{headers[3]}</StandardGridHeaderCell>
              <StandardGridHeaderCell onClick={() => handleHeaderClick('ydelsestype')} sortRole={getSortRole('ydelsestype')} sortDirection={getSortDirection('ydelsestype')}>{headers[4]}</StandardGridHeaderCell>
              <StandardGridHeaderCell onClick={() => handleHeaderClick('periodiseringLabel')} sortRole={getSortRole('periodiseringLabel')} sortDirection={getSortDirection('periodiseringLabel')}>{headers[5]}</StandardGridHeaderCell>
              <StandardGridHeaderCell onClick={() => handleHeaderClick('antalDageDisplay')} sortRole={getSortRole('antalDageDisplay')} sortDirection={getSortDirection('antalDageDisplay')}>{headers[6]}</StandardGridHeaderCell>
              <StandardGridHeaderCell onClick={() => handleHeaderClick('ydelsePerDagDisplay')} sortRole={getSortRole('ydelsePerDagDisplay')} sortDirection={getSortDirection('ydelsePerDagDisplay')}>{headers[7]}</StandardGridHeaderCell>
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
                      undoFieldPathAliases={getUndoFieldPathAliases(row.id, 0)}
                      value={row.fraDato}
                      onBlur={(e) => commitRowUpdate(row.id, { fraDato: e.target.value }, 0)}
                      onErrorChange={handleErrorChange(row.id, 'fraDato')}
                      externalErrorMessage={getExternalErrorMessage(row.id, 'fraDato')}
                      inputRef={registerCellRef(row.id, 0)}
                      minDate={dateRanges_offentligeYdelser.fraDato.min}
                      maxDate={row.tilDato ?? dateRanges_offentligeYdelser.fraDato.fallbackMax}
                      specialRangeErrors={{ fraTilRole: 'fra' }}
                      noValidRangeCause="Til-dato i samme række"
                    />
                  </td>

                  <td style={getStandardGridCellStyle({ align: 'center' })}>
                    <TableDateInput
                      gridCell={{ rowId: row.id, colIndex: 1 }}
                      undoFieldPathAliases={getUndoFieldPathAliases(row.id, 1)}
                      value={row.tilDato}
                      onBlur={(e) => commitRowUpdate(row.id, { tilDato: e.target.value }, 1)}
                      onErrorChange={handleErrorChange(row.id, 'tilDato')}
                      externalErrorMessage={getExternalErrorMessage(row.id, 'tilDato')}
                      inputRef={registerCellRef(row.id, 1)}
                      minDate={row.fraDato ?? dateRanges_offentligeYdelser.tilDato.fallbackMin}
                      maxDate={dateRanges_offentligeYdelser.tilDato.max}
                      specialRangeErrors={{ fraTilRole: 'til' }}
                      noValidRangeCause="Fra-dato i samme række"
                    />
                  </td>

                  <td style={getStandardGridCellStyle({ align: 'center' })}>
                    <TableAmountInput
                      gridCell={{ rowId: row.id, colIndex: 2 }}
                      undoFieldPathAliases={getUndoFieldPathAliases(row.id, 2)}
                      value={row.ydelse}
                      onBlur={(e) => commitRowUpdate(row.id, { ydelse: e.target.value }, 2)}
                      onErrorChange={handleErrorChange(row.id, 'ydelse')}
                      externalErrorMessage={getExternalErrorMessage(row.id, 'ydelse')}
                      inputRef={registerCellRef(row.id, 2)}
                    />
                  </td>

                  <td style={getStandardGridCellStyle({ align: 'center' })}>
                    <TableAmountInput
                      gridCell={{ rowId: row.id, colIndex: 3 }}
                      undoFieldPathAliases={getUndoFieldPathAliases(row.id, 3)}
                      value={row.tillaeg}
                      onBlur={(e) => commitRowUpdate(row.id, { tillaeg: e.target.value }, 3)}
                      onErrorChange={handleErrorChange(row.id, 'tillaeg')}
                      externalErrorMessage={getExternalErrorMessage(row.id, 'tillaeg')}
                      inputRef={registerCellRef(row.id, 3)}
                    />
                  </td>

                  <td style={getStandardGridCellStyle({ align: 'center' })}>
                    <TableDropdown
                      gridCell={{ rowId: row.id, colIndex: 4 }}
                      undoFieldPathAliases={getUndoFieldPathAliases(row.id, 4)}
                      value={row.ydelsestype}
                      allowEmpty={true}
                      onChange={(e) => commitRowUpdate(row.id, { ydelsestype: e.target.value || '' }, 4)}
                      placeholder="Vælg..."
                      options={ydelsestypeOptions}
                      externalErrorMessage={getExternalErrorMessage(row.id, 'ydelsestype')}
                      inputRef={registerCellRef(row.id, 4)}
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
                      color: 'var(--mineo-color-grid-derived)',
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
                      color: 'var(--mineo-color-grid-derived)',
                    }}
                  >
                    {derived?.antalDageDisplay ?? ''}
                  </td>

                  <td
                    style={{
                      padding: '4px 8px',
                      // Reserveret bane til højre for værdien, hvor slet-ikonet vises.
                      paddingRight: '28px',
                      border: 'none',
                      textAlign: 'right',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      fontSize: '13px',
                      fontFamily: '"Montserrat", sans-serif',
                      fontFeatureSettings: '"tnum"',
                      position: 'relative',
                      color: 'var(--mineo-color-grid-derived)',
                    }}
                  >
                    {derived?.ydelsePerDagDisplay ?? ''}
                    {!isRowEmpty(row) && (
                      <RowDeleteButton onDelete={() => handleDeleteRow(row.id)} />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </StandardGridTable>
      </div>
    );
  }
));

OffentligeYdelserTable.displayName = 'OffentligeYdelserTable';

export default OffentligeYdelserTable;
