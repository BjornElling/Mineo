import * as React from 'react';
import { TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import TableDateIsoInput from '../inputs/table/TableDateIsoInput';
import TableIntegerInput from '../inputs/table/TableIntegerInput';
import StandardLooseTable from './StandardLooseTable';
import { computeSkadesdatoMinRule, dateRanges_erstatningsopgoerelse, TODAY } from '../../config/dateRanges';
import type { TafPeriodeRow } from '../../schemas/formSchemas';
import type { ISODateString } from '../../types/branded';
import { isoToDanish, subtractOneDay } from '../../types/branded';
import { computeRowDateBounds } from '../../domain/erstatningsopgoerelse/rowDateBounds';
import type { TafDraftRow } from '../../domain/erstatningsopgoerelse/tableDraftRows';
import { calculateFerieHverdageMinusSHDage } from '../../domain/erstatningsopgoerelse/ferieCalculations';

export type TAFPeriodeTableProps = Readonly<{
  rows: TafDraftRow[];
  committedById: ReadonlyMap<string, TafPeriodeRow>;
  overlappingIds: ReadonlySet<string>;
  onFieldChange: (rowId: string, field: 'fra' | 'til' | 'loseFeriedage') => (value: string) => void;
  onRowBlur: (rowId: string) => void;
  derivedById: Record<string, number | null>;
  derivedColumnHeader: string;
  overlapWithBeregningsperiodeByRowId: Readonly<Record<string, string>>;
  skadesdatoISO: ISODateString | undefined;
  endeligEETBeregnetDato: ISODateString | undefined;
  differencekravDato: ISODateString | undefined;
  erErhvervssygdom: boolean;
  verserendeKlageEet: boolean;
}>;

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
    skadesdatoISO,
    endeligEETBeregnetDato,
    differencekravDato,
    erErhvervssygdom,
    verserendeKlageEet,
  }: TAFPeriodeTableProps) => {
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
            <TableCell sx={{ width: 180 }}>Fra o.m.</TableCell>
            <TableCell sx={{ width: 180 }}>Til o.m.</TableCell>
            <TableCell sx={{ width: 180 }}>Løse feriedage</TableCell>
            <TableCell sx={{ width: 180 }}>{derivedColumnHeader}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => {
            const committed = committedById.get(row.id);
            const beregnetVaerdi = derivedById[row.id] ?? null;

            const fraISO = committed?.fra;
            const tilISO = committed?.til;
            const maxValueRaw = calculateFerieHverdageMinusSHDage(fraISO, tilISO);
            const maxValue =
              typeof maxValueRaw === 'number' && Number.isFinite(maxValueRaw) ? Math.max(0, Math.trunc(maxValueRaw)) : undefined;
            const maxDigitsForLoseFeriedage = maxValue !== undefined ? Math.max(3, String(Math.trunc(maxValue)).length) : 3;

            // Beregn den laveste af ekstra max-datoer for til-dato:
            // - endeligEETBeregnetDato-1 (hvis ikke verserende klage)
            // - differencekravDato-1 (altid anvendt)
            const endeligEETMinus1 = endeligEETBeregnetDato ? subtractOneDay(endeligEETBeregnetDato) : undefined;
            const differencekravMinus1 = differencekravDato ? subtractOneDay(differencekravDato) : undefined;

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

            const skadesdatoMinRule = computeSkadesdatoMinRule({
              skadesdatoISO,
              erErhvervssygdom,
              fallbackMin: dateRanges_erstatningsopgoerelse.tabelTAFFra.fallbackMin,
            });

            const bounds = computeRowDateBounds({
              skadesdatoMinDate: skadesdatoMinRule.minDate,
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
              if (skadesdatoMinRule.minBoundKind) parts.push('skadesdato');
              if (tilISO) parts.push('til-dato i samme række');
              return parts.length > 0 ? parts.join(', ') : undefined;
            })();

            const tilNoValidRangeCause = (() => {
              const parts: string[] = [];
              if (!fraISO && skadesdatoMinRule.minBoundKind) parts.push('skadesdato');
              if (fraISO) parts.push('fra-dato i samme række');
              parts.push('dags dato');
              if (differencekravDato) parts.push('differencekrav-dato');
              if (!verserendeKlageEet && endeligEETBeregnetDato) parts.push('beregnet dato for endeligt EET');
              return parts.join(', ');
            })();

            // Tjek om denne række har overlappende periode
            const internalOverlapError = overlappingIds.has(row.id) ? 'Der er overlappende perioder' : undefined;
            const beregningsperiodeOverlapError = overlapWithBeregningsperiodeByRowId[row.id];

            const overlapError =
              beregningsperiodeOverlapError && internalOverlapError
                ? `${beregningsperiodeOverlapError}; ${internalOverlapError}`
                : beregningsperiodeOverlapError ?? internalOverlapError;

            const eetCutoff = !verserendeKlageEet ? endeligEETBeregnetDato : undefined;
            const buildCutoffErrors = (value: ISODateString | undefined): string | undefined => {
              const parts: string[] = [];
              if (differencekravDato && value && value >= differencekravDato) {
                const dateText = isoToDanish(differencekravDato) ?? differencekravDato;
                parts.push(`Der er angivet tabt arbejdsfortjeneste, efter differencekrav er opgjort (${dateText})`);
              }
              if (eetCutoff && value && value >= eetCutoff) {
                const dateText = isoToDanish(eetCutoff) ?? eetCutoff;
                parts.push(`Der er angivet tabt arbejdsfortjeneste efter afgørelse om endeligt erhvervsevnetab (${dateText})`);
              }
              return parts.length > 0 ? parts.join('; ') : undefined;
            };

            const fraCutoffError = buildCutoffErrors(fraISO);
            const tilCutoffError = buildCutoffErrors(tilISO);

            const fraErrorMessage =
              fraCutoffError && overlapError ? `${fraCutoffError}; ${overlapError}` : fraCutoffError ?? overlapError;
            const tilErrorMessage =
              tilCutoffError && overlapError ? `${tilCutoffError}; ${overlapError}` : tilCutoffError ?? overlapError;

            return (
              <TableRow key={row.id} data-mineo-row-id={row.id}>
                <TableCell>
                  <TableDateIsoInput
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
                      minBoundKind: skadesdatoMinRule.minBoundKind,
                      minBoundReferenceISO: skadesdatoMinRule.minBoundReferenceISO,
                    }}
                    noValidRangeCause={fraNoValidRangeCause}
                    externalErrorMessage={fraErrorMessage}
                  />
                </TableCell>
                <TableCell>
                  <TableDateIsoInput
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
                        skadesdatoMinRule.minBoundKind && tilMinDate === absoluteMinDate ? skadesdatoMinRule.minBoundKind : undefined,
                      minBoundReferenceISO: skadesdatoMinRule.minBoundReferenceISO,
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
                    {beregnetVaerdi !== null
                      ? derivedColumnHeader === 'TAF-måneder'
                        ? String(beregnetVaerdi).replace('.', ',')
                        : String(beregnetVaerdi)
                      : ''}
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
