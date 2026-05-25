import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Typography, Checkbox, FormControlLabel, Tooltip, MenuItem } from '@mui/material';
import { Download, ErrorOutlined as ErrorOutline, WarningAmber } from '@mui/icons-material';
import ContentBox from '../../layout/ContentBox';
import { useBlockingFieldIdsBySuffixForSection, useFieldErrorsBySourceForSection } from '../../../hooks/useFormFieldErrors';
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
import { toReadableSummaryMessage } from '../../../domain/erstatningsopgoerelse/helpers/readableSummaryMessage';
import type { StamdataValues } from '../../../schemas/formSchemas';
import {
  downloadErstatningsopgoerelsePdf,
  downloadTafFordeltPaaAarPdf,
} from '../../../pdf/infrastructure/pdfService';
import type { EoSnapshot } from '../../../domain/erstatningsopgoerelse/snapshot/eoSnapshot';
import { eoSnapshotToBeregningView } from '../../../domain/erstatningsopgoerelse/snapshot/eoSnapshotToBeregningView';
import { eoSnapshotToEoPdfDocument } from '../../../domain/erstatningsopgoerelse/snapshot/eoSnapshotToEoPdfDocument';
import { eoSnapshotToTafPerYearPdfDocument } from '../../../domain/erstatningsopgoerelse/snapshot/eoSnapshotToTafPerYearPdfDocument';
import type { EoInvariant } from '../../../domain/erstatningsopgoerelse/snapshot/eoSnapshotInvariants';
import { reportSystemIssue } from '../../../utils/systemIssueReporter';
import { safeCompute } from '../../../utils/safeComputation';
import { isErr } from '../../../types/result';
import { type SetValuesUpdater } from '../../../hooks/usePersistedForm';
import {
  EO_BILAG_DYNAMIC_SELECTION_KEYS,
  getEoBilagAvailability,
  type EoBilagDynamicSelectionKey,
} from '../../../domain/erstatningsopgoerelse/helpers/eoBilagRules';
import { allowPdfDownload, blockPdfDownload, type PdfDownloadGateResult } from '../../../pdf/pdfGateTypes';
import { resolveEoCaseReguleringSettings } from '../../../domain/erstatningsopgoerelse/helpers/eoCaseReguleringSettings';

type TabKey = 'eo_oplysninger' | 'loenindkomst' | 'offentlige_ydelser' | 'beregning' | 'debug' | 'debug_tabel';

interface EOberegningTabProps {
  activeTab: TabKey;
  setActiveTab: (tab: TabKey) => void;
  isActive: boolean;
  eoSnapshot?: EoSnapshot | null;
  stamdataValues: StamdataValues;
  eoValues: ErstatningsopgoerelseValues;
  setEOValues: SetValuesUpdater<ErstatningsopgoerelseValues>;
}

type SystemIssueRow = Readonly<{
  id: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}>;

type EetIssueRow = Readonly<{
  id: string;
  message: string;
  severity: 'error' | 'warning';
  onAction: () => void;
}>;

type DebugRowsMemoResult = Readonly<{
  errors: ReadonlyArray<DebugRowWithNavigation>;
  warnings: ReadonlyArray<DebugRowWithNavigation>;
  relevantRows: ReadonlyArray<DebugRowWithNavigation>;
  debugAggregationErrorMessage: string | null;
}>;

const createPdfGate = (canDownload: boolean, reason: string | null, fallbackReason: string): PdfDownloadGateResult => {
  return canDownload
    ? allowPdfDownload()
    : blockPdfDownload({
      code: 'erstatningsopgoerelse:pdf-blocked',
      message: reason ?? fallbackReason,
    });
};

const EO_LOENINDKOMST_INPUT_ERROR_SUFFIX = ':loenindkomst';

const DEVTOOLS_REPORTABLE_INVARIANT_IDS = new Set([
  'debug:control_mismatch',
  'taf_per_year:afrunding_over_100',
]);

const isDevtoolsReportableInvariant = (invariant: EoInvariant): boolean =>
  invariant.source === 'system' && DEVTOOLS_REPORTABLE_INVARIANT_IDS.has(invariant.id);

const buildInvariantDiagnostics = (
  invariant: EoInvariant,
  snapshot: EoSnapshot | null | undefined
): Record<string, unknown> => {
  const baseContext: Record<string, unknown> = {
    invariantId: invariant.id,
    revision: snapshot?.revision ?? 'no-snapshot',
    evidence: invariant.evidence ?? [],
  };

  if (!snapshot?.data) {
    return baseContext;
  }

  if (invariant.id === 'taf_per_year:afrunding_over_100') {
    return {
      ...baseContext,
      tafTotals: {
        tabtArbejdsfortjenesteOre: snapshot.data.totals.tabtArbejdsfortjenesteOre,
        tabtArbejdsfortjenesteFoerForligOre: snapshot.data.totals.tabtArbejdsfortjenesteFoerForligOre,
        tidligereModtagetTafOre: snapshot.data.totals.tidligereModtagetTafOre,
        forligFactor: snapshot.data.totals.forligFactor,
      },
      tafNetto: {
        harTafPerioder: snapshot.data.engines.tafNetto.harTafPerioder,
        tafBeregningsenhed: snapshot.data.engines.tafNetto.tafBeregningsenhed,
        tafIndtaegterTotalOre:
          snapshot.data.engines.tafNetto.tafIndtaegter?.total.status === 'ok'
            ? snapshot.data.engines.tafNetto.tafIndtaegter.total.value
            : snapshot.data.engines.tafNetto.tafIndtaegter?.total.status,
        loenudviklingTotalOre:
          snapshot.data.engines.tafNetto.loenudvikling?.loenudviklingTotal.status === 'ok'
            ? snapshot.data.engines.tafNetto.loenudvikling.loenudviklingTotal.value
            : snapshot.data.engines.tafNetto.loenudvikling?.loenudviklingTotal.status,
      },
      sygeferiegodtgoerelse: {
        totalOre: snapshot.data.engines.tafNetto.sygeferiegodtgoerelse.totalOre,
        perYear: snapshot.data.engines.tafNetto.sygeferiegodtgoerelse.perYear,
        perAnsaettelsesforhold: snapshot.data.engines.tafNetto.sygeferiegodtgoerelse.perAnsaettelsesforhold.map((entry) => ({
          ansaettelsesforholdId: entry.ansaettelsesforholdId,
          ansaettelsesforholdNavn: entry.ansaettelsesforholdNavn,
          totalOre: entry.totalOre,
          perYear: entry.perYear,
          segmentCount: entry.segments.length,
        })),
      },
      canonicalTafPerioder: snapshot.data.canonicalOutput.periodiseringer.tafPerioder,
    };
  }

  if (invariant.id === 'debug:control_mismatch') {
    const mismatchRows = snapshot.debugSnapshot?.sammentaellingRows
      .filter((row) => (invariant.evidence ?? []).some((message) => message.startsWith(`${row.label}:`)))
      .map((row) => ({
        key: row.key,
        label: row.label,
        beregnetDisplay: row.control.beregnetDisplay,
        tabelDisplay: row.control.tabelDisplay,
        beregnetValue: row.control.beregnetValue,
        tabelValue: row.control.tabelValue,
        loseFeriedage: row.control.loseFeriedage,
        oevrigeFravaersdage: row.control.oevrigeFravaersdage,
      })) ?? [];

    return {
      ...baseContext,
      debugControlMismatch: {
        mismatchCount: invariant.evidence?.length ?? 0,
        mismatches: invariant.evidence ?? [],
        matchedRows: mismatchRows,
        allSammentaellingRowCount: snapshot.debugSnapshot?.sammentaellingRows.length ?? 0,
      },
      tafContext: {
        harTafPerioder: snapshot.data.engines.tafNetto.harTafPerioder,
        tafBeregningsenhed: snapshot.data.engines.tafNetto.tafBeregningsenhed,
        canonicalTafPerioder: snapshot.data.canonicalOutput.periodiseringer.tafPerioder,
      },
      snapshotTotals: {
        tabtArbejdsfortjenesteOre: snapshot.data.totals.tabtArbejdsfortjenesteOre,
        tabtArbejdsfortjenesteFoerForligOre: snapshot.data.totals.tabtArbejdsfortjenesteFoerForligOre,
      },
    };
  }

  return baseContext;
};

const FEJL_ADVARSLER_ROW_SX = {
  display: 'grid',
  gridTemplateColumns: '1fr max-content',
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
  row: Pick<DebugRowWithNavigation, 'id' | 'label' | 'message' | 'displayValue'>
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

  if (
    row.label.startsWith('Periode (')
    && (
      message.startsWith('Der er angivet tabt arbejdsfortjeneste efter ')
      || message.startsWith('Der er angivet tabt arbejdsfortjeneste, efter differencekrav er opgjort ')
    )
  ) {
    return message;
  }

  if (row.label === 'Valgt regulering' && message === 'Lønudvikling beregnes ud fra mangler') {
    return 'Der mangler at blive angivet lønregulering, evt. \'Ingen\'';
  }

  if (row.label === 'Valgt regulering' && message === 'Overenskomst er ikke valgt') {
    return 'Regulering er sat til \'Overenskomst\', men ingen overenskomst er valgt';
  }

  if (row.label === 'Periode til beregning af før-løn' && message === 'Ikke alle felter udfyldt') {
    return 'Der mangler indtastninger i perioden til beregning af før-løn.';
  }

  if (row.id === 'forlig.dato' && message === 'Dato for forlig kræver, at ansvarsgrad angives som procent eller brøk') {
    return 'Der er indtastet forligsdato, men ikke forligsprocent eller -brøk';
  }

  if (row.id.startsWith('sfgg.beregningskilde.') && message === 'Intet valgt') {
    return 'Beregningsgrundlag for sygeferiegodtgørelse er ikke valgt';
  }

  if (row.id.startsWith('sfgg.overenskomst.') && message === 'Ingen overenskomst valgt') {
    return 'Det er angivet, at SFGG fastsættes efter overenskomst, men ingen overenskomst er valgt';
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
  const caseSettings = React.useMemo(
    () => resolveEoCaseReguleringSettings(settings, eoValues),
    [eoValues, settings]
  );
  const stamdataErrors = useFieldErrorsBySourceForSection('stamdata');
  const eoErrors = useFieldErrorsBySourceForSection('erstatningsopgoerelse');
  const manuelReguleringInputErrors = useBlockingFieldIdsBySuffixForSection('erstatningsopgoerelse', EO_LOENINDKOMST_INPUT_ERROR_SUFFIX);

  const beregningView = React.useMemo(
    () => (eoSnapshot ? eoSnapshotToBeregningView(eoSnapshot) : null),
    [eoSnapshot]
  );
  const authoritativeBlockingInvariants = React.useMemo(
    () => beregningView?.authoritativeBlockingInvariants ?? [],
    [beregningView]
  );

  // ============================================================================
  // SAMLE ALLE DEBUG-ROWS MED NAVIGATION
  // ============================================================================

  const { errors, warnings, relevantRows, debugAggregationErrorMessage } = React.useMemo<DebugRowsMemoResult>(() => {
    if (!isActive) {
      return { errors: [], warnings: [], relevantRows: [], debugAggregationErrorMessage: null };
    }
    // Return tom liste hvis data ikke er loaded endnu
    if (!eoValues) {
      return { errors: [], warnings: [], relevantRows: [], debugAggregationErrorMessage: null };
    }

    const result = safeCompute(
      () => collectAllDebugRows(
        stamdataValues,
        stamdataErrors,
        eoValues,
        eoErrors,
        manuelReguleringInputErrors,
        caseSettings,
        beregningView?.canonicalOutput
      ),
      'EOberegningTab.collectAllDebugRows',
      { code: 'eo_debug:aggregation_failed' }
    );
    if (isErr(result)) {
      return {
        errors: [],
        warnings: [],
        relevantRows: [],
        debugAggregationErrorMessage: 'Beregningens fejloverblik kan ikke vises på grund af en intern fejl.',
      };
    }

    return { ...result.value, debugAggregationErrorMessage: null };
  }, [isActive, stamdataValues, stamdataErrors, eoValues, eoErrors, manuelReguleringInputErrors, caseSettings, beregningView]);
  const eoPdfProjection = React.useMemo(
    () => (eoSnapshot ? eoSnapshotToEoPdfDocument(eoSnapshot) : null),
    [eoSnapshot]
  );
  const tafPdfProjection = React.useMemo(
    () => (eoSnapshot ? eoSnapshotToTafPerYearPdfDocument(eoSnapshot) : null),
    [eoSnapshot]
  );
  const eoPdfBlockingInvariants = React.useMemo(
    () => (eoPdfProjection?.kind === 'blocked' ? eoPdfProjection.invariants : []),
    [eoPdfProjection]
  );
  const isSystemInvariant = React.useCallback((invariant: EoInvariant): boolean => {
    return invariant.source === 'system';
  }, []);

  const midlertidigtEetFraEetSiden = eoValues.midlertidigtEetFraEetSiden === 'Ja';
  const midlertidigtEetGroups = React.useMemo(
    () => (midlertidigtEetFraEetSiden ? (eoSnapshot?.data?.midlertidigtEetGroups ?? []) : []),
    [eoSnapshot?.data?.midlertidigtEetGroups, midlertidigtEetFraEetSiden]
  );

  /**
   * EET-issues læses fra snapshot-invarianterne. Snapshottet er den autoritative kilde
   * til både beregningsblokering og visning, så EOberegningTab ikke kalder EET-beregningen
   * parallelt.
   */
  const eetLoebendeIssueRows = React.useMemo<readonly EetIssueRow[]>(() => {
    if (!midlertidigtEetFraEetSiden) return [];
    return (eoSnapshot?.invariants ?? [])
      .filter((invariant) => invariant.id.startsWith('midlertidigt_eet_source:'))
      .map((invariant) => ({
        id: invariant.id,
        message: invariant.message,
        severity: invariant.severity,
        onAction: () => {
          navigate('/erhvervsevnetab');
        },
      }));
  }, [eoSnapshot, midlertidigtEetFraEetSiden, navigate]);
  const eetLoebendeErrorRows = React.useMemo(
    () => eetLoebendeIssueRows.filter((row) => row.severity === 'error'),
    [eetLoebendeIssueRows]
  );
  const eetLoebendeWarningRows = React.useMemo(
    () => eetLoebendeIssueRows.filter((row) => row.severity === 'warning'),
    [eetLoebendeIssueRows]
  );

  const firstBlockingDebugErrorMessage = React.useMemo(() => {
    if (debugAggregationErrorMessage) {
      return debugAggregationErrorMessage;
    }
    const firstError = errors[0];
    if (firstError) {
      const normalizedMessage = firstError.message?.trim() || '';
      return getCustomDebugRowMessage(firstError) ?? (normalizedMessage || firstError.label);
    }
    const firstEetError = eetLoebendeErrorRows[0];
    if (firstEetError) {
      return firstEetError.message;
    }
    return null;
  }, [debugAggregationErrorMessage, errors, eetLoebendeErrorRows]);

  const hasBlockingDebugErrors = errors.length > 0 || eetLoebendeErrorRows.length > 0 || debugAggregationErrorMessage !== null;
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

  const eoPdfGate = React.useMemo(
    () => createPdfGate(
      eoPdfProjection?.kind === 'ok' && !hasBlockingDebugErrors,
      eoPdfDisabledReason,
      'EO-PDF kan ikke genereres for den aktuelle sag.'
    ),
    [eoPdfDisabledReason, eoPdfProjection, hasBlockingDebugErrors]
  );
  const tafPdfGate = React.useMemo(
    () => createPdfGate(
      tafPdfProjection?.kind === 'ok' && !hasBlockingDebugErrors,
      tafPdfDisabledReason,
      'TAF fordelt på år kan ikke genereres for den aktuelle sag.'
    ),
    [hasBlockingDebugErrors, tafPdfDisabledReason, tafPdfProjection]
  );
  const canDownloadSnapshotEoPdf = eoPdfGate.canDownload;
  const canDownloadSnapshotTafPdf = tafPdfGate.canDownload;

  const reportableSystemInvariants = React.useMemo(() => {
    return [
      ...authoritativeBlockingInvariants,
      ...eoPdfBlockingInvariants,
      ...(tafPdfProjection?.kind === 'blocked' ? tafPdfProjection.invariants : []),
    ].filter((invariant, index, array) =>
      isDevtoolsReportableInvariant(invariant)
      && array.findIndex((candidate) => candidate.id === invariant.id && candidate.message === invariant.message) === index
    );
  }, [authoritativeBlockingInvariants, eoPdfBlockingInvariants, tafPdfProjection]);

  const reportedSystemInvariantKeysRef = React.useRef<Set<string>>(new Set());
  const [pdfDownloadErrorMessage, setPdfDownloadErrorMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    const revision = eoSnapshot?.revision ?? 'no-snapshot';
    reportableSystemInvariants.forEach((invariant) => {
      const key = `${revision}:${invariant.id}:${invariant.message}`;
      if (reportedSystemInvariantKeysRef.current.has(key)) return;
      reportedSystemInvariantKeysRef.current.add(key);

      reportSystemIssue({
        code: invariant.id,
        area: 'eo',
        context: 'EOberegningTab',
        userMessage: invariant.message,
        revision,
        evidence: invariant.evidence ?? [],
        diagnostics: buildInvariantDiagnostics(invariant, eoSnapshot),
      });
    });
  }, [eoSnapshot, eoSnapshot?.revision, reportableSystemInvariants]);

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
      switch (eoSnapshot.failClosedReason) {
        case 'runtime_exception':
          // Runtime-undtagelser skal allerede være rapporteret centralt i computeEoSnapshot
          // via reportSystemIssue. Her vises kun en neutral inline-række uden rapportknap,
          // så UI-kontrakten ikke er implicit koblet til catch-blokken.
          pushIssue({
            id: 'snapshot-fail-closed-runtime',
            message: eoSnapshot.invariants[0]?.message ?? 'Beregningen kan ikke gennemføres på grund af en intern runtimefejl.',
          });
          break;
        case 'invariant_guard':
        case 'schema_guard':
        default:
          // Neutral fejlbesked uden BugReportButton for deterministiske fail_closed-tilstande.
          pushIssue({
            id: 'snapshot-fail-closed',
            message: eoSnapshot.invariants[0]?.message ?? 'Beregningen kan ikke gennemføres — ret manglende eller ugyldige felter.',
          });
          break;
      }
    }

    if (debugAggregationErrorMessage) {
      pushIssue({
        id: 'debug-aggregation-failed',
        message: debugAggregationErrorMessage,
        actionLabel: 'Debug tabel',
        onAction: () => setActiveTab('debug_tabel'),
      });
    }

    // Systeminvarianter med reel systemfejl-semantik vises samlet her.
    // TAF-afstemningsfejl bevarer fortsat også tooltip-blokeringen på downloadknappen.
    [
      ...authoritativeBlockingInvariants,
      ...eoPdfBlockingInvariants,
      ...(tafPdfProjection?.kind === 'blocked' ? tafPdfProjection.invariants : []),
    ]
      .filter((invariant) => isSystemInvariant(invariant) && isDevtoolsReportableInvariant(invariant))
      .forEach((invariant) => {
        pushIssue({
          id: invariant.id,
          message: invariant.message,
          actionLabel: invariant.id === 'debug:control_mismatch' ? 'Debug tabel' : undefined,
          onAction: invariant.id === 'debug:control_mismatch'
            ? () => setActiveTab('debug_tabel')
            : undefined,
        });
      });

    return rows;
  }, [
    authoritativeBlockingInvariants,
    eoPdfBlockingInvariants,
    eoSnapshot,
    debugAggregationErrorMessage,
    isSystemInvariant,
    setActiveTab,
    tafPdfProjection,
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

    const isLoenindkomstEmploymentDebugRow =
      pendingNavigation.target.tabId === 'loenindkomst' &&
      (
        pendingNavigation.debugRowId.startsWith('loenindkomst.')
        || pendingNavigation.debugRowId.startsWith('sfgg.')
      );

    if (isLoenindkomstEmploymentDebugRow) {
      runRowScroll();
      setPendingNavigation(null);
      return () => {
        cancelled = true;
      };
    }

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

  const baseSelectedElements = React.useMemo(() => (
    eoValues.eoBilagSelection ?? {
      opgoerelse: true as const,
      loenindkomst: true,
      offentligeYdelser: true,
      midlertidigEet: true,
      shDage: false,
      regulering: true,
      okSatser: true,
      sygeferiegodtgoerelse: true,
    }
  ), [eoValues.eoBilagSelection]);
  const bilagAvailability = React.useMemo(
    () => getEoBilagAvailability({ eoValues, skadedatoISO: stamdataValues.skadedato }),
    [eoValues, stamdataValues.skadedato]
  );
  const selectedElements = React.useMemo(() => {
    const next = { ...baseSelectedElements };
    for (const key of EO_BILAG_DYNAMIC_SELECTION_KEYS) {
      if (!bilagAvailability[key].enabled) {
        next[key] = false;
      }
    }
    return next;
  }, [baseSelectedElements, bilagAvailability]);
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
  const svieSmerteLines = React.useMemo(() => {
    if (!beregnesSvieSmerte) return [];
    if (svieSmerteRow?.status === 'error') return ['Fejl'];
    return (svieSmerteRow?.displayValue ?? '-')
      .split('\n')
      .map((value) => value.trim())
      .filter((value) => value !== '' && value !== '-');
  }, [beregnesSvieSmerte, svieSmerteRow]);
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
    const harTafPeriodeFejl = tafPeriodeRows.some((row) => row.status === 'error');

    if (harTafPeriodeFejl) {
      return ['Fejl'];
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
  const skadedatoLabel = erErhvervssygdom ? 'Anmeldelsesdato' : 'Skadedato';
  const skadedatoDisplay = formatIsoDateLong(stamdataValues?.skadedato) || '-';

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
      setPdfDownloadErrorMessage(null);
      return;
    }
    if (!eoSnapshot) return;

    const result = await downloadErstatningsopgoerelsePdf({
      stamdataValues,
      eoValues,
      selectedElements,
      settings,
      snapshot: eoSnapshot,
      midlertidigtEetGroups,
    });
    setPdfDownloadErrorMessage(result.success ? null : result.error);
  }, [canDownloadSnapshotEoPdf, eoSnapshot, stamdataValues, eoValues, selectedElements, settings, midlertidigtEetGroups]);

  const handleDownloadTafFordeltPdf = React.useCallback(async () => {
    if (!canDownloadSnapshotTafPdf) {
      setPdfDownloadErrorMessage(null);
      return;
    }
    if (!eoSnapshot) return;

    const result = await downloadTafFordeltPaaAarPdf({
      stamdataValues,
      eoValues,
      settings,
      snapshot: eoSnapshot,
    });
    setPdfDownloadErrorMessage(result.success ? null : result.error);
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
      ? <ErrorOutline sx={{ color: 'var(--color-status-error)', fontSize: 20 }} />
      : <WarningAmber sx={{ color: 'var(--color-status-warning)', fontSize: 20 }} />;

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
        <Box
          className="row--label-right-hover__content"
          sx={{
            gap: 1,
            alignItems: row.actionLabel ? 'center' : 'flex-start',
          }}
        >
          {row.actionLabel && row.onAction && (
            <Typography
              className="row--text icon-text-link"
              component="button"
              type="button"
              onClick={row.onAction}
              sx={{
                cursor: 'pointer',
                border: 0,
                background: 'transparent',
                p: 0,
                m: 0,
                font: 'inherit',
              }}
            >
              {row.actionLabel}
            </Typography>
          )}
          <ErrorOutline
            sx={{
              color: 'var(--color-status-error)',
              fontSize: 20,
              alignSelf: row.actionLabel ? 'center' : 'flex-start',
            }}
          />
        </Box>
      </Box>
    ));
  }, []);

  const renderEetLoebendeIssueRows = React.useCallback((rows: readonly EetIssueRow[]) => {
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
          <Typography className="row--text">
            Erhvervsevnetab {'->'}{' '}
          </Typography>
          <Typography
            className="row--text icon-text-link"
            component="button"
            type="button"
            onClick={row.onAction}
            sx={{
              cursor: 'pointer',
              border: 0,
              background: 'transparent',
              p: 0,
              m: 0,
              font: 'inherit',
            }}
          >
            Løbende ydelser
          </Typography>
          {row.severity === 'error' ? (
            <ErrorOutline sx={{ color: 'var(--color-status-error)', fontSize: 20 }} />
          ) : (
            <WarningAmber sx={{ color: 'var(--color-status-warning)', fontSize: 20 }} />
          )}
        </Box>
      </Box>
    ));
  }, []);

  const renderBilagCheckbox = React.useCallback((
    key: EoBilagDynamicSelectionKey,
    label: string
  ) => {
    const availability = bilagAvailability[key];
    const checkbox = (
      <FormControlLabel
        className="mineo-disabled-hover-target"
        control={(
          <Checkbox
            checked={selectedElements[key]}
            disabled={!availability.enabled}
            onChange={(event) => {
              updateSelectedElement(key, event.target.checked);
            }}
          />
        )}
        label={label}
        sx={{ mr: 0 }}
      />
    );

    if (availability.enabled || !availability.disabledReason) {
      return <React.Fragment key={key}>{checkbox}</React.Fragment>;
    }

    return (
      <Tooltip key={key} title={availability.disabledReason} arrow placement="top">
        <Box component="span" className="mineo-disabled-hover-target">{checkbox}</Box>
      </Tooltip>
    );
  }, [bilagAvailability, selectedElements, updateSelectedElement]);

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <Box>
      {(pdfDownloadErrorMessage || systemIssueRows.length > 0 || errors.length > 0 || warnings.length > 0 || eetLoebendeIssueRows.length > 0) && (
        <ContentBox>
          <Typography className="section-header">Fejl og advarsler</Typography>
          {pdfDownloadErrorMessage && (
            <Box
              className="row--label-right-hover"
              sx={{
                '--label-width': '400px',
                ...FEJL_ADVARSLER_ROW_SX,
              }}
            >
              <Typography className="row--text">{pdfDownloadErrorMessage}</Typography>
              <Box className="row--label-right-hover__content" sx={{ gap: 1 }}>
                <ErrorOutline sx={{ color: 'var(--color-status-error)', fontSize: 20 }} />
              </Box>
            </Box>
          )}
          {renderSystemIssueRows(systemIssueRows)}
          {renderDebugRows(errors, 'error')}
          {renderEetLoebendeIssueRows(eetLoebendeErrorRows)}
          {renderDebugRows(warnings, 'warning')}
          {renderEetLoebendeIssueRows(eetLoebendeWarningRows)}
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
          <Typography className="row--text">{skadedatoLabel}</Typography>
          <Box className="row--label-right-hover__content">
            <Typography className="row--text">{skadedatoDisplay}</Typography>
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
                    backgroundColor: 'var(--color-icon-action-hover)',
                  },
                  '&:active': {
                    backgroundColor: 'var(--color-icon-action-active)',
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
            className="row--label-right-hover__content disabled-hover-checkbox-group"
            sx={{
              display: 'flex',
              flexDirection: 'column',
              gap: 0,
              alignItems: 'flex-end',
              '& .MuiFormControlLabel-label': {
                fontFamily: 'var(--font-family-base)',
                fontSize: '15px',
                fontWeight: 'var(--font-weight-regular)',
                lineHeight: 'var(--line-height-base)',
                color: 'var(--mineo-color-row-text)',
              },
            }}
          >
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <Box component="span" className="mineo-disabled-hover-target">
                <FormControlLabel
                  className="mineo-disabled-hover-target"
                  control={<Checkbox checked={selectedElements.opgoerelse} disabled />}
                  label="Opgørelse"
                />
              </Box>
              {renderBilagCheckbox('loenindkomst', 'Lønindkomst')}
              {renderBilagCheckbox('offentligeYdelser', 'Offentlige ydelser')}
              {renderBilagCheckbox('midlertidigEet', 'Midlertidig EET')}
            </Box>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              {renderBilagCheckbox('regulering', 'Regulering')}
              {renderBilagCheckbox('shDage', 'SH-dage')}
              {renderBilagCheckbox('sygeferiegodtgoerelse', 'Sygeferiegodtgørelse')}
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
                    backgroundColor: 'var(--color-icon-action-hover)',
                  },
                  '&:active': {
                    backgroundColor: 'var(--color-icon-action-active)',
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
