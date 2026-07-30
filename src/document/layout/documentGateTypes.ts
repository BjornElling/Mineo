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
 *  - `invalid-input` — der ER indtastet noget, men det er ugyldigt (en rød feltfejl blokerer projektionen).
 *    Tooltippet viser den universelle {@link DOWNLOAD_BLOCKED_INVALID_INPUT_MESSAGE}. Adskilt fra
 *    `missing-input` efter brugerkravet 2026-07-30: "der mangler noget" og "noget er forkert" sender brugeren
 *    to forskellige steder hen, og gaterne kendte i forvejen forskellen internt (`field-error` vs
 *    `missing-fields`) — kun brugerteksten kollapsede dem til én.
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
 * Den universelle brugerrettede tekst for en blokering, hvor der ER indtastet noget ugyldigt (brugerkrav
 * 2026-07-30). Samme ordlyd som feltets eget generiske tooltip
 * ({@link ../../inputCore/inputIssue!FIELD_ISSUE_GENERIC_TOOLTIP}), så knappen og det felt, brugeren skal rette,
 * taler samme sprog.
 */
export const DOWNLOAD_BLOCKED_INVALID_INPUT_MESSAGE = 'Fejl i indtastning';

/**
 * Årsagens brugerrettede klasse. Se modulets hoveddoc for hvorfor det er en typet klassifikation og ikke
 * et strengmatch på `message`.
 */
export type DocumentDownloadGateReasonKind = 'missing-input' | 'invalid-input' | 'specific';

export type DocumentDownloadGateReason = Readonly<{
  code: string;
  /**
   * Den INTERNE forklaring på blokeringen. Vises kun til brugeren, når `kind` er `'specific'`; ellers
   * erstattes den af den universelle tekst for `kind`. Bevares altid, så koder/tests/logs kan skelne to
   * blokeringer, der deler samme brugertekst.
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
export const resolveDocumentGateTooltip = (reason: DocumentDownloadGateReason): string => {
  switch (reason.kind) {
    case 'specific':
      return reason.message;
    case 'invalid-input':
      return DOWNLOAD_BLOCKED_INVALID_INPUT_MESSAGE;
    case 'missing-input':
      return DOWNLOAD_BLOCKED_MISSING_INPUT_MESSAGE;
  }
};

/**
 * Hvor handlingsanvisende hver klasse er. En gate kan samle FLERE årsager (fx Forsørgertab), men tooltippet
 * viser én tekst — så valget skal være en egenskab ved klassifikationen, ikke ved den rækkefølge, en gate
 * tilfældigvis pusher sine årsager i.
 *
 * `specific` navngiver feltet/rækken og vinder derfor. `invalid-input` slår `missing-input`, fordi noget
 * FORKERT er mere akut end noget uudfyldt: det uudfyldte felt bliver ofte udfyldt i samme arbejdsgang, mens en
 * afvist værdi kræver, at brugeren finder og retter den. Det er samme forrang, de enkelte gates i forvejen
 * bruger internt (rød feltfejl før manglende-felt-fejl).
 */
const REASON_KIND_PRIORITY: Readonly<Record<DocumentDownloadGateReasonKind, number>> = {
  specific: 0,
  'invalid-input': 1,
  'missing-input': 2,
};

/**
 * Den PRIMÆRE årsag i en blokering — den, hvis tekst brugeren skal se. `undefined` kun for en tom liste (en
 * gate, der blokerer uden årsag, er en fejl hos gaten).
 *
 * Stabil: ved samme `kind` bevares gatens egen rækkefølge, så en gate stadig kan udtrykke "denne først".
 */
export const resolvePrimaryGateReason = (
  reasons: readonly DocumentDownloadGateReason[]
): DocumentDownloadGateReason | undefined =>
  reasons.reduce<DocumentDownloadGateReason | undefined>(
    (best, candidate) =>
      best === undefined || REASON_KIND_PRIORITY[candidate.kind] < REASON_KIND_PRIORITY[best.kind]
        ? candidate
        : best,
    undefined
  );

/**
 * Tooltipteksten for en BLOKERET gate: vælger den primære årsag og oversætter den. Det ene sted, en flade skal
 * kalde — så ingen knap selv rækker ned i `reasons[0]`.
 */
export const resolveBlockedGateTooltip = (
  reasons: readonly DocumentDownloadGateReason[]
): string | undefined => {
  const primary = resolvePrimaryGateReason(reasons);
  return primary === undefined ? undefined : resolveDocumentGateTooltip(primary);
};

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
 * Blokering, hvor det indtastede ER ugyldigt (en rød feltfejl blokerer projektionen). Brugeren ser den
 * universelle {@link DOWNLOAD_BLOCKED_INVALID_INPUT_MESSAGE}; `message` er den interne forklaring.
 */
export const blockDocumentDownloadForInvalidInput = (
  reason: Readonly<{ code: string; message: string }>
): DocumentDownloadGateResult => ({
  canDownload: false,
  reasons: [{ ...reason, kind: 'invalid-input' }],
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

/** Én årsag, klassificeret som "ugyldig indtastning" — til gates der samler flere årsager. */
export const invalidInputReason = (code: string, message: string): DocumentDownloadGateReason =>
  ({ code, message, kind: 'invalid-input' });

/** Én årsag, hvis besked skal citeres ordret — til gates der samler flere årsager. */
export const specificReason = (code: string, message: string): DocumentDownloadGateReason =>
  ({ code, message, kind: 'specific' });
