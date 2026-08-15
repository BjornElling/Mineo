import {
  allowDocumentDownload,
  blockDocumentDownloadForPageErrors,
  blockDocumentDownloadFromCauses,
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

/**
 * Den interne forklaring på blokeringen. Efter brugerbeslutningen 2026-08-13 er den IKKE længere
 * brugerteksten for en rækkeblokering — men den bevares som `message`, så koder, tests og logs stadig kan
 * skelne to blokeringer, der deler samme tooltip.
 */
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
  const message = resolveDisabledReason(input) ?? input.gateFallback;

  // BRUGERBESLUTNING 2026-08-13: er blokeringen en rækkefejl, står den ALLEREDE i "Fejl og advarsler"
  // ovenfor, og knappen henviser dertil frem for at citere én af rækkerne. Brugeren valgte
  // forudsigelighed over handlingsanvisning: samme tooltip hver gang boksen viser en fejl, også når
  // fejlen kunne navngives ("Feriegodtgørelse er ikke udfyldt").
  //
  // Klassen erstatter den page-lokale ternary i `EOberegningTab`, som tidligere kastede gatens svar væk
  // for netop denne tilstand. Beslutningen hører i gaten, ikke i den flade der tegner knappen.
  //
  // BEVIDST fane-uafhængig: `hasBlockingRows` afledes af gatens egen `collectAllEoRows`-kørsel uden
  // viewmodellens `isActive`-guard (§A2.1 — en gate må ikke afhænge af mount/fane). Viewmodellens guard er
  // ren render-optimering; begge kalder samme funktion på samme projektion, så teksten kan ikke drifte.
  if (input.hasBlockingRows) {
    return blockDocumentDownloadForPageErrors({ code: 'erstatningsopgoerelse:pdf-blocked-by-rows', message });
  }

  // Snapshot-, invariant- og projektionsblokeringer er IKKE rækkefejl: de har ingen garanteret række i
  // boksen, og sikkerhedsnettet i `useEoBeregningViewModel` findes netop for at fange dem. De beskriver en
  // TILSTAND i beregningen frem for et felt, brugeren kan rette.
  //
  // Scope er derfor `unavailable-calculation` og ikke længere `aggregate`: årsagen er præcis den, scopet
  // navngiver, og klassen (`missing-input`) følger af formen frem for at være et valg, dette kaldssted
  // skulle træffe. `aggregate` kræver nu en eksplicit klasse, og at skrive «mangler» i hånden her ville
  // være samme hardkodning, som brugerfundet 2026-08-15 handlede om.
  return blockDocumentDownloadFromCauses(
    'erstatningsopgoerelse:pdf-blocked',
    [{ scope: 'unavailable-calculation', message }],
    input.gateFallback
  );
};
