import React from 'react';
import { Box, IconButton, Typography } from '@mui/material';
import { Download } from '@mui/icons-material';
import type { RateEntry } from '../../../data/interestRates';
import StyledDateField from '../../inputs/StyledDateField';
import InsertTodayDateButton from '../../inputs/InsertTodayDateButton';
import StyledTextField from '../../inputs/StyledTextField';
import BeregnetRenteTable from '../../tables/BeregnetRenteTable';
import { CellInvalidDraftScopeProvider } from '../../../contexts/CellInvalidDraftScopeContext';
import { CELL_TABLE_IDS } from '../../../config/cellInvalidDraftScopes';
import type { RentekravPdfContextMap } from '../../tables/BeregnetRenteTable';
import type { ContentBoxComponent } from '../../layout/ContentBoxFrame';
import type { RentekravRow } from '../../../schemas/formSchemas';
import type { ISODateString } from '../../../types/branded';
import type { RentekravDraftRow } from '../../../domain/renteberegning/tableDraftRows';
import type { RentePdfContext } from '../../tables/BeregnetRenteTable';
import { computeRentekravRow } from '../../../domain/renteberegning/renteberegningEngine';
import { isRentekravRowEmpty } from '../../../domain/renteberegning/rowEmpty';
import { createCommitEvent, type CommitHandler } from '../../../types/fieldEvents';
import { RENTE_CALCULATION_PRINCIPLES } from '../../../domain/renteberegning/renteCalculationPrinciples';
import { dateRanges_renteberegning } from '../../../config/dateRanges';
import SpecifikationDownloadBox from './SpecifikationDownloadBox';
import type { RenteOversigtRow } from '../../../document/generators/renteberegning/renteOversigtDocument';
import type { DocumentDownloadFormat } from '../../../document/documentFormat';

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
  onDownloadOversigt?: (rows: readonly RenteOversigtRow[], beregningsdato: ISODateString) => Promise<void>;
  oversigtErrorMessage?: string | null;
  showOversigtBox?: boolean;
  documentDownloadFormat: DocumentDownloadFormat;
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
  onDownloadOversigt,
  oversigtErrorMessage = null,
  showOversigtBox = false,
  documentDownloadFormat,
}: RenteberegningTabProps) => {
  const [beregningsdatoHasError, setBeregningsdatoHasError] = React.useState(false);
  const beregningsdatoInputRef = React.useRef<HTMLInputElement>(null);
  const [downloadAllIsLoading, setDownloadAllIsLoading] = React.useState(false);

  // §2.4 (renteberegning-contract): download-gaten beregnes auditerbart hos parent
  // DIREKTE fra committed input via den kanoniske computeRentekravRow — IKKE via
  // en child→parent callback der delvist fyrer fra draft-state. Tomme rækker springes
  // over; en ikke-tom række uden gyldig pdfContext (fx delvist udfyldt) markerer
  // anyRowHasError. Draft-kun dato-fejl (renterFraHasError) er bevidst EKSKLUDERET her.
  const { pdfContexts, anyRowHasError } = React.useMemo<{
    pdfContexts: RentekravPdfContextMap;
    anyRowHasError: boolean;
  }>(() => {
    const contexts = new Map<string, RentePdfContext>();
    let rowHasError = false;
    for (const [rowId, committedRow] of committedRentekravById) {
      if (isRentekravRowEmpty(committedRow)) continue;
      const { pdfContext } = computeRentekravRow(
        committedRow,
        beregningsdato,
        referenceRates,
        surchargeRates,
      );
      if (pdfContext !== null) {
        contexts.set(rowId, pdfContext);
      } else {
        rowHasError = true;
      }
    }
    return { pdfContexts: contexts, anyRowHasError: rowHasError };
  }, [committedRentekravById, beregningsdato, referenceRates, surchargeRates]);

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

  // Oversigts-download-gate:
  //  a) beregningsdato udfyldt og gyldig
  //  b) mindst én gyldig rente-linje
  //  c) ingen rente-linje med indtastning er ugyldig
  const oversigtDownloadDisabled =
    beregningsdato === undefined ||
    beregningsdatoHasError ||
    !hasValidPdfContexts ||
    anyRowHasError;

  const handleDownloadOversigt = React.useCallback(async () => {
    if (!onDownloadOversigt || beregningsdato === undefined) return;
    const rows: RenteOversigtRow[] = Array.from(pdfContexts.values()).map((ctx) => ({
      beloeb: ctx.beloeb,
      renterFra: ctx.actualInterestDate,
      beregnetRente: ctx.calculatedInterest,
    }));
    if (rows.length === 0) return;
    await onDownloadOversigt(rows, beregningsdato);
  }, [onDownloadOversigt, pdfContexts, beregningsdato]);

  // Vis kun oversigts-linjen på desktop (kalderen sætter showOversigtBox).
  const renderOversigtRow = showOversigtBox && onDownloadOversigt !== undefined && !isMobile;

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
          <CellInvalidDraftScopeProvider pageKey="renteberegning" tableId={CELL_TABLE_IDS.renteBeregnet}>
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
            documentDownloadFormat={documentDownloadFormat}
          />
          </CellInvalidDraftScopeProvider>
        </Box>
        {renderOversigtRow && (
          <>
            {oversigtErrorMessage && (
              <Box className="row--label-right-hover">
                <Typography className="row--text" sx={{ color: 'error.main' }}>
                  {oversigtErrorMessage}
                </Typography>
                <Box className="row--label-right-hover__content" />
              </Box>
            )}
            <Box className="row--label-right-hover">
              <Typography className="row--text">Download samlet oversigt</Typography>
              <Box className="row--label-right-hover__content">
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                  <IconButton
                    onClick={() => { void handleDownloadOversigt(); }}
                    disabled={oversigtDownloadDisabled}
                    aria-label="Download samlet oversigt"
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
                    <Download sx={{ fontSize: '24px', color: oversigtDownloadDisabled ? 'action.disabled' : 'primary.main' }} />
                  </IconButton>
                </Box>
              </Box>
            </Box>
          </>
        )}
      </ContentBoxComponent>

      {showDownloadAllBox && (
        <SpecifikationDownloadBox
          onDownloadAll={handleDownloadAll}
          errorMessage={downloadAllErrorMessage}
          isLoading={downloadAllIsLoading}
          disabled={downloadAllDisabled}
          ContentBoxComponent={ContentBoxComponent}
          documentDownloadFormat={documentDownloadFormat}
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
