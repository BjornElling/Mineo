import React from 'react';
import { Box, IconButton, Typography } from '@mui/material';
import { Delete } from '@mui/icons-material';
import ConfirmationDialog from '../../ui/ConfirmationDialog';
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
import { isRentekravRowEmpty } from '../../../domain/renteberegning/rowEmpty';
import { evaluateDownloadAllGate, evaluateOversigtDownloadGate } from '../../../domain/renteberegning/renteberegningDownloadGate';
import { buildRenteberegningInputProjection } from '../../../domain/renteberegning/renteberegningInputProjection';
import {
  getCommittedChangeCounterSnapshot,
  getInvalidDraftsForSectionSnapshot,
  getPersistedSectionSnapshot,
  useCombinedSectionRevisionSelector,
  useInvalidDraftsForSectionSelector,
} from '../../../hooks/useFormPersistenceSelectors';
import { useFormFieldErrorReporter } from '../../../hooks/useFormFieldErrors';
import { createCommitEvent, type CommitHandler } from '../../../types/fieldEvents';
import { RENTE_CALCULATION_PRINCIPLES } from '../../../domain/renteberegning/renteCalculationPrinciples';
import { dateRanges_renteberegning } from '../../../config/dateRanges';
import SpecifikationDownloadBox from './SpecifikationDownloadBox';
import DownloadIconButton from '../../inputs/DownloadIconButton';
import type { RenteOversigtRow } from '../../../document/generators/renteberegning/renteOversigtDocument';
import { DOWNLOAD_DISABLED_TOOLTIP, getDocumentFormatLabel, type DocumentDownloadFormat } from '../../../document/documentFormat';
import { documentGateFromBlockers } from '../../../domain/inputIntegrity/inputBlockerGate';
import type { ReadyInputRevision } from '../../../domain/inputIntegrity/inputBlocker';
import { useOptionalCriticalActionCoordinator } from '../../../criticalActions/CriticalActionContext';

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

export interface RenteberegningTabProps {
  beregningsdato: ISODateString | undefined;
  kommentarer: string | undefined;
  onBeregningsdatoCommit: CommitHandler<ISODateString | undefined>;
  onKommentarerCommit: CommitHandler<string>;
  rentekravRows: RentekravDraftRow[];
  onRentekravChange: (rowId: string, fieldId: 'belob' | 'renterFra' | 'tillaegstid' | 'enhed') => (value: string) => void;
  onRentekravBlur: (rowId: string) => void;
  /** Sletter hele rentekrav-rækken i én undo-handling (committed removeRow fra useRentekravRows). */
  onRentekravDelete?: (rowId: string) => void;
  onRentekravReorder: (orderedIds: readonly string[]) => void;
  onDownloadSpecifikation: (pdfContext: RentePdfContext, inputRevision: ReadyInputRevision) => Promise<void>;
  committedRentekravById: ReadonlyMap<string, RentekravRow>;
  onError: (message: string, context: string, error?: unknown) => void;
  pdfErrorMessage: string | null;
  referenceRates: ReadonlyArray<RateEntry>;
  surchargeRates: ReadonlyArray<RateEntry>;
  ContentBoxComponent: ContentBoxComponent;
  isMobile?: boolean;
  onDownloadAllSpecifikationer?: (
    contexts: RentekravPdfContextMap,
    inputRevision: ReadyInputRevision
  ) => Promise<void>;
  downloadAllErrorMessage?: string | null;
  onDownloadOversigt?: (
    rows: readonly RenteOversigtRow[],
    beregningsdato: ISODateString,
    latestReferenceRateDate: ISODateString | null,
    inputRevision: ReadyInputRevision,
  ) => Promise<void>;
  oversigtErrorMessage?: string | null;
  showOversigtBox?: boolean;
  /**
   * Nulstiller alle indtastninger på renteberegning-siden til defaults. Når sat (kun på
   * desktop-kalderne) vises "Slet alle indtastninger"-rækken under oversigts-download.
   * Bevidst kun desktop: følger samme synlighed som oversigts-rækken (jf. !isMobile).
   */
  onClearAll?: () => void;
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
  onRentekravDelete,
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
  onClearAll,
  documentDownloadFormat,
}: RenteberegningTabProps) => {
  const beregningsdatoInputRef = React.useRef<HTMLInputElement>(null);
  const [downloadAllIsLoading, setDownloadAllIsLoading] = React.useState(false);
  const [clearAllDialogOpen, setClearAllDialogOpen] = React.useState(false);
  const criticalActions = useOptionalCriticalActionCoordinator();
  const inputRevision = useCombinedSectionRevisionSelector();

  // Binding af beregningsdato til invalidDrafts (obligatorisk for persisterede sagsfelter, jf.
  // mineo-field-pattern.md "Felt-identitets-API" punkt 5). Erstatter den lokale beregningsdatoHasError-
  // boolean, der pr. design var blank for uparseligt format (visualErrorMessage tvinges til '') og
  // derfor ikke kunne gate download (document-output-contract.md §A2.1). Reporteren er router-fri, så
  // den også virker i den routerløse standalone minProcesrente-app.
  const beregningsdatoErrorReporter = useFormFieldErrorReporter('renteberegning', 'beregningsdato');

  // Samme revisionsbundne projektion driver tabeloutput og dokumentgates. Blokerede rækker kalder
  // aldrig beregningsmotoren med den tidligere canonical værdi bag masken.
  const renteInvalidDrafts = useInvalidDraftsForSectionSelector('renteberegning');
  const inputProjection = React.useMemo(
    () => buildRenteberegningInputProjection({
      beregningsdato,
      committedRentekravById,
      invalidDrafts: renteInvalidDrafts,
      referenceRates,
      surchargeRates,
      revision: inputRevision,
    }),
    [
      beregningsdato,
      committedRentekravById,
      inputRevision,
      referenceRates,
      renteInvalidDrafts,
      surchargeRates,
    ]
  );
  const aggregateData = inputProjection.aggregateProjection.status === 'ready'
    ? inputProjection.aggregateProjection.data
    : null;
  const pdfContexts: RentekravPdfContextMap = aggregateData?.pdfContexts ?? new Map();
  const anyRowHasError = aggregateData?.anyRowHasError ?? false;

  const handleDownloadAll = React.useCallback(async () => {
    if (!onDownloadAllSpecifikationer) return;
    const preparation = criticalActions === null
      ? { status: 'committed' as const }
      : await criticalActions.prepare('download');
    if (preparation.status === 'blocked') {
      preparation.target?.focus();
      return;
    }

    const latestValues = criticalActions === null ? null : getPersistedSectionSnapshot('renteberegning');
    const latestProjection = latestValues === null
      ? inputProjection
      : buildRenteberegningInputProjection({
          beregningsdato: latestValues.beregningsdato,
          committedRentekravById: new Map(latestValues.rentekravRows.map((row) => [row.id, row])),
          invalidDrafts: getInvalidDraftsForSectionSnapshot('renteberegning'),
          referenceRates,
          surchargeRates,
          revision: getCommittedChangeCounterSnapshot(),
        });
    if (latestProjection.aggregateProjection.status === 'blocked') return;
    const latest = latestProjection.aggregateProjection;
    const gate = evaluateDownloadAllGate({
      hasValidPdfContexts: latest.data.pdfContexts.size > 0,
      anyRowHasError: latest.data.anyRowHasError,
      beregningsdatoHasError: false,
    });
    if (!gate.canDownload) return;

    setDownloadAllIsLoading(true);
    try {
      await onDownloadAllSpecifikationer(latest.data.pdfContexts, latest.revision);
    } finally {
      setDownloadAllIsLoading(false);
    }
  }, [criticalActions, inputProjection, onDownloadAllSpecifikationer, referenceRates, surchargeRates]);

  // hasValidPdfContexts: mindst én række med fuldt beregnet pdfContext (belob + renterFra gyldige og beregning ok)
  const hasValidPdfContexts = pdfContexts.size > 0;

  // Begge download-gates bygges på det fælles documentGateTypes-primitiv (dokument-
  // output-kontrakt §A2): committed-only-reglen er nu konstruktion, ikke kommentar.
  // Gate-funktionerne er rene og committed-afledte; loading-tilstanden er en separat
  // UI-transient der OR'es på download-alle-knappens disabled nedenfor.
  // Aggregat-downloads blokeres af ENHVER afsluttet ugyldig input (global eller en hvilken som helst
  // rækkes celle) — en samlet oversigt/alle-download inkluderer alle rækker. `hasAnyInputBlocker`
  // erstatter den gamle beregningsdatoHasError-boolean som output-sandhedskilde (§A2.1).
  const downloadAllGate = React.useMemo(() => {
    if (inputProjection.aggregateProjection.status === 'blocked') {
      return documentGateFromBlockers(inputProjection.aggregateProjection.blockers, 'renteberegning');
    }
    return evaluateDownloadAllGate({ hasValidPdfContexts, anyRowHasError, beregningsdatoHasError: false });
  }, [anyRowHasError, hasValidPdfContexts, inputProjection.aggregateProjection]);
  const downloadAllDisabled = !downloadAllGate.canDownload || downloadAllIsLoading;

  const showDownloadAllBox = isMobile && onDownloadAllSpecifikationer !== undefined;

  const oversigtDownloadGate = React.useMemo(() => {
    if (inputProjection.aggregateProjection.status === 'blocked') {
      return documentGateFromBlockers(inputProjection.aggregateProjection.blockers, 'renteberegning');
    }
    return evaluateOversigtDownloadGate({
      beregningsdato,
      hasValidPdfContexts,
      anyRowHasError,
      beregningsdatoHasError: false,
    });
  }, [anyRowHasError, beregningsdato, hasValidPdfContexts, inputProjection.aggregateProjection]);
  const oversigtDownloadDisabled = !oversigtDownloadGate.canDownload;

  const handleDownloadOversigt = React.useCallback(async () => {
    if (!onDownloadOversigt) return;
    const preparation = criticalActions === null
      ? { status: 'committed' as const }
      : await criticalActions.prepare('download');
    if (preparation.status === 'blocked') {
      preparation.target?.focus();
      return;
    }

    const latestValues = criticalActions === null ? null : getPersistedSectionSnapshot('renteberegning');
    const latestBeregningsdato = latestValues?.beregningsdato ?? beregningsdato;
    if (latestBeregningsdato === undefined) return;
    const latestProjection = latestValues === null
      ? inputProjection
      : buildRenteberegningInputProjection({
          beregningsdato: latestBeregningsdato,
          committedRentekravById: new Map(latestValues.rentekravRows.map((row) => [row.id, row])),
          invalidDrafts: getInvalidDraftsForSectionSnapshot('renteberegning'),
          referenceRates,
          surchargeRates,
          revision: getCommittedChangeCounterSnapshot(),
        });
    if (latestProjection.aggregateProjection.status === 'blocked') return;
    const latest = latestProjection.aggregateProjection;
    const gate = evaluateOversigtDownloadGate({
      beregningsdato: latestBeregningsdato,
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
    await onDownloadOversigt(rows, latestBeregningsdato, latestReferenceRateDate, latest.revision);
  }, [
    beregningsdato,
    criticalActions,
    inputProjection,
    onDownloadOversigt,
    referenceRates,
    surchargeRates,
  ]);

  // Vis kun oversigts-linjen på desktop (kalderen sætter showOversigtBox).
  const renderOversigtRow = showOversigtBox && onDownloadOversigt !== undefined && !isMobile;

  // "Slet alle indtastninger" vises kun på desktop (samme synlighed som oversigts-rækken)
  // og kun når kalderen leverer en nulstil-handler.
  const renderClearAllRow = onClearAll !== undefined && !isMobile;

  // Deaktivér slet-knappen når der intet er at slette. Afgøres KUN fra committed state
  // (jf. form-contract: ingen afledt feedback fra draft): beregningsdato, kommentarer og
  // alle committed rentekrav-rækker skal være tomme. 'enhed' tæller ikke (jf. isRentekravRowEmpty).
  const hasAnyCommittedInput = React.useMemo(() => {
    if (beregningsdato !== undefined) return true;
    if (kommentarer !== undefined && kommentarer.trim() !== '') return true;
    for (const committedRow of committedRentekravById.values()) {
      if (!isRentekravRowEmpty(committedRow)) return true;
    }
    return false;
  }, [beregningsdato, kommentarer, committedRentekravById]);
  const clearAllDisabled = !hasAnyCommittedInput;

  const handleDownloadRow = React.useCallback(async (rowId: string) => {
    const preparation = criticalActions === null
      ? { status: 'committed' as const }
      : await criticalActions.prepare('download');
    if (preparation.status === 'blocked') {
      preparation.target?.focus();
      return;
    }

    const latestValues = criticalActions === null ? null : getPersistedSectionSnapshot('renteberegning');
    const latestProjection = latestValues === null
      ? inputProjection
      : buildRenteberegningInputProjection({
          beregningsdato: latestValues.beregningsdato,
          committedRentekravById: new Map(latestValues.rentekravRows.map((row) => [row.id, row])),
          invalidDrafts: getInvalidDraftsForSectionSnapshot('renteberegning'),
          referenceRates,
          surchargeRates,
          revision: getCommittedChangeCounterSnapshot(),
        });
    const rowProjection = latestProjection.rowProjections.get(rowId);
    if (rowProjection?.status !== 'ready' || rowProjection.data.pdfContext === null) return;
    await onDownloadSpecifikation(rowProjection.data.pdfContext, rowProjection.revision);
  }, [
    criticalActions,
    inputProjection,
    onDownloadSpecifikation,
    referenceRates,
    surchargeRates,
  ]);

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
                onFieldError={beregningsdatoErrorReporter}
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
            onDeleteRow={onRentekravDelete}
            onRowsReorder={onRentekravReorder}
            beregningsdato={beregningsdato}
            onDownloadSpecifikation={handleDownloadRow}
            committedById={committedRentekravById}
            onError={onError}
            rowProjections={inputProjection.rowProjections}
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
                  {/* Bevidst dæmpet rød (mellem støvet og temaets kraftige error.main) — blødere
                      signal for en destruktiv, men sjælden handling. Deaktiveret: samme grå som
                      download-ikonet (action.disabled). */}
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
            onClearAll?.();
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
