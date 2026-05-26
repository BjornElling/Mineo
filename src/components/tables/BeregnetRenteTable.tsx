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
import type { TableSaveOrderPath } from '../../utils/tableSaveOrderRegistry';

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

export type RentekravPdfContextMap = ReadonlyMap<string, RentePdfContext>;

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
  saveOrderPath?: TableSaveOrderPath;
  onRowsReorder?: (orderedIds: readonly string[]) => void;
  isMobile?: boolean;
  onPdfContextsChange?: (contexts: RentekravPdfContextMap, anyRowHasError: boolean) => void;
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
  isMobile: boolean;
  onRowStateChange: (rowId: string, pdfContext: RentePdfContext | null, hasError: boolean) => void;
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
    isMobile,
    onRowStateChange,
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

    const belobHasValue = committedRow.belob !== undefined && amountValueToNumber(committedRow.belob) !== undefined;
    const renterFraHasValue = committedRow.renterFra !== undefined;
    const isPartialRow = belobHasValue !== renterFraHasValue;

    const hasRowError = renterFraHasError || isPartialRow;
    React.useEffect(() => {
      onRowStateChange(row.id, pdfContext, hasRowError);
    }, [row.id, pdfContext, hasRowError, onRowStateChange]);

    const actualInterestDateDanish = isoToDanish(actualInterestDate ?? undefined) ?? null;
    const showDownloadButton = pdfContext !== null && !renterFraHasError && !beregningsdatoHasError;

    return (
      <TableRow data-mineo-row-id={row.id}>
        <TableCell sx={isMobile ? undefined : { textAlign: 'center' }}>
          <TableAmountInput
            gridCell={{ rowId: row.id, colIndex: 0 }}
            value={committedRow.belob}
            onBlur={(e) => {
              onFieldChange(row.id, 'belob')(amountValueToDraftString(e.target.value, 2));
              onRowBlur(row.id);
            }}
            placeholder={isMobile ? '0,00' : '0,00 kr.'}
            canBeNegative={false}
            sx={isMobile
              ? { width: '100%', paddingLeft: '4px', paddingRight: '4px' }
              : { width: 156 }
            }
          />
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
            inputMode={isMobile ? 'numeric' : 'text'}
            sx={isMobile ? { paddingLeft: '4px', paddingRight: '4px' } : undefined}
          />
        </TableCell>

        {!isMobile && (
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
        )}

        {!isMobile && (
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
        )}

        {!isMobile && (
          <TableCell align="center" sx={{ paddingTop: 0, paddingBottom: 0 }}>
            <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Typography className="row--text" sx={{ color: 'var(--color-text-secondary)', textAlign: 'center' }}>
                {actualInterestDateDanish || '-'}
              </Typography>
            </Box>
          </TableCell>
        )}

        <TableCell align="right" sx={{ paddingTop: 0, paddingBottom: 0, ...(isMobile && { paddingRight: '10px' }) }}>
          <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
            <Typography className="row--text" sx={{ color: 'var(--color-text-secondary)', textAlign: 'right' }}>
              {calculatedInterest !== null ? `${formatAsAmount(calculatedInterest, 2)} kr.` : '-'}
            </Typography>
          </Box>
        </TableCell>

        {!isMobile && (
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
        )}
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
    isMobile = false,
    onPdfContextsChange,
  }: BeregnetRenteTableProps) => {
    // rowId → { pdfContext, hasError } — opdateres løbende af BeregnetRenteRow via onRowStateChange
    const rowStatesRef = React.useRef<Map<string, { pdfContext: RentePdfContext | null; hasError: boolean }>>(new Map());
    const onPdfContextsChangeRef = React.useRef(onPdfContextsChange);
    React.useEffect(() => {
      onPdfContextsChangeRef.current = onPdfContextsChange;
    });

    const handleRowStateChange = React.useCallback((
      rowId: string,
      pdfContext: RentePdfContext | null,
      hasError: boolean,
    ) => {
      const prev = rowStatesRef.current.get(rowId);
      if (prev?.pdfContext === pdfContext && prev?.hasError === hasError) return;
      rowStatesRef.current.set(rowId, { pdfContext, hasError });

      const contexts = new Map<string, RentePdfContext>();
      let anyRowHasError = false;
      for (const [id, state] of rowStatesRef.current) {
        if (state.pdfContext !== null) contexts.set(id, state.pdfContext);
        if (state.hasError) anyRowHasError = true;
      }
      onPdfContextsChangeRef.current?.(contexts, anyRowHasError);
    }, []);

    // Ryd op i rowStates når rækker fjernes
    React.useEffect(() => {
      const currentIds = new Set(rows.map((r) => r.id));
      let changed = false;
      for (const id of rowStatesRef.current.keys()) {
        if (!currentIds.has(id)) {
          rowStatesRef.current.delete(id);
          changed = true;
        }
      }
      if (changed) {
        const contexts = new Map<string, RentePdfContext>();
        let anyRowHasError = false;
        for (const [id, state] of rowStatesRef.current) {
          if (state.pdfContext !== null) contexts.set(id, state.pdfContext);
          if (state.hasError) anyRowHasError = true;
        }
        onPdfContextsChangeRef.current?.(contexts, anyRowHasError);
      }
    }, [rows]);

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
        immediateEditing={isMobile}
        sx={{
          tableLayout: 'fixed',
          width: isMobile ? '100%' : '1130px',
          '& .MuiTableCell-root': {
            whiteSpace: 'nowrap',
            verticalAlign: 'middle',
            ...(isMobile && { paddingLeft: '6px', paddingRight: '6px', paddingTop: '4px', paddingBottom: '4px', fontSize: '12px' }),
          },
          '& thead th': {
            textAlign: 'center',
          },
          '& .MuiTableRow-root': {
            '@media (hover: hover)': {
              '&:hover': { backgroundColor: isMobile ? 'transparent' : (theme) => theme.palette.action.hover },
            },
            '@media (hover: none)': {
              '&:hover': { backgroundColor: 'transparent' },
            },
          },
        }}
      >
        {isMobile ? (
          <colgroup>
            <col style={{ width: '35%' }} />
            <col style={{ width: '33%' }} />
            <col style={{ width: '32%' }} />
          </colgroup>
        ) : (
          <colgroup>
            <col style={{ width: '176px' }} />
            <col style={{ width: '163px' }} />
            <col style={{ width: '90px' }} />
            <col style={{ width: '224px' }} />
            <col style={{ width: '163px' }} />
            <col style={{ width: '151px' }} />
            <col style={{ width: '163px' }} />
          </colgroup>
        )}
        <TableHead>
          <TableRow>
            <StandardLooseHeaderCell
              sx={{ width: isMobile ? '35%' : '176px' }}
              onClick={() => handleHeaderClick('belob')}
              sortRole={getSortRole('belob')}
              sortDirection={getSortDirection('belob')}
            >
              Beløb
            </StandardLooseHeaderCell>
            <StandardLooseHeaderCell
              sx={{ width: isMobile ? '33%' : '163px' }}
              onClick={() => handleHeaderClick('renterFra')}
              sortRole={getSortRole('renterFra')}
              sortDirection={getSortDirection('renterFra')}
            >
              Renter fra
            </StandardLooseHeaderCell>
            {!isMobile && <TableCell colSpan={2} sx={{ width: '314px' }}>Evt. tillægstid</TableCell>}
            {!isMobile && <TableCell align="center" sx={{ width: '163px' }}>Rentedato</TableCell>}
            <TableCell align="center" sx={{ width: isMobile ? '32%' : '151px' }}>Beregnet rente</TableCell>
            {!isMobile && <TableCell sx={{ width: '163px' }}>Specifikation</TableCell>}
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
                isMobile={isMobile}
                onRowStateChange={handleRowStateChange}
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
