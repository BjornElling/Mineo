import * as React from 'react';
import { TableBody, TableCell, TableHead, TableRow } from '@mui/material';
import StyledAmountField from '../inputs/StyledAmountField';
import StyledDateField from '../inputs/StyledDateField';
import StyledTextField from '../inputs/StyledTextField';
import StandardLooseTable from './StandardLooseTable';
import type { OevrigeKravRow } from '../../schemas/formSchemas';
import type { OevrigeKravDraftRow } from '../../domain/erstatningsopgoerelse/tableDraftRows';
import type { ISODateString } from '../../types/branded';
import { coerceToISODateString } from '../../types/branded';
import type { DateRangeSpecialErrors } from '../../utils/dateRangeErrorMessages';

export type OevrigeKravTableProps = Readonly<{
  rows: OevrigeKravDraftRow[];
  committedById: ReadonlyMap<string, OevrigeKravRow>;
  onFieldChange: (rowId: string, field: 'dato' | 'udgiftTil' | 'beloeb') => (value: string) => void;
  onRowBlur: (rowId: string) => void;
  minDate?: ISODateString | string;
  maxDate?: ISODateString | string;
  specialRangeErrors?: DateRangeSpecialErrors;
  noValidRangeCause?: string;
}>;

const OevrigeKravTable = React.memo(
  ({ rows, committedById, onFieldChange, onRowBlur, minDate, maxDate, specialRangeErrors, noValidRangeCause }: OevrigeKravTableProps) => {
  const minIso = React.useMemo(() => coerceToISODateString(minDate), [minDate]);
  const maxIso = React.useMemo(() => coerceToISODateString(maxDate), [maxDate]);

  return (
    <StandardLooseTable
      sx={{
        width: '640px',
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
          <TableCell sx={{ width: 180 }}>Dato</TableCell>
          <TableCell sx={{ width: 500 }}>Udgift til</TableCell>
          <TableCell sx={{ width: 160 }}>Beløb</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.map((row) => {
          const committed = committedById.get(row.id);
          const committedDatoIso = coerceToISODateString(committed?.dato);

          return (
            <TableRow key={row.id}>
              <TableCell>
                <StyledDateField
                  value={committedDatoIso}
                  onDraftChange={(e) => onFieldChange(row.id, 'dato')(e.target.value ?? '')}
                  onCommit={(e) => {
                    onFieldChange(row.id, 'dato')(e.target.value ?? '');
                    onRowBlur(row.id);
                  }}
                  minDate={minIso}
                  maxDate={maxIso}
                  specialRangeErrors={specialRangeErrors}
                  noValidRangeCause={noValidRangeCause}
                />
              </TableCell>
              <TableCell>
                <StyledTextField
                  width={400}
                  value={committed?.udgiftTil ?? ''}
                  onDraftChange={(e) => onFieldChange(row.id, 'udgiftTil')(e.target.value)}
                  onCommit={(e) => {
                    onFieldChange(row.id, 'udgiftTil')(e.target.value);
                    onRowBlur(row.id);
                  }}
                />
              </TableCell>
              <TableCell>
                <StyledAmountField
                  width={130}
                  value={committed?.beloeb}
                  onDraftChange={(e) => onFieldChange(row.id, 'beloeb')(e.target.value)}
                  onCommit={() => {
                    onRowBlur(row.id);
                  }}
                  allowNegative={false}
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

OevrigeKravTable.displayName = 'OevrigeKravTable';

export default OevrigeKravTable;
