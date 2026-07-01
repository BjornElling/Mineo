import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useBlockingFieldIdsBySuffixForSection, useFieldErrorsBySourceForSection } from '../../../../hooks/useFormFieldErrors';
import { setActiveTabForPage } from '../../../../hooks/usePersistedActiveTab';
import { collectAllEoRows } from '../../../../domain/eoRowEvaluation/eoRowAggregator';
import type { EoRowWithNavigation } from '../../../../domain/eoRowEvaluation/eoRowAggregator';
import type { NavigationTarget } from '../../../../domain/eoRowEvaluation/eoRowNavigationMap';
import { resolveEoIssueSummaryText } from '../../../../domain/eoRowEvaluation/eoRowIssueCatalog';
import { scrollToSection } from '../../../../utils/scrollToSection';
import { scrollToDebugRow } from '../../../../utils/scrollToDebugRow';
import { formatIsoDateLong } from '../../../../utils/dateFormatting';
import { useAppSettings } from '../../../../contexts/useAppSettings';
import type { ErstatningsopgoerelseValues, StamdataValues } from '../../../../schemas/formSchemas';
import { isoToDanish } from '../../../../types/branded';
import { type StyledDropdownChangeEvent } from '../../../inputs/StyledDropdown';
import { toReadableSummaryMessage } from '../../../../domain/erstatningsopgoerelse/helpers/readableSummaryMessage';
import {
  downloadErstatningsopgoerelseDokument,
  downloadTafFordeltPaaAarDokument,
  downloadTafKravGrafDokument,
  downloadTafOpreguleretPaaAarDokument,
} from '../../../../document/service/documentService';
import type { EoSnapshot } from '../../../../domain/erstatningsopgoerelse/snapshot/eoSnapshot';
import { eoSnapshotToBeregningView } from '../../../../domain/erstatningsopgoerelse/snapshot/eoSnapshotToBeregningView';
import { eoSnapshotToEoDocument } from '../../../../domain/erstatningsopgoerelse/snapshot/eoSnapshotToEoDocument';
import { eoSnapshotToTafPerYearDocument } from '../../../../domain/erstatningsopgoerelse/snapshot/eoSnapshotToTafPerYearDocument';
import { eoSnapshotToTafPerYearOpreguleretDocument } from '../../../../domain/erstatningsopgoerelse/snapshot/eoSnapshotToTafPerYearOpreguleretDocument';
import { eoSnapshotToTafKravGrafDocument } from '../../../../domain/erstatningsopgoerelse/snapshot/eoSnapshotToTafKravGrafDocument';
import type { EoInvariant } from '../../../../domain/erstatningsopgoerelse/snapshot/eoSnapshotInvariants';
import { reportSystemIssue } from '../../../../utils/systemIssueReporter';
import { safeCompute } from '../../../../utils/safeComputation';
import { isErr } from '../../../../types/result';
import { type SetValuesUpdater } from '../../../../hooks/usePersistedForm';
import {
  EO_BILAG_DYNAMIC_SELECTION_KEYS,
  getEoBilagAvailability,
} from '../../../../domain/erstatningsopgoerelse/helpers/eoBilagRules';
import { type DocumentDownloadGateResult } from '../../../../document/layout/documentGateTypes';
import { evaluateEoDocumentDownloadGate } from '../../../../domain/erstatningsopgoerelse/snapshot/eoDocumentDownloadGate';
import type { EoIssueFocusTarget } from '../../../../domain/eoRowEvaluation/eoRowTypes';
import {
  resolveMidlertidigtEetIssueNavigation,
  type EetIssueNavigationTarget,
} from '../../../../domain/erhvervsevnetab/eetIssueNavigation';

export type TabKey = 'eo_oplysninger' | 'loenindkomst' | 'offentlige_ydelser' | 'beregning' | 'debug' | 'debug_tabel';

export interface EOberegningTabProps {
  activeTab: TabKey;
  setActiveTab: (tab: TabKey) => void;
  isActive: boolean;
  eoSnapshot?: EoSnapshot | null;
  stamdataValues: StamdataValues;
  eoValues: ErstatningsopgoerelseValues;
  setEOValues: SetValuesUpdater<ErstatningsopgoerelseValues>;
}

export type SystemIssueRow = Readonly<{
  id: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}>;

export type EetIssueRow = Readonly<{
  id: string;
  message: string;
  severity: 'error' | 'warning';
  navigation: EetIssueNavigationTarget;
  onAction: () => void;
}>;

type EoRowsMemoResult = Readonly<{
  errors: ReadonlyArray<EoRowWithNavigation>;
  warnings: ReadonlyArray<EoRowWithNavigation>;
  relevantRows: ReadonlyArray<EoRowWithNavigation>;
  eoRowAggregationErrorMessage: string | null;
}>;

const EO_LOENINDKOMST_INPUT_ERROR_SUFFIX = ':loenindkomst';

const DEVTOOLS_REPORTABLE_INVARIANT_IDS = new Set([
  'debug:control_mismatch',
  'taf_per_year:afrunding_over_100',
]);

const isDevtoolsReportableInvariant = (invariant: EoInvariant): boolean =>
  invariant.source === 'system' && DEVTOOLS_REPORTABLE_INVARIANT_IDS.has(invariant.id);

const scrollToRowIssueTarget = (debugRowId: string, focusTarget: EoIssueFocusTarget | undefined): void => {
  if (focusTarget) {
    scrollToDebugRow(debugRowId, { focusTarget });
    return;
  }
  scrollToDebugRow(debugRowId);
};

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

/**
 * View-model-laget for Erstatningsopgørelse-beregningsfanen.
 *
 * Ejer al afledt visningstilstand: debug-rækker med navigation, snapshot-projektioner og
 * download-gates, system-/EET-issue-rækker, bilag-valg, opsummeringslinjer og PDF-download-handlers.
 * Returnerer én flad model; fanen beholder kun præsentations-render-helpers + selve JSX'en — jf.
 * arkitektur-kandidat A1 (view-model-lag under fagsiderne). Adfærdsbevarende: logikken er flyttet
 * uændret ud af `EOberegningTab`.
 */
export function useEoBeregningViewModel(props: EOberegningTabProps) {
  const { activeTab, setActiveTab, isActive, eoSnapshot = null, stamdataValues, eoValues, setEOValues } = props;

  const navigate = useNavigate();
  const { settings } = useAppSettings();
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

  const { errors, warnings, relevantRows, eoRowAggregationErrorMessage } = React.useMemo<EoRowsMemoResult>(() => {
    if (!isActive) {
      return { errors: [], warnings: [], relevantRows: [], eoRowAggregationErrorMessage: null };
    }
    // Return tom liste hvis data ikke er loaded endnu
    if (!eoValues) {
      return { errors: [], warnings: [], relevantRows: [], eoRowAggregationErrorMessage: null };
    }

    const result = safeCompute(
      () => collectAllEoRows(
        stamdataValues,
        stamdataErrors,
        eoValues,
        eoErrors,
        manuelReguleringInputErrors,
        settings,
        beregningView?.canonicalOutput,
        // pdfModel SKAL med, så download-gaten ser de samme resultat-afhængige SFGG-fejlrækker
        // som DEV-debug-fanen (jf. collectAllEoRows-doc). Uden den var gaten fail-open for dem.
        eoSnapshot?.data?.pdfModel
      ),
      'EOberegningTab.collectAllEoRows',
      { code: 'eo_debug:aggregation_failed' }
    );
    if (isErr(result)) {
      return {
        errors: [],
        warnings: [],
        relevantRows: [],
        eoRowAggregationErrorMessage: 'Beregningens fejloverblik kan ikke vises på grund af en intern fejl',
      };
    }

    return { ...result.value, eoRowAggregationErrorMessage: null };
  }, [isActive, stamdataValues, stamdataErrors, eoValues, eoErrors, manuelReguleringInputErrors, settings, beregningView, eoSnapshot?.data?.pdfModel]);
  const eoPdfProjection = React.useMemo(
    () => (eoSnapshot ? eoSnapshotToEoDocument(eoSnapshot) : null),
    [eoSnapshot]
  );
  const tafPdfProjection = React.useMemo(
    () => (eoSnapshot ? eoSnapshotToTafPerYearDocument(eoSnapshot) : null),
    [eoSnapshot]
  );
  const tafOpreguleretPdfProjection = React.useMemo(
    () => (eoSnapshot ? eoSnapshotToTafPerYearOpreguleretDocument(eoSnapshot) : null),
    [eoSnapshot]
  );
  const tafKravGrafPdfProjection = React.useMemo(
    () => (eoSnapshot ? eoSnapshotToTafKravGrafDocument(eoSnapshot) : null),
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
      .map((invariant) => {
        const sourceIssueId = invariant.id.replace(/^midlertidigt_eet_source:/, '');
        const navigation = resolveMidlertidigtEetIssueNavigation({ id: sourceIssueId });
        return {
          id: invariant.id,
          message: invariant.message,
          severity: invariant.severity,
          navigation,
          onAction: () => {
            switch (navigation.kind) {
              case 'erhvervsevnetab-tab':
                setActiveTabForPage('erhvervsevnetab', navigation.tabKey);
                navigate('/erhvervsevnetab');
                break;
              case 'stamdata-page':
                navigate('/stamdata');
                // Land på det konkrete felt, hvis issuet peger på ét (parallelt til EO-rækkernes
                // stamdata-sti). Den generiske schema-invalid har intet enkelt felt → kun navigation.
                if (navigation.focusFieldPath) {
                  scrollToDebugRow('', {
                    focusTarget: { kind: 'fieldPath', fieldPath: navigation.focusFieldPath },
                  });
                }
                break;
              default: {
                const _exhaustive: never = navigation;
                return _exhaustive;
              }
            }
          },
        };
      });
  }, [eoSnapshot, midlertidigtEetFraEetSiden, navigate]);
  const eetLoebendeErrorRows = React.useMemo(
    () => eetLoebendeIssueRows.filter((row) => row.severity === 'error'),
    [eetLoebendeIssueRows]
  );
  const eetLoebendeWarningRows = React.useMemo(
    () => eetLoebendeIssueRows.filter((row) => row.severity === 'warning'),
    [eetLoebendeIssueRows]
  );

  const firstBlockingEoRowErrorMessage = React.useMemo(() => {
    if (eoRowAggregationErrorMessage) {
      return eoRowAggregationErrorMessage;
    }
    const firstError = errors[0];
    if (firstError) {
      const normalizedMessage = firstError.message?.trim() || '';
      return firstError.summaryText ?? resolveEoIssueSummaryText(firstError) ?? (normalizedMessage || firstError.label);
    }
    const firstEetError = eetLoebendeErrorRows[0];
    if (firstEetError) {
      return firstEetError.message;
    }
    return null;
  }, [eoRowAggregationErrorMessage, errors, eetLoebendeErrorRows]);

  const hasBlockingEoRowErrors = errors.length > 0 || eetLoebendeErrorRows.length > 0 || eoRowAggregationErrorMessage !== null;

  // Ét autoritativt output-gate-resultat pr. dokument (arkitektur-kandidat A5). Den fælles, rene
  // domæne-funktion ejer beslutnings-præcedensen; her leveres de live-inputs (række-/EET-blokering,
  // snapshot, projektion). Samme gate videregives til service-grænsen, så dokument-genereringen
  // fail-closer på præcis samme beslutning som download-knappen.
  const eoPdfGate = React.useMemo(
    () => evaluateEoDocumentDownloadGate({
      snapshot: eoSnapshot,
      projection: eoPdfProjection,
      authoritativeBlockingInvariants,
      blockingRowMessage: firstBlockingEoRowErrorMessage,
      hasBlockingRows: hasBlockingEoRowErrors,
      failClosedFallback: 'Opgørelsen kan ikke hentes for den aktuelle sag',
      gateFallback: 'Opgørelsen kan ikke hentes for den aktuelle sag',
    }),
    [authoritativeBlockingInvariants, eoPdfProjection, eoSnapshot, firstBlockingEoRowErrorMessage, hasBlockingEoRowErrors]
  );
  const tafPdfGate = React.useMemo(
    () => evaluateEoDocumentDownloadGate({
      snapshot: eoSnapshot,
      projection: tafPdfProjection,
      authoritativeBlockingInvariants,
      blockingRowMessage: firstBlockingEoRowErrorMessage,
      hasBlockingRows: hasBlockingEoRowErrors,
      failClosedFallback: 'TAF fordelt på år kan ikke genereres for den aktuelle sag',
      gateFallback: 'TAF fordelt på år kan ikke genereres for den aktuelle sag',
    }),
    [authoritativeBlockingInvariants, eoSnapshot, firstBlockingEoRowErrorMessage, hasBlockingEoRowErrors, tafPdfProjection]
  );
  const tafOpreguleretPdfGate = React.useMemo(
    () => evaluateEoDocumentDownloadGate({
      snapshot: eoSnapshot,
      projection: tafOpreguleretPdfProjection,
      authoritativeBlockingInvariants,
      blockingRowMessage: firstBlockingEoRowErrorMessage,
      hasBlockingRows: hasBlockingEoRowErrors,
      failClosedFallback: 'TAF opreguleret til beregningsåret kan ikke genereres for den aktuelle sag',
      gateFallback: 'TAF opreguleret til beregningsåret kan ikke genereres for den aktuelle sag',
    }),
    [authoritativeBlockingInvariants, eoSnapshot, firstBlockingEoRowErrorMessage, hasBlockingEoRowErrors, tafOpreguleretPdfProjection]
  );
  const tafKravGrafPdfGate = React.useMemo(
    () => evaluateEoDocumentDownloadGate({
      snapshot: eoSnapshot,
      projection: tafKravGrafPdfProjection,
      authoritativeBlockingInvariants,
      blockingRowMessage: firstBlockingEoRowErrorMessage,
      hasBlockingRows: hasBlockingEoRowErrors,
      failClosedFallback: 'Visuel graf over indtægtsniveau kan ikke genereres for den aktuelle sag',
      gateFallback: 'Visuel graf over indtægtsniveau kan ikke genereres for den aktuelle sag',
    }),
    [authoritativeBlockingInvariants, eoSnapshot, firstBlockingEoRowErrorMessage, hasBlockingEoRowErrors, tafKravGrafPdfProjection]
  );

  // disabledReason til tooltips udledes nu af gaten (ikke-null præcis når gaten blokerer) — samme
  // værdi som tidligere, men én kilde.
  const gateDisabledReason = (gate: DocumentDownloadGateResult): string | null =>
    gate.canDownload ? null : (gate.reasons[0]?.message ?? null);
  const eoPdfDisabledReason = gateDisabledReason(eoPdfGate);
  const tafPdfDisabledReason = gateDisabledReason(tafPdfGate);
  const tafOpreguleretPdfDisabledReason = gateDisabledReason(tafOpreguleretPdfGate);
  const tafKravGrafPdfDisabledReason = gateDisabledReason(tafKravGrafPdfGate);

  const canDownloadSnapshotEoPdf = eoPdfGate.canDownload;
  const canDownloadSnapshotTafPdf = tafPdfGate.canDownload;
  const canDownloadSnapshotTafOpreguleretPdf = tafOpreguleretPdfGate.canDownload;
  const canDownloadSnapshotTafKravGrafPdf = tafKravGrafPdfGate.canDownload;

  const reportableSystemInvariants = React.useMemo(() => {
    return [
      ...authoritativeBlockingInvariants,
      ...eoPdfBlockingInvariants,
      ...(tafPdfProjection?.kind === 'blocked' ? tafPdfProjection.invariants : []),
      ...(tafOpreguleretPdfProjection?.kind === 'blocked' ? tafOpreguleretPdfProjection.invariants : []),
      ...(tafKravGrafPdfProjection?.kind === 'blocked' ? tafKravGrafPdfProjection.invariants : []),
    ].filter((invariant, index, array) =>
      isDevtoolsReportableInvariant(invariant)
      && array.findIndex((candidate) => candidate.id === invariant.id && candidate.message === invariant.message) === index
    );
  }, [authoritativeBlockingInvariants, eoPdfBlockingInvariants, tafPdfProjection, tafOpreguleretPdfProjection, tafKravGrafPdfProjection]);

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
            message: eoSnapshot.invariants[0]?.message ?? 'Beregningen kan ikke gennemføres på grund af en intern runtimefejl',
          });
          break;
        case 'invariant_guard':
        case 'schema_guard':
        default:
          // Neutral fejlbesked uden BugReportButton for deterministiske fail_closed-tilstande.
          pushIssue({
            id: 'snapshot-fail-closed',
            message: eoSnapshot.invariants[0]?.message ?? 'Beregningen kan ikke gennemføres — ret manglende eller ugyldige felter',
          });
          break;
      }
    }

    if (eoRowAggregationErrorMessage) {
      pushIssue({
        id: 'eo-row-aggregation-failed',
        message: eoRowAggregationErrorMessage,
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
    eoRowAggregationErrorMessage,
    isSystemInvariant,
    setActiveTab,
    tafPdfProjection,
  ]);

  const [pendingNavigation, setPendingNavigation] = React.useState<{
    target: NavigationTarget;
    debugRowId: string;
    focusTarget?: EoIssueFocusTarget;
  } | null>(null);

  const handleNavigate = React.useCallback(
    (target: NavigationTarget, debugRowId: string, focusTarget?: EoIssueFocusTarget) => {
      switch (target.kind) {
        case 'erstatningsopgoerelse-tab':
          // Switch til korrekt fane
          setActiveTab(target.tabId);
          // Scroll til specifik række + evt. sektion når fanen er aktiv
          setPendingNavigation({ target, debugRowId, focusTarget });
          break;

        case 'stamdata-page':
          // Naviger til Stamdata-siden
          navigate('/stamdata');
          scrollToRowIssueTarget(debugRowId, focusTarget);
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
      scrollToRowIssueTarget(pendingNavigation.debugRowId, pendingNavigation.focusTarget);
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
    () => getEoBilagAvailability({
      eoValues,
      skadedatoISO: stamdataValues.skadedato,
      loenudvikling: eoSnapshot?.data?.pdfModel.tabtArbejdsfortjeneste.loenudvikling,
      offentligeYdelserUdvikling: eoSnapshot?.data?.pdfModel.tabtArbejdsfortjeneste.offentligeYdelserUdvikling,
    }),
    [eoValues, eoSnapshot?.data?.pdfModel.tabtArbejdsfortjeneste.loenudvikling, eoSnapshot?.data?.pdfModel.tabtArbejdsfortjeneste.offentligeYdelserUdvikling, stamdataValues.skadedato]
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
      }), { fieldPath: 'eoBilagLoenindkomstOgOffentligeYdelserIndgaar' });
    },
    [setEOValues]
  );

  const beregnesSvieSmerte = eoValues.kravPaaSvieSmerteGodtgoerelse === 'Ja';
  const beregnesTabtArbejdsfortjeneste = eoValues.kravPaaTabtArbejdsfortjeneste === 'Ja';

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
  // 'Skjul' har samme beregningsadfærd som 'Nej', men udelades helt fra opgørelses-PDF'en.
  // Markér det i oversigten, så det er tydeligt at emnet er fravalgt fra dokumentet (ikke kun 0 kr.).
  const svieSmerteFravalgtTekst = eoValues.kravPaaSvieSmerteGodtgoerelse === 'Skjul' ? 'Nej (skjult)' : 'Nej';
  const svieSmerteSummaryLines = harSvieSmertePerioder ? svieSmerteLines : [svieSmerteFravalgtTekst];
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
  const tafFravalgtTekst = eoValues.kravPaaTabtArbejdsfortjeneste === 'Skjul' ? 'Nej (skjult)' : 'Nej';
  const tafSummaryLines = harTafPerioder ? tafPerioderLines : [tafFravalgtTekst];
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

  const handleDownloadPdf = React.useCallback(async () => {
    if (!canDownloadSnapshotEoPdf) {
      setPdfDownloadErrorMessage(null);
      return;
    }
    if (!eoSnapshot) return;

    const result = await downloadErstatningsopgoerelseDokument({
      stamdataValues,
      eoValues,
      selectedElements,
      settings,
      snapshot: eoSnapshot,
      midlertidigtEetGroups,
      gate: eoPdfGate,
    });
    setPdfDownloadErrorMessage(result.success ? null : result.error);
  }, [canDownloadSnapshotEoPdf, eoSnapshot, stamdataValues, eoValues, selectedElements, settings, midlertidigtEetGroups, eoPdfGate]);

  const handleDownloadTafFordeltPdf = React.useCallback(async () => {
    if (!canDownloadSnapshotTafPdf) {
      setPdfDownloadErrorMessage(null);
      return;
    }
    if (!eoSnapshot) return;

    const result = await downloadTafFordeltPaaAarDokument({
      stamdataValues,
      eoValues,
      settings,
      snapshot: eoSnapshot,
      gate: tafPdfGate,
    });
    setPdfDownloadErrorMessage(result.success ? null : result.error);
  }, [canDownloadSnapshotTafPdf, eoSnapshot, stamdataValues, eoValues, settings, tafPdfGate]);

  const handleDownloadTafOpreguleretPdf = React.useCallback(async () => {
    if (!canDownloadSnapshotTafOpreguleretPdf) {
      setPdfDownloadErrorMessage(null);
      return;
    }
    if (!eoSnapshot) return;

    const result = await downloadTafOpreguleretPaaAarDokument({
      stamdataValues,
      eoValues,
      selectedElements,
      settings,
      snapshot: eoSnapshot,
      midlertidigtEetGroups,
      gate: tafOpreguleretPdfGate,
    });
    setPdfDownloadErrorMessage(result.success ? null : result.error);
  }, [canDownloadSnapshotTafOpreguleretPdf, eoSnapshot, stamdataValues, eoValues, selectedElements, settings, midlertidigtEetGroups, tafOpreguleretPdfGate]);

  const handleDownloadTafKravGrafPdf = React.useCallback(async () => {
    if (!canDownloadSnapshotTafKravGrafPdf) {
      setPdfDownloadErrorMessage(null);
      return;
    }
    if (!eoSnapshot) return;

    const result = await downloadTafKravGrafDokument({
      eoValues,
      settings,
      snapshot: eoSnapshot,
      gate: tafKravGrafPdfGate,
    });
    setPdfDownloadErrorMessage(result.success ? null : result.error);
  }, [canDownloadSnapshotTafKravGrafPdf, eoSnapshot, eoValues, settings, tafKravGrafPdfGate]);

  const formatSummaryText = React.useCallback((row: (typeof errors)[number]): string => {
    const issueSummaryText = row.summaryText ?? resolveEoIssueSummaryText(row);
    if (issueSummaryText) return issueSummaryText;
    const message = toReadableSummaryMessage(row.message ?? '');
    if (row.summaryDisplay === 'messageOnly') {
      if (message !== '') return message;
      return row.label;
    }
    if (message === '') return row.label;
    if (message.startsWith('mangler')) return `${row.label} ${message}`;
    return `${row.label}: ${message}`;
  }, []);

  return {
    // Debug-/issue-rækker
    errors,
    warnings,
    eetLoebendeIssueRows,
    eetLoebendeErrorRows,
    eetLoebendeWarningRows,
    systemIssueRows,

    // Download-gates + årsager
    pdfDownloadErrorMessage,
    hasBlockingEoRowErrors,
    eoPdfDisabledReason,
    tafPdfDisabledReason,
    tafOpreguleretPdfDisabledReason,
    tafKravGrafPdfDisabledReason,
    canDownloadSnapshotEoPdf,
    canDownloadSnapshotTafPdf,
    canDownloadSnapshotTafOpreguleretPdf,
    canDownloadSnapshotTafKravGrafPdf,
    handleDownloadPdf,
    handleDownloadTafFordeltPdf,
    handleDownloadTafOpreguleretPdf,
    handleDownloadTafKravGrafPdf,

    // Navigation + bilag
    handleNavigate,
    selectedElements,
    bilagAvailability,
    updateSelectedElement,
    loenindkomstOgOffentligeYdelserIndgaar,
    updateLoenindkomstOgOffentligeYdelserIndgaar,

    // Opsummeringslinjer
    svieSmerteSummaryLabel,
    svieSmerteSummaryLines,
    tafSummaryLabel,
    tafSummaryLines,
    skadedatoLabel,
    skadedatoDisplay,
    erstatningsopgoerelseTitel,

    // Render-formattering
    formatSummaryText,
  };
}
