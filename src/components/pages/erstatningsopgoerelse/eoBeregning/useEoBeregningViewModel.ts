import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useBlockingFieldIdsBySuffixForSection, useFieldErrorsBySourceForSection } from '../../../../hooks/useFormFieldErrors';
import { collectAllDebugRows } from '../../../../domain/eoRowEvaluation/eoDebugRowAggregator';
import type { DebugRowWithNavigation } from '../../../../domain/eoRowEvaluation/eoDebugRowAggregator';
import type { NavigationTarget } from '../../../../domain/eoRowEvaluation/eoDebugNavigationMap';
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
import { allowDocumentDownload, blockDocumentDownload, type DocumentDownloadGateResult } from '../../../../document/layout/documentGateTypes';

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
  onAction: () => void;
}>;

type DebugRowsMemoResult = Readonly<{
  errors: ReadonlyArray<DebugRowWithNavigation>;
  warnings: ReadonlyArray<DebugRowWithNavigation>;
  relevantRows: ReadonlyArray<DebugRowWithNavigation>;
  debugAggregationErrorMessage: string | null;
}>;

const EO_LOENINDKOMST_INPUT_ERROR_SUFFIX = ':loenindkomst';

const createPdfGate = (canDownload: boolean, reason: string | null, fallbackReason: string): DocumentDownloadGateResult => {
  return canDownload
    ? allowDocumentDownload()
    : blockDocumentDownload({
      code: 'erstatningsopgoerelse:pdf-blocked',
      message: reason ?? fallbackReason,
    });
};

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
    return 'Angivelse af lønudvikling mangler';
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
        settings,
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
  }, [isActive, stamdataValues, stamdataErrors, eoValues, eoErrors, manuelReguleringInputErrors, settings, beregningView]);
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
      return eoSnapshot.invariants[0]?.message ?? 'Opgørelsen kan ikke hentes for den aktuelle sag.';
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

  const tafOpreguleretPdfDisabledReason = React.useMemo(() => {
    if (firstBlockingDebugErrorMessage) {
      return firstBlockingDebugErrorMessage;
    }
    if (!eoSnapshot) return 'Download ikke mulig, før der er bygget et gyldigt snapshot';
    if (eoSnapshot.status === 'fail_closed') {
      return eoSnapshot.invariants[0]?.message ?? 'TAF opreguleret til beregningsåret kan ikke genereres for den aktuelle sag.';
    }
    if (authoritativeBlockingInvariants.length > 0) {
      return authoritativeBlockingInvariants[0]?.message ?? 'EO-beregningen er blokeret af snapshot-kontroller.';
    }
    if (tafOpreguleretPdfProjection?.kind === 'blocked') {
      return tafOpreguleretPdfProjection.message;
    }
    return null;
  }, [authoritativeBlockingInvariants, eoSnapshot, tafOpreguleretPdfProjection, firstBlockingDebugErrorMessage]);

  const tafKravGrafPdfDisabledReason = React.useMemo(() => {
    if (firstBlockingDebugErrorMessage) {
      return firstBlockingDebugErrorMessage;
    }
    if (!eoSnapshot) return 'Download ikke mulig, før der er bygget et gyldigt snapshot';
    if (eoSnapshot.status === 'fail_closed') {
      return eoSnapshot.invariants[0]?.message ?? 'Visuel graf over indtægtsniveau kan ikke genereres for den aktuelle sag.';
    }
    if (authoritativeBlockingInvariants.length > 0) {
      return authoritativeBlockingInvariants[0]?.message ?? 'EO-beregningen er blokeret af snapshot-kontroller.';
    }
    if (tafKravGrafPdfProjection?.kind === 'blocked') {
      return tafKravGrafPdfProjection.message;
    }
    return null;
  }, [authoritativeBlockingInvariants, eoSnapshot, tafKravGrafPdfProjection, firstBlockingDebugErrorMessage]);

  const eoPdfGate = React.useMemo(
    () => createPdfGate(
      eoPdfProjection?.kind === 'ok' && !hasBlockingDebugErrors,
      eoPdfDisabledReason,
      'Opgørelsen kan ikke hentes for den aktuelle sag.'
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
  const tafOpreguleretPdfGate = React.useMemo(
    () => createPdfGate(
      tafOpreguleretPdfProjection?.kind === 'ok' && !hasBlockingDebugErrors,
      tafOpreguleretPdfDisabledReason,
      'TAF opreguleret til beregningsåret kan ikke genereres for den aktuelle sag.'
    ),
    [hasBlockingDebugErrors, tafOpreguleretPdfDisabledReason, tafOpreguleretPdfProjection]
  );
  const tafKravGrafPdfGate = React.useMemo(
    () => createPdfGate(
      tafKravGrafPdfProjection?.kind === 'ok' && !hasBlockingDebugErrors,
      tafKravGrafPdfDisabledReason,
      'Visuel graf over indtægtsniveau kan ikke genereres for den aktuelle sag.'
    ),
    [hasBlockingDebugErrors, tafKravGrafPdfDisabledReason, tafKravGrafPdfProjection]
  );
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
    });
    setPdfDownloadErrorMessage(result.success ? null : result.error);
  }, [canDownloadSnapshotEoPdf, eoSnapshot, stamdataValues, eoValues, selectedElements, settings, midlertidigtEetGroups]);

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
    });
    setPdfDownloadErrorMessage(result.success ? null : result.error);
  }, [canDownloadSnapshotTafPdf, eoSnapshot, stamdataValues, eoValues, settings]);

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
    });
    setPdfDownloadErrorMessage(result.success ? null : result.error);
  }, [canDownloadSnapshotTafOpreguleretPdf, eoSnapshot, stamdataValues, eoValues, selectedElements, settings, midlertidigtEetGroups]);

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
    });
    setPdfDownloadErrorMessage(result.success ? null : result.error);
  }, [canDownloadSnapshotTafKravGrafPdf, eoSnapshot, eoValues, settings]);

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
    hasBlockingDebugErrors,
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
