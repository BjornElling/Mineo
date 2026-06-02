import * as React from 'react';
import { TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import TableDateInput from '../inputs/table/TableDateInput';
import TableIntegerInput from '../inputs/table/TableIntegerInput';
import StandardLooseTable, { StandardLooseHeaderCell } from './StandardLooseTable';
import { useTableSort } from './useTableSort';
import { computeSkadedatoMinRule, dateRanges_erstatningsopgoerelse, TODAY } from '../../config/dateRanges';
import type { TafPeriodeRow } from '../../schemas/formSchemas';
import type { ISODateString } from '../../types/branded';
import { getDayBeforeIso } from '../../utils/isoDateHelpers';
import { formatAsAmountTrimmed } from '../../utils/formatUtils';

import { computeRowDateBounds } from '../../domain/erstatningsopgoerelse/helpers/rowDateBounds';
import { isFraTilDraftRowEmpty as isRowEmpty, type TafDraftRow } from '../../domain/erstatningsopgoerelse/tables/tableDraftRows';
import { calculateFerieHverdageMinusSHDage } from '../../domain/erstatningsopgoerelse/engines/ferieCalculations';
import { buildTafCutoffErrorMessage } from '../../domain/erstatningsopgoerelse/validation/tafPeriodConstraints';
import { useRegisterTableSaveOrder } from './useRegisterTableSaveOrder';
import type { TableSaveOrderPath } from '../../utils/tableSaveOrderRegistry';

export type TAFPeriodeTableProps = Readonly<{
  rows: TafDraftRow[];
  committedById: ReadonlyMap<string, TafPeriodeRow>;
  overlappingIds: ReadonlySet<string>;
  onFieldChange: (rowId: string, field: 'fra' | 'til' | 'loseFeriedage') => (value: string) => void;
  onRowBlur: (rowId: string) => void;
  derivedById: Record<string, number | null>;
  derivedColumnHeader: string;
  overlapWithBeregningsperiodeByRowId: Readonly<Record<string, string>>;
  skadedatoISO: ISODateString | undefined;
  endeligEETBeregnetDato: ISODateString | undefined;
  /** Midlertidig EET-dato som TAF-afgrænsning — kun sat ved skadedato < 2011-06-16. */
  midlertidigEETBeregnetDato: ISODateString | undefined;
  differencekravDato: ISODateString | undefined;
  erErhvervssygdom: boolean;
  verserendeKlageEet: boolean;
  saveOrderPath?: TableSaveOrderPath;
  onRowsReorder?: (orderedIds: readonly string[]) => void;
}>;

const getRowId = (row: TafDraftRow) => row.id;

const TAFPeriodeTable = React.memo(
  ({
    rows,
    committedById,
    overlappingIds,
    onFieldChange,
    onRowBlur,
    derivedById,
    derivedColumnHeader,
    overlapWithBeregningsperiodeByRowId,
    skadedatoISO,
    endeligEETBeregnetDato,
    midlertidigEETBeregnetDato,
    differencekravDato,
    erErhvervssygdom,
    verserendeKlageEet,
    saveOrderPath,
    onRowsReorder,
  }: TAFPeriodeTableProps) => {
    const sortColumns = React.useMemo(() => [
      { colId: 'fra', getSortValue: (row: TafDraftRow) => committedById.get(row.id)?.fra },
      { colId: 'til', getSortValue: (row: TafDraftRow) => committedById.get(row.id)?.til },
      { colId: 'loseFeriedage', getSortValue: (row: TafDraftRow) => committedById.get(row.id)?.loseFeriedage },
      { colId: 'beregnet', getSortValue: (row: TafDraftRow) => derivedById[row.id] ?? undefined },
    ], [committedById, derivedById]);

    const { sortedRows, getSortRole, getSortDirection, handleHeaderClick } = useTableSort({
      rows,
      getRowId,
      isRowEmpty,
      columns: sortColumns,
      onSortedRowsChange: (nextRows) => onRowsReorder?.(nextRows.map((row) => row.id)),
    });
    useRegisterTableSaveOrder(saveOrderPath, React.useMemo(() => sortedRows.map((row) => row.id), [sortedRows]));

    return (
      <StandardLooseTable
        sx={{
          width: '720px',
          tableLayout: 'fixed',
          mb: 3,
          '& .MuiTableCell-root': {
            textAlign: 'center',
            whiteSpace: 'nowrap',
          },
          '& thead th': {
            textAlign: 'center',
          },
        }}
      >
        <TableHead>
          <TableRow>
            <StandardLooseHeaderCell sx={{ width: 180 }} onClick={() => handleHeaderClick('fra')} sortRole={getSortRole('fra')} sortDirection={getSortDirection('fra')}>Fra o.m.</StandardLooseHeaderCell>
            <StandardLooseHeaderCell sx={{ width: 180 }} onClick={() => handleHeaderClick('til')} sortRole={getSortRole('til')} sortDirection={getSortDirection('til')}>Til o.m.</StandardLooseHeaderCell>
            <StandardLooseHeaderCell sx={{ width: 180 }} onClick={() => handleHeaderClick('loseFeriedage')} sortRole={getSortRole('loseFeriedage')} sortDirection={getSortDirection('loseFeriedage')}>Løse feriedage</StandardLooseHeaderCell>
            <StandardLooseHeaderCell sx={{ width: 180 }} onClick={() => handleHeaderClick('beregnet')} sortRole={getSortRole('beregnet')} sortDirection={getSortDirection('beregnet')}>{derivedColumnHeader}</StandardLooseHeaderCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {sortedRows.map((row) => {
            const committed = committedById.get(row.id);
            const beregnetVaerdi = derivedById[row.id] ?? null;

            const fraISO = committed?.fra;
            const tilISO = committed?.til;
            const maxValueRaw = calculateFerieHverdageMinusSHDage(fraISO, tilISO);
            const maxValue =
              typeof maxValueRaw === 'number' && Number.isFinite(maxValueRaw) ? Math.max(0, Math.trunc(maxValueRaw)) : undefined;
            const maxDigitsForLoseFeriedage = maxValue !== undefined ? Math.max(3, String(Math.trunc(maxValue)).length) : 3;

            // Beregn den laveste af ekstra max-datoer for til-dato:
            // - differencekravDato-1 (altid anvendt)
            // - endeligEETBeregnetDato-1 (hvis ikke verserende klage)
            // - midlertidigEETBeregnetDato-1 (hvis ikke verserende klage; kun sat ved skadedato < 2011-06-16)
            const endeligEETMinus1 = endeligEETBeregnetDato ? getDayBeforeIso(endeligEETBeregnetDato) : undefined;
            const midlertidigEETMinus1 = midlertidigEETBeregnetDato ? getDayBeforeIso(midlertidigEETBeregnetDato) : undefined;
            const differencekravMinus1 = differencekravDato ? getDayBeforeIso(differencekravDato) : undefined;

            let combinedExtraMaxDate: ISODateString | undefined = undefined;

            // Differencekrav anvendes altid (uafhængig af verserende klage)
            if (differencekravMinus1) {
              combinedExtraMaxDate = differencekravMinus1;
            }

            // Endelig EET anvendes kun hvis ikke verserende klage
            if (!verserendeKlageEet && endeligEETMinus1) {
              if (!combinedExtraMaxDate || endeligEETMinus1 < combinedExtraMaxDate) {
                combinedExtraMaxDate = endeligEETMinus1;
              }
            }

            // Midlertidig EET anvendes kun hvis ikke verserende klage (dato er allerede undefined ved skadedato >= 2011-06-16)
            if (!verserendeKlageEet && midlertidigEETMinus1) {
              if (!combinedExtraMaxDate || midlertidigEETMinus1 < combinedExtraMaxDate) {
                combinedExtraMaxDate = midlertidigEETMinus1;
              }
            }

            const skadedatoMinRule = computeSkadedatoMinRule({
              skadedatoISO,
              erErhvervssygdom,
              fallbackMin: dateRanges_erstatningsopgoerelse.tabelTAFFra.fallbackMin,
            });

            const bounds = computeRowDateBounds({
              skadedatoMinDate: skadedatoMinRule.minDate,
              rowFra: fraISO,
              rowTil: tilISO,
              fallbackMin: dateRanges_erstatningsopgoerelse.tabelTAFFra.fallbackMin,
              fallbackMax: dateRanges_erstatningsopgoerelse.tabelTAFFra.fallbackMax,
              tilFallbackMax: TODAY,
              tilExtraMaxDate: combinedExtraMaxDate,
              useTilExtraMaxDate: true,
            });
            const absoluteMinDate = bounds.fra.min;
            const fraMaxDate = bounds.fra.max;
            const tilMinDate = bounds.til.min;
            const tilMaxDate = bounds.til.max;

            // Generer konkrete årsager til afgrænsning
            const fraNoValidRangeCause = (() => {
              const parts: string[] = [];
              if (skadedatoMinRule.minBoundKind) parts.push('skadedato');
              if (tilISO) parts.push('til-dato i samme række');
              return parts.length > 0 ? parts.join(', ') : undefined;
            })();

            const tilNoValidRangeCause = (() => {
              const parts: string[] = [];
              if (!fraISO && skadedatoMinRule.minBoundKind) parts.push('skadedato');
              if (fraISO) parts.push('fra-dato i samme række');
              parts.push('dags dato');
              if (differencekravDato) parts.push('differencekrav-dato');
              if (!verserendeKlageEet && endeligEETBeregnetDato) parts.push('beregnet dato for endeligt EET');
              if (!verserendeKlageEet && midlertidigEETBeregnetDato) parts.push('beregnet dato for midlertidigt EET');
              return parts.join(', ');
            })();

            // Tjek om denne række har overlappende periode
            const internalOverlapError = overlappingIds.has(row.id) ? 'Der er overlappende perioder' : undefined;
            const beregningsperiodeOverlapError = overlapWithBeregningsperiodeByRowId[row.id];

            const overlapError =
              beregningsperiodeOverlapError && internalOverlapError
                ? `${beregningsperiodeOverlapError}; ${internalOverlapError}`
                : beregningsperiodeOverlapError ?? internalOverlapError;

            const endeligEetCutoff = !verserendeKlageEet ? endeligEETBeregnetDato : undefined;
            const midlertidigEetCutoff = !verserendeKlageEet ? midlertidigEETBeregnetDato : undefined;
            const fraCutoffError = buildTafCutoffErrorMessage({
              value: fraISO,
              differencekravDato,
              endeligEETDato: endeligEetCutoff,
              midlertidigEETDato: midlertidigEetCutoff,
            });
            const tilCutoffError = buildTafCutoffErrorMessage({
              value: tilISO,
              differencekravDato,
              endeligEETDato: endeligEetCutoff,
              midlertidigEETDato: midlertidigEetCutoff,
            });

            const fraErrorMessage =
              fraCutoffError && overlapError ? `${fraCutoffError}; ${overlapError}` : fraCutoffError ?? overlapError;
            const tilErrorMessage =
              tilCutoffError && overlapError ? `${tilCutoffError}; ${overlapError}` : tilCutoffError ?? overlapError;

            return (
              <TableRow key={row.id} data-mineo-row-id={row.id}>
                <TableCell>
                  <TableDateInput
                    gridCell={{ rowId: row.id, colIndex: 0 }}
                    value={fraISO}
                    onBlur={(e) => {
                      onFieldChange(row.id, 'fra')(e.target.value ?? '');
                      onRowBlur(row.id);
                    }}
                    minDate={absoluteMinDate}
                    maxDate={fraMaxDate}
                    specialRangeErrors={{
                      fraTilRole: 'fra',
                      minBoundKind: skadedatoMinRule.minBoundKind,
                      minBoundReferenceISO: skadedatoMinRule.minBoundReferenceISO,
                    }}
                    noValidRangeCause={fraNoValidRangeCause}
                    externalErrorMessage={fraErrorMessage}
                  />
                </TableCell>
                <TableCell>
                  <TableDateInput
                    gridCell={{ rowId: row.id, colIndex: 1 }}
                    value={tilISO}
                    onBlur={(e) => {
                      onFieldChange(row.id, 'til')(e.target.value ?? '');
                      onRowBlur(row.id);
                    }}
                    minDate={tilMinDate}
                    maxDate={tilMaxDate}
                    specialRangeErrors={{
                      fraTilRole: 'til',
                      minBoundKind:
                        skadedatoMinRule.minBoundKind && tilMinDate === absoluteMinDate ? skadedatoMinRule.minBoundKind : undefined,
                      minBoundReferenceISO: skadedatoMinRule.minBoundReferenceISO,
                    }}
                    noValidRangeCause={tilNoValidRangeCause}
                    externalErrorMessage={tilErrorMessage}
                  />
                </TableCell>
                <TableCell>
                  <TableIntegerInput
                    gridCell={{ rowId: row.id, colIndex: 2 }}
                    sx={{ width: 80 }}
                    maxDigits={maxDigitsForLoseFeriedage}
                    value={committed?.loseFeriedage === undefined ? '' : String(committed.loseFeriedage)}
                    onBlur={(e) => {
                      onFieldChange(row.id, 'loseFeriedage')(e.target.value);
                      onRowBlur(row.id);
                    }}
                    minValue={0}
                    maxValue={maxValue}
                    enforceRange={false}
                  />
                </TableCell>
                <TableCell>
                  <Typography variant="body1">
                    {beregnetVaerdi !== null ? formatAsAmountTrimmed(beregnetVaerdi, 2) : ''}
                  </Typography>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </StandardLooseTable>
    );
  }
);

TAFPeriodeTable.displayName = 'TAFPeriodeTable';

export default TAFPeriodeTable;
