import React from 'react';
import { Box, IconButton, Typography } from '@mui/material';
import { Delete } from '@mui/icons-material';
import ConfirmationDialog from '../../ui/ConfirmationDialog';
import type { RateEntry } from '../../../data/interestRates';
import GreenfieldDateField from '../../../inputCore/react/fields/GreenfieldDateField';
import GreenfieldMultilineTextField from '../../../inputCore/react/fields/GreenfieldMultilineTextField';
import InsertTodayDateButton from '../../inputs/InsertTodayDateButton';
import BeregnetRenteTable, { type RentekravPdfContextMap, type RentePdfContext } from '../../tables/BeregnetRenteTable';
import type { ContentBoxComponent } from '../../layout/ContentBoxFrame';
import type { ISODateString } from '../../../types/branded';
import { isRentekravRowEmpty } from '../../../domain/renteberegning/rowEmpty';
import { evaluateDownloadAllGate, evaluateOversigtDownloadGate } from '../../../domain/renteberegning/renteberegningDownloadGate';
import {
  buildRenteberegningReaderProjection,
  readRentekravCommittedRows,
} from '../../../domain/renteberegning/renteberegningReaderProjection';
import { RENTE_CALCULATION_PRINCIPLES } from '../../../domain/renteberegning/renteCalculationPrinciples';
import SpecifikationDownloadBox from './SpecifikationDownloadBox';
import DownloadIconButton from '../../inputs/DownloadIconButton';
import type { RenteOversigtRow } from '../../../document/generators/renteberegning/renteOversigtDocument';
import { DOWNLOAD_DISABLED_TOOLTIP, getDocumentFormatLabel, type DocumentDownloadFormat } from '../../../document/documentFormat';
import { documentGateFromBlockers } from '../../../domain/inputIntegrity/inputBlockerGate';
import { useInputEvaluation, useCriticalInputActions } from '../../../inputCore/react/useInputEvaluation';
import { useFieldEditor } from '../../../inputCore/react/useFieldEditor';
import { captureProductionEvaluationSource } from '../../../inputCore/react/productionInputRuntime';
import { useInputRuntime } from '../../../inputCore/react/inputRuntimeContext';
import { resetSection } from '../../../inputCore/inputReducer';
import { sourceTokensEqual } from '../../../inputCore/evaluationSource';
import {
  renteberegningBeregningsdatoField,
  renteberegningKommentarerField,
} from '../../../inputCore/catalog/renteberegningDescriptors';

// Greenfield-migreret RenteberegningTab (§2.4 trin 4 / §2.5 / Fase 3 Renteberegning-slice). Hele fanen kører nu på
// greenfield-inputCore: beregningsdato + kommentarer skriver/læser gennem den offentlige `InputReader` + den ene
// write-grænse (ingen `usePersistedForm`); rentekrav-tabellen ejer sine rækker via grid-adapteren; og den ENE
// reader-afledte projektion (`buildRenteberegningReaderProjection`) driver både tabeloutput og alle download-gates.
// Beregningstal og synlig adfærd er uændrede (§5.4).

interface TechnicalAssumptionsListProps {
  items: readonly string[];
}

const TechnicalAssumptionsList = ({ items }: TechnicalAssumptionsListProps) => (
  <>
    {items.map((item) => (
      <Typography className="row--text" key={item}>{item}</Typography>
    ))}
  </>
);

const beregningsdatoRef = renteberegningBeregningsdatoField.bind();
const kommentarerRef = renteberegningKommentarerField.bind();

export interface RenteberegningTabProps {
  onDownloadSpecifikation: (pdfContext: RentePdfContext, isSourceCurrent: () => boolean) => Promise<void>;
  referenceRates: ReadonlyArray<RateEntry>;
  surchargeRates: ReadonlyArray<RateEntry>;
  ContentBoxComponent: ContentBoxComponent;
  isMobile?: boolean;
  pdfErrorMessage: string | null;
  onDownloadAllSpecifikationer?: (
    contexts: RentekravPdfContextMap,
    isSourceCurrent: () => boolean
  ) => Promise<void>;
  downloadAllErrorMessage?: string | null;
  onDownloadOversigt?: (
    rows: readonly RenteOversigtRow[],
    beregningsdato: ISODateString,
    latestReferenceRateDate: ISODateString | null,
    isSourceCurrent: () => boolean,
  ) => Promise<void>;
  oversigtErrorMessage?: string | null;
  showOversigtBox?: boolean;
  documentDownloadFormat: DocumentDownloadFormat;
}

const RenteberegningTab = React.memo(({
  onDownloadSpecifikation,
  referenceRates,
  surchargeRates,
  ContentBoxComponent,
  isMobile = false,
  pdfErrorMessage,
  onDownloadAllSpecifikationer,
  downloadAllErrorMessage = null,
  onDownloadOversigt,
  oversigtErrorMessage = null,
  showOversigtBox = false,
  documentDownloadFormat,
}: RenteberegningTabProps) => {
  const runtime = useInputRuntime();
  const evaluation = useInputEvaluation();
  const criticalActions = useCriticalInputActions();
  const [downloadAllIsLoading, setDownloadAllIsLoading] = React.useState(false);
  const [clearAllDialogOpen, setClearAllDialogOpen] = React.useState(false);

  const beregningsdatoInputRef = React.useRef<HTMLInputElement>(null);
  const beregningsdatoController = useFieldEditor(beregningsdatoRef, { locationId: 'renteberegning:beregningsdato' });

  // Den ENE reader-afledte projektion (§3.4/§5.4) — tabeloutput og download-gates deler præcis samme sandhed.
  const projection = React.useMemo(
    () => buildRenteberegningReaderProjection({
      reader: evaluation.reader,
      referenceRates,
      surchargeRates,
      revision: evaluation.issues.sourceToken.inputRevision,
    }),
    [evaluation, referenceRates, surchargeRates]
  );

  const committedRows = React.useMemo(() => readRentekravCommittedRows(evaluation.reader), [evaluation]);
  const beregningsdatoRead = evaluation.reader.read(beregningsdatoRef);
  const beregningsdato = beregningsdatoRead.status === 'usable' ? beregningsdatoRead.value : undefined;
  const kommentarerRead = evaluation.reader.read(kommentarerRef);
  const kommentarer = kommentarerRead.status === 'usable' ? kommentarerRead.value : undefined;

  const aggregateData = projection.aggregateProjection.status === 'ready'
    ? projection.aggregateProjection.data
    : null;
  const hasValidPdfContexts = (aggregateData?.pdfContexts.size ?? 0) > 0;
  const anyRowHasError = aggregateData?.anyRowHasError ?? false;

  // En frisk projektion til en download (§3.9): efter settle genlæses et frisk kildesnapshot; er tokenet stale
  // (input/settings flyttede), returneres null og downloaden afbrydes.
  const captureFreshProjection = React.useCallback(() => {
    const source = captureProductionEvaluationSource();
    const fresh = buildRenteberegningReaderProjection({
      reader: source.evaluation.reader,
      referenceRates,
      surchargeRates,
      revision: source.evaluation.issues.sourceToken.inputRevision,
    });
    const freshBeregningsdatoRead = source.evaluation.reader.read(beregningsdatoRef);
    const freshBeregningsdato = freshBeregningsdatoRead.status === 'usable' ? freshBeregningsdatoRead.value : undefined;
    return { source, fresh, freshBeregningsdato, isSourceCurrent: source.isSourceCurrent };
  }, [referenceRates, surchargeRates]);

  const handleDownloadRow = React.useCallback(async (rowId: string) => {
    const preparation = await criticalActions.prepare('download');
    if (preparation.status !== 'committed') {
      if (preparation.status === 'blocked') preparation.target?.focus();
      return;
    }
    const { source, fresh, isSourceCurrent } = captureFreshProjection();
    if (!sourceTokensEqual(preparation.token, source.evaluation.issues.sourceToken)) return;
    const rowProjection = fresh.rowProjections.get(rowId);
    if (rowProjection?.status !== 'ready' || rowProjection.data.pdfContext === null) return;
    await onDownloadSpecifikation(rowProjection.data.pdfContext, isSourceCurrent);
  }, [captureFreshProjection, criticalActions, onDownloadSpecifikation]);

  const handleDownloadAll = React.useCallback(async () => {
    if (!onDownloadAllSpecifikationer) return;
    const preparation = await criticalActions.prepare('download');
    if (preparation.status !== 'committed') {
      if (preparation.status === 'blocked') preparation.target?.focus();
      return;
    }
    const { source, fresh, isSourceCurrent } = captureFreshProjection();
    if (!sourceTokensEqual(preparation.token, source.evaluation.issues.sourceToken)) return;
    if (fresh.aggregateProjection.status !== 'ready') return;
    const latest = fresh.aggregateProjection;
    const gate = evaluateDownloadAllGate({
      hasValidPdfContexts: latest.data.pdfContexts.size > 0,
      anyRowHasError: latest.data.anyRowHasError,
      beregningsdatoHasError: false,
    });
    if (!gate.canDownload) return;

    setDownloadAllIsLoading(true);
    try {
      await onDownloadAllSpecifikationer(latest.data.pdfContexts, isSourceCurrent);
    } finally {
      setDownloadAllIsLoading(false);
    }
  }, [captureFreshProjection, criticalActions, onDownloadAllSpecifikationer]);

  const handleDownloadOversigt = React.useCallback(async () => {
    if (!onDownloadOversigt) return;
    const preparation = await criticalActions.prepare('download');
    if (preparation.status !== 'committed') {
      if (preparation.status === 'blocked') preparation.target?.focus();
      return;
    }
    const { source, fresh, freshBeregningsdato, isSourceCurrent } = captureFreshProjection();
    if (!sourceTokensEqual(preparation.token, source.evaluation.issues.sourceToken)) return;
    if (freshBeregningsdato === undefined) return;
    if (fresh.aggregateProjection.status !== 'ready') return;
    const latest = fresh.aggregateProjection;
    const gate = evaluateOversigtDownloadGate({
      beregningsdato: freshBeregningsdato,
      hasValidPdfContexts: latest.data.pdfContexts.size > 0,
      anyRowHasError: latest.data.anyRowHasError,
      beregningsdatoHasError: false,
    });
    if (!gate.canDownload) return;

    let latestReferenceRateDate: ISODateString | null = null;
    const rows: RenteOversigtRow[] = Array.from(latest.data.pdfContexts.values()).map((ctx) => ({
      beloeb: ctx.beloeb,
      renterFra: ctx.actualInterestDate,
      beregnetRente: ctx.calculatedInterest,
    }));
    for (const ctx of latest.data.pdfContexts.values()) {
      if (ctx.latestReferenceRateDate === null) continue;
      if (latestReferenceRateDate === null || ctx.latestReferenceRateDate > latestReferenceRateDate) {
        latestReferenceRateDate = ctx.latestReferenceRateDate;
      }
    }
    if (rows.length === 0) return;
    await onDownloadOversigt(rows, freshBeregningsdato, latestReferenceRateDate, isSourceCurrent);
  }, [captureFreshProjection, criticalActions, onDownloadOversigt]);

  // Download-gates (§A2): committed-afledte via den reader-projektion, som cellerne allerede afspejler.
  const downloadAllGate = React.useMemo(() => {
    if (projection.aggregateProjection.status === 'blocked') {
      return documentGateFromBlockers(projection.aggregateProjection.blockers, 'renteberegning');
    }
    return evaluateDownloadAllGate({ hasValidPdfContexts, anyRowHasError, beregningsdatoHasError: false });
  }, [anyRowHasError, hasValidPdfContexts, projection.aggregateProjection]);
  const downloadAllDisabled = !downloadAllGate.canDownload || downloadAllIsLoading;

  const oversigtDownloadGate = React.useMemo(() => {
    if (projection.aggregateProjection.status === 'blocked') {
      return documentGateFromBlockers(projection.aggregateProjection.blockers, 'renteberegning');
    }
    return evaluateOversigtDownloadGate({ beregningsdato, hasValidPdfContexts, anyRowHasError, beregningsdatoHasError: false });
  }, [anyRowHasError, beregningsdato, hasValidPdfContexts, projection.aggregateProjection]);
  const oversigtDownloadDisabled = !oversigtDownloadGate.canDownload;

  const showDownloadAllBox = isMobile && onDownloadAllSpecifikationer !== undefined;
  const renderOversigtRow = showOversigtBox && onDownloadOversigt !== undefined && !isMobile;
  const renderClearAllRow = !isMobile;

  // Slet-knappen deaktiveres når der intet er at slette (afgøres KUN fra afsluttet/committed state).
  const hasAnyCommittedInput = React.useMemo(() => {
    if (beregningsdato !== undefined) return true;
    if (kommentarer !== undefined && kommentarer.trim() !== '') return true;
    return committedRows.some((row) => !isRentekravRowEmpty(row));
  }, [beregningsdato, committedRows, kommentarer]);
  const clearAllDisabled = !hasAnyCommittedInput;

  const handleClearAll = React.useCallback(() => {
    // §1.4: reset gennemføres uden settle. ConfirmationDialog betyder ingen åben editor, så en direkte
    // resetSection gennem system-porten er tilstrækkelig (undoable, som legacy resetForm).
    runtime.resetSection(resetSection('renteberegning', { rentekravRows: [] }));
  }, [runtime]);

  return (
    <Box>
      <ContentBoxComponent className="content-box content-box--beregningsdato">
        <Typography className="section-header">Beregningsdato</Typography>
        <Box className="row--label-right-hover">
          <Typography className="row--text">Rente beregnes til og med</Typography>
          <Box className="row--label-right-hover__content">
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <GreenfieldDateField
                field={beregningsdatoRef}
                location={{ locationId: 'renteberegning:beregningsdato' }}
                name="beregningsdato"
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
                  beregningsdatoController.commitImmediate(today);
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
            committedRows={committedRows}
            rowProjections={projection.rowProjections}
            onDownloadSpecifikation={handleDownloadRow}
            saveOrderPath="renteberegning.rentekravRows"
            isMobile={isMobile}
            documentDownloadFormat={documentDownloadFormat}
          />
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
                  <DownloadIconButton
                    onClick={() => { void handleDownloadOversigt(); }}
                    disabled={oversigtDownloadDisabled}
                    tooltip={oversigtDownloadDisabled ? DOWNLOAD_DISABLED_TOOLTIP : `Download som ${getDocumentFormatLabel(documentDownloadFormat)}`}
                    ariaLabel="Download samlet oversigt"
                  />
                </Box>
              </Box>
            </Box>
          </>
        )}
        {renderClearAllRow && (
          <Box className="row--label-right-hover">
            <Typography className="row--text">Slet alle indtastninger</Typography>
            <Box className="row--label-right-hover__content">
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                <IconButton
                  onClick={() => setClearAllDialogOpen(true)}
                  disabled={clearAllDisabled}
                  aria-label="Slet alle indtastninger"
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
                  {/* Bevidst dæmpet rød — blødere signal for en destruktiv, men sjælden handling. */}
                  <Delete sx={{ fontSize: '24px', color: clearAllDisabled ? 'action.disabled' : '#c25555' }} />
                </IconButton>
              </Box>
            </Box>
          </Box>
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
        <GreenfieldMultilineTextField
          field={kommentarerRef}
          location={{ locationId: 'renteberegning:kommentarer' }}
          name="kommentarer"
          width="min(800px, 100%)"
          rows={isMobile ? 3 : 4}
          singleStageClick={isMobile}
          placeholder="Indtast eventuelle kommentarer her..."
          sx={isMobile ? { fontSize: 'var(--minprocesrente-mobile-content-font-size)' } : undefined}
        />
      </ContentBoxComponent>

      <ContentBoxComponent className="content-box flow--16">
        <Typography className="section-header">Beregningstekniske forudsætninger</Typography>
        <TechnicalAssumptionsList items={RENTE_CALCULATION_PRINCIPLES} />
      </ContentBoxComponent>

      {renderClearAllRow && (
        <ConfirmationDialog
          open={clearAllDialogOpen}
          title="Slet alle indtastninger"
          message={(
            <>
              Dette sletter alle de værdier, du har indtastet. Handlingen kan fortrydes.
              <br />
              <br />
              Bekræft venligst.
            </>
          )}
          confirmText="Ja, slet"
          cancelText="Annuller"
          confirmColor="error"
          onConfirm={() => {
            handleClearAll();
            setClearAllDialogOpen(false);
          }}
          onCancel={() => setClearAllDialogOpen(false)}
        />
      )}
    </Box>
  );
});

RenteberegningTab.displayName = 'RenteberegningTab';

export default RenteberegningTab;
