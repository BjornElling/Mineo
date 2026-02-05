import * as React from 'react';
import { TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import StyledDateField from '../inputs/StyledDateField';
import StandardLooseTable from './StandardLooseTable';
import { computeSkadesdatoMinRule, dateRanges_erstatningsopgoerelse, TODAY } from '../../config/dateRanges';
import type { FerieperiodeRow } from '../../schemas/formSchemas';
import type { ISODateString } from '../../types/branded';
import { subtractOneDay } from '../../types/branded';
import { computeRowDateBounds } from '../../domain/erstatningsopgoerelse/rowDateBounds';
import type { FerieDraftRow } from '../../domain/erstatningsopgoerelse/tableDraftRows';

export type FerieperiodeTableProps = Readonly<{
  rows: FerieDraftRow[];
  committedById: ReadonlyMap<string, FerieperiodeRow>;
  feriedageById: Record<string, number | null>;
  onFieldChange: (rowId: string, field: 'fra' | 'til') => (value: string) => void;
  onRowBlur: (rowId: string) => void;
  skadesdatoISO: ISODateString | undefined;
  endeligEETBeregnetDato: ISODateString | undefined;
  differencekravDato: ISODateString | undefined;
  erErhvervssygdom: boolean;
  verserendeKlageEet: boolean;
}>;

const FerieperiodeTable = React.memo(
  ({
    rows,
    committedById,
    feriedageById,
    onFieldChange,
    onRowBlur,
    skadesdatoISO,
    endeligEETBeregnetDato,
    differencekravDato,
    erErhvervssygdom,
    verserendeKlageEet,
  }: FerieperiodeTableProps) => {
    return (
      <StandardLooseTable
        sx={{
          width: '520px',
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
            <TableCell sx={{ width: 160 }}>Feriedage</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => {
            const committed = committedById.get(row.id);
            const fraISO = committed?.fra;
            const tilISO = committed?.til;
            const antalFeriedage = feriedageById[row.id] ?? null;

            const endeligEETMinus1 = endeligEETBeregnetDato ? subtractOneDay(endeligEETBeregnetDato) : undefined;
            const differencekravMinus1 = differencekravDato ? subtractOneDay(differencekravDato) : undefined;

            let combinedExtraMaxDate: ISODateString | undefined = undefined;
            if (differencekravMinus1) combinedExtraMaxDate = differencekravMinus1;
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

            return (
              <TableRow key={row.id} data-mineo-row-id={row.id}>
                <TableCell>
                  <StyledDateField
                    value={fraISO}
                    onDraftChange={(e) => onFieldChange(row.id, 'fra')(e.target.value ?? '')}
                    onCommit={(e) => {
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
                  />
                </TableCell>
                <TableCell>
                  <StyledDateField
                    value={tilISO}
                    onDraftChange={(e) => onFieldChange(row.id, 'til')(e.target.value ?? '')}
                    onCommit={(e) => {
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
                  />
                </TableCell>
                <TableCell>
                  <Typography variant="body1" sx={{ textAlign: 'center', py: 0.5 }}>
                    {antalFeriedage !== null ? antalFeriedage : ''}
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

FerieperiodeTable.displayName = 'FerieperiodeTable';

export default FerieperiodeTable;
