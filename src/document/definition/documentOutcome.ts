/**
 * Dokument-download-livscyklussens ENE resultat-algebra.
 *
 * Der er ÉN union for hele livscyklussen, med `phase` bevaret som auditdata frem for som
 * beskedvalg. Reglen er: **tilstanden bestemmer beskeden; fasen bestemmer kun diagnostikken.**
 *
 * Taksonomien skelner tre ting, som §A5 kræver holdt adskilt:
 *   - `rejected` — forventelig, brugerrettelig eller transient. Rapporteres IKKE som systemfejl.
 *   - `failed` med `kind: 'dev-server-unavailable'` — kun DEV; miljøproblem, ikke en programfejl.
 *   - `failed` med `kind: 'runtime'` — uventet. Den ENESTE klasse der hører til systemfejl-sinken.
 */
import {
  invalidInputReason,
  missingInputReason,
  specificReason,
  type DocumentDownloadGateReason,
} from '../layout/documentGateTypes';
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
 * download ALTID har en auditerbar grund, og en tom liste ville gøre knappens tooltip tomt — den ENE
 * kanal, årsagen har til brugeren (`page-component-contract.md` §11.1).
 */
export type DocumentGateReasons = readonly [DocumentDownloadGateReason, ...DocumentDownloadGateReason[]];

export const isNonEmptyReasons = (
  reasons: readonly DocumentDownloadGateReason[]
): reasons is DocumentGateReasons => reasons.length > 0;

/**
 * Oversætter en gate-årsagsliste af ubestemt længde til den non-empty form, `blocked` kræver.
 *
 * De eksisterende `evaluate*DownloadGate`-funktioner returnerer `readonly Reason[]`, og en blokering
 * med tom liste ville derfor kunne slippe igennem som en knap, der er disabled uden nogen grund i
 * tooltippet — og uden noget at auditere. `fallback` er derfor påkrævet og fungerer som sikkerhedsnet:
 * hellere en generisk grund end ingen.
 */
export const toGateReasons = (
  reasons: readonly DocumentDownloadGateReason[],
  fallback: Readonly<{ code: string; message: string }>
): DocumentGateReasons => (
  isNonEmptyReasons(reasons) ? reasons : [missingInputReason(fallback.code, fallback.message)]
);

/**
 * Den blokerede gren af et projektionsresultat. Den er UAFHÆNGIG af projektionens værditype, så samme
 * værdi kan returneres, uanset hvilket `DocumentProjectionResult<T>` callsiten skal opfylde.
 */
export type BlockedProjection = Readonly<{ status: 'blocked'; reasons: DocumentGateReasons }>;

/**
 * Den ENE måde en projektion udtrykker "blokeret" med præcis én årsag.
 *
 * Projektionernes fail-closed sikkerhedsnet — "Beregning kan ikke dannes", "Rentelinjen findes ikke længere"
 * — beskriver en TILSTAND i gaten, ikke en handling brugeren kan udføre. De er derfor `missing-input`, så
 * brugeren møder den universelle tekst. Er blokeringen derimod et RØDT FELT, er
 * {@link blockedProjectionForInvalidInput} den rigtige; har projektionen undtagelsesvist en konkret,
 * brugerrettet besked, er det `blockedProjectionWithSpecificReason`.
 *
 * Helperen findes, fordi de ni definitionsfiler før byggede `{status:'blocked', reasons:[{code,message}]}`
 * i hånden — en parallel vej, der omgik gate-konstruktørerne og derfor kunne glemme klassifikationen.
 */
export const blockedProjection = (
  code: string,
  message: string
): BlockedProjection => ({ status: 'blocked', reasons: [missingInputReason(code, message)] });

/**
 * Som {@link blockedProjection}, men blokeringen skyldes en UGYLDIG indtastning (et rødt felt), så brugeren
 * møder "Fejl i indtastning" frem for "Indtastning mangler" (brugerkrav 2026-07-30).
 */
export const blockedProjectionForInvalidInput = (
  code: string,
  message: string
): BlockedProjection => ({ status: 'blocked', reasons: [invalidInputReason(code, message)] });

/** Som {@link blockedProjection}, men beskeden citeres ordret til brugeren. */
export const blockedProjectionWithSpecificReason = (
  code: string,
  message: string
): BlockedProjection => ({ status: 'blocked', reasons: [specificReason(code, message)] });

/**
 * Blokering ud fra en projektions ISSUE-liste — mønsteret "citér issuet, hvis der er et; ellers en generisk
 * tilstandsbeskrivelse". Det stod før udskrevet fire steder (satser ×2, renteberegning ×2, aarsløn-gaten,
 * rente-rækken) med hver sin `?? 'fallback'`-kæde.
 *
 * Skelnen er hele pointen: et issue navngiver det felt eller den grænse, brugeren skal rette, og
 * citeres derfor ordret.
 *
 * `fallbackKind` klassificerer den GENERISKE fallback, når der ikke er noget issue at citere: en fallback som
 * "Stamdata indeholder fejl" er en manglende-indtastning (default), mens "Fejl i indtastning" netop betyder,
 * at det indtastede er ugyldigt. Uden parameteren fik sidstnævnte tooltippet "Indtastning mangler", altså
 * modsat sin egen ordlyd.
 */
export const blockedFromIssues = (
  code: string,
  issues: readonly Readonly<{ message: string }>[] | undefined,
  genericFallback: string,
  fallbackKind: 'missing-input' | 'invalid-input' = 'missing-input'
): BlockedProjection => {
  const issueMessage = issues?.[0]?.message;
  if (issueMessage !== undefined) return blockedProjectionWithSpecificReason(code, issueMessage);
  return fallbackKind === 'invalid-input'
    ? blockedProjectionForInvalidInput(code, genericFallback)
    : blockedProjection(code, genericFallback);
};

/**
 * En forventelig afvisning. Ingen af disse er programfejl, og ingen af dem må nå
 * systemfejl-overfladen.
 *
 * - `gate-blocked` er brugerrettelig og bærer definitionens egne årsager — HELE listen — som AUDITDATA.
 *   Den producerer bevidst ingen brugerbesked: knappen var synligt inaktiv, og tooltippet ejer årsagen
 *   (`page-component-contract.md` §11.1).
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
