import * as React from 'react';
import { TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';

import type { ISODateString } from '../../types/branded';
import type { FerieperiodeRow } from '../../schemas/formSchemas';
import type { FerieDraftRow } from '../../domain/erstatningsopgoerelse/tableDraftRows';
import StyledDateField from '../inputs/StyledDateField';
import StandardLooseTable from './StandardLooseTable';

export type BeregningsperiodeFerieTableProps = Readonly<{
  rows: FerieDraftRow[];
  committedById: ReadonlyMap<string, FerieperiodeRow>;
  feriedageById: Record<string, number | null>;
  onFieldChange: (rowId: string, field: 'fra' | 'til') => (value: string) => void;
  onRowBlur: (rowId: string) => void;
  beregningsperiodeFra: ISODateString | undefined;
  beregningsperiodeTil: ISODateString | undefined;
}>;

const OUTSIDE_BEREGNINGSPERIODE_ERROR_MESSAGE = 'Ferie i beregningsperioden skal også ligge inden for beregningsperioden.';

const BeregningsperiodeFerieTable = React.memo(
  ({
    rows,
    committedById,
    feriedageById,
    onFieldChange,
    onRowBlur,
    beregningsperiodeFra,
    beregningsperiodeTil,
  }: BeregningsperiodeFerieTableProps) => {
    const hasValidBeregningsperiodeBounds =
      beregningsperiodeFra !== undefined &&
      beregningsperiodeTil !== undefined &&
      beregningsperiodeFra <= beregningsperiodeTil;

    const isOutsideBeregningsperiode = React.useCallback(
      (iso: ISODateString | undefined): boolean => {
        if (!hasValidBeregningsperiodeBounds) return false;
        if (!iso) return false;
        return iso < beregningsperiodeFra || iso > beregningsperiodeTil;
      },
      [beregningsperiodeFra, beregningsperiodeTil, hasValidBeregningsperiodeBounds]
    );

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

            const absoluteMinDate = beregningsperiodeFra;
            const absoluteMaxDate = beregningsperiodeTil;

            const fraOutsideBeregningsperiode = isOutsideBeregningsperiode(fraISO);
            const tilOutsideBeregningsperiode = isOutsideBeregningsperiode(tilISO);

            const fraMaxDate: ISODateString | undefined = (() => {
              if (!absoluteMaxDate) return tilISO;
              if (!tilISO) return absoluteMaxDate;
              return tilISO < absoluteMaxDate ? tilISO : absoluteMaxDate;
            })();

            const tilMinDate: ISODateString | undefined = (() => {
              if (!absoluteMinDate) return fraISO;
              if (!fraISO) return absoluteMinDate;
              return fraISO > absoluteMinDate ? fraISO : absoluteMinDate;
            })();

            const tilMaxDate = absoluteMaxDate;

            const fraNoValidRangeCause = (() => {
              const parts: string[] = [];
              if (beregningsperiodeFra) parts.push('Periode til beregning af før-løn: fra');
              if (beregningsperiodeTil) parts.push('Periode til beregning af før-løn: til');
              if (tilISO) parts.push('Til-dato i samme række');
              return parts.length > 0 ? parts.join(', ') : undefined;
            })();

            const tilNoValidRangeCause = (() => {
              const parts: string[] = [];
              if (beregningsperiodeFra) parts.push('Periode til beregning af før-løn: fra');
              if (beregningsperiodeTil) parts.push('Periode til beregning af før-løn: til');
              if (fraISO) parts.push('Fra-dato i samme række');
              return parts.length > 0 ? parts.join(', ') : undefined;
            })();

            return (
              <TableRow key={row.id}>
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
                    specialRangeErrors={{ fraTilRole: 'fra' }}
                    noValidRangeCause={fraNoValidRangeCause}
                    error={fraOutsideBeregningsperiode}
                    helperText={fraOutsideBeregningsperiode ? OUTSIDE_BEREGNINGSPERIODE_ERROR_MESSAGE : ''}
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
                    specialRangeErrors={{ fraTilRole: 'til' }}
                    noValidRangeCause={tilNoValidRangeCause}
                    error={tilOutsideBeregningsperiode}
                    helperText={tilOutsideBeregningsperiode ? OUTSIDE_BEREGNINGSPERIODE_ERROR_MESSAGE : ''}
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

BeregningsperiodeFerieTable.displayName = 'BeregningsperiodeFerieTable';

export default BeregningsperiodeFerieTable;
