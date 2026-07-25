/**
 * Det ENE dokument-download-entrypoint (Fase 5). Alle 21 outputs — hovedapp og standalone,
 * knapklik, tastatur og programmatisk aktivering — går gennem denne funktion.
 *
 * Den binder preflighten (`prepareDocument`) til afviklingen (`runPreparedDocument`) og oversætter
 * en afvisning til det, kalderen skal gøre: fokusér feltet, vis en brugerrettet besked, eller
 * ingenting. Kalderen har derfor ingen anledning til at reimplementere rækkefølgen — og kan det
 * ikke, fordi `runPreparedDocument` kun tager en `PreparedDocument`, som kun preflighten kan lave.
 */
import type { CriticalActionCoordinator } from '../../inputCore/runtime/criticalActionCoordinator';
import type { DocumentDefinition } from './documentDefinition';
import {
  prepareDocument,
  type DocumentEvaluationSource,
  type DocumentPreflightRejection,
} from './prepareDocument';
import { runPreparedDocument } from './runPreparedDocument';
import type { DocumentDownloadResult } from '../service/documentRuntimeFailure';

/**
 * Brugerrettet besked ved en afvist aktivering. `null` betyder "ingen besked": ved
 * `settle-failed` er feltets egen røde markering signalet (og kalderen fokuserer det), og ved
 * `editor-open` er der intet at melde, fordi download-handlingen aldrig er `noop` i §1.4-matricen
 * — grenen findes udelukkende for at holde `CriticalActionPreparationResult` udtømmende.
 */
const STALE_SOURCE_MESSAGE = 'Downloaden blev afbrudt, fordi sagen blev ændret undervejs. Prøv igen.';

export const resolveRejectionMessage = (rejection: DocumentPreflightRejection): string | null => {
  switch (rejection.status) {
    case 'gate-blocked':
      return rejection.reasons[0]?.message ?? 'Dokumentet kan ikke hentes for den aktuelle sag';
    case 'stale-source':
      return STALE_SOURCE_MESSAGE;
    case 'settle-failed':
    case 'editor-open':
      return null;
  }
};

export type DocumentDownloadOutcome =
  | Readonly<{ status: 'downloaded' }>
  | Readonly<{ status: 'failed'; error: string }>
  | Readonly<{ status: 'rejected'; rejection: DocumentPreflightRejection; message: string | null }>;

export const downloadDocument = async <TInput>(
  definition: DocumentDefinition<TInput>,
  deps: Readonly<{
    criticalActions: CriticalActionCoordinator;
    captureSource: DocumentEvaluationSource;
  }>
): Promise<DocumentDownloadOutcome> => {
  const preflight = await prepareDocument(definition, deps);
  if (preflight.status === 'rejected') {
    // Fokus-targeting sker hos kalderen: preflighten kender ikke DOM'en. Ved `settle-failed`
    // videregives targetet, så siden kan fokusere det blokerende felt uden scroll (§A2.1).
    if (preflight.rejection.status === 'settle-failed') {
      preflight.rejection.focusTarget?.focus();
    }
    return Object.freeze({
      status: 'rejected' as const,
      rejection: preflight.rejection,
      message: resolveRejectionMessage(preflight.rejection),
    });
  }

  const result: DocumentDownloadResult = await runPreparedDocument(preflight.prepared);
  return result.success
    ? Object.freeze({ status: 'downloaded' as const })
    : Object.freeze({ status: 'failed' as const, error: result.error });
};
