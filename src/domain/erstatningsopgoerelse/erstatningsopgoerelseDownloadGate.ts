import type { AppSettings } from '../../settings/appSettingsSchema';
import { DEFAULT_APP_SETTINGS } from '../../settings/appSettingsSchema';
import { collectAllEoRows } from '../eoRowEvaluation/eoRowAggregator';
import { resolveEoIssueSummaryText } from '../eoRowEvaluation/eoRowIssueCatalog';
import { safeCompute } from '../../utils/safeComputation';
import { isErr } from '../../types/result';
import type { DocumentDownloadGateResult } from '../../document/layout/documentGateTypes';
import type { EoSnapshot } from './snapshot/eoSnapshot';
import { getAuthoritativeBlockingInvariants } from './snapshot/eoSnapshotInvariants';
import { eoSnapshotToEoDocument } from './snapshot/eoSnapshotToEoDocument';
import { eoSnapshotToTafPerYearDocument } from './snapshot/eoSnapshotToTafPerYearDocument';
import { eoSnapshotToTafPerYearOpreguleretDocument } from './snapshot/eoSnapshotToTafPerYearOpreguleretDocument';
import { eoSnapshotToTafKravGrafDocument } from './snapshot/eoSnapshotToTafKravGrafDocument';
import {
  evaluateEoDocumentDownloadGate,
  type EoDownloadProjectionStatus,
} from './snapshot/eoDocumentDownloadGate';
import type { ErstatningsopgoerelseReaderProjection } from './erstatningsopgoerelseReaderProjection';
import { selectBlockingEoEntityIdsBySuffix } from './eoInputIssues';

// Greenfield EO download-gate (§3.4/§3.9/§5.4, Fase 2.4 trin 8). En ren, React-fri gate der afledes af den ENE
// reader-projektion (`buildErstatningsopgoerelseReaderProjection`) i stedet for `useEoBeregningViewModel`'s live
// store-reads (`useFieldErrorsBySourceForSection`/`useBlockingFieldIdsBySuffixForSection`). Den ejer gate-
// beslutningen for de FIRE EO-dokumenter (erstatningsopgørelse, TAF fordelt på år, TAF opreguleret, TAF-kravgraf).
//
// Beslutnings-præcedensen genbruges BYTE-FOR-BYTE fra `evaluateEoDocumentDownloadGate` (den samme rene funktion,
// view-modellen allerede kalder), fodret med:
//  - per-dokument-projektionen `eoSnapshotToXxxDocument(snapshot)` (ok/blocked),
//  - de autoritativt-blokerende invarianter fra snapshottet (`getAuthoritativeBlockingInvariants`),
//  - den første blokerende række-/EET-fejlbesked + hasBlockingRows fra `collectAllEoRows`, fodret med reader-
//    projektionens rekonstruerede værdier og error-maps (inkl. `${afId}:loenindkomst`-aggregatet → suffix-gaten).
// Dermed blokerer gaten på PRÆCIS de samme rækker som DEV-kontrolfanen og den nuværende view-model, uden at læse
// nogen rå sektion eller monteret felt.

/** De fire selvstændige EO-dokumenter. */
export type EoDocumentKey = 'erstatningsopgoerelse' | 'tafFordeltPaaAar' | 'tafOpreguleret' | 'tafKravGraf';

/** Gate-resultatet + tooltip-årsag for hvert af de fire EO-dokumenter. */
export type ErstatningsopgoerelseDownloadGates = Readonly<Record<EoDocumentKey, DocumentDownloadGateResult>>;

const FALLBACK_MESSAGE: Record<EoDocumentKey, string> = {
  erstatningsopgoerelse: 'Opgørelsen kan ikke hentes for den aktuelle sag',
  tafFordeltPaaAar: 'TAF fordelt på år kan ikke genereres for den aktuelle sag',
  tafOpreguleret: 'TAF opreguleret til beregningsåret kan ikke genereres for den aktuelle sag',
  tafKravGraf: 'Visuel graf over indtægtsniveau kan ikke genereres for den aktuelle sag',
};

const EO_LOENINDKOMST_INPUT_ERROR_SUFFIX = ':loenindkomst';

/** Én dokument-projektions gate-relevante status (kun `kind` + `message` aflæses af gaten). */
const toProjectionStatus = (
  projection: Readonly<{ kind: 'ok' }> | Readonly<{ kind: 'blocked'; message: string }> | null
): EoDownloadProjectionStatus => projection;

/**
 * Den samlede række-/EET-blokerings-tilstand, som gaten forbruger — udledt af reader-projektionens rekonstruerede
 * værdier og error-maps. Spejler `useEoBeregningViewModel`s `firstBlockingEoRowErrorMessage`/`hasBlockingEoRowErrors`.
 */
type EoRowBlockingState = Readonly<{ blockingRowMessage: string | null; hasBlockingRows: boolean }>;

const resolveEoRowBlockingState = (
  projection: ErstatningsopgoerelseReaderProjection,
  settings: AppSettings
): EoRowBlockingState => {
  // BEVIDST: ingen `isActive`-guard som view-modellen (der springer collectAllEoRows over på en inaktiv fane
  // for at spare render-arbejde). Gaten er en ren funktion af inputtet og må ikke afhænge af component mount/fane
  // (§3.4/§3.9 + acceptkriterie §10 pkt. 22) — den afspejler altid den sande blokerings-tilstand.
  const { snapshot, eoValues, stamdataValues, eoErrors, stamdataErrors } = projection;

  // EET-kilde-fejl (kun ved aktiv midlertidigt-EET-import) læses fra snapshot-invarianterne, som view-modellen.
  const eetErrorMessages = eoValues.midlertidigtEetFraEetSiden === 'Ja'
    ? (snapshot.invariants ?? [])
      .filter((invariant) => invariant.id.startsWith('midlertidigt_eet_source:') && invariant.severity === 'error')
      .map((invariant) => invariant.message)
    : [];

  const manuelReguleringInputErrors = selectBlockingEoEntityIdsBySuffix(eoErrors, EO_LOENINDKOMST_INPUT_ERROR_SUFFIX);

  const rowsResult = safeCompute(
    () => collectAllEoRows(
      stamdataValues,
      stamdataErrors,
      eoValues,
      eoErrors,
      manuelReguleringInputErrors,
      settings,
      snapshot.data?.canonicalOutput,
      snapshot.data?.pdfModel
    ),
    'erstatningsopgoerelseDownloadGate.collectAllEoRows',
    { code: 'eo_inspektion:aggregation_failed' }
  );

  if (isErr(rowsResult)) {
    // En aggregerings-fejl er selv en blokerende tilstand (som view-modellens `eoRowAggregationErrorMessage`).
    return {
      blockingRowMessage: 'Beregningens fejloverblik kan ikke vises på grund af en intern fejl',
      hasBlockingRows: true,
    };
  }

  const errors = rowsResult.value.errors;
  const firstError = errors[0];
  const firstErrorMessage = firstError
    ? (firstError.summaryText
      ?? resolveEoIssueSummaryText(firstError)
      ?? ((firstError.message?.trim() || '') || firstError.label))
    : (eetErrorMessages[0] ?? null);

  return {
    blockingRowMessage: firstErrorMessage,
    hasBlockingRows: errors.length > 0 || eetErrorMessages.length > 0,
  };
};

/**
 * Bygger gate-beslutningen for alle fire EO-dokumenter ud fra reader-projektionen. Hvert dokument gates med sin
 * egen projektion, men deler den fælles række-/invariant-blokering (som den nuværende view-model).
 */
export const evaluateErstatningsopgoerelseDownloadGates = (
  projection: ErstatningsopgoerelseReaderProjection,
  settings: AppSettings = DEFAULT_APP_SETTINGS
): ErstatningsopgoerelseDownloadGates => {
  const snapshot: EoSnapshot = projection.snapshot;
  const authoritativeBlockingInvariants = getAuthoritativeBlockingInvariants(snapshot.invariants);
  const { blockingRowMessage, hasBlockingRows } = resolveEoRowBlockingState(projection, settings);

  const gateFor = (
    key: EoDocumentKey,
    documentProjection: Readonly<{ kind: 'ok' }> | Readonly<{ kind: 'blocked'; message: string }> | null
  ): DocumentDownloadGateResult =>
    evaluateEoDocumentDownloadGate({
      snapshot,
      projection: toProjectionStatus(documentProjection),
      authoritativeBlockingInvariants,
      blockingRowMessage,
      hasBlockingRows,
      failClosedFallback: FALLBACK_MESSAGE[key],
      gateFallback: FALLBACK_MESSAGE[key],
    });

  return {
    erstatningsopgoerelse: gateFor('erstatningsopgoerelse', eoSnapshotToEoDocument(snapshot)),
    tafFordeltPaaAar: gateFor('tafFordeltPaaAar', eoSnapshotToTafPerYearDocument(snapshot)),
    tafOpreguleret: gateFor('tafOpreguleret', eoSnapshotToTafPerYearOpreguleretDocument(snapshot)),
    tafKravGraf: gateFor('tafKravGraf', eoSnapshotToTafKravGrafDocument(snapshot)),
  };
};
