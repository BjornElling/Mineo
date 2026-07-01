import {
  allowDocumentDownload,
  blockDocumentDownload,
  type DocumentDownloadGateResult,
} from '../../../document/layout/documentGateTypes';
import type { EoInvariant } from './eoSnapshotInvariants';
import type { EoSnapshot } from './eoSnapshot';

/**
 * Ét autoritativt output-gate-resultat pr. EO-dokument (arkitektur-kandidat A5).
 *
 * Download-gaten for de fire EO-dokumenter var tidligere sammensat ad hoc i `useEoBeregningViewModel`
 * (per-dokument `disabledReason`-memo + `createPdfGate`) OG re-tjekket separat — kun på dokument-
 * projektionen — i `documentService`. Service-grænsen var derfor IKKE selv fail-closed mod række-
 * niveau-fejlene fra `collectAllEoRows` (fx resultat-afhængige SFGG-fejlrækker): de gatede knappen
 * upstream, men ikke selve dokument-genereringen.
 *
 * Denne rene funktion ejer nu gate-beslutningen ét sted. View-modellen kalder den for hvert dokument
 * (med live AppSettings/felt-fejl tilgængelige til række-evalueringen) og videregiver det resulterende
 * `DocumentDownloadGateResult` til service-grænsen, som fail-closer på det. Service-laget får dermed
 * ét gate-resultat pr. dokument uden at skulle kende AppSettings (C15-grænsen bevares).
 *
 * Beslutnings-præcedensen er bevaret byte-for-byte fra view-modellens tidligere per-gate-logik.
 */
export type EoDownloadProjectionStatus =
  | Readonly<{ kind: 'ok' }>
  | Readonly<{ kind: 'blocked'; message: string }>
  | null;

export type EvaluateEoDocumentDownloadGateInput = Readonly<{
  /** Snapshottet (null før første build). */
  snapshot: EoSnapshot | null;
  /** Dokumentets egen projektion (ok/blocked) — kun `kind` + `message` aflæses. */
  projection: EoDownloadProjectionStatus;
  /** De autoritativt-blokerende invarianter (blocksAuthoritativeComputation). */
  authoritativeBlockingInvariants: readonly EoInvariant[];
  /** Første blokerende række-/EET-fejlbesked fra collectAllEoRows-overblikket, ellers null. */
  blockingRowMessage: string | null;
  /** Sand hvis der er nogen blokerende række-/EET-fejl (gater download). */
  hasBlockingRows: boolean;
  /** Fallback-besked når snapshottet er fail_closed uden invariant-besked. */
  failClosedFallback: string;
  /** Endelig fallback-besked når intet andet leverede en årsag. */
  gateFallback: string;
}>;

const resolveDisabledReason = (input: EvaluateEoDocumentDownloadGateInput): string | null => {
  if (input.blockingRowMessage) {
    return input.blockingRowMessage;
  }
  if (!input.snapshot) return 'Download ikke mulig, før der er bygget et gyldigt snapshot';
  if (input.snapshot.status === 'fail_closed') {
    return input.snapshot.invariants[0]?.message ?? input.failClosedFallback;
  }
  if (input.authoritativeBlockingInvariants.length > 0) {
    return input.authoritativeBlockingInvariants[0]?.message ?? 'EO-beregningen er blokeret af snapshot-kontroller';
  }
  if (input.projection?.kind === 'blocked') {
    return input.projection.message;
  }
  return null;
};

export const evaluateEoDocumentDownloadGate = (
  input: EvaluateEoDocumentDownloadGateInput
): DocumentDownloadGateResult => {
  const canDownload = input.projection?.kind === 'ok' && !input.hasBlockingRows;
  if (canDownload) {
    return allowDocumentDownload();
  }
  return blockDocumentDownload({
    code: 'erstatningsopgoerelse:pdf-blocked',
    message: resolveDisabledReason(input) ?? input.gateFallback,
  });
};
