import * as React from 'react';
import { TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import TableDateInput from '../inputs/table/TableDateInput';
import StandardLooseTable, { StandardLooseHeaderCell } from './StandardLooseTable';
import { computeSkadedatoMinRule, dateRanges_erstatningsopgoerelse, TODAY } from '../../config/dateRanges';
import type { FerieperiodeRow } from '../../schemas/formSchemas';
import type { ISODateString } from '../../types/branded';
import { getDayBeforeIso } from '../../utils/isoDateHelpers';

import { computeRowDateBounds } from '../../domain/erstatningsopgoerelse/helpers/rowDateBounds';
import type { FerieDraftRow } from '../../domain/erstatningsopgoerelse/tables/tableDraftRows';
import { useTableSort } from './useTableSort';
import { useRegisterTableSaveOrder } from './useRegisterTableSaveOrder';

export type FerieperiodeTableProps = Readonly<{
  rows: FerieDraftRow[];
  committedById: ReadonlyMap<string, FerieperiodeRow>;
  feriedageById: Record<string, number | null>;
  onFieldChange: (rowId: string, field: 'fra' | 'til') => (value: string) => void;
  onRowBlur: (rowId: string) => void;
  skadedatoISO: ISODateString | undefined;
  endeligEETBeregnetDato: ISODateString | undefined;
  differencekravDato: ISODateString | undefined;
  erErhvervssygdom: boolean;
  verserendeKlageEet: boolean;
  saveOrderPath?: string;
  onRowsReorder?: (orderedIds: readonly string[]) => void;
}>;

const getRowId = (row: FerieDraftRow) => row.id;
const isRowEmpty = (row: FerieDraftRow) => row.fra.trim() === '' && row.til.trim() === '';

const FerieperiodeTable = React.memo(
  ({
    rows,
    committedById,
    feriedageById,
    onFieldChange,
    onRowBlur,
    skadedatoISO,
    endeligEETBeregnetDato,
    differencekravDato,
    erErhvervssygdom,
    verserendeKlageEet,
    saveOrderPath,
    onRowsReorder,
  }: FerieperiodeTableProps) => {
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

            const endeligEETMinus1 = endeligEETBeregnetDato ? getDayBeforeIso(endeligEETBeregnetDato) : undefined;
            const differencekravMinus1 = differencekravDato ? getDayBeforeIso(differencekravDato) : undefined;

            let combinedExtraMaxDate: ISODateString | undefined = undefined;
            if (differencekravMinus1) combinedExtraMaxDate = differencekravMinus1;
            if (!verserendeKlageEet && endeligEETMinus1) {
              if (!combinedExtraMaxDate || endeligEETMinus1 < combinedExtraMaxDate) {
                combinedExtraMaxDate = endeligEETMinus1;
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
              return parts.join(', ');
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
                    specialRangeErrors={{
                      fraTilRole: 'fra',
                      minBoundKind: skadedatoMinRule.minBoundKind,
                      minBoundReferenceISO: skadedatoMinRule.minBoundReferenceISO,
                    }}
                    noValidRangeCause={fraNoValidRangeCause}
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
