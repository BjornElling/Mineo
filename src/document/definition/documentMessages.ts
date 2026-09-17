/**
 * Brugerrettede beskeder for dokument-udfald.
 *
 * Outputtet erklærer sit NAVN, og beskeden formuleres her med formatet som eksplicit parameter.
 * TILSTANDEN afgør beskeden; livscyklusfasen er kun diagnostik.
 */
import { getDocumentFormatLabel } from '../documentFormat';
import type { DocumentDownloadFormat } from '../documentFormat';
import type { DocumentLabels } from './documentDefinition';
import type { DocumentOutcome } from './documentOutcome';

const STALE_SOURCE_MESSAGE = 'Downloaden blev afbrudt, fordi sagen blev ændret undervejs. Prøv igen.';
/**
 * Ordlyden deler bevidst vokabular med `LazyChunkRecoveryNotice` («En programdel skal genindlæses»),
 * så de to flader beskriver samme tilstand med samme ord: linjen her forklarer, hvorfor klikket ikke
 * gav en fil, og recoverylinjen bærer selve «Genindlæs nu»-handlingen.
 */
const CHUNK_UNAVAILABLE_MESSAGE = 'Downloaden blev afbrudt, fordi en programdel skal genindlæses. Genindlæs programmet, og prøv igen.';
const DEV_SERVER_MESSAGE = 'Udviklingsserveren svarer ikke længere. Genstart `npm run dev` og prøv dokument-download igen.';

/**
 * Den besked, brugeren skal se – eller `null`, når udfaldet ikke har nogen besked.
 *
 * `null` betyder bevidst "intet at vise":
 *  - `downloaded`: der er ingen fejl.
 *  - `gate-blocked`: en deaktiveret download-knap svarer IKKE med tekst. Årsagen har ÉN kanal –
 *    knappens tooltip ved hover. Det gælder også, når blokeringen først opdages under aktiveringen:
 *    et klik på en knap, brugeren kan se er inaktiv, skal ikke fremkalde en besked hverken under
 *    knappen eller i rækken (udviklerbeslutning 2026-07-31). Årsagerne bevares på udfaldet som
 *    auditdata, men de er ikke længere en visningskilde.
 *  - `settle-failed`: det blokerende felt bærer selv sin røde markering, og preflighten har
 *    fokuseret det. En ekstra besked ville duplikere signalet.
 *  - `runtime` i en app, der router systemfejl centralt (§A5) – se `showRuntimeFailureLocally`.
 *
 * Tilbage står derfor kun de udfald, brugeren ikke kunne forudse af knappens tilstand: et
 * stale-afbrud, en manglende programdel og en død DEV-server.
 */
export const resolveDocumentOutcomeMessage = (
  outcome: DocumentOutcome,
  labels: DocumentLabels,
  format: DocumentDownloadFormat,
  /**
   * Appens politik for uventede runtimefejl. `false` (hovedappen) betyder, at fejlen ALENE routes
   * til den centrale fejlrapportering; en lokal tekst ville rapportere den to steder og møde
   * brugeren med en teknisk fejl inline i sideflowet, hvad §A5 forbyder. `true` (standalone) er for
   * apps uden en central fejloverflade, hvor beskeden ellers ville forsvinde helt.
   */
  showRuntimeFailureLocally: boolean
): string | null => {
  switch (outcome.status) {
    case 'downloaded':
      return null;
    case 'rejected':
      switch (outcome.rejection.kind) {
        case 'gate-blocked':
          return null;
        case 'stale-source':
          return STALE_SOURCE_MESSAGE;
        case 'settle-failed':
          return null;
        case 'chunk-unavailable':
          // Vises i BEGGE apps. Tilstanden er transient og brugerrettelig som `stale-source`, og
          // standalone MinProcesrente har ingen recoverylinje, der ellers kunne bære signalet.
          return CHUNK_UNAVAILABLE_MESSAGE;
      }
    // falls through er umuligt: begge grene ovenfor returnerer.
    case 'failed':
      switch (outcome.failure.kind) {
        case 'dev-server-unavailable':
          // Ikke en programfejl, men et DEV-miljøproblem brugeren selv kan rette – vises altid.
          return DEV_SERVER_MESSAGE;
        case 'runtime':
          return showRuntimeFailureLocally
            ? `Kunne ikke generere ${labels.documentName} som ${getDocumentFormatLabel(format)}`
            : null;
      }
  }
};
