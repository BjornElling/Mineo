import React from 'react';
import { Box, IconButton, Typography } from '@mui/material';
import { Delete } from '@mui/icons-material';
import ConfirmationDialog from '../../ui/ConfirmationDialog';
import type { RateEntry } from '../../../data/interestRates';
import DateField from '../../../inputCore/react/fields/DateField';
import MultilineTextField from '../../../inputCore/react/fields/MultilineTextField';
import InsertTodayDateButton from '../../inputs/InsertTodayDateButton';
import BeregnetRenteTable from '../../tables/BeregnetRenteTable';
import type { ContentBoxComponent } from '../../layout/ContentBoxFrame';
import { isRentekravRowEmpty } from '../../../domain/renteberegning/rowEmpty';
import type { DocumentDownloadHandle } from '../../../document/definition/react/useDocumentDownload';
import {
  buildRenteberegningReaderProjection,
  readRentekravCommittedRows,
} from '../../../domain/renteberegning/renteberegningReaderProjection';
import { RENTE_CALCULATION_PRINCIPLES } from '../../../domain/renteberegning/renteCalculationPrinciples';
import SpecifikationDownloadBox from './SpecifikationDownloadBox';
import DownloadIconButton from '../../inputs/DownloadIconButton';
import { DOWNLOAD_DISABLED_TOOLTIP, getDocumentFormatLabel, type DocumentDownloadFormat } from '../../../document/documentFormat';
import { useInputEvaluation, useCriticalInputActions } from '../../../inputCore/react/useInputEvaluation';
import { useFieldEditor } from '../../../inputCore/react/useFieldEditor';
import { useSectionReset } from '../../../inputCore/react/inputRuntimeContext';
import { resetSection } from '../../../inputCore/inputReducer';
import {
  renteberegningBeregningsdatoField,
  renteberegningKommentarerField,
} from '../../../inputCore/catalog/renteberegningDescriptors';
import { APP_ROUTES, PAGE_DEFAULT_TAB } from '../../../config/pageNavigation';

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

// route + tabKey er eksplicit navigation-metadata (§3.7). Denne tab-komponent renderes kun under calculation-fanen.
const BEREGNINGSDATO_LOCATION = { locationId: 'renteberegning:beregningsdato', route: APP_ROUTES.renteberegning, tabKey: PAGE_DEFAULT_TAB.renteberegning } as const;
const KOMMENTARER_LOCATION = { locationId: 'renteberegning:kommentarer', route: APP_ROUTES.renteberegning, tabKey: PAGE_DEFAULT_TAB.renteberegning } as const;

/**
 * Fanen deles af Mineo og standalone MinProcesrente, som har hvert sit
 * `DocumentExecutionEnvironment` (format, brevhoved, failure-sink). Derfor modtager den FÆRDIGE
 * dokumenthandles som props frem for at komponere dem selv: den ejende side kender sin app, fanen
 * gør ikke.
 *
 * Før Fase 5 modtog fanen i stedet tre `onDownload*`-callbacks og skrev SELV hele preflighten
 * (settle → capture → token-lighed → gate) — fire gange, én pr. handler plus de reaktive gates.
 * Alt det ligger nu i definitionerne.
 */
export interface RenteberegningTabProps {
  /**
   * Rækkespecifikationen. BÅDE aktiveringen og rækkeknappens reaktive gate går gennem dette handle
   * med rækkens EGEN id (`gateFor({ rowId })` / `download({ rowId })`), så §A2's krav om samme
   * definition og samme request holder pr. række.
   */
  renteDownload: DocumentDownloadHandle<Readonly<{ rowId: string }>>;
  referenceRates: ReadonlyArray<RateEntry>;
  surchargeRates: ReadonlyArray<RateEntry>;
  ContentBoxComponent: ContentBoxComponent;
  isMobile?: boolean;
  /** Alle specifikationer i ét dokument. Kun standalone (mobil) har dette output. */
  renteAlleDownload?: DocumentDownloadHandle<void>;
  /** Oversigtstabellen. */
  renteOversigtDownload?: DocumentDownloadHandle<void>;
  showOversigtBox?: boolean;
  documentDownloadFormat: DocumentDownloadFormat;
}

const RenteberegningTab = React.memo(({
  renteDownload,
  referenceRates,
  surchargeRates,
  ContentBoxComponent,
  isMobile = false,
  renteAlleDownload,
  renteOversigtDownload,
  showOversigtBox = false,
  documentDownloadFormat,
}: RenteberegningTabProps) => {
  const dispatchSectionReset = useSectionReset();
  const evaluation = useInputEvaluation();
  const criticalActions = useCriticalInputActions();
  const [downloadAllIsLoading, setDownloadAllIsLoading] = React.useState(false);
  const [clearAllDialogOpen, setClearAllDialogOpen] = React.useState(false);

  const beregningsdatoInputRef = React.useRef<HTMLInputElement>(null);
  const beregningsdatoController = useFieldEditor(beregningsdatoRef, BEREGNINGSDATO_LOCATION);

  // Den ENE reader-afledte projektion (§3.4/§5.4) — tabeloutput og download-gates deler præcis samme sandhed.
  const projection = React.useMemo(
    () => buildRenteberegningReaderProjection({
      reader: evaluation.reader,
      referenceRates,
      surchargeRates,
    }),
    [evaluation, referenceRates, surchargeRates]
  );

  const committedRows = React.useMemo(() => readRentekravCommittedRows(evaluation.reader), [evaluation]);
  const beregningsdatoRead = evaluation.reader.read(beregningsdatoRef);
  const beregningsdato = beregningsdatoRead.status === 'usable' ? beregningsdatoRead.value : undefined;
  const kommentarerRead = evaluation.reader.read(kommentarerRef);
  const kommentarer = kommentarerRead.status === 'usable' ? kommentarerRead.value : undefined;

  // Preflighten (settle → frisk capture → token-lighed → gate) ejes af definitionerne. Det eneste,
  // der er tilbage her, er "vis en spinner mens det samlede dokument bygges" — ren præsentation.
  const handleDownloadRow = React.useCallback(async (rowId: string) => {
    await renteDownload.download({ rowId });
  }, [renteDownload]);

  /** Rækkens gate fra definitionen selv — samme `project`, samme kontekst, samme request som klikket. */
  const resolveRowDownloadGate = React.useCallback((rowId: string) => {
    const gate = renteDownload.gateFor({ rowId });
    return gate.canDownload
      ? { canDownload: true as const }
      : { canDownload: false as const, disabledReason: gate.reasons[0].message };
  }, [renteDownload]);

  const handleDownloadAll = React.useCallback(async () => {
    if (!renteAlleDownload) return;
    setDownloadAllIsLoading(true);
    try {
      await renteAlleDownload.download(undefined);
    } finally {
      setDownloadAllIsLoading(false);
    }
  }, [renteAlleDownload]);

  const handleDownloadOversigt = React.useCallback(async () => {
    await renteOversigtDownload?.download(undefined);
  }, [renteOversigtDownload]);

  const downloadAllDisabled = renteAlleDownload === undefined || !renteAlleDownload.canDownload || downloadAllIsLoading;
  const oversigtDownloadDisabled = renteOversigtDownload === undefined || !renteOversigtDownload.canDownload;

  const showDownloadAllBox = isMobile && renteAlleDownload !== undefined;
  const renderOversigtRow = showOversigtBox && renteOversigtDownload !== undefined && !isMobile;
  const renderClearAllRow = !isMobile;

  // Slet-knappen deaktiveres når der intet er at slette (afgøres KUN fra afsluttet/committed state).
  const hasAnyCommittedInput = React.useMemo(() => {
    if (beregningsdato !== undefined) return true;
    if (kommentarer !== undefined && kommentarer.trim() !== '') return true;
    return committedRows.some((row) => !isRentekravRowEmpty(row));
  }, [beregningsdato, committedRows, kommentarer]);
  const clearAllDisabled = !hasAnyCommittedInput;

  const handleClearAll = React.useCallback(async () => {
    // Draften forbliver urørt, mens dialogen er åben. Først efter bekræftelse gennemføres reset atomisk; ved
    // storagefejl forbliver både den afsluttede tilstand og editoren uændret.
    await criticalActions.applyDestructive(() =>
      dispatchSectionReset(resetSection('renteberegning', { rentekravRows: [] })));
  }, [criticalActions, dispatchSectionReset]);

  return (
    <Box>
      <ContentBoxComponent className="content-box content-box--beregningsdato">
        <Typography className="section-header">Beregningsdato</Typography>
        <Box className="row--label-right-hover">
          <Typography className="row--text">Rente beregnes til og med</Typography>
          <Box className="row--label-right-hover__content">
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <DateField
                field={beregningsdatoRef}
                location={BEREGNINGSDATO_LOCATION}
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
                  beregningsdatoController.settleValue(today);
                }}
                focusRef={beregningsdatoInputRef}
              />
            </Box>
          </Box>
        </Box>
      </ContentBoxComponent>

      <ContentBoxComponent className="content-box">
        <Typography className="section-header">Beregnet rente</Typography>
        {renteDownload.errorMessage && (
          <Box className="row--label-right-hover">
            <Typography className="row--text" sx={{ color: 'error.main' }}>
              {renteDownload.errorMessage}
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
            // Rækkeknappernes gate spørger SAMME definition, som klikket aktiverer, med rækkens
            // EGEN id (§A2). Tabellen udleder den ikke selv af projektionen; gjorde den det, ville
            // reaktiv gate og click-preflight være to udtryk for samme regel.
            resolveDownloadGate={resolveRowDownloadGate}
          />
        </Box>
        {renderOversigtRow && (
          <>
            {renteOversigtDownload?.errorMessage && (
              <Box className="row--label-right-hover">
                <Typography className="row--text" sx={{ color: 'error.main' }}>
                  {renteOversigtDownload.errorMessage}
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
                  onMouseDown={(event) => event.preventDefault()}
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
          errorMessage={renteAlleDownload?.errorMessage ?? null}
          isLoading={downloadAllIsLoading}
          disabled={downloadAllDisabled}
          ContentBoxComponent={ContentBoxComponent}
          documentDownloadFormat={documentDownloadFormat}
        />
      )}

      <ContentBoxComponent className="content-box">
        <Typography className="section-header">Kommentarer</Typography>
        <MultilineTextField
          field={kommentarerRef}
          location={KOMMENTARER_LOCATION}
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
          preserveExternalFocus
          onConfirm={() => {
            void handleClearAll().then(() => setClearAllDialogOpen(false));
          }}
          onCancel={() => setClearAllDialogOpen(false)}
        />
      )}
    </Box>
  );
});

RenteberegningTab.displayName = 'RenteberegningTab';

export default RenteberegningTab;
