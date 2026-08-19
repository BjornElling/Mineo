/**
 * Dokument-download-livscyklussens ENE resultat-algebra.
 *
 * Der er ÉN union for hele livscyklussen, med `phase` bevaret som auditdata frem for som
 * beskedvalg. Reglen er: **tilstanden bestemmer beskeden; fasen bestemmer kun diagnostikken.**
 *
 * Taksonomien skelner tre ting, som §A5 kræver holdt adskilt:
 *   - `rejected` – forventelig, brugerrettelig eller transient. Rapporteres IKKE som systemfejl.
 *   - `failed` med `kind: 'dev-server-unavailable'` – kun DEV; miljøproblem, ikke en programfejl.
 *   - `failed` med `kind: 'runtime'` – uventet. Den ENESTE klasse der hører til systemfejl-sinken.
 */
import {
  classifyBlockingCauses,
  missingInputReason,
  specificReason,
  toBlockingCauses,
  type DocumentDownloadGateReason,
} from '../layout/documentGateTypes';
import type { ConsumerIssue, FieldIssue } from '../../inputCore/inputIssue';
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
 * download ALTID har en auditerbar grund, og en tom liste ville gøre knappens tooltip tomt – den ENE
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
 * tooltippet – og uden noget at auditere. `fallback` er derfor påkrævet og fungerer som sikkerhedsnet:
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
 * Projektionernes fail-closed sikkerhedsnet – "Beregning kan ikke dannes", "Rentelinjen findes ikke længere"
 * – beskriver en TILSTAND i gaten, ikke en handling brugeren kan udføre. De er derfor `missing-input`, så
 * brugeren møder den universelle tekst. Er blokeringen derimod et RØDT FELT, er
 * {@link blockedProjectionFromCauses} den rigtige – den UDLEDER klassen af issuene frem for at hardkode
 * den; har projektionen undtagelsesvist en konkret, brugerrettet besked, er det
 * `blockedProjectionWithSpecificReason`.
 *
 * Helperen findes, fordi de ni definitionsfiler før byggede `{status:'blocked', reasons:[{code,message}]}`
 * i hånden – en parallel vej, der omgik gate-konstruktørerne og derfor kunne glemme klassifikationen.
 *
 * Der fandtes tidligere en `blockedProjectionForInvalidInput`-tvilling, som hardkodede `invalid-input`.
 * Ingen definitionsfil kaldte den – den var en åben, uafprøvet vej til præcis den fejlklasse, brugerfundet
 * 2026-08-15 afdækkede to andre steder (en hardkodet klasse over en betingelse, der dækker begge klasser).
 * Den er derfor slettet frem for bevaret, og `document/gate-class-hardcoded-invalid-input` holder den ude.
 */
export const blockedProjection = (
  code: string,
  message: string
): BlockedProjection => ({ status: 'blocked', reasons: [missingInputReason(code, message)] });

/** Som {@link blockedProjection}, men beskeden citeres ordret til brugeren. */
export const blockedProjectionWithSpecificReason = (
  code: string,
  message: string
): BlockedProjection => ({ status: 'blocked', reasons: [specificReason(code, message)] });

/**
 * Blokering ud fra en projektions ISSUE-liste, hvor klassen UDLEDES af issuene (§3.1).
 *
 * Erstatter den tidligere `blockedFromIssues`, som citerede `issues[0].message` ordret, hvis der blot FANDTES
 * et issue. Den havde to fejl på samme tid:
 *
 *  1. En `missing`-consumerfejl blev citeret ("Feltet Skadedato er ikke udfyldt") frem for at give den
 *     universelle "Indtastning mangler", som issuets egen klasse foreskriver.
 *  2. Et vilkårligt FØRSTE issue blev fremhævet, også når projektionen bar flere – så brugeren kunne tro,
 *     den citerede fejl var den eneste (lempelsen §2).
 *
 * `fallbackMessage` bruges kun, når listen er tom (eller kun rummer aggregat-årsager uden besked).
 */
export const blockedProjectionFromCauses = (
  code: string,
  issues: readonly (FieldIssue | ConsumerIssue)[] | undefined,
  fallbackMessage: string
): BlockedProjection => ({
  status: 'blocked',
  reasons: [classifyBlockingCauses(code, toBlockingCauses(issues ?? []), fallbackMessage)],
});

/**
 * En forventelig afvisning. Ingen af disse er programfejl, og ingen af dem må nå
 * systemfejl-overfladen.
 *
 * - `gate-blocked` er brugerrettelig og bærer definitionens egne årsager – HELE listen – som AUDITDATA.
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
