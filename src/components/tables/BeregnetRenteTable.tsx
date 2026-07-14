import * as React from 'react';
import { Box, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import DownloadIconButton from '../inputs/DownloadIconButton';
import TableAmountInput from '../inputs/table/TableAmountInput';
import TableDateInput from '../inputs/table/TableDateInput';
import TableIntegerInput from '../inputs/table/TableIntegerInput';
import TableDropdown, { type TableDropdownOption } from '../inputs/table/TableDropdown';
import StandardLooseTable, { StandardLooseHeaderCell } from './StandardLooseTable';
import { RowDeleteButton } from './RowDeleteButton';
import { useTableSort } from './useTableSort';
import { formatKr } from '../../utils/formatUtils';
import type { ISODateString } from '../../types/branded';
import { isoToDanish } from '../../types/branded';
import { minISO } from '../../utils/isoDateHelpers';
import type { RentekravRow } from '../../schemas/formSchemas';
import type { RentekravDraftRow } from '../../domain/renteberegning/tableDraftRows';
import type { RentekravRowResult } from '../../domain/renteberegning/renteberegningEngine';
import { createEmptyRentekravCommittedRow } from '../../domain/renteberegning/rentekravTableModel';
import { isRentekravRowEmpty } from '../../domain/renteberegning/rowEmpty';
import type { InputProjection } from '../../domain/inputIntegrity/inputBlocker';
import { amountValueToDraftString, amountValueToNumber } from '../../utils/expressionAmount';
import { dateRanges_renteberegning } from '../../config/dateRanges';
import { useRegisterTableSaveOrder } from './useRegisterTableSaveOrder';
import { useReconcileInvalidDraftsToLiveRows } from '../../hooks/tableInput';
import type { TableSaveOrderPath } from '../../utils/tableSaveOrderRegistry';
import { getDocumentFormatLabel, type DocumentDownloadFormat } from '../../document/documentFormat';

export type RentePdfContext = NonNullable<RentekravRowResult['pdfContext']>;

const ENHED_OPTIONS = [
  { value: 'dage', label: 'Dage' },
  { value: 'uger', label: 'Uger' },
  { value: 'maaneder', label: 'Måneder' },
] satisfies readonly TableDropdownOption[];

export type RentekravPdfContextMap = ReadonlyMap<string, RentePdfContext>;

export type BeregnetRenteTableProps = Readonly<{
  rows: RentekravDraftRow[];
  committedById: ReadonlyMap<string, RentekravRow>;
  onFieldChange: (rowId: string, fieldId: 'belob' | 'renterFra' | 'tillaegstid' | 'enhed') => (value: string) => void;
  onRowBlur: (rowId: string) => void;
  /** Sletter hele rækken i én undo-handling (committed removeRow fra row-hooken). */
  onDeleteRow?: (rowId: string) => void;
  beregningsdato: ISODateString | undefined;
  onDownloadSpecifikation: (rowId: string) => Promise<void>;
  onError: (message: string, context: string, error?: unknown) => void;
  rowProjections: ReadonlyMap<string, InputProjection<RentekravRowResult>>;
  saveOrderPath?: TableSaveOrderPath;
  onRowsReorder?: (orderedIds: readonly string[]) => void;
  isMobile?: boolean;
  documentDownloadFormat: DocumentDownloadFormat;
}>;

type BeregnetRenteRowProps = Readonly<{
  row: RentekravDraftRow;
  committedRow: RentekravRow;
  rowIndex: number;
  onFieldChange: (rowId: string, fieldId: 'belob' | 'renterFra' | 'tillaegstid' | 'enhed') => (value: string) => void;
  onRowBlur: (rowId: string) => void;
  onDeleteRow?: (rowId: string) => void;
  beregningsdato: ISODateString | undefined;
  onDownloadSpecifikation: (rowId: string) => Promise<void>;
  onError: (message: string, context: string, error?: unknown) => void;
  projection: InputProjection<RentekravRowResult> | undefined;
  isMobile: boolean;
  documentDownloadFormat: DocumentDownloadFormat;
}>;

const BeregnetRenteRow = React.memo(
  ({
    row,
    committedRow,
    rowIndex,
    onFieldChange,
    onRowBlur,
    onDeleteRow,
    beregningsdato,
    onDownloadSpecifikation,
    onError: _onError,
    projection,
    isMobile,
    documentDownloadFormat,
  }: BeregnetRenteRowProps) => {
    const formatLabel = getDocumentFormatLabel(documentDownloadFormat);
    const standardMaxDate = dateRanges_renteberegning.renteTil.max;

    const dynamicMaxDate = React.useMemo((): ISODateString => {
      if (!beregningsdato) {
        return standardMaxDate;
      }

      return minISO(beregningsdato, standardMaxDate);
    }, [beregningsdato, standardMaxDate]);

    const { actualInterestDate, calculatedInterest, pdfContext } = projection?.status === 'ready'
      ? projection.data
      : { actualInterestDate: null, calculatedInterest: null, pdfContext: null };

    const actualInterestDateDanish = isoToDanish(actualInterestDate ?? undefined) ?? null;
    // Per-række-download vises kun for en gyldig række uden nogen afsluttet ugyldig input (global eller
    // rækkens egen celle). Blokeringen udledes nu af invalidDrafts via forælderen — ikke af en lokal
    // renterFraHasError-boolean (document-output-contract.md §A2.1).
    const showDownloadButton = pdfContext !== null;

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
            placeholder="0,00"
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
              ariaLabel="Enhed for tillægstid"
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
              <Typography className="row--text" sx={{ color: 'var(--mineo-color-grid-derived)', textAlign: 'center' }}>
                {actualInterestDateDanish || '-'}
              </Typography>
            </Box>
          </TableCell>
        )}

        <TableCell align="right" sx={{ paddingTop: 0, paddingBottom: 0, ...(isMobile && { paddingRight: '10px' }) }}>
          <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
            <Typography className="row--text" sx={{ color: 'var(--mineo-color-grid-derived)', textAlign: 'right' }}>
              {calculatedInterest !== null ? formatKr(calculatedInterest, 2) : '-'}
            </Typography>
          </Box>
        </TableCell>

        {!isMobile && (
          <TableCell sx={{ position: 'relative', paddingRight: '28px' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {showDownloadButton ? (
                <DownloadIconButton
                  onClick={() => { void onDownloadSpecifikation(row.id); }}
                  tooltip={`Download som ${formatLabel}`}
                  ariaLabel={`Download ${formatLabel}-specifikation for række ${rowIndex + 1}`}
                />
              ) : (
                <Typography className="row--text" sx={{ color: 'var(--mineo-color-grid-derived)' }}>
                  -
                </Typography>
              )}
            </Box>
            {onDeleteRow && !isRentekravRowEmpty(committedRow) && (
              <RowDeleteButton onDelete={() => onDeleteRow(row.id)} />
            )}
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
    onDeleteRow,
    beregningsdato,
    onDownloadSpecifikation,
    committedById,
    onError,
    rowProjections,
    saveOrderPath,
    onRowsReorder,
    isMobile = false,
    documentDownloadFormat,
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
    // Ryd en slettet rækkes celle-`invalidDraft`, så den ikke blokerer Gem som spøgelses-mål uden synligt felt.
    const liveRowIds = React.useMemo(() => new Set(visibleRowIds), [visibleRowIds]);
    useReconcileInvalidDraftsToLiveRows(liveRowIds);

    return (
      <StandardLooseTable
        immediateEditing={isMobile}
        sx={{
          tableLayout: 'fixed',
          width: isMobile ? '100%' : '1130px',
          '& .MuiTableCell-root': {
            whiteSpace: 'nowrap',
            verticalAlign: 'middle',
            ...(isMobile && {
              paddingLeft: '6px',
              paddingRight: '6px',
              paddingTop: '4px',
              paddingBottom: '4px',
              fontSize: 'var(--minprocesrente-mobile-content-font-size)',
            }),
            ...(isMobile && {
              '& .MuiInputBase-root, & .MuiInputBase-input': {
                fontSize: 'var(--minprocesrente-mobile-content-font-size)',
              },
            }),
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
                onDeleteRow={onDeleteRow}
                beregningsdato={beregningsdato}
                onDownloadSpecifikation={onDownloadSpecifikation}
                onError={onError}
                projection={rowProjections.get(row.id)}
                isMobile={isMobile}
                documentDownloadFormat={documentDownloadFormat}
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
