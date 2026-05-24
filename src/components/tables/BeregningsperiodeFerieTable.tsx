import * as React from 'react';
import { TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';

import type { ISODateString } from '../../types/branded';
import type { FerieperiodeRow } from '../../schemas/formSchemas';
import type { FerieDraftRow } from '../../domain/erstatningsopgoerelse/tables/tableDraftRows';
import TableDateInput from '../inputs/table/TableDateInput';
import StandardLooseTable, { StandardLooseHeaderCell } from './StandardLooseTable';
import { useTableSort } from './useTableSort';
import { useRegisterTableSaveOrder } from './useRegisterTableSaveOrder';

export type BeregningsperiodeFerieTableProps = Readonly<{
  rows: FerieDraftRow[];
  committedById: ReadonlyMap<string, FerieperiodeRow>;
  feriedageById: Record<string, number | null>;
  onFieldChange: (rowId: string, field: 'fra' | 'til') => (value: string) => void;
  onRowBlur: (rowId: string) => void;
  beregningsperiodeFra: ISODateString | undefined;
  beregningsperiodeTil: ISODateString | undefined;
  saveOrderPath?: string;
  onRowsReorder?: (orderedIds: readonly string[]) => void;
}>;

const OUTSIDE_BEREGNINGSPERIODE_ERROR_MESSAGE = 'Ferie i beregningsperioden skal også ligge inden for beregningsperioden.';

const getRowId = (row: FerieDraftRow) => row.id;
const isRowEmpty = (row: FerieDraftRow) => row.fra.trim() === '' && row.til.trim() === '';

const BeregningsperiodeFerieTable = React.memo(
  ({
    rows,
    committedById,
    feriedageById,
    onFieldChange,
    onRowBlur,
    beregningsperiodeFra,
    beregningsperiodeTil,
    saveOrderPath,
    onRowsReorder,
  }: BeregningsperiodeFerieTableProps) => {
    const sortColumns = React.useMemo(() => [
      { colId: 'fra', getSortValue: (row: FerieDraftRow) => committedById.get(row.id)?.fra },
      { colId: 'til', getSortValue: (row: FerieDraftRow) => committedById.get(row.id)?.til },
      { colId: 'feriedage', getSortValue: (row: FerieDraftRow) => feriedageById[row.id] ?? undefined },
    ], [committedById, feriedageById]);

    const { sortedRows, getSortRole, getSortDirection, handleHeaderClick } = useTableSort({
      rows,
      getRowId,
      isRowEmpty,
      columns: sortColumns,
      onSortedRowsChange: (nextRows) => onRowsReorder?.(nextRows.map((row) => row.id)),
    });
    const visibleRowIds = React.useMemo(() => sortedRows.map((row) => row.id), [sortedRows]);
    useRegisterTableSaveOrder(saveOrderPath, visibleRowIds);

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
            <StandardLooseHeaderCell sx={{ width: 180 }} onClick={() => handleHeaderClick('fra')} sortRole={getSortRole('fra')} sortDirection={getSortDirection('fra')}>Fra o.m.</StandardLooseHeaderCell>
            <StandardLooseHeaderCell sx={{ width: 180 }} onClick={() => handleHeaderClick('til')} sortRole={getSortRole('til')} sortDirection={getSortDirection('til')}>Til o.m.</StandardLooseHeaderCell>
            <StandardLooseHeaderCell sx={{ width: 160 }} onClick={() => handleHeaderClick('feriedage')} sortRole={getSortRole('feriedage')} sortDirection={getSortDirection('feriedage')}>Feriedage</StandardLooseHeaderCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {sortedRows.map((row) => {
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
                    specialRangeErrors={{ fraTilRole: 'fra' }}
                    noValidRangeCause={fraNoValidRangeCause}
                    externalErrorMessage={fraOutsideBeregningsperiode ? OUTSIDE_BEREGNINGSPERIODE_ERROR_MESSAGE : undefined}
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
                    specialRangeErrors={{ fraTilRole: 'til' }}
                    noValidRangeCause={tilNoValidRangeCause}
                    externalErrorMessage={tilOutsideBeregningsperiode ? OUTSIDE_BEREGNINGSPERIODE_ERROR_MESSAGE : undefined}
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
