import * as React from 'react';
import { TableBody, TableCell, TableHead, TableRow } from '@mui/material';
import TableDateInput from '../inputs/table/TableDateInput';
import TablePercentInput from '../inputs/table/TablePercentInput';
import TableDropdown, { type TableDropdownOption } from '../inputs/table/TableDropdown';
import StandardLooseTable, { StandardLooseHeaderCell } from './StandardLooseTable';
import { RowDeleteButton } from './RowDeleteButton';
import { dateRanges_erhvervsevnetab } from '../../config/dateRanges';
import type { DateRangeSpecialErrors } from '../../utils/dateRangeErrorMessages';
import type { AslAfgoerelseRow, AfgoerelseType, JaNej } from '../../schemas/formSchemas';
import type { ISODateString } from '../../types/branded';
import { getDayBeforeIso } from '../../utils/isoDateHelpers';
import {
  ASL_AFGOERELSE_ROW_ID_PREFIX,
  EET_ASL_MIN_VISIBLE_ROWS,
  collectEetAslAfgoerelseValidationIssues,
  createEmptyAslAfgoerelseRow,
  emptyAslAfgoerelseRowFields,
  isAslAfgoerelseRowPersistenceEmpty,
} from '../../domain/erhvervsevnetab/eetAslAfgoerelser';
import { createEmptyRowId } from '../../utils/rowId';
import { normalizeGridRows } from './gridCore/gridModel';
import { useGridRowPersistenceCore, type GridRowCommitOrigin } from './gridCore/useGridRowPersistenceCore';
import { useReconcileInvalidDraftsToLiveRows } from '../../hooks/tableInput';
import { useTableSort } from './useTableSort';
import { useRegisterTableSaveOrder } from './useRegisterTableSaveOrder';
import type { TableSaveOrderPath } from '../../utils/tableSaveOrderRegistry';

export type EetAslAfgoerelserTableProps = Readonly<{
  tableData: AslAfgoerelseRow[];
  skadedato: ISODateString | undefined;
  skadedatoMin: ISODateString;
  beregningsdato: ISODateString | undefined;
  skadelidteFodselsdato: ISODateString | undefined;
  onTableDataChange?: (rows: AslAfgoerelseRow[], origin?: GridRowCommitOrigin) => boolean;
  saveOrderPath?: TableSaveOrderPath;
}>;

/**
 * Felt → kolonneindeks, så et celle-commit kan tagges med `rowId:colIndex` — samme identitet
 * som Table*Input-cellerne registrerer deres draft-history-controller under (gridCell.colIndex).
 * Bruges til at give undo/redo korrekt fokus-mål; jf. StandardLoenTable-mønstret.
 */
const FIELD_COL_INDEX: Readonly<Partial<Record<keyof AslAfgoerelseRow, number>>> = {
  afgoerelsesDato: 0,
  virkningsDato: 1,
  eetPct: 2,
  afgoerelseType: 3,
  kapDato: 4,
  kapPct: 5,
  tidlKapDato: 6,
  fsTilbageholdtEet: 7,
};

const AFGOERELSES_TYPE_OPTIONS: readonly TableDropdownOption[] = [
  { value: 'Midlertidig', label: 'Midlertidig' },
  { value: 'Delvist endelig', label: 'Delvist endelig' },
  { value: 'Endelig', label: 'Endelig' },
];

const JA_NEJ_OPTIONS: readonly TableDropdownOption[] = [
  { value: 'Ja', label: 'Ja' },
  { value: 'Nej', label: 'Nej' },
];

const VIRKNINGSDATO_SPECIAL_RANGE_ERRORS: DateRangeSpecialErrors = { maxBoundKind: 'eetDataMax', maxBoundFieldLabel: 'Virkningsdato' };
const KAPDATO_NO_AFGOERELSESDATO_SPECIAL_RANGE_ERRORS: DateRangeSpecialErrors = { maxBoundKind: 'eetDataMax', maxBoundFieldLabel: 'Kapitaliseringsdato' };

const TABLE_FINGERPRINT_KEYS = [
  'id',
  'afgoerelsesDato',
  'virkningsDato',
  'eetPct',
  'kapDato',
  'kapPct',
  'afgoerelseType',
  'tidlKapDato',
  'fsTilbageholdtEet',
] as const satisfies ReadonlyArray<keyof AslAfgoerelseRow>;

const fingerprintTableData = (rows: readonly AslAfgoerelseRow[]): string => {
  return JSON.stringify(rows.map((row) => TABLE_FINGERPRINT_KEYS.map((key) => row[key] ?? null)));
};

const EetAslAfgoerelserTable = React.memo(
  ({ tableData, skadedato, skadedatoMin, beregningsdato: _beregningsdato, skadelidteFodselsdato, onTableDataChange, saveOrderPath }: EetAslAfgoerelserTableProps) => {
    const tabelAfgoerelsesdatoMax = dateRanges_erhvervsevnetab.tabelAfgoerelsesdato.max;
    const tabelVirkningsdatoMax = dateRanges_erhvervsevnetab.tabelVirkningsdato.max;
    const tabelKapitaliseringsdatoMax = dateRanges_erhvervsevnetab.tabelKapitaliseringsdato.max;

    const afgoerelsesDatoSpecialErrors = React.useMemo<DateRangeSpecialErrors>(
      () => ({ minBoundKind: 'skadedato', minBoundReferenceISO: skadedato, maxBoundKind: 'eetDataMax', maxBoundFieldLabel: 'Afgørelsesdato' }),
      [skadedato]
    );

    const defaultTableData = React.useMemo<AslAfgoerelseRow[]>(
      () => [createEmptyAslAfgoerelseRow(), createEmptyAslAfgoerelseRow()],
      []
    );

    const normalizeRows = React.useCallback(
      (rows: readonly AslAfgoerelseRow[]): AslAfgoerelseRow[] => {
        return normalizeGridRows({
          rows,
          minRows: EET_ASL_MIN_VISIBLE_ROWS,
          getRowId: (row) => row.id,
          isRowEmpty: isAslAfgoerelseRowPersistenceEmpty,
          // Determinisme-kontrakt (se normalizeGridRows): id'et udledes af seed'et, ikke en RNG,
          // så StrictMode-dobbeltinvokering af setState-updateren ikke giver divergerende id'er.
          createEmptyRow: (seed) => ({
            ...emptyAslAfgoerelseRowFields,
            id: createEmptyRowId(ASL_AFGOERELSE_ROW_ID_PREFIX, seed),
          }),
        });
      },
      []
    );

    const { internalTableData, setInternalTableData, lastPersistedFingerprintRef, getStrippedFingerprint, queuePersist, getUndoFieldPathAliases } =
      useGridRowPersistenceCore<AslAfgoerelseRow>({
        tableData: tableData.length > 0 ? tableData : defaultTableData,
        onTableDataChange,
        normalizeRows,
        isRowEmpty: isAslAfgoerelseRowPersistenceEmpty,
        getRowId: (row) => row.id,
        withRowId: (row, id) => ({ ...row, id }),
        fingerprint: fingerprintTableData,
      });

    // `invalidDrafts`-reconcile mod renderede rækker: en slettet rækkes rå draft må ikke blokere Gem
    // som spøgelses-mål (denne grid-tabel bruger domæne-validering frem for celle-fejl-trackeren, så
    // den har ikke en pruneToValidRowIds-effect at læne sig op ad).
    const liveRowIds = React.useMemo(() => new Set(internalTableData.map((row) => row.id)), [internalTableData]);
    useReconcileInvalidDraftsToLiveRows(liveRowIds);

    // Bevidst tabel-lokal commit-model: denne domæne-tabel har faste rækker/celler og ingen
    // row-draft-isolation, så hvert Table*Input ejer sin draft og committer en partiel række her.
    // Loose-substrat (MUI Table) uden grid-fokus-plan; kernen håndterer strip/reconcile/flush.
    const commitRowUpdate = React.useCallback(
      (rowId: string, updates: Partial<AslAfgoerelseRow>) => {
        // updates er altid en enkelt-felt-patch (én celle pr. commit). Felt → colIndex
        // giver undo-framet den redigerede celles identitet (rowId:colIndex).
        const editedField = Object.keys(updates)[0] as keyof AslAfgoerelseRow | undefined;
        const colIndex = editedField ? FIELD_COL_INDEX[editedField] : undefined;
        const fieldPath = colIndex !== undefined ? `${rowId}:${colIndex}` : undefined;
        setInternalTableData((prev) => {
          const updated = prev.map((row) => (row.id === rowId ? { ...row, ...updates } : row));
          const normalized = normalizeRows(updated);
          if (getStrippedFingerprint(normalized) !== lastPersistedFingerprintRef.current) {
            queuePersist(normalized, fieldPath);
          }
          return normalized;
        });
      },
      [getStrippedFingerprint, lastPersistedFingerprintRef, normalizeRows, queuePersist, setInternalTableData]
    );

    // Slet hele rækken i én undo-handling: filtrér rækken ud, re-normalisér og persistér én gang.
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

    const validationMessageByCell = React.useMemo(() => {
      const issues = collectEetAslAfgoerelseValidationIssues(internalTableData, skadedato, skadelidteFodselsdato);
      const map = new Map<string, string>();
      for (const issue of issues) {
        const key = `${issue.rowId}|${issue.field}`;
        if (!map.has(key)) map.set(key, issue.message);
      }
      return map;
    }, [internalTableData, skadelidteFodselsdato, skadedato]);

    const sortColumns = React.useMemo(() => [
      { colId: 'afgoerelsesDato', getSortValue: (row: AslAfgoerelseRow) => row.afgoerelsesDato },
      { colId: 'virkningsDato', getSortValue: (row: AslAfgoerelseRow) => row.virkningsDato },
      { colId: 'eetPct', getSortValue: (row: AslAfgoerelseRow) => row.eetPct },
      { colId: 'afgoerelseType', getSortValue: (row: AslAfgoerelseRow) => row.afgoerelseType },
      { colId: 'kapDato', getSortValue: (row: AslAfgoerelseRow) => row.kapDato },
      { colId: 'kapPct', getSortValue: (row: AslAfgoerelseRow) => row.kapPct },
      { colId: 'tidlKapDato', getSortValue: (row: AslAfgoerelseRow) => row.tidlKapDato },
      { colId: 'fsTilbageholdtEet', getSortValue: (row: AslAfgoerelseRow) => row.fsTilbageholdtEet },
    ], []);

    const { sortedRows, getSortRole, getSortDirection, handleHeaderClick } = useTableSort({
      rows: internalTableData,
      getRowId: (row) => row.id,
      isRowEmpty: isAslAfgoerelseRowPersistenceEmpty,
      columns: sortColumns,
      onSortedRowsChange: (nextRows) => {
        if (getStrippedFingerprint(nextRows) !== lastPersistedFingerprintRef.current) {
          queuePersist(nextRows);
        }
        setInternalTableData(nextRows);
      },
    });
    const visibleRowIds = React.useMemo(() => sortedRows.map((row) => row.id), [sortedRows]);
    useRegisterTableSaveOrder(saveOrderPath, visibleRowIds);

    return (
      <StandardLooseTable
        sx={{
          width: '1130px',
          tableLayout: 'fixed',
          '& .MuiTableCell-root': {
            textAlign: 'center',
            whiteSpace: 'nowrap',
          },
          '& thead th': {
            textAlign: 'center',
          },
        }}
      >
        <colgroup>
          <col style={{ width: '150px' }} />
          <col style={{ width: '150px' }} />
          <col style={{ width: '105px' }} />
          <col style={{ width: '180px' }} />
          <col style={{ width: '150px' }} />
          <col style={{ width: '105px' }} />
          <col style={{ width: '150px' }} />
          <col style={{ width: '140px' }} />
        </colgroup>
        <TableHead>
          <TableRow>
            <StandardLooseHeaderCell onClick={() => handleHeaderClick('afgoerelsesDato')} sortRole={getSortRole('afgoerelsesDato')} sortDirection={getSortDirection('afgoerelsesDato')}>Afgørelsesdato</StandardLooseHeaderCell>
            <StandardLooseHeaderCell onClick={() => handleHeaderClick('virkningsDato')} sortRole={getSortRole('virkningsDato')} sortDirection={getSortDirection('virkningsDato')}>Virkningsdato</StandardLooseHeaderCell>
            <StandardLooseHeaderCell onClick={() => handleHeaderClick('eetPct')} sortRole={getSortRole('eetPct')} sortDirection={getSortDirection('eetPct')}>EET %</StandardLooseHeaderCell>
            <StandardLooseHeaderCell onClick={() => handleHeaderClick('afgoerelseType')} sortRole={getSortRole('afgoerelseType')} sortDirection={getSortDirection('afgoerelseType')}>Afgørelsestype</StandardLooseHeaderCell>
            <StandardLooseHeaderCell onClick={() => handleHeaderClick('kapDato')} sortRole={getSortRole('kapDato')} sortDirection={getSortDirection('kapDato')}>Kap.dato</StandardLooseHeaderCell>
            <StandardLooseHeaderCell onClick={() => handleHeaderClick('kapPct')} sortRole={getSortRole('kapPct')} sortDirection={getSortDirection('kapPct')}>Kap. %</StandardLooseHeaderCell>
            <StandardLooseHeaderCell onClick={() => handleHeaderClick('tidlKapDato')} sortRole={getSortRole('tidlKapDato')} sortDirection={getSortDirection('tidlKapDato')}>
              Hvis genopt. -
              <br />
              tidl. kap.dato
            </StandardLooseHeaderCell>
            <StandardLooseHeaderCell onClick={() => handleHeaderClick('fsTilbageholdtEet')} sortRole={getSortRole('fsTilbageholdtEet')} sortDirection={getSortDirection('fsTilbageholdtEet')}>
              FS tilbage-
              <br />
              holdt EET
            </StandardLooseHeaderCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {sortedRows.map((row) => {
            const duplicateAfgoerelsesDatoError = validationMessageByCell.get(`${row.id}|afgoerelsesDato`);
            const duplicateVirkningsDatoError = validationMessageByCell.get(`${row.id}|virkningsDato`);
            const eetPctError = validationMessageByCell.get(`${row.id}|eetPct`);
            const duplicateAfgoerelseTypeError = validationMessageByCell.get(`${row.id}|afgoerelseType`);
            const kapDatoError = validationMessageByCell.get(`${row.id}|kapDato`);
            const kapPctError = validationMessageByCell.get(`${row.id}|kapPct`);
            const tidlKapDatoError = validationMessageByCell.get(`${row.id}|tidlKapDato`);
            return (
              <TableRow key={row.id} data-mineo-row-id={row.id}>
                <TableCell>
                  <TableDateInput
                    gridCell={{ rowId: row.id, colIndex: 0 }}
                    undoFieldPathAliases={getUndoFieldPathAliases(row.id, 0)}
                    value={row.afgoerelsesDato}
                    onBlur={(e) => commitRowUpdate(row.id, { afgoerelsesDato: e.target.value })}
                    minDate={skadedatoMin}
                    maxDate={tabelAfgoerelsesdatoMax}
                    specialRangeErrors={afgoerelsesDatoSpecialErrors}
                    externalErrorMessage={duplicateAfgoerelsesDatoError}
                  />
                </TableCell>
                <TableCell>
                  <TableDateInput
                    gridCell={{ rowId: row.id, colIndex: 1 }}
                    undoFieldPathAliases={getUndoFieldPathAliases(row.id, 1)}
                    value={row.virkningsDato}
                    onBlur={(e) => commitRowUpdate(row.id, { virkningsDato: e.target.value })}
                    minDate={skadedatoMin}
                    maxDate={tabelVirkningsdatoMax}
                    specialRangeErrors={VIRKNINGSDATO_SPECIAL_RANGE_ERRORS}
                    externalErrorMessage={duplicateVirkningsDatoError}
                  />
                </TableCell>
                <TableCell>
                  <TablePercentInput
                    gridCell={{ rowId: row.id, colIndex: 2 }}
                    undoFieldPathAliases={getUndoFieldPathAliases(row.id, 2)}
                    value={row.eetPct}
                    allowDecimals={false}
                    minValue={0}
                    maxValue={100}
                    useDefaultPercentRange={false}
                    onBlur={(e) => commitRowUpdate(row.id, { eetPct: e.target.value })}
                    externalErrorMessage={eetPctError}
                  />
                </TableCell>
                <TableCell>
                  <TableDropdown
                    gridCell={{ rowId: row.id, colIndex: 3 }}
                    undoFieldPathAliases={getUndoFieldPathAliases(row.id, 3)}
                    value={row.afgoerelseType}
                    allowEmpty={true}
                    onChange={(e) =>
                      commitRowUpdate(
                        row.id,
                        { afgoerelseType: (e.target.value as AfgoerelseType) || undefined }
                      )
                    }
                    placeholder="Vælg..."
                    options={AFGOERELSES_TYPE_OPTIONS}
                    externalErrorMessage={duplicateAfgoerelseTypeError}
                  />
                </TableCell>
                <TableCell>
                  {(() => {
                    const afgoerelsesDatoIso = row.afgoerelsesDato;
                    const kapDatoMin = afgoerelsesDatoIso ?? skadedatoMin;
                    const kapDatoMax = tabelKapitaliseringsdatoMax;
                    const hasValidRange = !(kapDatoMax !== undefined && kapDatoMin > kapDatoMax);
                    const kapDatoSpecialErrors: DateRangeSpecialErrors = afgoerelsesDatoIso
                      ? { minBoundKind: 'kapDatoFoerAfgoerelsesdato', minBoundReferenceISO: afgoerelsesDatoIso, maxBoundKind: 'eetDataMax', maxBoundFieldLabel: 'Kapitaliseringsdato' }
                      : KAPDATO_NO_AFGOERELSESDATO_SPECIAL_RANGE_ERRORS;
                    return (
                      <TableDateInput
                        gridCell={{ rowId: row.id, colIndex: 4 }}
                        undoFieldPathAliases={getUndoFieldPathAliases(row.id, 4)}
                        value={row.kapDato}
                        onBlur={(e) => commitRowUpdate(row.id, { kapDato: e.target.value })}
                        minDate={hasValidRange ? kapDatoMin : undefined}
                        maxDate={hasValidRange ? kapDatoMax : undefined}
                        specialRangeErrors={kapDatoSpecialErrors}
                        externalErrorMessage={kapDatoError}
                      />
                    );
                  })()}
                </TableCell>
                <TableCell>
                  <TablePercentInput
                    gridCell={{ rowId: row.id, colIndex: 5 }}
                    undoFieldPathAliases={getUndoFieldPathAliases(row.id, 5)}
                    value={row.kapPct}
                    allowDecimals={false}
                    minValue={0}
                    maxValue={100}
                    useDefaultPercentRange={false}
                    onBlur={(e) => commitRowUpdate(row.id, { kapPct: e.target.value })}
                    externalErrorMessage={kapPctError}
                  />
                </TableCell>
                <TableCell>
                  {(() => {
                    const afgoerelsesDatoIso = row.afgoerelsesDato;
                    const tidlKapMax = getDayBeforeIso(afgoerelsesDatoIso);
                    const hasValidRange = !(tidlKapMax !== undefined && skadedatoMin > tidlKapMax);
                    const tidlKapSpecialErrors: DateRangeSpecialErrors = {
                      minBoundKind: 'skadedato',
                      maxBoundKind: 'foerAfgoerelsesdato',
                      maxBoundReferenceISO: afgoerelsesDatoIso,
                    };
                    return (
                      <TableDateInput
                        gridCell={{ rowId: row.id, colIndex: 6 }}
                        undoFieldPathAliases={getUndoFieldPathAliases(row.id, 6)}
                        value={row.tidlKapDato}
                        onBlur={(e) => commitRowUpdate(row.id, { tidlKapDato: e.target.value })}
                        minDate={hasValidRange ? skadedatoMin : undefined}
                        maxDate={hasValidRange ? tidlKapMax : undefined}
                        specialRangeErrors={tidlKapSpecialErrors}
                        externalErrorMessage={tidlKapDatoError}
                      />
                    );
                  })()}
                </TableCell>
                <TableCell sx={{ position: 'relative', paddingRight: '28px' }}>
                  <TableDropdown
                    gridCell={{ rowId: row.id, colIndex: 7 }}
                    undoFieldPathAliases={getUndoFieldPathAliases(row.id, 7)}
                    value={row.fsTilbageholdtEet ?? 'Nej'}
                    allowEmpty={false}
                    onChange={(e) =>
                      commitRowUpdate(row.id, { fsTilbageholdtEet: e.target.value as JaNej })
                    }
                    options={JA_NEJ_OPTIONS}
                  />
                  {!isAslAfgoerelseRowPersistenceEmpty(row) && (
                    <RowDeleteButton onDelete={() => handleDeleteRow(row.id)} />
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </StandardLooseTable>
    );
  }
);

EetAslAfgoerelserTable.displayName = 'EetAslAfgoerelserTable';

export default EetAslAfgoerelserTable;
