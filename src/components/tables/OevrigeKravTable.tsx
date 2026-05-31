import * as React from 'react';
import { TableBody, TableCell, TableHead, TableRow } from '@mui/material';
import TableAmountInput from '../inputs/table/TableAmountInput';
import TableDateInput from '../inputs/table/TableDateInput';
import TableTextInput from '../inputs/table/TableTextInput';
import StandardLooseTable, { StandardLooseHeaderCell } from './StandardLooseTable';
import type { OevrigeKravRow } from '../../schemas/formSchemas';
import type { OevrigeKravDraftRow } from '../../domain/erstatningsopgoerelse/tables/tableDraftRows';
import type { ISODateString } from '../../types/branded';
import type { DateRangeSpecialErrors } from '../../utils/dateRangeErrorMessages';
import { amountValueToDraftString, amountValueToNumber } from '../../utils/expressionAmount';
import { useTableSort } from './useTableSort';
import { useRegisterTableSaveOrder } from './useRegisterTableSaveOrder';
import type { TableSaveOrderPath } from '../../utils/tableSaveOrderRegistry';

export type OevrigeKravTableProps = Readonly<{
  rows: OevrigeKravDraftRow[];
  committedById: ReadonlyMap<string, OevrigeKravRow>;
  onFieldChange: (rowId: string, field: 'dato' | 'udgiftTil' | 'beloeb') => (value: string) => void;
  onRowBlur: (rowId: string) => void;
  minDate?: ISODateString | string;
  maxDate?: ISODateString | string;
  specialRangeErrors?: DateRangeSpecialErrors;
  noValidRangeCause?: string;
  saveOrderPath?: TableSaveOrderPath;
  onRowsReorder?: (orderedIds: readonly string[]) => void;
}>;

const getRowId = (row: OevrigeKravDraftRow) => row.id;
const isRowEmpty = (row: OevrigeKravDraftRow) => row.dato.trim() === '' && row.udgiftTil.trim() === '' && row.beloeb.trim() === '';

const OevrigeKravTable = React.memo(
  ({ rows, committedById, onFieldChange, onRowBlur, minDate, maxDate, specialRangeErrors, noValidRangeCause, saveOrderPath, onRowsReorder }: OevrigeKravTableProps) => {
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
    onSortedRowsChange: (nextRows) => onRowsReorder?.(nextRows.map((row) => row.id)),
  });
  const visibleRowIds = React.useMemo(() => sortedRows.map((row) => row.id), [sortedRows]);
  useRegisterTableSaveOrder(saveOrderPath, visibleRowIds);

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

          return (
            <TableRow key={row.id} data-mineo-row-id={row.id}>
              <TableCell>
                <TableDateInput
                  gridCell={{ rowId: row.id, colIndex: 0 }}
                  value={committed?.dato}
                  onBlur={(e) => {
                    // Row-draft-grænsen bruger stadig strenge; undefined rydder draften.
                    onFieldChange(row.id, 'dato')(e.target.value ?? '');
                    onRowBlur(row.id);
                  }}
                  minDate={minDate}
                  maxDate={maxDate}
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
