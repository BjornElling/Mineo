import React from 'react';
import { Box, Typography } from '@mui/material';
import type { RateEntry } from '../../../data/interestRates';
import StyledDateField from '../../inputs/StyledDateField';
import InsertTodayDateButton from '../../inputs/InsertTodayDateButton';
import StyledTextField from '../../inputs/StyledTextField';
import BeregnetRenteTable from '../../tables/BeregnetRenteTable';
import type { RentekravPdfContextMap } from '../../tables/BeregnetRenteTable';
import type { ContentBoxFrameProps, ContentBoxComponent } from '../../layout/ContentBoxFrame';
import type { RentekravRow } from '../../../schemas/formSchemas';
import type { ISODateString } from '../../../types/branded';
import type { RentekravDraftRow } from '../../../domain/renteberegning/tableDraftRows';
import type { RentePdfContext } from '../../tables/BeregnetRenteTable';
import { createCommitEvent, type CommitHandler } from '../../../types/fieldEvents';
import { RENTE_CALCULATION_PRINCIPLES } from '../../../domain/renteberegning/renteCalculationPrinciples';
import { dateRanges_renteberegning } from '../../../config/dateRanges';
import SpecifikationDownloadBox from './SpecifikationDownloadBox';

interface TechnicalAssumptionsListProps {
  items: readonly string[];
}

const TechnicalAssumptionsList = ({ items }: TechnicalAssumptionsListProps) => (
  <Box>
    {items.map((item) => (
      <Box className="row--label-right-hover" key={item}>
        <Typography className="row--text">{item}</Typography>
        <Box className="row--label-right-hover__content" />
      </Box>
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
  ContentBoxComponent: ContentBoxComponent;
  isMobile?: boolean;
  onDownloadAllSpecifikationer?: (contexts: RentekravPdfContextMap) => Promise<void>;
  downloadAllErrorMessage?: string | null;
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
  ContentBoxComponent,
  isMobile = false,
  onDownloadAllSpecifikationer,
  downloadAllErrorMessage = null,
}: RenteberegningTabProps) => {
  const [beregningsdatoHasError, setBeregningsdatoHasError] = React.useState(false);
  const beregningsdatoInputRef = React.useRef<HTMLInputElement>(null);
  const [downloadAllIsLoading, setDownloadAllIsLoading] = React.useState(false);
  const [pdfContexts, setPdfContexts] = React.useState<RentekravPdfContextMap>(new Map());
  const [anyRowHasError, setAnyRowHasError] = React.useState(false);

  const handlePdfContextsChange = React.useCallback((
    contexts: RentekravPdfContextMap,
    rowHasError: boolean,
  ) => {
    setPdfContexts(contexts);
    setAnyRowHasError(rowHasError);
  }, []);

  const handleDownloadAll = React.useCallback(async () => {
    if (!onDownloadAllSpecifikationer) return;
    setDownloadAllIsLoading(true);
    try {
      await onDownloadAllSpecifikationer(pdfContexts);
    } finally {
      setDownloadAllIsLoading(false);
    }
  }, [onDownloadAllSpecifikationer, pdfContexts]);

  // hasValidPdfContexts: mindst én række med fuldt beregnet pdfContext (belob + renterFra gyldige og beregning ok)
  const hasValidPdfContexts = pdfContexts.size > 0;

  const downloadAllDisabled =
    !hasValidPdfContexts ||
    anyRowHasError ||
    beregningsdatoHasError ||
    downloadAllIsLoading;

  const showDownloadAllBox = isMobile && onDownloadAllSpecifikationer !== undefined;

  return (
    <Box>
      <ContentBoxComponent className="content-box content-box--beregningsdato">
        <Typography className="section-header">Beregningsdato</Typography>
        <Box className="row--label-right-hover">
          <Typography className="row--text">Rente beregnes til og med</Typography>
          <Box className="row--label-right-hover__content">
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <StyledDateField
                name="beregningsdato"
                value={beregningsdato}
                onCommit={onBeregningsdatoCommit}
                minDate={dateRanges_renteberegning.renteTil.min}
                maxDate={dateRanges_renteberegning.renteTil.max}
                onFieldError={(errorMsg) => setBeregningsdatoHasError(!!errorMsg)}
                inputRef={beregningsdatoInputRef}
                width={isMobile ? 110 : 130}
                singleStageClick={isMobile}
                sx={isMobile
                  ? {
                    '& .MuiInputBase-root': {
                      fontSize: 'var(--minprocesrente-mobile-content-font-size)',
                      fontVariantNumeric: 'tabular-nums',
                      lineHeight: 'var(--line-height-base)',
                    },
                    '& .MuiInputBase-input': {
                      fontSize: 'var(--minprocesrente-mobile-content-font-size)',
                      fontVariantNumeric: 'tabular-nums',
                      lineHeight: 'var(--line-height-base)',
                      textAlign: 'center',
                    },
                  }
                  : undefined}
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
      </ContentBoxComponent>

      <ContentBoxComponent className="content-box">
        <Typography className="section-header">Beregnet rente</Typography>
        {pdfErrorMessage && (
          <Box className="row--label-right-hover">
            <Typography className="row--text" sx={{ color: 'error.main' }}>
              {pdfErrorMessage}
            </Typography>
            <Box className="row--label-right-hover__content" />
          </Box>
        )}
        <Box sx={{ width: '100%', overflowX: { xs: 'hidden', sm: 'auto' }, overflowY: 'hidden' }}>
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
            isMobile={isMobile}
            onPdfContextsChange={handlePdfContextsChange}
          />
        </Box>
      </ContentBoxComponent>

      {showDownloadAllBox && (
        <SpecifikationDownloadBox
          onDownloadAll={handleDownloadAll}
          errorMessage={downloadAllErrorMessage}
          isLoading={downloadAllIsLoading}
          disabled={downloadAllDisabled}
          ContentBoxComponent={ContentBoxComponent}
        />
      )}

      <ContentBoxComponent className="content-box">
        <Typography className="section-header">Kommentarer</Typography>
        <StyledTextField
          name="kommentarer"
          width="min(800px, 100%)"
          value={kommentarer ?? ''}
          onCommit={onKommentarerCommit}
          multiline
          rows={isMobile ? 3 : 4}
          singleStageClick={isMobile}
          placeholder="Indtast eventuelle kommentarer her..."
          sx={isMobile ? { fontSize: 'var(--minprocesrente-mobile-content-font-size)' } : undefined}
        />
      </ContentBoxComponent>

      <ContentBoxComponent className="content-box">
        <Typography className="section-header">Beregningstekniske forudsætninger</Typography>
        <TechnicalAssumptionsList items={RENTE_CALCULATION_PRINCIPLES} />
      </ContentBoxComponent>
    </Box>
  );
});

RenteberegningTab.displayName = 'RenteberegningTab';

export default RenteberegningTab;
