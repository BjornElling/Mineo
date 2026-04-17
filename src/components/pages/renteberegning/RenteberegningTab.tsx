import React from 'react';
import { Box, Typography } from '@mui/material';
import type { RateEntry } from '../../../data/interestRates';
import StyledDateField from '../../inputs/StyledDateField';
import InsertTodayDateButton from '../../inputs/InsertTodayDateButton';
import StyledTextField from '../../inputs/StyledTextField';
import BeregnetRenteTable from '../../tables/BeregnetRenteTable';
import ContentBox from '../../layout/ContentBox';
import type { RentekravRow } from '../../../schemas/formSchemas';
import type { ISODateString } from '../../../types/branded';
import type { RentekravDraftRow } from '../../../domain/renteberegning/tableDraftRows';
import type { RentePdfContext } from '../../tables/BeregnetRenteTable';
import { createCommitEvent, type CommitHandler } from '../../../types/fieldEvents';
import { RENTE_CALCULATION_PRINCIPLES } from '../../../domain/renteberegning/renteCalculationPrinciples';
import { dateRanges_renteberegning } from '../../../config/dateRanges';

interface TechnicalAssumptionsListProps {
  items: readonly string[];
}

const TechnicalAssumptionsList = ({ items }: TechnicalAssumptionsListProps) => (
  <Box component="ul" sx={{ margin: 0, paddingLeft: '20px', color: 'var(--color-text-primary)', lineHeight: 1.6 }}>
    {items.map((item) => (
      <Typography className="row--text" component="li" key={item} sx={{ marginBottom: '8px' }}>
        {item}
      </Typography>
    ))}
  </Box>
);

export interface RenteberegningTabProps {
  beregningsdato: ISODateString | undefined;
  kommentarer: string | undefined;
  onBeregningsdatoCommit: CommitHandler<ISODateString | undefined>;
  onKommentarerCommit: CommitHandler<string>;
  rentekravRows: RentekravDraftRow[];
  onRentekravChange: (rowId: string, fieldId: 'belob' | 'renterFra' | 'tillaegstid' | 'enhed') => (value: string) => void;
  onRentekravBlur: (rowId: string) => void;
  onRentekravReorder: (orderedIds: readonly string[]) => void;
  onDownloadSpecifikation: (pdfContext: RentePdfContext) => Promise<void>;
  committedRentekravById: ReadonlyMap<string, RentekravRow>;
  onError: (message: string, context: string, error?: unknown) => void;
  pdfErrorMessage: string | null;
  referenceRates: ReadonlyArray<RateEntry>;
  surchargeRates: ReadonlyArray<RateEntry>;
}

const RenteberegningTab = React.memo(({
  beregningsdato,
  kommentarer,
  onBeregningsdatoCommit,
  onKommentarerCommit,
  rentekravRows,
  onRentekravChange,
  onRentekravBlur,
  onRentekravReorder,
  onDownloadSpecifikation,
  committedRentekravById,
  onError,
  pdfErrorMessage,
  referenceRates,
  surchargeRates,
}: RenteberegningTabProps) => {
  const [beregningsdatoHasError, setBeregningsdatoHasError] = React.useState(false);
  const beregningsdatoInputRef = React.useRef<HTMLInputElement>(null);

  return (
    <Box>
      <ContentBox className="content-box">
        <Typography className="section-header">Beregningsdato</Typography>
        <Box className="row--label-offset">
          <Typography className="row--text">Rente beregnes til og med</Typography>
          <Box className="row--label-offset__content">
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <StyledDateField
                value={beregningsdato}
                onCommit={onBeregningsdatoCommit}
                minDate={dateRanges_renteberegning.renteTil.min}
                maxDate={dateRanges_renteberegning.renteTil.max}
                onFieldError={(errorMsg) => setBeregningsdatoHasError(!!errorMsg)}
                inputRef={beregningsdatoInputRef}
              />
              <InsertTodayDateButton
                onCommit={(today) => {
                  onBeregningsdatoCommit(createCommitEvent(today));
                }}
                focusRef={beregningsdatoInputRef}
              />
            </Box>
          </Box>
        </Box>
      </ContentBox>

      <ContentBox className="content-box">
        <Typography className="section-header">Beregnet rente</Typography>
        {pdfErrorMessage && (
          <Box className="row--label-right-hover">
            <Typography className="row--text" sx={{ color: 'error.main' }}>
              {pdfErrorMessage}
            </Typography>
            <Box className="row--label-right-hover__content" />
          </Box>
        )}
        <BeregnetRenteTable
          rows={rentekravRows}
          onFieldChange={onRentekravChange}
          onRowBlur={onRentekravBlur}
          onRowsReorder={onRentekravReorder}
          beregningsdato={beregningsdato}
          onDownloadSpecifikation={onDownloadSpecifikation}
          committedById={committedRentekravById}
          onError={onError}
          beregningsdatoHasError={beregningsdatoHasError}
          referenceRates={referenceRates}
          surchargeRates={surchargeRates}
          saveOrderPath="renteberegning.rentekravRows"
        />
      </ContentBox>

      <ContentBox className="content-box">
        <Typography className="section-header">Kommentarer</Typography>
        <StyledTextField
          width={800}
          value={kommentarer ?? ''}
          onCommit={onKommentarerCommit}
          multiline
          rows={4}
          placeholder="Indtast eventuelle kommentarer her..."
        />
      </ContentBox>

      <ContentBox className="content-box">
        <Typography className="section-header">Beregningstekniske forudsætninger</Typography>
        <TechnicalAssumptionsList items={RENTE_CALCULATION_PRINCIPLES} />
      </ContentBox>
    </Box>
  );
});

RenteberegningTab.displayName = 'RenteberegningTab';

export default RenteberegningTab;
