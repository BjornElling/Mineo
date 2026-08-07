import React from 'react';
import { useNavigate } from 'react-router-dom';
import { setActiveTabForPage } from '../../../../hooks/usePersistedActiveTab';
import { APP_ROUTES } from '../../../../config/pageNavigation';
import { collectAllEoRows } from '../../../../domain/eoRowEvaluation/eoRowAggregator';
import type { EoRowWithNavigation } from '../../../../domain/eoRowEvaluation/eoRowAggregator';
import type { NavigationTarget } from '../../../../domain/eoRowEvaluation/eoRowNavigationMap';
import { resolveEoIssueSummaryText } from '../../../../domain/eoRowEvaluation/eoRowIssueCatalog';
import { scrollToSection } from '../../../../utils/scrollToSection';
import { scrollToEoRow } from '../../../../utils/scrollToEoRow';
import { formatIsoDateLong } from '../../../../utils/dateFormatting';
import { useAppSettings } from '../../../../contexts/useAppSettings';
import { projectEoRowPolicy, projectSourceSettings } from '../../../../settings/sourceSettings';
import { isoToDanish } from '../../../../types/branded';
import { toReadableSummaryMessage } from '../../../../domain/erstatningsopgoerelse/helpers/readableSummaryMessage';
import {
  erstatningsopgoerelseDocumentDefinition,
  tafFordeltPaaAarDocumentDefinition,
  tafKravGrafDocumentDefinition,
  tafOpreguleretPaaAarDocumentDefinition,
} from '../../../../domain/erstatningsopgoerelse/eoDocumentDefinitions';
import {
  useMineoDocumentOutputWithContext,
  useMineoDocumentSourceContext,
} from '../../../../document/runtime/react/useMineoDocumentOutput';
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
import { getEoBilagAvailability } from '../../../../domain/erstatningsopgoerelse/helpers/eoBilagRules';
import type { EoIssueFocusTarget } from '../../../../domain/eoRowEvaluation/eoRowTypes';
import {
  resolveMidlertidigtEetIssueNavigation,
  type EetIssueNavigationTarget,
} from '../../../../domain/erhvervsevnetab/eetIssueNavigation';
import type { ErstatningsopgoerelseReaderProjection } from '../../../../domain/erstatningsopgoerelse/erstatningsopgoerelseReaderProjection';
import { selectBlockingLoenindkomstEntityIds } from '../../../../domain/erstatningsopgoerelse/eoInputIssues';

export type TabKey = 'eo_oplysninger' | 'loenindkomst' | 'offentlige_ydelser' | 'beregning' | 'inspektion' | 'kontroltabel';

export interface EOberegningTabProps {
  activeTab: TabKey;
  setActiveTab: (tab: TabKey) => void;
  isActive: boolean;
  projection: ErstatningsopgoerelseReaderProjection;
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


const DEVTOOLS_REPORTABLE_INVARIANT_IDS = new Set([
  'control:sammentaelling_mismatch',
  'taf_per_year:afrunding_over_100',
]);

const isDevtoolsReportableInvariant = (invariant: EoInvariant): boolean =>
  invariant.source === 'system' && DEVTOOLS_REPORTABLE_INVARIANT_IDS.has(invariant.id);

const scrollToRowIssueTarget = (rowId: string, focusTarget: EoIssueFocusTarget | undefined): void => {
  if (focusTarget) {
    scrollToEoRow(rowId, { focusTarget });
    return;
  }
  scrollToEoRow(rowId);
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

  if (invariant.id === 'control:sammentaelling_mismatch') {
    const mismatchRows = snapshot.inspektionSnapshot?.sammentaellingRows
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
      inspektionControlMismatch: {
        mismatchCount: invariant.evidence?.length ?? 0,
        mismatches: invariant.evidence ?? [],
        matchedRows: mismatchRows,
        allSammentaellingRowCount: snapshot.inspektionSnapshot?.sammentaellingRows.length ?? 0,
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
 * Ejer al afledt visningstilstand: kontrol-rækker med navigation, snapshot-projektioner og
 * download-gates, system-/EET-issue-rækker, bilag-valg, opsummeringslinjer og PDF-download-handlers.
 * Returnerer én flad model; fanen beholder kun præsentations-render-helpers + selve JSX'en — jf.
 * arkitektur-kandidat A1 (view-model-lag under fagsiderne). Adfærdsbevarende: logikken er flyttet
 * uændret ud af `EOberegningTab`.
 */
export function useEoBeregningViewModel(props: EOberegningTabProps) {
  const { activeTab, setActiveTab, isActive, projection } = props;
  const { snapshot: eoSnapshot, stamdataValues, eoValues, stamdataErrors, eoErrors } = projection;

  const navigate = useNavigate();
  const { settings } = useAppSettings();
  // Rækkeevalueringen gater EO-downloaden, så den må kun se de nøgler, der indgår i
  // settingsrevisionen. Projektionen er den ENESTE vej til `EoRowPolicy`; en bred `AppSettings` kan
  // ikke sendes ind. En nøgle uden for sættet kunne ellers
  // ændre gatens udfald uden at gøre et optaget `EvaluationSourceToken` stale.
  const rowPolicy = React.useMemo(
    () => projectEoRowPolicy(projectSourceSettings(settings)),
    [settings]
  );
  const manuelReguleringInputErrors = React.useMemo(
    () => selectBlockingLoenindkomstEntityIds(eoErrors),
    [eoErrors]
  );

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
        rowPolicy,
        beregningView?.canonicalOutput,
        // pdfModel SKAL med, så download-gaten ser de samme resultat-afhængige SFGG-fejlrækker
        // som DEV-kontrolfanerne (jf. collectAllEoRows-doc). Uden den var gaten fail-open for dem.
        eoSnapshot?.data?.pdfModel
      ),
      'EOberegningTab.collectAllEoRows',
      { code: 'eo_inspektion:aggregation_failed' }
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
  }, [isActive, stamdataValues, stamdataErrors, eoValues, eoErrors, manuelReguleringInputErrors, rowPolicy, beregningView, eoSnapshot?.data?.pdfModel]);
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
                navigate(APP_ROUTES.erhvervsevnetab);
                break;
              case 'stamdata-page':
                navigate(APP_ROUTES.stamdata);
                // Land på det konkrete felt, hvis issuet peger på ét (parallelt til EO-rækkernes
                // stamdata-sti). Den generiske schema-invalid har intet enkelt felt → kun navigation.
                if (navigation.focusFieldAddress) {
                  scrollToEoRow('', {
                    focusTarget: { kind: 'fieldAddress', address: navigation.focusFieldAddress },
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

  const hasBlockingEoRowErrors = errors.length > 0 || eetLoebendeErrorRows.length > 0 || eoRowAggregationErrorMessage !== null;

  /**
   * De fire EO-dokumentoutputs. Hele preflighten — settle, frisk capture, token-lighed,
   * projektion, gate — ligger nu i definitionerne, som deler ÉN kildekontekst: `collectAllEoRows` og
   * gate-sættet køres derfor én gang pr. revision, ikke fire. Bilagsudvælgelsen og den valgfri
   * `midlertidigtEetGroups` er flyttet ind i definitionerne, hvor de hører til: de er dokumentets
   * input, ikke sidens.
   */
  const documentContext = useMineoDocumentSourceContext();
  const eoDownload = useMineoDocumentOutputWithContext(erstatningsopgoerelseDocumentDefinition, undefined, documentContext);
  const tafFordeltDownload = useMineoDocumentOutputWithContext(tafFordeltPaaAarDocumentDefinition, undefined, documentContext);
  const tafOpreguleretDownload = useMineoDocumentOutputWithContext(tafOpreguleretPaaAarDocumentDefinition, undefined, documentContext);
  const tafKravGrafDownload = useMineoDocumentOutputWithContext(tafKravGrafDocumentDefinition, undefined, documentContext);

  // Knaptilstand og tooltip kommer fra PRÆCIS den definition, klikket aktiverer (§10 acceptkriterie 27).
  const eoPdfDisabledReason = eoDownload.disabledReason ?? null;
  const tafPdfDisabledReason = tafFordeltDownload.disabledReason ?? null;
  const tafOpreguleretPdfDisabledReason = tafOpreguleretDownload.disabledReason ?? null;
  const tafKravGrafPdfDisabledReason = tafKravGrafDownload.disabledReason ?? null;

  const canDownloadSnapshotEoPdf = eoDownload.canDownload;
  const canDownloadSnapshotTafPdf = tafFordeltDownload.canDownload;
  const canDownloadSnapshotTafOpreguleretPdf = tafOpreguleretDownload.canDownload;
  const canDownloadSnapshotTafKravGrafPdf = tafKravGrafDownload.canDownload;

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
  /**
   * Den fælles fejlboks for de fire outputs. Gate-blokeringer bærer ingen besked — knappens tooltip
   * ejer årsagen — så boksen viser kun et stale-afbrud eller en død DEV-server. Hvert output bidrager
   * kun med sin egen besked, så en gammel besked ikke overlever et nyt klik på et andet output.
   */
  const pdfDownloadErrorMessage =
    eoDownload.errorMessage
    ?? tafFordeltDownload.errorMessage
    ?? tafOpreguleretDownload.errorMessage
    ?? tafKravGrafDownload.errorMessage;

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
        actionLabel: 'Kontroltabel',
        onAction: () => setActiveTab('kontroltabel'),
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
          actionLabel: invariant.id === 'control:sammentaelling_mismatch' ? 'Kontroltabel' : undefined,
          onAction: invariant.id === 'control:sammentaelling_mismatch'
            ? () => setActiveTab('kontroltabel')
            : undefined,
        });
      });

    // SIKKERHEDSNET (garanti: download må ALDRIG blokeres uden en synlig fejl i "Fejl og advarsler").
    // En autoritativt-blokerende validerings-invariant blokerer download. Den forventes normalt
    // reproduceret som en synlig række af `collectAllEoRows`, men hvis en row-builder ikke dækker
    // reglen — eller `eoSnapshot.data` er null, så en resultat-afhængig række ikke kan dannes — ville
    // download ellers være blokeret med en tom fejlboks. Vises kun når boksen ellers er tom for
    // error-niveau-indhold, så dette aldrig dublerer en allerede vist, målrettet fejl. Beskeden er
    // validatorens egen brugervendte tekst.
    const hasErrorLevelContent =
      rows.length > 0
      || errors.length > 0
      || eetLoebendeErrorRows.length > 0
      || eoRowAggregationErrorMessage !== null;
    if (!hasErrorLevelContent) {
      authoritativeBlockingInvariants
        // EET-kilde-invarianter har deres egen visningskanal (`eetLoebendeIssueRows`) med samme
        // toggle-styrede synlighed som deres oprettelse (kun når midlertidigt-EET-import er aktiv),
        // så de er aldrig en usynlig-blokerings-risiko og må ikke dubleres her.
        .filter((invariant) => !invariant.id.startsWith('midlertidigt_eet_source:'))
        .forEach((invariant) => {
          pushIssue({ id: `blocking-invariant:${invariant.id}`, message: invariant.message });
        });
    }

    return rows;
  }, [
    authoritativeBlockingInvariants,
    eoPdfBlockingInvariants,
    eoSnapshot,
    eoRowAggregationErrorMessage,
    errors,
    eetLoebendeErrorRows,
    isSystemInvariant,
    setActiveTab,
    tafPdfProjection,
  ]);

  const [pendingNavigation, setPendingNavigation] = React.useState<{
    target: NavigationTarget;
    rowId: string;
    focusTarget?: EoIssueFocusTarget;
  } | null>(null);

  const handleNavigate = React.useCallback(
    (target: NavigationTarget, rowId: string, focusTarget?: EoIssueFocusTarget) => {
      switch (target.kind) {
        case 'erstatningsopgoerelse-tab':
          // Switch til korrekt fane
          setActiveTab(target.tabId);
          // Scroll til specifik række + evt. sektion når fanen er aktiv
          setPendingNavigation({ target, rowId, focusTarget });
          break;

        case 'stamdata-page':
          // Naviger til Stamdata-siden
          navigate(APP_ROUTES.stamdata);
          scrollToRowIssueTarget(rowId, focusTarget);
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
      scrollToRowIssueTarget(pendingNavigation.rowId, pendingNavigation.focusTarget);
    };

    const isLoenindkomstEmploymentInspektionRow =
      pendingNavigation.target.tabId === 'loenindkomst' &&
      (
        pendingNavigation.rowId.startsWith('loenindkomst.')
        || pendingNavigation.rowId.startsWith('sfgg.')
      );

    if (isLoenindkomstEmploymentInspektionRow) {
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

  const bilagAvailability = React.useMemo(
    () => getEoBilagAvailability({
      eoValues,
      skadedatoISO: stamdataValues.skadedato,
      loenudvikling: eoSnapshot?.data?.pdfModel.tabtArbejdsfortjeneste.loenudvikling,
      offentligeYdelserUdvikling: eoSnapshot?.data?.pdfModel.tabtArbejdsfortjeneste.offentligeYdelserUdvikling,
    }),
    [eoValues, eoSnapshot?.data?.pdfModel.tabtArbejdsfortjeneste.loenudvikling, eoSnapshot?.data?.pdfModel.tabtArbejdsfortjeneste.offentligeYdelserUdvikling, stamdataValues.skadedato]
  );
  const beregnesSvieSmerte = eoValues.kravPaaSvieSmerteGodtgoerelse === 'Ja';
  const beregnesTabtArbejdsfortjeneste = eoValues.kravPaaTabtArbejdsfortjeneste === 'Ja';

  const svieSmerteRow = relevantRows.find((row) => row.id === 'sviesmerte.beregnetPeriode');
  const svieSmerteLines = React.useMemo(() => {
    if (!beregnesSvieSmerte) return [];
    if (svieSmerteRow?.status === 'error') return ['Fejl'];
    // Rækkens strukturerede `lines` er kilden. Tidligere blev `displayValue` splittet på `\n`
    // her — en skjult aftale med row-builderen, som en formatteringsændring kunne bryde lydløst,
    // og som driver synlig UI-forgrening (antal linjer afgør ental/flertal i etiketten).
    return svieSmerteRow?.lines ?? [];
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

  const handleDownloadPdf = React.useCallback(async () => { await eoDownload.download(undefined); }, [eoDownload]);
  const handleDownloadTafFordeltPdf = React.useCallback(async () => { await tafFordeltDownload.download(undefined); }, [tafFordeltDownload]);
  const handleDownloadTafOpreguleretPdf = React.useCallback(async () => { await tafOpreguleretDownload.download(undefined); }, [tafOpreguleretDownload]);
  const handleDownloadTafKravGrafPdf = React.useCallback(async () => { await tafKravGrafDownload.download(undefined); }, [tafKravGrafDownload]);

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
    // Kontrol-/issue-rækker
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
    bilagAvailability,

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
