import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Typography, Checkbox, FormControlLabel, Tooltip, MenuItem } from '@mui/material';
import { Download, ErrorOutline, WarningAmber } from '@mui/icons-material';
import ContentBox from '../../layout/ContentBox';
import { useFieldErrorsBySourceForSection } from '../../../hooks/useFormFieldErrors';
import { useEOLoenindkomstInputErrors } from '../../../hooks/useEOLoenindkomstInputErrors';
import { collectAllDebugRows } from '../../../domain/debug/eoDebugRowAggregator';
import type { DebugRowWithNavigation } from '../../../domain/debug/eoDebugRowAggregator';
import type { NavigationTarget } from '../../../domain/debug/eoDebugNavigationMap';
import { scrollToSection } from '../../../utils/scrollToSection';
import { scrollToDebugRow } from '../../../utils/scrollToDebugRow';
import { formatIsoDateLong } from '../../../utils/dateFormatting';
import { useAppSettings } from '../../../contexts/useAppSettings';
import type { ErstatningsopgoerelseValues } from '../../../schemas/formSchemas';
import { isoToDanish } from '../../../types/branded';
import StyledDropdown, { type StyledDropdownChangeEvent } from '../../inputs/StyledDropdown';
import { toReadableSummaryMessage } from '../../../domain/erstatningsopgoerelse/readableSummaryMessage';
import type { StamdataValues } from '../../../schemas/formSchemas';
import {
  downloadErstatningsopgoerelsePdf,
  downloadTafFordeltPaaAarPdf,
} from '../../../utils/pdf/pdfService';
import type { EoSnapshot } from '../../../domain/erstatningsopgoerelse/eoSnapshot';
import { eoSnapshotToBeregningView } from '../../../domain/erstatningsopgoerelse/eoSnapshotToBeregningView';
import { eoSnapshotToEoPdfDocument } from '../../../domain/erstatningsopgoerelse/eoSnapshotToEoPdfDocument';
import { eoSnapshotToTafPerYearPdfDocument } from '../../../domain/erstatningsopgoerelse/eoSnapshotToTafPerYearPdfDocument';
import type { EoInvariant } from '../../../domain/erstatningsopgoerelse/eoSnapshotInvariants';

type TabKey = 'eo_oplysninger' | 'loenindkomst' | 'offentlige_ydelser' | 'beregning' | 'debug' | 'debug_tabel';

interface EOberegningTabProps {
  activeTab: TabKey;
  setActiveTab: (tab: TabKey) => void;
  isActive: boolean;
  eoSnapshot?: EoSnapshot | null;
  stamdataValues: StamdataValues;
  eoValues: ErstatningsopgoerelseValues;
  setEOValues: React.Dispatch<React.SetStateAction<ErstatningsopgoerelseValues>>;
}

type SystemIssueRow = Readonly<{
  id: string;
  message: string;
}>;

const FEJL_ADVARSLER_ROW_SX = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 58ch) max-content',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: 1,
  '& > :first-of-type': {
    minWidth: 0,
    overflowWrap: 'break-word',
  },
  '& .row--label-right-hover__content': {
    minWidth: 'max-content',
    flexWrap: 'nowrap',
    whiteSpace: 'nowrap',
    alignSelf: 'flex-start',
  },
} as const;

/**
 * Beregning-fanen viser debug-fejl/advarsler og snapshot-baseret downloadstatus.
 *
 * Debug-rækker er et separat forklaringslag til brugernavigation.
 * Download-gating følger den samlede EO-fejlliste fra debug-aggregatoren
 * og snapshot-/projektionstilstanden.
 */

const getCustomDebugRowMessage = (
  row: Pick<DebugRowWithNavigation, 'id' | 'label' | 'message'>
): string | null => {
  const message = row.message?.trim() ?? '';
  if (
    row.label === 'Periode til beregning af før-løn'
    && message.startsWith('Der er overlap mellem beregningsperioden (')
  ) {
    return message;
  }

  if (
    row.label.startsWith('Periode (')
    && message.startsWith('Dato skal være mellem ')
  ) {
    const prefix = row.id.startsWith('sviesmerte.periode.')
      ? 'Svie/smerte-perioden'
      : 'TAF-perioden';
    return `${prefix} skal være mellem ${message.replace('Dato skal være mellem ', '')}`;
  }

  if (row.label === 'Valgt regulering' && message === 'Lønudvikling beregnes ud fra mangler') {
    return 'Der mangler at blive angivet lønregulering, evt. \'Ingen\'';
  }

  if (row.label === 'Periode til beregning af før-løn' && message === 'Ikke alle felter udfyldt') {
    return 'Der mangler indtastninger i perioden til beregning af før-løn.';
  }

  if (row.id === 'forlig.dato' && message === 'Dato for forlig kræver, at ansvarsgrad angives som procent eller brøk') {
    return 'Der er indtastet forligsdato, men ikke forligsprocent eller -brøk';
  }

  return null;
};

const EOberegningTab = React.memo<EOberegningTabProps>((
  { activeTab, setActiveTab, isActive, eoSnapshot = null, stamdataValues, eoValues, setEOValues }
) => {
  // ============================================================================
  // DATA FRA COMMITTED STATE + PERSISTENCE FACADE
  // ============================================================================

  const navigate = useNavigate();
  const { settings } = useAppSettings();
  const stamdataErrors = useFieldErrorsBySourceForSection('stamdata');
  const eoErrors = useFieldErrorsBySourceForSection('erstatningsopgoerelse');
  const manuelReguleringInputErrors = useEOLoenindkomstInputErrors();

  const beregningView = React.useMemo(
    () => (eoSnapshot ? eoSnapshotToBeregningView(eoSnapshot) : null),
    [eoSnapshot]
  );
  const authoritativeBlockingInvariants = beregningView?.authoritativeBlockingInvariants ?? [];

  // ============================================================================
  // SAMLE ALLE DEBUG-ROWS MED NAVIGATION
  // ============================================================================

  const { errors, warnings, relevantRows } = React.useMemo(() => {
    if (!isActive) {
      return { errors: [], warnings: [], relevantRows: [] };
    }
    // Return tom liste hvis data ikke er loaded endnu
    if (!eoValues) {
      return { errors: [], warnings: [], relevantRows: [] };
    }

    return collectAllDebugRows(
      stamdataValues,
      stamdataErrors,
      eoValues,
      eoErrors,
      manuelReguleringInputErrors,
      settings,
      beregningView?.canonicalOutput
    );
  }, [isActive, stamdataValues, stamdataErrors, eoValues, eoErrors, manuelReguleringInputErrors, settings, beregningView]);
  const eoPdfProjection = React.useMemo(
    () => (eoSnapshot ? eoSnapshotToEoPdfDocument(eoSnapshot) : null),
    [eoSnapshot]
  );
  const tafPdfProjection = React.useMemo(
    () => (eoSnapshot ? eoSnapshotToTafPerYearPdfDocument(eoSnapshot) : null),
    [eoSnapshot]
  );
  const eoPdfBlockingInvariants = eoPdfProjection?.kind === 'blocked'
    ? eoPdfProjection.invariants
    : [];
  const tafPdfBlockingInvariants = tafPdfProjection?.kind === 'blocked'
    ? tafPdfProjection.invariants
    : [];

  const isSystemInvariant = React.useCallback((invariant: EoInvariant): boolean => {
    return invariant.source === 'system';
  }, []);

  const firstBlockingDebugErrorMessage = React.useMemo(() => {
    const firstError = errors[0];
    if (!firstError) return null;
    const normalizedMessage = firstError.message?.trim() || '';
    return getCustomDebugRowMessage(firstError) ?? (normalizedMessage || firstError.label);
  }, [errors]);

  const hasBlockingDebugErrors = errors.length > 0;
  const canDownloadSnapshotEoPdf = eoPdfProjection?.kind === 'ok' && !hasBlockingDebugErrors;
  const canDownloadSnapshotTafPdf = tafPdfProjection?.kind === 'ok' && !hasBlockingDebugErrors;

  const eoPdfDisabledReason = React.useMemo(() => {
    if (firstBlockingDebugErrorMessage) {
      return firstBlockingDebugErrorMessage;
    }
    if (!eoSnapshot) return 'Download ikke mulig, før der er bygget et gyldigt snapshot';
    if (eoSnapshot.status === 'fail_closed') {
      return eoSnapshot.invariants[0]?.message ?? 'EO-PDF kan ikke genereres for den aktuelle sag.';
    }
    if (authoritativeBlockingInvariants.length > 0) {
      return authoritativeBlockingInvariants[0]?.message ?? 'EO-beregningen er blokeret af snapshot-kontroller.';
    }
    if (eoPdfProjection?.kind === 'blocked') {
      return eoPdfProjection.message;
    }
    return null;
  }, [authoritativeBlockingInvariants, eoPdfProjection, eoSnapshot, firstBlockingDebugErrorMessage]);

  const tafPdfDisabledReason = React.useMemo(() => {
    if (firstBlockingDebugErrorMessage) {
      return firstBlockingDebugErrorMessage;
    }
    if (!eoSnapshot) return 'Download ikke mulig, før der er bygget et gyldigt snapshot';
    if (eoSnapshot.status === 'fail_closed') {
      return eoSnapshot.invariants[0]?.message ?? 'TAF fordelt på år kan ikke genereres for den aktuelle sag.';
    }
    if (authoritativeBlockingInvariants.length > 0) {
      return authoritativeBlockingInvariants[0]?.message ?? 'EO-beregningen er blokeret af snapshot-kontroller.';
    }
    if (tafPdfProjection?.kind === 'blocked') {
      return tafPdfProjection.message;
    }
    return null;
  }, [authoritativeBlockingInvariants, eoSnapshot, tafPdfProjection, firstBlockingDebugErrorMessage]);

  const systemIssueRows = React.useMemo<readonly SystemIssueRow[]>(() => {
    const rows: SystemIssueRow[] = [];
    const seen = new Set<string>();

    const pushIssue = (issue: SystemIssueRow) => {
      const key = `${issue.id}::${issue.message}`;
      if (seen.has(key)) return;
      seen.add(key);
      rows.push(issue);
    };

    if (eoSnapshot?.status === 'fail_closed') {
      // Neutral fejlbesked uden BugReportButton for alle fail_closed-årsager.
      // schema_guard: forventelig inkonsistens (manglende felter, korrupt .eo).
      // runtime_exception: logges via console.error i computeEoSnapshot og routes til
      // ErrorFallback/ErrorBoundary. BugReportButton vises ikke her (jf. eo-snapshot-contract.md §7).
      pushIssue({
        id: 'snapshot-fail-closed',
        message: eoSnapshot.invariants[0]?.message ?? 'Beregningen kan ikke gennemføres — ret manglende eller ugyldige felter.',
      });
    }

    // Kun autoritative og EO-PDF-blokerende system-invarianter vises i systemfejl-sektionen.
    // tafPdfBlockingInvariants blokerer kun TAF-PDF-download og vises ikke som globale systemfejl.
    [
      ...authoritativeBlockingInvariants,
      ...eoPdfBlockingInvariants,
    ]
      .filter(isSystemInvariant)
      .forEach((invariant) => {
        pushIssue({
          id: invariant.id,
          message: invariant.message,
        });
      });

    return rows;
  }, [
    authoritativeBlockingInvariants,
    eoPdfBlockingInvariants,
    eoSnapshot,
    isSystemInvariant,
    tafPdfBlockingInvariants,
  ]);

  // ============================================================================
  // NAVIGATION-HÅNDTERING
  // ============================================================================

  const [pendingNavigation, setPendingNavigation] = React.useState<{
    target: NavigationTarget;
    debugRowId: string;
  } | null>(null);

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
  }, [activeTab, pendingNavigation]);

  // ============================================================================
  // CHECKBOX STATE FOR ERSTATNINGSOPGØRELSE-DOWNLOAD
  // ============================================================================

  const selectedElements = eoValues.eoBilagSelection ?? {
    opgoerelse: true as const,
    loenindkomst: true,
    offentligeYdelser: true,
    shDage: false,
    regulering: true,
    okSatser: true,
    sygeferiegodtgoerelse: false,
  };
  const loenindkomstOgOffentligeYdelserIndgaar =
    eoValues.eoBilagLoenindkomstOgOffentligeYdelserIndgaar ?? 'Perioden';

  const updateSelectedElement = React.useCallback(
    (
      key: Exclude<keyof ErstatningsopgoerelseValues['eoBilagSelection'], 'opgoerelse'>,
      checked: boolean
    ) => {
      setEOValues((prev) => ({
        ...prev,
        eoBilagSelection: {
          ...prev.eoBilagSelection,
          [key]: checked,
        },
      }));
    },
    [setEOValues]
  );

  const updateLoenindkomstOgOffentligeYdelserIndgaar = React.useCallback(
    (event: StyledDropdownChangeEvent<'Alle' | 'Perioden'>) => {
      const value = event.target.value;
      if (value !== 'Alle' && value !== 'Perioden') return;
      setEOValues((prev) => ({
        ...prev,
        eoBilagLoenindkomstOgOffentligeYdelserIndgaar: value,
      }));
    },
    [setEOValues]
  );

  const beregnesSvieSmerte = eoValues.beregnesSvieSmerteGodtgoerelse === 'Ja';
  const beregnesTabtArbejdsfortjeneste = eoValues.beregnesTabtArbejdsfortjeneste === 'Ja';

  const svieSmerteRow = relevantRows.find((row) => row.id === 'sviesmerte.beregnetPeriode');
  const svieSmerteDisplayParts = (beregnesSvieSmerte ? (svieSmerteRow?.displayValue ?? '-') : '-')
    .split('\n')
    .map((value) => value.trim())
    .filter((value) => value !== '' && value !== '-');
  const svieSmerteLines = svieSmerteDisplayParts;
  const harSvieSmertePerioder =
    beregnesSvieSmerte &&
    (eoValues.svieSmertePerioder ?? []).some((row) => row.fra || row.til || row.tilstand) &&
    svieSmerteLines.length > 0;
  const svieSmerteSummaryLines = harSvieSmertePerioder ? svieSmerteLines : ['Nej'];
  const svieSmerteSummaryLabel = harSvieSmertePerioder && svieSmerteLines.length > 1
    ? 'Svie/smerte-perioder'
    : 'Svie/smerte-periode';

  const tafPerioderLabels = React.useMemo(() => {
    if (!beregnesTabtArbejdsfortjeneste || !eoValues) return [];

    const tafPeriodeRows = relevantRows.filter((row) => row.id.startsWith('taf.periode.') && row.id !== 'taf.periode.empty');
    const tafPeriodeFejl = tafPeriodeRows
      .filter((row) => row.status === 'error')
      .map((row) => row.displayValue.trim())
      .filter((value, index, arr) => value !== '' && arr.indexOf(value) === index);

    if (tafPeriodeFejl.length > 0) {
      return tafPeriodeFejl;
    }

    const ranges = beregningView?.tafPerioder ?? [];
    return ranges
      .map((range) => {
        const fra = isoToDanish(range.fra);
        const til = isoToDanish(range.til);
        return fra && til ? `${fra} - ${til}` : '';
      })
      .filter((value) => value !== '');
  }, [beregnesTabtArbejdsfortjeneste, beregningView, eoValues, relevantRows]);
  const harTafPerioder =
    beregnesTabtArbejdsfortjeneste &&
    (eoValues.tafPerioder ?? []).some((row) => row.fra || row.til || typeof row.loseFeriedage === 'number') &&
    tafPerioderLabels.length > 0;
  const tafPerioderLines = tafPerioderLabels;
  const tafSummaryLines = harTafPerioder ? tafPerioderLines : ['Nej'];
  const tafSummaryLabel = harTafPerioder && tafPerioderLines.length > 1 ? 'TAF-perioder' : 'TAF-periode';

  const erErhvervssygdom = stamdataValues?.skadestype === 'Erhvervssygdom';
  const skadesdatoLabel = erErhvervssygdom ? 'Anmeldelsesdato' : 'Skadesdato';
  const skadesdatoDisplay = formatIsoDateLong(stamdataValues?.skadesdato) || '-';

  const erRevideret = eoValues.revideretOpgoerelse === 'Ja';
  const revideretPrefix = erRevideret ? 'Revideret ' : '';
  const erstatningsord = erRevideret ? 'erstatningsopgørelse' : 'Erstatningsopgørelse';
  const eoNummer = eoValues.eoNummer?.trim() ?? '';
  const eoLedsagetekst = eoValues.eoLedsagetekst?.trim() ?? '';
  const eoNummerPart = eoNummer ? ` ${eoNummer}` : '';
  const eoLedsagetekstPart = eoLedsagetekst ? ` (${eoLedsagetekst})` : '';
  const erstatningsopgoerelseTitel = `${revideretPrefix}${erstatningsord}${eoNummerPart}${eoLedsagetekstPart}`.trim();

  // ============================================================================
  // PDF DOWNLOAD-HÅNDTERING
  // ============================================================================

  const handleDownloadPdf = React.useCallback(async () => {
    if (!canDownloadSnapshotEoPdf) {
      return;
    }
    if (!eoSnapshot) return;

    const result = await downloadErstatningsopgoerelsePdf({
      stamdataValues,
      eoValues,
      selectedElements,
      settings,
      snapshot: eoSnapshot,
    });
    if (!result.success) {
      // Runtime-fejl under PDF-generering er en systemteknisk fejl — logges til devtools-monitor.
      // Ingen dialog eller BugReportButton vises til brugeren (jf. error-debug-contract.md §8.1).
      console.error('[EOberegningTab] EO PDF download fejlede:', result.error);
    }
  }, [canDownloadSnapshotEoPdf, eoSnapshot, stamdataValues, eoValues, selectedElements, settings]);

  const handleDownloadTafFordeltPdf = React.useCallback(async () => {
    if (!canDownloadSnapshotTafPdf) {
      return;
    }
    if (!eoSnapshot) return;

    const result = await downloadTafFordeltPaaAarPdf({
      stamdataValues,
      eoValues,
      settings,
      snapshot: eoSnapshot,
    });
    if (!result.success) {
      // Runtime-fejl under PDF-generering er en systemteknisk fejl — logges til devtools-monitor.
      // Ingen dialog eller BugReportButton vises til brugeren (jf. error-debug-contract.md §8.1).
      console.error('[EOberegningTab] TAF fordelt på år PDF download fejlede:', result.error);
    }
  }, [canDownloadSnapshotTafPdf, eoSnapshot, stamdataValues, eoValues, settings]);

  const getCustomSummaryText = React.useCallback((row: (typeof errors)[number]): string | null => {
    return getCustomDebugRowMessage(row);
  }, []);

  const formatSummaryText = React.useCallback((row: (typeof errors)[number]): string => {
    const message = toReadableSummaryMessage(row.message ?? '');
    const customSummaryText = getCustomSummaryText(row);
    if (customSummaryText) return customSummaryText;
    if (row.summaryDisplay === 'messageOnly') {
      if (message !== '') return message;
      return row.label;
    }
    if (message === '') return row.label;
    if (message.startsWith('mangler')) return `${row.label} ${message}`;
    return `${row.label}: ${message}`;
  }, [getCustomSummaryText]);

  const renderDebugRows = React.useCallback((
    rows: ReadonlyArray<(typeof errors)[number]>,
    severity: 'error' | 'warning'
  ) => {
    const icon = severity === 'error'
      ? <ErrorOutline sx={{ color: 'red', fontSize: 20 }} />
      : <WarningAmber sx={{ color: 'orange', fontSize: 20 }} />;

    return rows.map((row) => (
      <Box
        key={row.id}
        className="row--label-right-hover"
        sx={{
          '--label-width': '400px',
          ...FEJL_ADVARSLER_ROW_SX,
        }}
      >
        <Typography className="row--text">{formatSummaryText(row)}</Typography>
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
          {icon}
        </Box>
      </Box>
    ));
  }, [formatSummaryText, handleNavigate]);

  const renderSystemIssueRows = React.useCallback((rows: readonly SystemIssueRow[]) => {
    return rows.map((row) => (
      <Box
        key={row.id}
        className="row--label-right-hover"
        sx={{
          '--label-width': '400px',
          ...FEJL_ADVARSLER_ROW_SX,
        }}
      >
        <Typography className="row--text">{row.message}</Typography>
        <Box className="row--label-right-hover__content" sx={{ gap: 1 }}>
          <ErrorOutline sx={{ color: 'red', fontSize: 20 }} />
        </Box>
      </Box>
    ));
  }, []);

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <Box>
      {(systemIssueRows.length > 0 || errors.length > 0 || warnings.length > 0) && (
        <ContentBox>
          <Typography className="section-header">Fejl og advarsler</Typography>
          {renderSystemIssueRows(systemIssueRows)}
          {renderDebugRows(errors, 'error')}
          {renderDebugRows(warnings, 'warning')}
        </ContentBox>
      )}
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

        <Box className="row--label-right-hover">
          <Typography className="row--text">{svieSmerteSummaryLabel}</Typography>
          <Box
            className="row--label-right-hover__content"
            sx={{
              flexDirection: 'column',
              alignItems: 'flex-end',
              gap: 0,
            }}
          >
            {svieSmerteSummaryLines.map((line, index) => (
              <Typography key={`${line}-${index}`} className="row--text" sx={{ minHeight: 'unset', lineHeight: 1.2 }}>
                {line}
              </Typography>
            ))}
          </Box>
        </Box>

        <Box className="row--label-right-hover">
          <Typography className="row--text">{tafSummaryLabel}</Typography>
          <Box
            className="row--label-right-hover__content"
            sx={{
              flexDirection: 'column',
              alignItems: 'flex-end',
              gap: 0,
            }}
          >
            {tafSummaryLines.map((line, index) => (
              <Typography key={`${line}-${index}`} className="row--text" sx={{ minHeight: 'unset', lineHeight: 1.2 }}>
                {line}
              </Typography>
            ))}
          </Box>
        </Box>

        {/* Download-knap */}
        <Box className="row--label-right-hover">
          <Typography className="row--text">Hent opgørelse</Typography>
          <Box className="row--label-right-hover__content">
            {canDownloadSnapshotEoPdf && (
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
            {!canDownloadSnapshotEoPdf && (
              <Tooltip
                title={eoPdfDisabledReason ?? 'EO-PDF kan ikke genereres for den aktuelle sag.'}
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
              <FormControlLabel
                control={(
                  <Checkbox
                    checked={selectedElements.loenindkomst}
                    onChange={(event) => {
                      updateSelectedElement('loenindkomst', event.target.checked);
                    }}
                  />
                )}
                label="Lønindkomst"
              />
              <FormControlLabel
                control={(
                  <Checkbox
                    checked={selectedElements.offentligeYdelser}
                    onChange={(event) => {
                      updateSelectedElement('offentligeYdelser', event.target.checked);
                    }}
                  />
                )}
                label="Offentlige ydelser"
              />
            </Box>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <FormControlLabel
                control={(
                  <Checkbox
                    checked={selectedElements.regulering}
                    onChange={(event) => {
                      updateSelectedElement('regulering', event.target.checked);
                    }}
                  />
                )}
                label="Regulering"
              />
              <FormControlLabel
                control={(
                  <Checkbox
                    checked={selectedElements.shDage}
                    onChange={(event) => {
                      updateSelectedElement('shDage', event.target.checked);
                    }}
                  />
                )}
                label="SH-dage"
              />
              <FormControlLabel
                control={(
                  <Checkbox
                    checked={selectedElements.sygeferiegodtgoerelse}
                    disabled
                  />
                )}
                label={(
                  <span style={{ textDecoration: 'line-through' }}>
                    Sygeferiegodtgørelse
                  </span>
                )}
              />
            </Box>
          </Box>
        </Box>

        <Box className="row--label-right-hover">
          <Typography className="row--text">Lønindkomst og offentlige ydelser, der indsættes som bilag</Typography>
          <Box className="row--label-right-hover__content">
            <StyledDropdown
              allowEmpty={false}
              value={loenindkomstOgOffentligeYdelserIndgaar}
              onChange={updateLoenindkomstOgOffentligeYdelserIndgaar}
              width={150}
            >
              <MenuItem value="Alle">Alle</MenuItem>
              <MenuItem value="Perioden">Perioden</MenuItem>
            </StyledDropdown>
          </Box>
        </Box>
      </ContentBox>

      <ContentBox>
        <Typography className="section-header">Alternative beregninger</Typography>

        <Box className="row--label-right-hover">
          <Typography className="row--text">TAF-krav fordelt på kalenderår</Typography>
          <Box className="row--label-right-hover__content">
            {canDownloadSnapshotTafPdf && (
              <Box
                onClick={handleDownloadTafFordeltPdf}
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
            {!canDownloadSnapshotTafPdf && (
              <Tooltip
                title={tafPdfDisabledReason ?? 'TAF fordelt på år kan ikke genereres for den aktuelle sag.'}
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

    </Box>
  );
});

EOberegningTab.displayName = 'EOberegningTab';

export default EOberegningTab;
