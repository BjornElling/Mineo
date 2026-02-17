import * as React from 'react';
import { TableBody, TableCell, TableHead, TableRow } from '@mui/material';
import TableAmountInput from '../inputs/table/TableAmountInput';
import TableDateIsoInput from '../inputs/table/TableDateIsoInput';
import TableTextInput from '../inputs/table/TableTextInput';
import StandardLooseTable from './StandardLooseTable';
import type { OevrigeKravRow } from '../../schemas/formSchemas';
import type { OevrigeKravDraftRow } from '../../domain/erstatningsopgoerelse/tableDraftRows';
import type { ISODateString } from '../../types/branded';
import { coerceToISODateString } from '../../types/branded';
import type { DateRangeSpecialErrors } from '../../utils/dateRangeErrorMessages';
import { amountValueToDraftString } from '../../utils/expressionAmount';

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
            <TableRow key={row.id} data-mineo-row-id={row.id}>
              <TableCell>
                <TableDateIsoInput
                  gridCell={{ rowId: row.id, colIndex: 0 }}
                  value={committedDatoIso}
                  onBlur={(e) => {
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
                <TableTextInput
                  gridCell={{ rowId: row.id, colIndex: 1 }}
                  sx={{ width: 400 }}
                  value={committed?.udgiftTil ?? ''}
                  onBlur={(e) => {
                    onFieldChange(row.id, 'udgiftTil')(e.target.value);
                    onRowBlur(row.id);
                  }}
                />
              </TableCell>
              <TableCell>
                <TableAmountInput
                  gridCell={{ rowId: row.id, colIndex: 2 }}
                  sx={{ width: 130 }}
                  value={committed?.beloeb}
                  onBlur={(e) => {
                    onFieldChange(row.id, 'beloeb')(amountValueToDraftString(e.target.value, 2));
                    onRowBlur(row.id);
                  }}
                  canBeNegative={false}
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
