import * as React from 'react';
import { TableBody, TableCell, TableHead, TableRow } from '@mui/material';
import TableDateInput from '../inputs/table/TableDateInput';
import TablePercentInput from '../inputs/table/TablePercentInput';
import TableDropdown, { type TableDropdownOption } from '../inputs/table/TableDropdown';
import StandardLooseTable from './StandardLooseTable';
import { dateRanges_erhvervsevnetab } from '../../config/dateRanges';
import type { DateRangeSpecialErrors } from '../../utils/dateRangeErrorMessages';
import type { AslAfgoerelseRow, AfgoerelseType } from '../../schemas/formSchemas';
import type { ISODateString } from '../../types/branded';
import { coerceToISODateString, subtractOneDay } from '../../types/branded';
import {
  EET_ASL_MIN_VISIBLE_ROWS,
  collectEetAslAfgoerelseValidationIssues,
  createEmptyAslAfgoerelseRow,
  isAslAfgoerelseRowEmpty,
} from '../../domain/erhvervsevnetab/eetAslAfgoerelser';
import { normalizeGridRows } from './gridModel';

export type EetAslAfgoerelserTableProps = Readonly<{
  tableData: AslAfgoerelseRow[];
  skadesdato: ISODateString | undefined;
  skadesdatoMin: ISODateString;
  beregningsdato: ISODateString | undefined;
  fodselsdato: ISODateString | undefined;
  onTableDataChange?: (rows: AslAfgoerelseRow[]) => void;
}>;

const AFGOERELSES_TYPE_OPTIONS: readonly TableDropdownOption[] = [
  { value: 'Midlertidig', label: 'Midlertidig' },
  { value: 'Delvist endelig', label: 'Delvist endelig' },
  { value: 'Endelig', label: 'Endelig' },
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
] as const satisfies ReadonlyArray<keyof AslAfgoerelseRow>;

const fingerprintTableData = (rows: readonly AslAfgoerelseRow[]): string => {
  return JSON.stringify(rows.map((row) => TABLE_FINGERPRINT_KEYS.map((key) => row[key] ?? null)));
};

const EetAslAfgoerelserTable = React.memo(
  ({ tableData, skadesdato, skadesdatoMin, beregningsdato, fodselsdato, onTableDataChange }: EetAslAfgoerelserTableProps) => {
    const tabelAfgoerelsesdatoMax = dateRanges_erhvervsevnetab.tabelAfgoerelsesdato.max;
    const tabelVirkningsdatoMax = dateRanges_erhvervsevnetab.tabelVirkningsdato.max;
    const tabelKapitaliseringsdatoMax = dateRanges_erhvervsevnetab.tabelKapitaliseringsdato.max;

    const afgoerelsesDatoSpecialErrors = React.useMemo<DateRangeSpecialErrors>(
      () => ({ minBoundKind: 'skadesdato', minBoundReferenceISO: skadesdato, maxBoundKind: 'eetDataMax', maxBoundFieldLabel: 'Afgørelsesdato' }),
      [skadesdato]
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
          isRowEmpty: isAslAfgoerelseRowEmpty,
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
    const [internalTableData, setInternalTableData] = React.useState<AslAfgoerelseRow[]>(() => {
      const initial = tableData.length > 0 ? normalizeRows(tableData) : normalizeRows(defaultTableData);
      lastPersistedFingerprintRef.current = fingerprintTableData(initial);
      return initial;
    });

    React.useEffect(() => {
      if (tableData.length > 0) {
        const normalizedData = normalizeRows(tableData);
        const fingerprint = fingerprintTableData(normalizedData);
        if (lastPersistedFingerprintRef.current === fingerprint) return;
        pendingPersistRef.current = null;
        lastPersistedFingerprintRef.current = fingerprint;
        setInternalTableData(normalizedData);
        return;
      }

      const normalizedDefault = normalizeRows(defaultTableData);
      pendingPersistRef.current = null;
      lastPersistedFingerprintRef.current = fingerprintTableData(normalizedDefault);
      setInternalTableData(normalizedDefault);
    }, [defaultTableData, normalizeRows, tableData]);

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
        internalTableData.filter((row) => !isAslAfgoerelseRowEmpty(row))
      );
      if (pendingPersist.fingerprint !== currentFingerprint) {
        pendingPersistRef.current = null;
        return;
      }
      persistTableData(pendingPersist.rows);
      pendingPersistRef.current = null;
    }, [internalTableData, persistTableData]);

    const commitRowUpdate = React.useCallback(
      (rowId: string, updates: Partial<AslAfgoerelseRow>) => {
        setInternalTableData((prev) => {
          const updated = prev.map((row) => (row.id === rowId ? { ...row, ...updates } : row));
          const normalized = normalizeRows(updated);
          const toSave = normalized.filter((row) => !isAslAfgoerelseRowEmpty(row));
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
      const issues = collectEetAslAfgoerelseValidationIssues(internalTableData, skadesdato, fodselsdato);
      const map = new Map<string, string>();
      for (const issue of issues) {
        const key = `${issue.rowId}|${issue.field}`;
        if (!map.has(key)) map.set(key, issue.message);
      }
      return map;
    }, [fodselsdato, internalTableData, skadesdato]);

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
          <col style={{ width: '160px' }} />
          <col style={{ width: '160px' }} />
          <col style={{ width: '100px' }} />
          <col style={{ width: '220px' }} />
          <col style={{ width: '160px' }} />
          <col style={{ width: '100px' }} />
          <col style={{ width: '160px' }} />
        </colgroup>
        <TableHead>
          <TableRow>
            <TableCell>Afgørelsesdato</TableCell>
            <TableCell>Virkningsdato</TableCell>
            <TableCell>EET %</TableCell>
            <TableCell>Afgørelsestype</TableCell>
            <TableCell>Kap.dato</TableCell>
            <TableCell>Kap. %</TableCell>
            <TableCell>
              Hvis genoptaget,
              <br />
              tidl. kap.dato
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {internalTableData.map((row) => {
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
                    minDate={skadesdatoMin}
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
                    minDate={skadesdatoMin}
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
                    placeholder=""
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
                    const kapDatoMin = afgoerelsesDatoIso ?? skadesdatoMin;
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
                    placeholder=""
                    onBlur={(e) => commitRowUpdate(row.id, { kapPct: e.target.value || undefined })}
                    externalErrorMessage={kapPctError}
                  />
                </TableCell>
                <TableCell>
                  {(() => {
                    const afgoerelsesDatoIso = coerceToISODateString(row.afgoerelsesDato);
                    const tidlKapMax = subtractOneDay(afgoerelsesDatoIso);
                    const hasValidRange = !(tidlKapMax !== undefined && skadesdatoMin > tidlKapMax);
                    const tidlKapSpecialErrors: DateRangeSpecialErrors = {
                      minBoundKind: 'skadesdato',
                      maxBoundKind: 'foerAfgoerelsesdato',
                      maxBoundReferenceISO: afgoerelsesDatoIso,
                    };
                    return (
                      <TableDateInput
                        gridCell={{ rowId: row.id, colIndex: 6 }}
                        value={row.tidlKapDato}
                        onBlur={(e) => commitRowUpdate(row.id, { tidlKapDato: e.target.value || undefined })}
                        minDate={hasValidRange ? skadesdatoMin : undefined}
                        maxDate={hasValidRange ? tidlKapMax : undefined}
                        specialRangeErrors={tidlKapSpecialErrors}
                        externalErrorMessage={tidlKapDatoError}
                      />
                    );
                  })()}
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
