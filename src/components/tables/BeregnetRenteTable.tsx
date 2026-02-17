import * as React from 'react';
import { Box, IconButton, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import { Download } from '@mui/icons-material';
import StyledAmountField from '../inputs/StyledAmountField';
import StyledDateField from '../inputs/StyledDateField';
import StyledIntegerField from '../inputs/StyledIntegerField';
import TableDropdown, { type TableDropdownOption } from '../inputs/table/TableDropdown';
import StandardLooseTable from './StandardLooseTable';
import { MIN_CALCULATION_DATE, MAX_CALCULATION_YEAR } from '../../data/interestRates';
import { formatAmount } from '../../utils/interestCalculator';
import { loadRentePdfModule } from '../../utils/pdf/pdfLoader';
import type { ISODateString, DanishDateString } from '../../types/branded';
import { toISODateString } from '../../types/branded';
import { minIsoDate } from '../../utils/dateUtils';
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
      return minIsoDate(beregningsdato, standardMaxDate);
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
      <TableRow>
        <TableCell>
          <StyledAmountField
            value={committedRow.belob}
            onDraftChange={(e) => onFieldChange(row.id, 'belob')(e.target.value)}
            onCommit={(e) => {
              onFieldChange(row.id, 'belob')(amountValueToDraftString(e.target.value, 2));
              onRowBlur(row.id);
            }}
            width={156}
            placeholder="0,00 kr."
            allowNegative={false}
          />
        </TableCell>

        <TableCell>
          <StyledDateField
            value={committedRow.renterFra}
            onDraftChange={(e) => onFieldChange(row.id, 'renterFra')(e.target.value ?? '')}
            onCommit={(e) => {
              onFieldChange(row.id, 'renterFra')(e.target.value ?? '');
              onRowBlur(row.id);
            }}
            minDate={MIN_CALCULATION_DATE}
            maxDate={dynamicMaxDate}
            onFieldError={(errorMsg) => setRenterFraHasError(!!errorMsg)}
          />
        </TableCell>

        <TableCell>
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 1.5 }}>
            <Typography className="row--text">+</Typography>

            <StyledIntegerField
              value={committedRow.tillaegstid}
              onDraftChange={(e) => onFieldChange(row.id, 'tillaegstid')(e.target.value)}
              onCommit={(e) => {
                onFieldChange(row.id, 'tillaegstid')(e.target.value === undefined ? '' : String(e.target.value));
                onRowBlur(row.id);
              }}
              width={50}
              placeholder="0"
              minValue={0}
              maxValue={99}
              maxDigits={2}
            />

             <TableDropdown
              value={committedRow.enhed}
              allowEmpty={false}
              appearance="loose"
              options={ENHED_OPTIONS}
              sx={{ width: 180, '& .MuiSelect-select': { textAlign: 'left' } }}
              onChange={(e) => {
                onFieldChange(row.id, 'enhed')(e.target.value);
                onRowBlur(row.id);
              }}
            />
          </Box>
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
        <TableHead>
          <TableRow>
            <TableCell sx={{ width: '176px' }}>Beløb</TableCell>
            <TableCell sx={{ width: '163px' }}>Renter fra</TableCell>
            <TableCell sx={{ width: '314px' }}>Evt. tillægstid</TableCell>
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
