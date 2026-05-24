import * as React from 'react';
import { Box, IconButton, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import { Download } from '@mui/icons-material';
import type { RateEntry } from '../../data/interestRates';
import TableAmountInput from '../inputs/table/TableAmountInput';
import TableDateInput from '../inputs/table/TableDateInput';
import TableIntegerInput from '../inputs/table/TableIntegerInput';
import TableDropdown, { type TableDropdownOption } from '../inputs/table/TableDropdown';
import StandardLooseTable, { StandardLooseHeaderCell } from './StandardLooseTable';
import { useTableSort } from './useTableSort';
import { formatAsAmount } from '../../utils/formatUtils';
import type { ISODateString } from '../../types/branded';
import { isoToDanish } from '../../types/branded';
import { minISO } from '../../utils/isoDateHelpers';
import type { RentekravRow } from '../../schemas/formSchemas';
import type { RentekravDraftRow } from '../../domain/renteberegning/tableDraftRows';
import { computeRentekravRow, type RentekravRowResult } from '../../domain/renteberegning/renteberegningEngine';
import { createEmptyRentekravCommittedRow } from '../../domain/renteberegning/rentekravTableModel';
import { isRentekravRowEmpty } from '../../domain/renteberegning/rowEmpty';
import { amountValueToDraftString, amountValueToNumber } from '../../utils/expressionAmount';
import { dateRanges_renteberegning } from '../../config/dateRanges';
import { useRegisterTableSaveOrder } from './useRegisterTableSaveOrder';

export type RentePdfContext = NonNullable<RentekravRowResult['pdfContext']>;

const ENHED_OPTIONS = [
  { value: 'dage', label: 'Dage' },
  { value: 'uger', label: 'Uger' },
  { value: 'maaneder', label: 'Måneder' },
] satisfies readonly TableDropdownOption[];

const useRentekravRowResult = (
  committedRow: RentekravRow,
  beregningsdato: ISODateString | undefined,
  referenceRates: ReadonlyArray<RateEntry>,
  surchargeRates: ReadonlyArray<RateEntry>,
): RentekravRowResult => {
  return React.useMemo(
    () => computeRentekravRow(committedRow, beregningsdato, referenceRates, surchargeRates),
    [committedRow, beregningsdato, referenceRates, surchargeRates]
  );
};

export type BeregnetRenteTableProps = Readonly<{
  rows: RentekravDraftRow[];
  committedById: ReadonlyMap<string, RentekravRow>;
  onFieldChange: (rowId: string, fieldId: 'belob' | 'renterFra' | 'tillaegstid' | 'enhed') => (value: string) => void;
  onRowBlur: (rowId: string) => void;
  beregningsdato: ISODateString | undefined;
  onDownloadSpecifikation: (pdfContext: RentePdfContext) => Promise<void>;
  onError: (message: string, context: string, error?: unknown) => void;
  beregningsdatoHasError: boolean;
  referenceRates: ReadonlyArray<RateEntry>;
  surchargeRates: ReadonlyArray<RateEntry>;
  saveOrderPath?: string;
  onRowsReorder?: (orderedIds: readonly string[]) => void;
}>;

type BeregnetRenteRowProps = Readonly<{
  row: RentekravDraftRow;
  committedRow: RentekravRow;
  rowIndex: number;
  onFieldChange: (rowId: string, fieldId: 'belob' | 'renterFra' | 'tillaegstid' | 'enhed') => (value: string) => void;
  onRowBlur: (rowId: string) => void;
  beregningsdato: ISODateString | undefined;
  onDownloadSpecifikation: (pdfContext: RentePdfContext) => Promise<void>;
  onError: (message: string, context: string, error?: unknown) => void;
  beregningsdatoHasError: boolean;
  referenceRates: ReadonlyArray<RateEntry>;
  surchargeRates: ReadonlyArray<RateEntry>;
}>;

const BeregnetRenteRow = React.memo(
  ({
    row,
    committedRow,
    rowIndex,
    onFieldChange,
    onRowBlur,
    beregningsdato,
    onDownloadSpecifikation,
    onError: _onError,
    beregningsdatoHasError,
    referenceRates,
    surchargeRates,
  }: BeregnetRenteRowProps) => {
    const [renterFraHasError, setRenterFraHasError] = React.useState(false);
    const standardMaxDate = dateRanges_renteberegning.renteTil.max;

    const dynamicMaxDate = React.useMemo((): ISODateString => {
      if (!beregningsdato) {
        return standardMaxDate;
      }

      return minISO(beregningsdato, standardMaxDate);
    }, [beregningsdato, standardMaxDate]);

    const { actualInterestDate, calculatedInterest, pdfContext } = useRentekravRowResult(
      committedRow,
      beregningsdato,
      referenceRates,
      surchargeRates
    );

    const actualInterestDateDanish = isoToDanish(actualInterestDate ?? undefined) ?? null;
    const showDownloadButton = pdfContext !== null && !renterFraHasError && !beregningsdatoHasError;

    return (
      <TableRow data-mineo-row-id={row.id}>
        <TableCell>
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <TableAmountInput
              gridCell={{ rowId: row.id, colIndex: 0 }}
              value={committedRow.belob}
              onBlur={(e) => {
                onFieldChange(row.id, 'belob')(amountValueToDraftString(e.target.value, 2));
                onRowBlur(row.id);
              }}
              placeholder="0,00 kr."
              canBeNegative={false}
              sx={{ width: 156 }}
            />
          </Box>
        </TableCell>

        <TableCell>
          <TableDateInput
            gridCell={{ rowId: row.id, colIndex: 1 }}
            value={committedRow.renterFra}
            onBlur={(e) => {
              onFieldChange(row.id, 'renterFra')(e.target.value ?? '');
              onRowBlur(row.id);
            }}
            minDate={dateRanges_renteberegning.renteTil.min}
            maxDate={dynamicMaxDate}
            onErrorChange={(info) => setRenterFraHasError(info.hasError)}
          />
        </TableCell>

        <TableCell>
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 1.5 }}>
            <Typography className="row--text">+</Typography>
            <TableIntegerInput
              gridCell={{ rowId: row.id, colIndex: 2 }}
              value={committedRow.tillaegstid === undefined ? '' : String(committedRow.tillaegstid)}
              onBlur={(e) => {
                onFieldChange(row.id, 'tillaegstid')(e.target.value);
                onRowBlur(row.id);
              }}
              placeholder="0"
              minValue={0}
              maxValue={99}
              sx={{ width: 50 }}
            />
          </Box>
        </TableCell>

        <TableCell>
          <TableDropdown
            gridCell={{ rowId: row.id, colIndex: 3 }}
            value={committedRow.enhed}
            allowEmpty={false}
            appearance="loose"
            options={ENHED_OPTIONS}
            sx={{ width: '100%', '& .MuiSelect-select': { textAlign: 'left' } }}
            onChange={(e) => {
              onFieldChange(row.id, 'enhed')(e.target.value);
              onRowBlur(row.id);
            }}
          />
        </TableCell>

        <TableCell align="center" sx={{ paddingTop: 0, paddingBottom: 0 }}>
          <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Typography className="row--text" sx={{ color: 'var(--color-text-secondary)', textAlign: 'center' }}>
              {actualInterestDateDanish || '-'}
            </Typography>
          </Box>
        </TableCell>

        <TableCell align="right" sx={{ paddingTop: 0, paddingBottom: 0 }}>
          <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
            <Typography className="row--text" sx={{ color: 'var(--color-text-secondary)', textAlign: 'right' }}>
              {calculatedInterest !== null ? `${formatAsAmount(calculatedInterest, 2)} kr.` : '-'}
            </Typography>
          </Box>
        </TableCell>

        <TableCell>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {showDownloadButton ? (
              <IconButton
                onClick={() => onDownloadSpecifikation(pdfContext)}
                aria-label={`Download PDF-specifikation for række ${rowIndex + 1}`}
                size="small"
                sx={(theme) => ({
                  width: '32px',
                  height: '32px',
                  borderRadius: '6px',
                  '&:hover': {
                    backgroundColor: theme.palette.action.hover,
                  },
                })}
              >
                <Download sx={{ fontSize: '24px', color: 'primary.main' }} />
              </IconButton>
            ) : (
              <Typography className="row--text" sx={{ color: 'var(--color-text-secondary)' }}>
                -
              </Typography>
            )}
          </Box>
        </TableCell>
      </TableRow>
    );
  }
);

BeregnetRenteRow.displayName = 'BeregnetRenteRow';

const getRowId = (row: RentekravDraftRow) => row.id;

const BeregnetRenteTable = React.memo(
  ({
    rows,
    onFieldChange,
    onRowBlur,
    beregningsdato,
    onDownloadSpecifikation,
    committedById,
    onError,
    beregningsdatoHasError,
    referenceRates,
    surchargeRates,
    saveOrderPath,
    onRowsReorder,
  }: BeregnetRenteTableProps) => {
    const sortColumns = React.useMemo(() => [
      { colId: 'belob', getSortValue: (row: RentekravDraftRow) => amountValueToNumber(committedById.get(row.id)?.belob) },
      { colId: 'renterFra', getSortValue: (row: RentekravDraftRow) => committedById.get(row.id)?.renterFra },
    ], [committedById]);

    const { sortedRows, getSortRole, getSortDirection, handleHeaderClick } = useTableSort({
      rows,
      getRowId,
      isRowEmpty: (row) => isRentekravRowEmpty(committedById.get(row.id) ?? createEmptyRentekravCommittedRow(row.id)),
      columns: sortColumns,
      onSortedRowsChange: (nextRows) => onRowsReorder?.(nextRows.map((row) => row.id)),
    });
    const visibleRowIds = React.useMemo(() => sortedRows.map((row) => row.id), [sortedRows]);
    useRegisterTableSaveOrder(saveOrderPath, visibleRowIds);

    return (
      <StandardLooseTable
        sx={{
          tableLayout: 'fixed',
          width: '1130px',
          '& .MuiTableCell-root': {
            whiteSpace: 'nowrap',
            verticalAlign: 'middle',
          },
          '& thead th': {
            textAlign: 'center',
          },
        }}
      >
        <colgroup>
          <col style={{ width: '176px' }} />
          <col style={{ width: '163px' }} />
          <col style={{ width: '90px' }} />
          <col style={{ width: '224px' }} />
          <col style={{ width: '163px' }} />
          <col style={{ width: '151px' }} />
          <col style={{ width: '163px' }} />
        </colgroup>
        <TableHead>
          <TableRow>
            <StandardLooseHeaderCell sx={{ width: '176px' }} onClick={() => handleHeaderClick('belob')} sortRole={getSortRole('belob')} sortDirection={getSortDirection('belob')}>Beløb</StandardLooseHeaderCell>
            <StandardLooseHeaderCell sx={{ width: '163px' }} onClick={() => handleHeaderClick('renterFra')} sortRole={getSortRole('renterFra')} sortDirection={getSortDirection('renterFra')}>Renter fra</StandardLooseHeaderCell>
            <TableCell colSpan={2} sx={{ width: '314px' }}>Evt. tillægstid</TableCell>
            <TableCell align="center" sx={{ width: '163px' }}>Rentedato</TableCell>
            <TableCell align="center" sx={{ width: '151px' }}>Beregnet rente</TableCell>
            <TableCell sx={{ width: '163px' }}>Specifikation</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {sortedRows.map((row, rowIndex) => {
            const committedRow = committedById.get(row.id) ?? createEmptyRentekravCommittedRow(row.id);
            return (
              <BeregnetRenteRow
                key={row.id}
                row={row}
                committedRow={committedRow}
                rowIndex={rowIndex}
                onFieldChange={onFieldChange}
                onRowBlur={onRowBlur}
                beregningsdato={beregningsdato}
                onDownloadSpecifikation={onDownloadSpecifikation}
                onError={onError}
                beregningsdatoHasError={beregningsdatoHasError}
                referenceRates={referenceRates}
                surchargeRates={surchargeRates}
              />
            );
          })}
        </TableBody>
      </StandardLooseTable>
    );
  }
);

BeregnetRenteTable.displayName = 'BeregnetRenteTable';

export default BeregnetRenteTable;
