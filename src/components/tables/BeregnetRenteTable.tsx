import * as React from 'react';
import { Box, IconButton, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import { Download } from '@mui/icons-material';
import TableAmountInput from '../inputs/table/TableAmountInput';
import TableDateIsoInput from '../inputs/table/TableDateIsoInput';
import TableIntegerInput from '../inputs/table/TableIntegerInput';
import TableDropdown, { type TableDropdownOption } from '../inputs/table/TableDropdown';
import StandardLooseTable from './StandardLooseTable';
import { MIN_CALCULATION_DATE, MAX_CALCULATION_YEAR } from '../../data/interestRates';
import { formatAmount } from '../../utils/interestCalculator';
import { loadRentePdfModule } from '../../utils/pdf/pdfLoader';
import type { ISODateString, DanishDateString } from '../../types/branded';
import { toISODateString } from '../../types/branded';
import { minISO } from '../../utils/isoDateHelpers';
import type { RentekravRow } from '../../schemas/formSchemas';
import type { RentekravDraftRow } from '../../domain/renteberegning/tableDraftRows';
import { computeRentekravCalculation, type RentekravCalculationResult } from '../../domain/renteberegning/renteEngine';
import { amountValueToDraftString } from '../../utils/expressionAmount';
import { useFormPersistence } from '../../contexts/FormPersistenceContext';
import { useAppSettings } from '../../contexts/AppSettingsContext';
import { getVisBrevhoved } from '../../utils/pdf/pdfBrevhoved';

const ENHED_OPTIONS = [
  { value: 'dage', label: 'Dage' },
  { value: 'uger', label: 'Uger' },
  { value: 'maaneder', label: 'Måneder' },
] satisfies readonly TableDropdownOption[];

const useRentekravCalculation = (
  committedRow: RentekravRow,
  beregningsdato: ISODateString | undefined
): RentekravCalculationResult => {
  return React.useMemo(() => computeRentekravCalculation(committedRow, beregningsdato), [committedRow, beregningsdato]);
};

export type BeregnetRenteTableProps = Readonly<{
  rows: RentekravDraftRow[];
  committedById: ReadonlyMap<string, RentekravRow>;
  onFieldChange: (rowId: string, fieldId: 'belob' | 'renterFra' | 'tillaegstid' | 'enhed') => (value: string) => void;
  onRowBlur: (rowId: string) => void;
  beregningsdato: ISODateString | undefined;
  onError: (message: string, context: string, error?: unknown) => void;
  beregningsdatoHasError: boolean;
}>;

type BeregnetRenteRowProps = Readonly<{
  row: RentekravDraftRow;
  committedRow: RentekravRow;
  rowIndex: number;
  onFieldChange: (rowId: string, fieldId: 'belob' | 'renterFra' | 'tillaegstid' | 'enhed') => (value: string) => void;
  onRowBlur: (rowId: string) => void;
  beregningsdato: ISODateString | undefined;
  onError: (message: string, context: string, error?: unknown) => void;
  beregningsdatoHasError: boolean;
}>;

const BeregnetRenteRow = React.memo(
  ({ row, committedRow, rowIndex, onFieldChange, onRowBlur, beregningsdato, onError, beregningsdatoHasError }: BeregnetRenteRowProps) => {
    const { getPersistedData } = useFormPersistence();
    const { settings } = useAppSettings();
    const [renterFraHasError, setRenterFraHasError] = React.useState(false);

    const dynamicMaxDate = React.useMemo((): ISODateString => {
      if (!beregningsdato) {
        return toISODateString(`${MAX_CALCULATION_YEAR}-12-31`);
      }

      const standardMaxDate = toISODateString(`${MAX_CALCULATION_YEAR}-12-31`);
      return minISO(beregningsdato, standardMaxDate);
    }, [beregningsdato]);

    const { context: validatedCalculation, issue: calculationIssue, actualInterestDate } = useRentekravCalculation(committedRow, beregningsdato);

    const lastLoggedIssueKeyRef = React.useRef<string | null>(null);
    React.useEffect(() => {
      if (!calculationIssue) return;
      const key = `${calculationIssue.context}:${calculationIssue.message}`;
      if (lastLoggedIssueKeyRef.current === key) return;
      lastLoggedIssueKeyRef.current = key;
      onError(calculationIssue.message, calculationIssue.context, calculationIssue.error);
    }, [calculationIssue, onError]);

    const calculatedInterest = validatedCalculation?.calculatedInterest ?? null;
    const showDownloadButton = calculatedInterest !== null && !renterFraHasError && !beregningsdatoHasError;

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
          <TableDateIsoInput
            gridCell={{ rowId: row.id, colIndex: 1 }}
            value={committedRow.renterFra}
            onBlur={(e) => {
              onFieldChange(row.id, 'renterFra')(e.target.value ?? '');
              onRowBlur(row.id);
            }}
            minDate={MIN_CALCULATION_DATE}
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
              {actualInterestDate || '-'}
            </Typography>
          </Box>
        </TableCell>

        <TableCell align="right" sx={{ paddingTop: 0, paddingBottom: 0 }}>
          <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
            <Typography className="row--text" sx={{ color: 'var(--color-text-secondary)', textAlign: 'right' }}>
              {calculatedInterest !== null ? `${formatAmount(calculatedInterest)} kr.` : '-'}
            </Typography>
          </Box>
        </TableCell>

        <TableCell>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {showDownloadButton ? (
              <IconButton
                onClick={async () => {
                  if (!validatedCalculation) {
                    onError('Kan ikke generere PDF: Manglende eller ugyldig data', 'BeregnetRenteRow.PDFGeneration');
                    return;
                  }

                  try {
                    // Hent stamdata
                    const stamdata = getPersistedData('stamdata');

                    // Udled visBrevhoved fra settings
                    const visBrevhoved = getVisBrevhoved(settings, 'renteberegning');

                    const { generateRentePdf } = await loadRentePdfModule();
                    generateRentePdf(
                      validatedCalculation.beloeb,
                      validatedCalculation.actualInterestDate,
                      validatedCalculation.beregningsdato,
                      {
                        visBrevhoved,
                        stamdata,
                      }
                    );
                  } catch (error) {
                    onError('Kunne ikke indlæse PDF-modulet for rente', 'BeregnetRenteRow.PDFGeneration', error);
                  }
                }}
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

const BeregnetRenteTable = React.memo(
  ({ rows, onFieldChange, onRowBlur, beregningsdato, committedById, onError, beregningsdatoHasError }: BeregnetRenteTableProps) => {
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
            <TableCell sx={{ width: '176px' }}>Beløb</TableCell>
            <TableCell sx={{ width: '163px' }}>Renter fra</TableCell>
            <TableCell colSpan={2} sx={{ width: '314px' }}>Evt. tillægstid</TableCell>
            <TableCell align="center" sx={{ width: '163px' }}>Rentedato</TableCell>
            <TableCell align="center" sx={{ width: '151px' }}>Beregnet rente</TableCell>
            <TableCell sx={{ width: '163px' }}>Specifikation</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row, rowIndex) => {
            const committedRow = committedById.get(row.id) ?? {
              id: row.id,
              belob: undefined,
              renterFra: undefined,
              tillaegstid: undefined,
              enhed: 'dage',
            };
            return (
              <BeregnetRenteRow
                key={row.id}
                row={row}
                committedRow={committedRow}
                rowIndex={rowIndex}
                onFieldChange={onFieldChange}
                onRowBlur={onRowBlur}
                beregningsdato={beregningsdato}
                onError={onError}
                beregningsdatoHasError={beregningsdatoHasError}
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
