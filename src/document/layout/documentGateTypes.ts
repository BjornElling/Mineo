/**
 * Download-gatens resultat og dens BRUGERRETTEDE årsagsklassifikation.
 *
 * **Hvorfor en `kind` og ikke kun en besked (UT-F07).** Gaten havde oprindeligt kun `{code, message}`, hvor
 * beskeden var både den interne forklaring OG den tekst, brugeren læste i tooltippet. Det gav to problemer på
 * samme tid:
 *
 *  1. Beskederne var lange og gate-interne ("Der er ikke beregnet en PDF-klar EAL- eller ASL-del.",
 *     "Ingen gyldige rækker i tabel", "Fatale beregningsfejl"). De beskriver gatens egen tilstandsmaskine,
 *     ikke hvad brugeren skal GØRE.
 *  2. Der var ingen måde at skelne "brugeren mangler at indtaste noget" fra "der findes en konkret, specifik
 *     fejl, som er værd at citere" — fx EO-rækkemotorens "Feriegodtgørelse er ikke udfyldt". Uden den
 *     skelnen kunne en forenkling af teksten kun laves med strengmatch pr. gate, som ville drifte.
 *
 * Klassifikationen er derfor DATA på årsagen:
 *
 *  - `missing-input` — brugeren mangler at indtaste noget, eller en afledt beregning kan ikke dannes af den
 *    grund. Tooltippet viser ÉN universel tekst ({@link DOWNLOAD_BLOCKED_MISSING_INPUT_MESSAGE}), så alle
 *    flader svarer ens. `message` bevares som den interne/diagnostiske forklaring (tests, fejlkoder, logs).
 *  - `specific` — årsagen ER den tekst, brugeren skal læse: en konkret, felt-/rækkenavngiven fejl, som
 *    fortæller præcis hvad der skal rettes. Den citeres ordret.
 *
 * `resolveDocumentGateTooltip` er det ENE sted, den beslutning omsættes til tooltiptekst.
 */

/**
 * Den universelle brugerrettede tekst for enhver blokering, der i praksis betyder "du mangler at indtaste
 * noget". Én tekst på alle flader — brugerens krav ved brugertesten 2026-07-29.
 */
export const DOWNLOAD_BLOCKED_MISSING_INPUT_MESSAGE = 'Indtastning mangler';

/**
 * Årsagens brugerrettede klasse. Se modulets hoveddoc for hvorfor det er en typet klassifikation og ikke
 * et strengmatch på `message`.
 */
export type DocumentDownloadGateReasonKind = 'missing-input' | 'specific';

export type DocumentDownloadGateReason = Readonly<{
  code: string;
  /**
   * Den INTERNE forklaring på blokeringen. Vises kun til brugeren, når `kind` er `'specific'`; ellers
   * erstattes den af {@link DOWNLOAD_BLOCKED_MISSING_INPUT_MESSAGE}. Bevares altid, så koder/tests/logs kan
   * skelne to blokeringer, der deler samme brugertekst.
   */
  message: string;
  kind: DocumentDownloadGateReasonKind;
}>;

export type DocumentDownloadGateResult = Readonly<{
  canDownload: boolean;
  reasons: readonly DocumentDownloadGateReason[];
}>;

export const allowDocumentDownload = (): DocumentDownloadGateResult => ({
  canDownload: true,
  reasons: [],
});

/**
 * Den brugerrettede tooltiptekst for en blokerende årsag — det ENE sted, `kind` oversættes til tekst.
 *
 * Ligger her frem for i React-laget, fordi valget er en egenskab ved ÅRSAGEN, ikke ved den flade der tegner
 * knappen. Havde hver flade valgt selv, ville "universel tekst" være en konvention, ingen kunne håndhæve —
 * og præcis den slags drift var årsagen til, at to sider viste årsagen både som tekst og tooltip.
 */
export const resolveDocumentGateTooltip = (reason: DocumentDownloadGateReason): string =>
  reason.kind === 'specific' ? reason.message : DOWNLOAD_BLOCKED_MISSING_INPUT_MESSAGE;

/**
 * Blokering, hvor brugeren mangler at indtaste noget. `message` er den interne forklaring; brugeren ser den
 * universelle tekst. Dette er DEFAULTEN for en gate-blokering — en gate skal aktivt vælge `specific`.
 */
export const blockDocumentDownload = (
  reason: Readonly<{ code: string; message: string }>
): DocumentDownloadGateResult => ({
  canDownload: false,
  reasons: [{ ...reason, kind: 'missing-input' }],
});

/**
 * Blokering med en konkret, brugerrettet årsag, der skal citeres ordret — fx EO-rækkemotorens navngivne
 * felt-/rækkefejl eller en validators egen besked. Brug den KUN, når teksten fortæller brugeren præcis hvad
 * der skal rettes; ellers er {@link blockDocumentDownload} den rigtige.
 */
export const blockDocumentDownloadWithSpecificReason = (
  reason: Readonly<{ code: string; message: string }>
): DocumentDownloadGateResult => ({
  canDownload: false,
  reasons: [{ ...reason, kind: 'specific' }],
});

/** Én årsag, klassificeret som "mangler indtastning" — til gates der samler flere årsager. */
export const missingInputReason = (code: string, message: string): DocumentDownloadGateReason =>
  ({ code, message, kind: 'missing-input' });

/** Én årsag, hvis besked skal citeres ordret — til gates der samler flere årsager. */
export const specificReason = (code: string, message: string): DocumentDownloadGateReason =>
  ({ code, message, kind: 'specific' });
