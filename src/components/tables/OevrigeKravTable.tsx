import * as React from 'react';
import { TableBody, TableCell, TableHead, TableRow } from '@mui/material';
import TableAmountInput from '../inputs/table/TableAmountInput';
import TableDateIsoInput from '../inputs/table/TableDateIsoInput';
import TableTextInput from '../inputs/table/TableTextInput';
import StandardLooseTable, { StandardLooseHeaderCell } from './StandardLooseTable';
import type { OevrigeKravRow } from '../../schemas/formSchemas';
import type { OevrigeKravDraftRow } from '../../domain/erstatningsopgoerelse/tableDraftRows';
import type { ISODateString } from '../../types/branded';
import { coerceToISODateString } from '../../types/branded';
import type { DateRangeSpecialErrors } from '../../utils/dateRangeErrorMessages';
import { amountValueToDraftString, amountValueToNumber } from '../../utils/expressionAmount';
import { useTableSort } from './useTableSort';

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

const getRowId = (row: OevrigeKravDraftRow) => row.id;
const isRowEmpty = (row: OevrigeKravDraftRow) => row.dato.trim() === '' && row.udgiftTil.trim() === '' && row.beloeb.trim() === '';

const OevrigeKravTable = React.memo(
  ({ rows, committedById, onFieldChange, onRowBlur, minDate, maxDate, specialRangeErrors, noValidRangeCause }: OevrigeKravTableProps) => {
  const minIso = React.useMemo(() => coerceToISODateString(minDate), [minDate]);
  const maxIso = React.useMemo(() => coerceToISODateString(maxDate), [maxDate]);

  const sortColumns = React.useMemo(() => [
    { colId: 'dato', getSortValue: (row: OevrigeKravDraftRow) => committedById.get(row.id)?.dato },
    { colId: 'udgiftTil', getSortValue: (row: OevrigeKravDraftRow) => committedById.get(row.id)?.udgiftTil },
    { colId: 'beloeb', getSortValue: (row: OevrigeKravDraftRow) => amountValueToNumber(committedById.get(row.id)?.beloeb) },
  ], [committedById]);

  const { sortedRows, getSortRole, getSortDirection, handleHeaderClick } = useTableSort({
    rows,
    getRowId,
    isRowEmpty,
    columns: sortColumns,
  });

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
          <StandardLooseHeaderCell sx={{ width: 180 }} onClick={() => handleHeaderClick('dato')} sortRole={getSortRole('dato')} sortDirection={getSortDirection('dato')}>Dato</StandardLooseHeaderCell>
          <StandardLooseHeaderCell sx={{ width: 500 }} onClick={() => handleHeaderClick('udgiftTil')} sortRole={getSortRole('udgiftTil')} sortDirection={getSortDirection('udgiftTil')}>Udgift til</StandardLooseHeaderCell>
          <StandardLooseHeaderCell sx={{ width: 160 }} onClick={() => handleHeaderClick('beloeb')} sortRole={getSortRole('beloeb')} sortDirection={getSortDirection('beloeb')}>Beløb</StandardLooseHeaderCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {sortedRows.map((row) => {
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
