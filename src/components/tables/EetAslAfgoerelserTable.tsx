import * as React from 'react';
import { TableBody, TableCell, TableHead, TableRow } from '@mui/material';
import TableDateInput from '../inputs/table/TableDateInput';
import TablePercentInput from '../inputs/table/TablePercentInput';
import TableDropdown, { type TableDropdownOption } from '../inputs/table/TableDropdown';
import StandardLooseTable, { StandardLooseHeaderCell } from './StandardLooseTable';
import { dateRanges_erhvervsevnetab } from '../../config/dateRanges';
import type { DateRangeSpecialErrors } from '../../utils/dateRangeErrorMessages';
import type { AslAfgoerelseRow, AfgoerelseType, JaNej } from '../../schemas/formSchemas';
import type { ISODateString } from '../../types/branded';
import { coerceToISODateString } from '../../types/branded';
import { getDayBeforeIso } from '../../utils/isoDateHelpers';
import {
  EET_ASL_MIN_VISIBLE_ROWS,
  collectEetAslAfgoerelseValidationIssues,
  createEmptyAslAfgoerelseRow,
  isAslAfgoerelseRowPersistenceEmpty,
} from '../../domain/erhvervsevnetab/eetAslAfgoerelser';
import { normalizeGridRows } from './gridCore/gridModel';
import { useTableSort } from './useTableSort';
import { useRegisterTableSaveOrder } from './useRegisterTableSaveOrder';

export type EetAslAfgoerelserTableProps = Readonly<{
  tableData: AslAfgoerelseRow[];
  skadedato: ISODateString | undefined;
  skadedatoMin: ISODateString;
  beregningsdato: ISODateString | undefined;
  skadelidteFodselsdato: ISODateString | undefined;
  onTableDataChange?: (rows: AslAfgoerelseRow[]) => void;
  saveOrderPath?: string;
}>;

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
          isRowEmpty: isAslAfgoerelseRowPersistenceEmpty,
          createEmptyRow: createEmptyAslAfgoerelseRow,
        });
      },
      []
    );

    const lastPersistedFingerprintRef = React.useRef<string | null>(null);
    const pendingPersistRef = React.useRef<{
      rows: AslAfgoerelseRow[];
      fingerprint: string;
    } | null>(null);
    const initialTableData = React.useMemo(
      () => (tableData.length > 0 ? normalizeRows(tableData) : normalizeRows(defaultTableData)),
      [defaultTableData, normalizeRows, tableData]
    );
    const [internalTableData, setInternalTableData] = React.useState<AslAfgoerelseRow[]>(initialTableData);

    React.useEffect(() => {
      const fingerprint = fingerprintTableData(initialTableData);
      if (lastPersistedFingerprintRef.current === fingerprint) return;
      pendingPersistRef.current = null;
      lastPersistedFingerprintRef.current = fingerprint;
      setInternalTableData(initialTableData);
    }, [initialTableData]);

    const persistTableData = React.useCallback(
      (rows: AslAfgoerelseRow[]) => {
        if (!onTableDataChange) return;
        lastPersistedFingerprintRef.current = fingerprintTableData(rows);
        onTableDataChange(rows);
      },
      [onTableDataChange]
    );

    const queuePersist = React.useCallback((rows: AslAfgoerelseRow[], fingerprint: string) => {
      pendingPersistRef.current = { rows, fingerprint };
    }, []);

    React.useEffect(() => {
      if (!pendingPersistRef.current) return;
      const pendingPersist = pendingPersistRef.current;
      const currentFingerprint = fingerprintTableData(
        internalTableData.filter((row) => !isAslAfgoerelseRowPersistenceEmpty(row))
      );
      if (pendingPersist.fingerprint !== currentFingerprint) {
        pendingPersistRef.current = null;
        return;
      }
      persistTableData(pendingPersist.rows);
      pendingPersistRef.current = null;
    }, [internalTableData, persistTableData]);

    // Intentional table-local commit model: this domain table has fixed rows/cells and no
    // row-draft isolation, so each Table*Input owns its draft and commits a partial row here.
    const commitRowUpdate = React.useCallback(
      (rowId: string, updates: Partial<AslAfgoerelseRow>) => {
        setInternalTableData((prev) => {
          const updated = prev.map((row) => (row.id === rowId ? { ...row, ...updates } : row));
          const normalized = normalizeRows(updated);
          const toSave = normalized.filter((row) => !isAslAfgoerelseRowPersistenceEmpty(row));
          const nextFingerprint = fingerprintTableData(toSave);
          if (nextFingerprint !== lastPersistedFingerprintRef.current) {
            queuePersist(toSave, nextFingerprint);
          }
          return normalized;
        });
      },
      [normalizeRows, queuePersist]
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
      { colId: 'eetPct', getSortValue: (row: AslAfgoerelseRow) => row.eetPct !== undefined ? Number.parseFloat(row.eetPct) : undefined },
      { colId: 'afgoerelseType', getSortValue: (row: AslAfgoerelseRow) => row.afgoerelseType },
      { colId: 'kapDato', getSortValue: (row: AslAfgoerelseRow) => row.kapDato },
      { colId: 'kapPct', getSortValue: (row: AslAfgoerelseRow) => row.kapPct !== undefined ? Number.parseFloat(row.kapPct) : undefined },
      { colId: 'tidlKapDato', getSortValue: (row: AslAfgoerelseRow) => row.tidlKapDato },
      { colId: 'fsTilbageholdtEet', getSortValue: (row: AslAfgoerelseRow) => row.fsTilbageholdtEet },
    ], []);

    const { sortedRows, getSortRole, getSortDirection, handleHeaderClick } = useTableSort({
      rows: internalTableData,
      getRowId: (row) => row.id,
      isRowEmpty: isAslAfgoerelseRowPersistenceEmpty,
      columns: sortColumns,
      onSortedRowsChange: (nextRows) => {
        const toSave = nextRows.filter((row) => !isAslAfgoerelseRowPersistenceEmpty(row));
        const nextFingerprint = fingerprintTableData(toSave);
        if (nextFingerprint !== lastPersistedFingerprintRef.current) {
          queuePersist(toSave, nextFingerprint);
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
                    value={row.afgoerelsesDato}
                    onBlur={(e) => commitRowUpdate(row.id, { afgoerelsesDato: e.target.value || undefined })}
                    minDate={skadedatoMin}
                    maxDate={tabelAfgoerelsesdatoMax}
                    specialRangeErrors={afgoerelsesDatoSpecialErrors}
                    externalErrorMessage={duplicateAfgoerelsesDatoError}
                  />
                </TableCell>
                <TableCell>
                  <TableDateInput
                    gridCell={{ rowId: row.id, colIndex: 1 }}
                    value={row.virkningsDato}
                    onBlur={(e) => commitRowUpdate(row.id, { virkningsDato: e.target.value || undefined })}
                    minDate={skadedatoMin}
                    maxDate={tabelVirkningsdatoMax}
                    specialRangeErrors={VIRKNINGSDATO_SPECIAL_RANGE_ERRORS}
                    externalErrorMessage={duplicateVirkningsDatoError}
                  />
                </TableCell>
                <TableCell>
                  <TablePercentInput
                    gridCell={{ rowId: row.id, colIndex: 2 }}
                    value={row.eetPct}
                    allowDecimals={false}
                    minValue={0}
                    maxValue={100}
                    useDefaultPercentRange={false}
                    onBlur={(e) => commitRowUpdate(row.id, { eetPct: e.target.value || undefined })}
                    externalErrorMessage={eetPctError}
                  />
                </TableCell>
                <TableCell>
                  <TableDropdown
                    gridCell={{ rowId: row.id, colIndex: 3 }}
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
                    const afgoerelsesDatoIso = coerceToISODateString(row.afgoerelsesDato);
                    const kapDatoMin = afgoerelsesDatoIso ?? skadedatoMin;
                    const kapDatoMax = tabelKapitaliseringsdatoMax;
                    const hasValidRange = !(kapDatoMax !== undefined && kapDatoMin > kapDatoMax);
                    const kapDatoSpecialErrors: DateRangeSpecialErrors = afgoerelsesDatoIso
                      ? { minBoundKind: 'kapDatoFoerAfgoerelsesdato', minBoundReferenceISO: afgoerelsesDatoIso, maxBoundKind: 'eetDataMax', maxBoundFieldLabel: 'Kapitaliseringsdato' }
                      : KAPDATO_NO_AFGOERELSESDATO_SPECIAL_RANGE_ERRORS;
                    return (
                      <TableDateInput
                        gridCell={{ rowId: row.id, colIndex: 4 }}
                        value={row.kapDato}
                        onBlur={(e) => commitRowUpdate(row.id, { kapDato: e.target.value || undefined })}
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
                    value={row.kapPct}
                    allowDecimals={false}
                    minValue={0}
                    maxValue={100}
                    useDefaultPercentRange={false}
                    onBlur={(e) => commitRowUpdate(row.id, { kapPct: e.target.value || undefined })}
                    externalErrorMessage={kapPctError}
                  />
                </TableCell>
                <TableCell>
                  {(() => {
                    const afgoerelsesDatoIso = coerceToISODateString(row.afgoerelsesDato);
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
                        value={row.tidlKapDato}
                        onBlur={(e) => commitRowUpdate(row.id, { tidlKapDato: e.target.value || undefined })}
                        minDate={hasValidRange ? skadedatoMin : undefined}
                        maxDate={hasValidRange ? tidlKapMax : undefined}
                        specialRangeErrors={tidlKapSpecialErrors}
                        externalErrorMessage={tidlKapDatoError}
                      />
                    );
                  })()}
                </TableCell>
                <TableCell>
                  <TableDropdown
                    gridCell={{ rowId: row.id, colIndex: 7 }}
                    value={row.fsTilbageholdtEet ?? 'Nej'}
                    allowEmpty={false}
                    onChange={(e) =>
                      commitRowUpdate(row.id, { fsTilbageholdtEet: e.target.value as JaNej })
                    }
                    options={JA_NEJ_OPTIONS}
                  />
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
