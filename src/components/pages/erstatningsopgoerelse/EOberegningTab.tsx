import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Typography, Checkbox, FormControlLabel, Tooltip } from '@mui/material';
import { Download, ErrorOutline, WarningAmber } from '@mui/icons-material';
import ContentBox from '../../layout/ContentBox';
import BugReportButton from '../../errors/BugReportButton';
import ConfirmationDialog from '../../ui/ConfirmationDialog';
import { useFieldErrorsBySourceForSection } from '../../../hooks/useFormFieldErrors';
import { usePersistedSection } from '../../../hooks/usePersistedSection';
import { collectAllDebugRows } from '../../../domain/erstatningsopgoerelse/eoDebugRowAggregator';
import type { NavigationTarget } from '../../../domain/erstatningsopgoerelse/eoDebugNavigationMap';
import { scrollToSection } from '../../../utils/scrollToSection';
import { scrollToDebugRow } from '../../../utils/scrollToDebugRow';
import { loadErstatningsopgoerelsePdfModule } from '../../../utils/pdf/pdfLoader';
import { formatISOToDanish } from '../../../utils/dateValidation';
import { MONTH_NAMES_DA } from '../../../utils/dateFormatting';
import { useErstatningsopgoerelseAggregation } from '../../../calculation/useErstatningsopgoerelseAggregation';
import AggregationResultView from './components/AggregationResultView';
import { useAppSettings } from '../../../contexts/AppSettingsContext';
import { getVisBrevhoved } from '../../../utils/pdf/pdfBrevhoved';
import { getSammentaellingControlStatus, type SammentaellingDisplayRow } from '../../../domain/debug/eoDebugSammentaelling';
import type { EODebugSnapshot } from '../../../domain/debug/eoDebugSnapshot';
import { buildControlMismatchReport, type ControlMismatchReport } from '../../../domain/debug/eoDebugMismatchReport';
import { useFormPersistence } from '../../../contexts/FormPersistenceContext';

const formatDateLongDisplay = (isoDate: string | undefined): string => {
  const danish = formatISOToDanish(isoDate ?? '');
  if (!danish) return '-';
  const [day, month, year] = danish.split('-');
  const dayNumber = parseInt(day, 10);
  const monthIndex = parseInt(month, 10) - 1;
  if (
    !Number.isFinite(dayNumber) ||
    !Number.isFinite(monthIndex) ||
    monthIndex < 0 ||
    monthIndex >= MONTH_NAMES_DA.length
  ) {
    return '-';
  }
  return `${dayNumber}. ${MONTH_NAMES_DA[monthIndex]} ${year}`;
};

type TabKey = 'eo_oplysninger' | 'loenindkomst' | 'offentlige_ydelser' | 'beregning' | 'debug' | 'debug_tabel';

interface EOberegningTabProps {
  activeTab: TabKey;
  setActiveTab: (tab: TabKey) => void;
  isActive: boolean;
  debugSnapshot: EODebugSnapshot | null;
  currentDebugRevision: string;
}

/**
 * Beregning-fanen - Viser fejl/warnings fra EODebug + download-funktionalitet
 *
 * Denne komponent er en "dumb" visningsside der:
 * - Genbruger al EODebug-funktionalitet via eoDebugRowAggregator
 * - Viser fejl og warnings i separate ContentBox'e
 * - Tilbyder navigation til fejlkilder med scroll-to-sektion
 * - Forbereder download-funktionalitet (inaktiv i denne version)
 *
 * Designprincipper (normative):
 * - Fejl/advarsler i contentboxe må kun komme fra EODebug-rows (ingen generiske runtime-fejl).
 * - Download af PDF blokeres altid ved fejl, men aldrig ved advarsler.
 */
const EOberegningTab = React.memo<EOberegningTabProps>((
  { activeTab, setActiveTab, isActive, debugSnapshot, currentDebugRevision }
) => {
  // ============================================================================
  // DATA INDSAMLING FRA FORMPERSISTENCE
  // ============================================================================

  const navigate = useNavigate();
  const { settings } = useAppSettings();
  const { getLoenindkomstManuelReguleringInputErrors } = useFormPersistence();
  const stamdataValues = usePersistedSection('stamdata');
  const eoValues = usePersistedSection('erstatningsopgoerelse');
  const stamdataErrors = useFieldErrorsBySourceForSection('stamdata');
  const eoErrors = useFieldErrorsBySourceForSection('erstatningsopgoerelse');
  const manuelReguleringInputErrors = getLoenindkomstManuelReguleringInputErrors();

  const [controlMismatchDialogOpen, setControlMismatchDialogOpen] = React.useState(false);
  const [controlMismatchRows, setControlMismatchRows] = React.useState<SammentaellingDisplayRow[]>([]);
  const [controlMismatchReport, setControlMismatchReport] = React.useState<ControlMismatchReport | null>(null);
  const [controlMismatchReportError, setControlMismatchReportError] = React.useState<Error | null>(null);
  const hasRunControlCheckRef = React.useRef(false);
  const debugSnapshotRef = React.useRef<EODebugSnapshot | null>(null);
  debugSnapshotRef.current = debugSnapshot;

  const buildControlMismatchError = React.useCallback((report: ControlMismatchReport): Error => {
    const lines = report.mismatches.map((row) => {
      return `${row.label}: beregnet=${row.beregnet}, tabel=${row.tabel}`;
    });
    return new Error(['Sammentælling kontroluoverensstemmelser', ...lines].join('\n'));
  }, []);

  const controlMismatchReportExtras = React.useCallback(() => {
    if (!controlMismatchReport) return [];
    return [
      { title: 'Kontroluoverensstemmelse (snapshot)', data: controlMismatchReport },
    ];
  }, [controlMismatchReport]);

  const runControlCheckOnceOnTabEntryRef = React.useRef<() => void>(() => {});
  runControlCheckOnceOnTabEntryRef.current = () => {
    const snapshot = debugSnapshotRef.current;
    if (!snapshot) return;
    if (snapshot.revision !== currentDebugRevision) return;
    if (!snapshot.hasControlErrors) {
      setControlMismatchRows([]);
      setControlMismatchReport(null);
      setControlMismatchReportError(null);
      setControlMismatchDialogOpen(false);
      return;
    }

    const mismatches = snapshot.sammentaellingRows.filter(
      (row) => getSammentaellingControlStatus(row.control) === 'error'
    );

    if (mismatches.length === 0) {
      setControlMismatchRows([]);
      setControlMismatchReport(null);
      setControlMismatchReportError(null);
      setControlMismatchDialogOpen(false);
      return;
    }

    const report = buildControlMismatchReport(snapshot, mismatches);
    setControlMismatchRows(mismatches);
    setControlMismatchReport(report);
    setControlMismatchReportError(buildControlMismatchError(report));
    setControlMismatchDialogOpen(true);
  };

  React.useEffect(() => {
    if (!isActive) {
      // Navigation-guard: reset when leaving tab so entry is explicit.
      hasRunControlCheckRef.current = false;
      setControlMismatchDialogOpen(false);
      return;
    }
    if (hasRunControlCheckRef.current) return;
    hasRunControlCheckRef.current = true;
    runControlCheckOnceOnTabEntryRef.current();
  }, [isActive]);

  // ============================================================================
  // SAMLE ALLE DEBUG-ROWS MED NAVIGATION
  // ============================================================================

  const { errors, warnings, relevantRows } = React.useMemo(() => {
    if (!isActive) {
      return { errors: [], warnings: [], allRows: [], relevantRows: [] };
    }
    // Return tom liste hvis data ikke er loaded endnu
    if (!stamdataValues || !eoValues) {
      return { errors: [], warnings: [], allRows: [], relevantRows: [] };
    }

    return collectAllDebugRows(stamdataValues, stamdataErrors, eoValues, eoErrors, manuelReguleringInputErrors);
  }, [isActive, stamdataValues, stamdataErrors, eoValues, eoErrors, manuelReguleringInputErrors]);

  // ============================================================================
  // SAMLET ERSTATNINGSOPGØRELSE (AGGREGATION)
  // ============================================================================

  const aggregationResult = useErstatningsopgoerelseAggregation(isActive);

  // ============================================================================
  // NAVIGATION-HÅNDTERING
  // ============================================================================

  const [pendingNavigation, setPendingNavigation] = React.useState<{
    target: NavigationTarget;
    debugRowId: string;
  } | null>(null);

  /**
   * Ekstraher fejlmeddelelse fra displayValue
   *
   * Format: "Fejl (meddelelse)" eller "Advarsel (meddelelse)" eller bare værdi
   * Returner: meddelelsen UDEN "Fejl:" prefix, eller tom streng hvis ukendt format
   */
  const extractErrorMessage = React.useCallback((displayValue: string): string => {
    const trimmed = displayValue.trim();
    if (trimmed === '' || trimmed === '-') return '';

    // Tjek om displayValue indeholder "Fejl (" eller "Advarsel ("
    const fejlMatch = displayValue.match(/^Fejl \((.+)\)$/);
    if (fejlMatch) {
      return `(${fejlMatch[1]})`;
    }

    const advarselMatch = displayValue.match(/^Advarsel \((.+)\)$/);
    if (advarselMatch) {
      return `(${advarselMatch[1]})`;
    }

    // Ukendt format - returner displayValue uændret for at undgå falsk semantik
    return displayValue;
  }, []);

  const handleNavigate = React.useCallback(
    (target: NavigationTarget, debugRowId: string) => {
      switch (target.kind) {
        case 'erstatningsopgoerelse-tab':
          // Switch til korrekt fane
          setActiveTab(target.tabId);
          // Scroll til specifik række + evt. sektion når fanen er aktiv
          setPendingNavigation({ target, debugRowId });
          break;

        case 'stamdata-page':
          // Naviger til Stamdata-siden
          navigate('/stamdata');
          setPendingNavigation(null);
          break;

        case 'unsupported':
          if (process.env.NODE_ENV === 'development') {
            console.warn(`Navigation ikke understøttet: ${target.reason}`);
          }
          setPendingNavigation(null);
          break;

        default: {
          // Exhaustiveness check - TypeScript sikrer at alle cases er håndteret
          const _exhaustive: never = target;
          return _exhaustive;
        }
      }
    },
    [setActiveTab, navigate, setPendingNavigation]
  );

  React.useEffect(() => {
    if (!pendingNavigation || pendingNavigation.target.kind !== 'erstatningsopgoerelse-tab') {
      return;
    }
    if (activeTab !== pendingNavigation.target.tabId) return;

    let cancelled = false;
    const runRowScroll = () => {
      if (cancelled) return;
      scrollToDebugRow(pendingNavigation.debugRowId);
    };

    if (pendingNavigation.target.sectionId) {
      scrollToSection(pendingNavigation.target.sectionId, {
        onSuccess: () => {
          if (cancelled) return;
          requestAnimationFrame(() => {
            runRowScroll();
          });
        },
        onFailure: () => {
          runRowScroll();
        },
      });
    } else {
      runRowScroll();
    }

    setPendingNavigation(null);

    return () => {
      cancelled = true;
    };
  }, [activeTab, pendingNavigation, scrollToSection, scrollToDebugRow]);

  // ============================================================================
  // CHECKBOX STATE FOR ERSTATNINGSOPGØRELSE-DOWNLOAD
  // ============================================================================

  const selectedElements = React.useMemo(
    () => ({
      opgoerelse: true,
      loenindkomst: false,
      offentligeYdelser: false,
      shDage: false,
      regulering: false,
      okSatser: false,
      sygeferiegodtgoerelse: false,
    }),
    []
  );

  const beregnesSvieSmerte = eoValues?.beregnesSvieSmerteGodtgoerelse === 'Ja';
  const beregnesTabtArbejdsfortjeneste = eoValues?.beregnesTabtArbejdsfortjeneste === 'Ja';

  const svieSmerteRow = relevantRows.find((row) => row.id === 'sviesmerte.beregnetPeriode');
  const svieSmerteDisplayParts = (beregnesSvieSmerte ? (svieSmerteRow?.displayValue ?? '-') : '-')
    .split('\n')
    .map((value) => value.trim())
    .filter((value) => value !== '' && value !== '-');
  const svieSmerteLines = svieSmerteDisplayParts;
  const svieSmerteLabel = svieSmerteLines.length > 1 ? 'Svie/smerteperioder' : 'Svie/smerteperiode';
  const harSvieSmertePerioder =
    beregnesSvieSmerte &&
    (eoValues?.svieSmertePerioder ?? []).some((row) => row.fra || row.til || row.tilstand) &&
    svieSmerteLines.length > 0;

  const tafRows = beregnesTabtArbejdsfortjeneste
    ? relevantRows.filter((row) => row.id.startsWith('taf.periode.'))
    : [];
  const tafPerioderLabels = tafRows
    .filter((row) => row.id !== 'taf.periode.empty' && row.label.trim() !== '-')
    .map((row) => {
      const match = row.label.match(/\(([^)]+)\)/);
      return match ? match[1].trim() : row.label.trim();
    })
    .filter((value) => value !== '');
  const harTafPerioder =
    beregnesTabtArbejdsfortjeneste &&
    (eoValues?.tafPerioder ?? []).some((row) => row.fra || row.til || typeof row.loseFeriedage === 'number') &&
    tafPerioderLabels.length > 0;
  const tafPerioderLines = tafPerioderLabels;
  const tafPerioderLabel = tafPerioderLines.length > 1 ? 'TAF-perioder' : 'TAF-periode';

  const erErhvervssygdom = stamdataValues?.skadestype === 'Erhvervssygdom';
  const skadesdatoLabel = erErhvervssygdom ? 'Anmeldelsesdato' : 'Skadesdato';
  const skadesdatoDisplay = formatDateLongDisplay(stamdataValues?.skadesdato);

  const erRevideret = eoValues?.revideretOpgoerelse === 'Ja';
  const revideretPrefix = erRevideret ? 'Revideret ' : '';
  const erstatningsord = erRevideret ? 'erstatningsopgørelse' : 'Erstatningsopgørelse';
  const eoNummer = eoValues?.eoNummer?.trim() ?? '';
  const eoLedsagetekst = eoValues?.eoLedsagetekst?.trim() ?? '';
  const eoNummerPart = eoNummer ? ` ${eoNummer}` : '';
  const eoLedsagetekstPart = eoLedsagetekst ? ` (${eoLedsagetekst})` : '';
  const erstatningsopgoerelseTitel = `${revideretPrefix}${erstatningsord}${eoNummerPart}${eoLedsagetekstPart}`.trim();

  // ============================================================================
  // PDF DOWNLOAD-HÅNDTERING
  // ============================================================================

  const handleDownloadPdf = React.useCallback(async () => {
    if (!stamdataValues || !eoValues) {
      console.error('Manglende data for PDF-generering');
      return;
    }

    // Udled visBrevhoved fra settings
    const visBrevhoved = getVisBrevhoved(settings, 'erstatningsopgoerelse');

    try {
      const { generateErstatningsopgoerelsePdf } = await loadErstatningsopgoerelsePdfModule();
      generateErstatningsopgoerelsePdf(stamdataValues, eoValues, selectedElements, {
        visBrevhoved,
        erstatningsopgoerelseAfsluttesMed: eoValues.erstatningsopgoerelseAfsluttesMed,
        visUdkastStempel: eoValues.indsaetUdkastStempel === 'Ja',
      });
    } catch (error) {
      console.error('Kunne ikke generere PDF for erstatningsopgørelse:', error);
    }
  }, [stamdataValues, eoValues, selectedElements, settings]);

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <Box>
      {/* ========================================================================
          CONTENTBOX 1: FEJL
          ======================================================================== */}
      {errors.length > 0 && (
        <ContentBox>
          <Typography className="section-header">Fejl</Typography>
          {errors.map((row) => {
            const errorMessage = extractErrorMessage(row.displayValue);
            return (
              <Box key={row.id} className="row--label-right-hover" sx={{ '--label-width': '400px' }}>
                <Typography className="row--text">
                  {row.label}{errorMessage ? ` ${errorMessage}` : ''}
                </Typography>
                <Box className="row--label-right-hover__content" sx={{ gap: 1 }}>
                  {row.navigation.kind === 'erstatningsopgoerelse-tab' && (
                    <>
                      <Typography className="row--text">
                        {row.navigation.tabName} {'->'}{' '}
                      </Typography>
                      <Typography
                        className="row--text icon-text-link"
                        component="button"
                        type="button"
                        onClick={() => handleNavigate(row.navigation, row.id)}
                        sx={{
                          cursor: 'pointer',
                          border: 0,
                          background: 'transparent',
                          p: 0,
                          m: 0,
                          font: 'inherit',
                        }}
                      >
                        {row.navigation.sectionTitle}
                      </Typography>
                    </>
                  )}
                  {row.navigation.kind === 'stamdata-page' && (
                    <>
                      <Typography className="row--text">
                        {row.navigation.pageName} {'->'}{' '}
                      </Typography>
                      <Typography
                        className="row--text icon-text-link"
                        component="button"
                        type="button"
                        onClick={() => handleNavigate(row.navigation, row.id)}
                        sx={{
                          cursor: 'pointer',
                          border: 0,
                          background: 'transparent',
                          p: 0,
                          m: 0,
                          font: 'inherit',
                        }}
                      >
                        {row.navigation.sectionTitle}
                      </Typography>
                    </>
                  )}
                  {row.navigation.kind === 'unsupported' && (
                    <Typography className="row--text">{row.navigation.displayPath}</Typography>
                  )}
                  <ErrorOutline sx={{ color: 'red', fontSize: 20 }} />
                </Box>
              </Box>
            );
          })}
        </ContentBox>
      )}
      {/* ========================================================================
          CONTENTBOX 2: ADVARSLER
          ======================================================================== */}
      {warnings.length > 0 && (
        <ContentBox>
          <Typography className="section-header">Advarsler</Typography>
          {warnings.map((row) => {
            const warningMessage = extractErrorMessage(row.displayValue);
            return (
              <Box key={row.id} className="row--label-right-hover" sx={{ '--label-width': '400px' }}>
                <Typography className="row--text">
                  {row.label}{warningMessage ? ` ${warningMessage}` : ''}
                </Typography>
                <Box className="row--label-right-hover__content" sx={{ gap: 1 }}>
                  {row.navigation.kind === 'erstatningsopgoerelse-tab' && (
                    <>
                      <Typography className="row--text">
                        {row.navigation.tabName} {'->'}{' '}
                      </Typography>
                      <Typography
                        className="row--text icon-text-link"
                        component="button"
                        type="button"
                        onClick={() => handleNavigate(row.navigation, row.id)}
                        sx={{
                          cursor: 'pointer',
                          border: 0,
                          background: 'transparent',
                          p: 0,
                          m: 0,
                          font: 'inherit',
                        }}
                      >
                        {row.navigation.sectionTitle}
                      </Typography>
                    </>
                  )}
                  {row.navigation.kind === 'stamdata-page' && (
                    <>
                      <Typography className="row--text">
                        {row.navigation.pageName} {'->'}{' '}
                      </Typography>
                      <Typography
                        className="row--text icon-text-link"
                        component="button"
                        type="button"
                        onClick={() => handleNavigate(row.navigation, row.id)}
                        sx={{
                          cursor: 'pointer',
                          border: 0,
                          background: 'transparent',
                          p: 0,
                          m: 0,
                          font: 'inherit',
                        }}
                      >
                        {row.navigation.sectionTitle}
                      </Typography>
                    </>
                  )}
                  {row.navigation.kind === 'unsupported' && (
                    <Typography className="row--text">{row.navigation.displayPath}</Typography>
                  )}
                  <WarningAmber sx={{ color: 'orange', fontSize: 20 }} />
                </Box>
              </Box>
            );
          })}
        </ContentBox>
      )}
      {/* ========================================================================
          CONTENTBOX 3: ERSTATNINGSOPGØRELSE (DOWNLOAD)
          ======================================================================== */}
      <ContentBox>
        <Typography className="section-header">Beregning</Typography>

        <Box className="row--label-right-hover">
          <Typography className="row--text" sx={{ fontWeight: '500 !important' }}>
            {erstatningsopgoerelseTitel}
          </Typography>
          <Box className="row--label-right-hover__content" />
        </Box>

        <Box className="row--label-right-hover">
          <Typography className="row--text">{skadesdatoLabel}</Typography>
          <Box className="row--label-right-hover__content">
            <Typography className="row--text">{skadesdatoDisplay}</Typography>
          </Box>
        </Box>

        {aggregationResult?.kind === 'ok' && (
          <Box className="row--label-right-hover">
            <Typography className="row--text">Samlet erstatningsopgørelse</Typography>
            <Box className="row--label-right-hover__content" sx={{ flexDirection: 'column', alignItems: 'flex-end' }}>
              <AggregationResultView total={aggregationResult.total} />
            </Box>
          </Box>
        )}

        {harSvieSmertePerioder && (
          <Box className="row--label-right-hover">
            <Typography className="row--text">{svieSmerteLabel}</Typography>
            <Box
              className="row--label-right-hover__content"
              sx={{
                flexDirection: 'column',
                alignItems: 'flex-end',
                gap: 0,
              }}
            >
              {svieSmerteLines.map((line, index) => (
                <Typography key={`${line}-${index}`} className="row--text" sx={{ minHeight: 'unset', lineHeight: 1.2 }}>
                  {line}
                </Typography>
              ))}
            </Box>
          </Box>
        )}

        {harTafPerioder && (
          <Box className="row--label-right-hover">
            <Typography className="row--text">{tafPerioderLabel}</Typography>
            <Box
              className="row--label-right-hover__content"
              sx={{
                flexDirection: 'column',
                alignItems: 'flex-end',
                gap: 0,
              }}
            >
              {tafPerioderLines.map((line, index) => (
                <Typography key={`${line}-${index}`} className="row--text" sx={{ minHeight: 'unset', lineHeight: 1.2 }}>
                  {line}
                </Typography>
              ))}
            </Box>
          </Box>
        )}

        {/* Download-knap */}
        <Box className="row--label-right-hover">
          <Typography className="row--text">Hent opgørelse</Typography>
          <Box className="row--label-right-hover__content">
            {errors.length === 0 && (
              <Box
                onClick={handleDownloadPdf}
                tabIndex={-1}
                sx={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s',
                  '&:hover': {
                    backgroundColor: '#e3f2fd',
                  },
                  '&:active': {
                    backgroundColor: '#bbdefb',
                  },
                }}
              >
                <Download
                  sx={{
                    fontSize: '24px',
                    color: 'primary.main',
                  }}
                />
              </Box>
            )}
            {errors.length > 0 && (
              <Tooltip
                title="Download ikke mulig, så længe der er fejl ovenfor"
                arrow
                placement="top"
              >
                <Box
                  tabIndex={-1}
                  sx={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'default',
                  }}
                >
                  <Download
                    sx={{
                      fontSize: '24px',
                      color: 'text.disabled',
                    }}
                  />
                </Box>
              </Tooltip>
            )}
          </Box>
        </Box>
      </ContentBox>

      <ContentBox>
        <Typography className="section-header">Bilag</Typography>

        <Box className="row--label-right-hover">
          <Typography className="row--text" sx={{ alignSelf: 'flex-start' }}>
            Vælg elementer, der skal indgå
          </Typography>
          <Box
            className="row--label-right-hover__content"
            sx={{
              display: 'flex',
              flexDirection: 'column',
              gap: 0,
              alignItems: 'flex-end',
              '& .MuiFormControlLabel-label.Mui-disabled': {
                color: 'text.primary',
                opacity: 1,
              },
            }}
          >
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <FormControlLabel
                control={<Checkbox checked={selectedElements.opgoerelse} disabled />}
                label="Opgørelse"
              />
            </Box>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <FormControlLabel
                control={<Checkbox checked={selectedElements.loenindkomst} disabled />}
                label="Lønindkomst"
              />
              <FormControlLabel
                control={<Checkbox checked={selectedElements.offentligeYdelser} disabled />}
                label="Offentlige ydelser"
              />
            </Box>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <FormControlLabel
                control={<Checkbox checked={selectedElements.shDage} disabled />}
                label="SH-dage"
              />
              <FormControlLabel
                control={<Checkbox checked={selectedElements.regulering} disabled />}
                label="Regulering"
              />
              <FormControlLabel
                control={<Checkbox checked={selectedElements.okSatser} disabled />}
                label="OK-satser"
              />
            </Box>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <FormControlLabel
                control={<Checkbox checked={selectedElements.sygeferiegodtgoerelse} disabled />}
                label="Sygeferiegodtgørelse"
              />
            </Box>
          </Box>
        </Box>
      </ContentBox>

      <ConfirmationDialog
        open={controlMismatchDialogOpen}
        title="Uoverensstemmelse i kontrolberegning"
        message={
          <Box>
            <Typography variant="body2" sx={{ marginBottom: 1 }}>
              Der er konstateret en uoverensstemmelse mellem de beregnede værdier og en bagvedliggende
              kontrolberegning. Det er en sikkerhedsforanstaltning, der ikke nødvendigvis betyder, at
              beregningen er forkert - men kontroller den grundigt.
            </Typography>
            <Typography variant="body2" sx={{ marginBottom: 0.5 }}>
              Uoverensstemmelser:
            </Typography>
            <Box component="ul" sx={{ margin: 0, paddingLeft: 2 }}>
              {controlMismatchRows.map((row) => (
                <li key={row.key}>
                  <Typography variant="body2">
                    {row.label}: Beregnet {row.control.beregnetDisplay} · Tabel {row.control.tabelDisplay}
                  </Typography>
                </li>
              ))}
            </Box>
          </Box>
        }
        cancelText="Luk"
        confirmText="OK"
        confirmColor="primary"
        onCancel={() => setControlMismatchDialogOpen(false)}
        onConfirm={() => setControlMismatchDialogOpen(false)}
        extraActions={
          controlMismatchReportError ? (
            <BugReportButton
              variant="outlined"
              label="Send fejloplysninger"
              context={{
                source: 'Beregning-fane: Kontroluoverensstemmelse i sammentælling',
                error: controlMismatchReportError,
              }}
              getExtraSections={controlMismatchReportExtras}
            />
          ) : null
        }
      />
    </Box>
  );
});

EOberegningTab.displayName = 'EOberegningTab';

export default EOberegningTab;
