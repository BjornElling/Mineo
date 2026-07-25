/**
 * Dokument-download-livscyklussens ENE resultat-algebra (Fase 5, pass 0).
 *
 * Før pass 0 fandtes tre former i serie: servicelagets legacy `{success, error}`, kernens
 * `DocumentPreflightRejection` og entrypointets `DocumentDownloadOutcome`. Hver oversættelse tabte
 * information — mest alvorligt blev en STALE kilde under afviklingen oversat til præcis samme
 * generiske tekst som en ægte generatorfejl ("Kunne ikke generere …-PDF"), mens den samme tilstand
 * i preflighten korrekt gav en transient "prøv igen"-besked. To identiske tilstande, to forskellige
 * beskeder, afhængigt af hvilken async-fase de indtraf i.
 *
 * Her er der derfor ÉN union for hele livscyklussen, med `phase` bevaret som auditdata frem for som
 * beskedvalg. Reglen er: **tilstanden bestemmer beskeden; fasen bestemmer kun diagnostikken.**
 *
 * Taksonomien skelner tre ting, som §A5 kræver holdt adskilt:
 *   - `rejected` — forventelig, brugerrettelig eller transient. Rapporteres IKKE som systemfejl.
 *   - `failed` med `kind: 'dev-server-unavailable'` — kun DEV; miljøproblem, ikke en programfejl.
 *   - `failed` med `kind: 'runtime'` — uventet. Den ENESTE klasse der hører til systemfejl-sinken.
 */
import type { DocumentDownloadGateReason } from '../layout/documentGateTypes';
import type { DocumentOutputId } from './documentOutputId';

/**
 * Hvor i livscyklussen noget skete. Bevares som diagnostik på både afvisninger og fejl, så en
 * stale-kilde kan skelnes fra en anden stale-kilde i telemetrien UDEN at ændre brugerbeskeden.
 */
export type DocumentLifecyclePhase =
  | 'settle'
  | 'capture'
  | 'gate'
  | 'dev-preflight'
  | 'renderer-load'
  | 'writer-load'
  | 'render'
  | 'deliver';

/**
 * Mindst én årsag. En blokering uden årsag er et invariantbrud: kontrakten kræver, at en blokeret
 * download ALTID har en synlig, auditerbar grund (jf. "ingen usynlig blokering"-invarianten), og en
 * tom liste ville gøre både tooltip og afvisningsbesked tomme.
 */
export type DocumentGateReasons = readonly [DocumentDownloadGateReason, ...DocumentDownloadGateReason[]];

export const isNonEmptyReasons = (
  reasons: readonly DocumentDownloadGateReason[]
): reasons is DocumentGateReasons => reasons.length > 0;

/**
 * Oversætter en gate-årsagsliste af ubestemt længde til den non-empty form, `blocked` kræver.
 *
 * De eksisterende `evaluate*DownloadGate`-funktioner returnerer `readonly Reason[]`, og en blokering
 * med tom liste ville derfor kunne slippe igennem som en USYNLIG blokering — knappen disabled uden
 * nogen grund at vise. Det bryder "ingen usynlig blokering"-invarianten. `fallback` er derfor
 * påkrævet og fungerer som fail-visible sikkerhedsnet: hellere en generisk grund end ingen.
 */
export const toGateReasons = (
  reasons: readonly DocumentDownloadGateReason[],
  fallback: DocumentDownloadGateReason
): DocumentGateReasons => (isNonEmptyReasons(reasons) ? reasons : [fallback]);

/**
 * En forventelig afvisning. Ingen af disse er programfejl, og ingen af dem må nå
 * systemfejl-overfladen.
 *
 * - `gate-blocked` er brugerrettelig og bærer definitionens egne årsager — HELE listen, så en
 *   konsument kan vise mere end den første.
 * - `stale-source` er transient og har samme betydning i ALLE faser (deraf `phase` som data).
 * - `settle-failed` betyder, at den åbne editor ikke kunne finaliseres; feltet bærer selv den røde
 *   markering, og `focusTarget` peger på det.
 */
export type DocumentRejection =
  | Readonly<{ kind: 'gate-blocked'; phase: DocumentLifecyclePhase; reasons: DocumentGateReasons }>
  | Readonly<{ kind: 'stale-source'; phase: DocumentLifecyclePhase }>
  | Readonly<{ kind: 'settle-failed'; phase: DocumentLifecyclePhase }>;

/**
 * En ægte fejl. `runtime` er den eneste klasse, der rapporteres som systemfejl; `cause` bevares, så
 * boundaryen kan rapportere struktureret frem for at genskrive en streng.
 */
export type DocumentFailure =
  | Readonly<{ kind: 'dev-server-unavailable'; phase: DocumentLifecyclePhase }>
  | Readonly<{ kind: 'runtime'; phase: DocumentLifecyclePhase; cause: Error }>;

export type DocumentOutcome =
  | Readonly<{ status: 'downloaded' }>
  | Readonly<{ status: 'rejected'; rejection: DocumentRejection }>
  | Readonly<{ status: 'failed'; failure: DocumentFailure }>;

export const documentDownloaded: DocumentOutcome = Object.freeze({ status: 'downloaded' as const });

export const documentRejected = (rejection: DocumentRejection): DocumentOutcome =>
  Object.freeze({ status: 'rejected' as const, rejection });

export const documentFailed = (failure: DocumentFailure): DocumentOutcome =>
  Object.freeze({ status: 'failed' as const, failure });

/**
 * Diagnostik til failure-sinken. Struktureret frem for en sammensat streng, så telemetrien kan
 * gruppere på output og fase i stedet for at parse `"documentService.<id>"` tilbage.
 */
export type DocumentDiagnostics = Readonly<{
  outputId: DocumentOutputId;
  phase: DocumentLifecyclePhase;
}>;
