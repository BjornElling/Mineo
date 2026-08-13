import {
  FIELD_ISSUE_GENERIC_TOOLTIP,
  resolveFieldIssueTooltip,
  type ConsumerIssue,
  type FieldIssue,
} from '../../inputCore/inputIssue';

/**
 * Download-gatens resultat og dens BRUGERRETTEDE årsagsklassifikation.
 *
 * **Hvorfor en `kind` og ikke kun en besked.** Gaten havde oprindeligt kun `{code, message}`, hvor
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
 *  - `page-errors` — blokeringen skyldes fejl, siden ALLEREDE viser i sin egen fejl-/advarselsboks.
 *    Tooltippet henviser til boksen ({@link DOWNLOAD_BLOCKED_BY_PAGE_ERRORS_MESSAGE}) frem for at gentage
 *    eller citere en enkelt af fejlene. Brugerbeslutning 2026-08-13: forudsigelighed over
 *    handlingsanvisning — viser boksen en fejl, siger knappen ALTID det samme, også når fejlen kunne
 *    navngives. Klassen har derfor den HØJESTE prioritet.
 *  - `invalid-input` — der ER indtastet noget, men det er ugyldigt (en rød feltfejl blokerer projektionen).
 *    Tooltippet viser den universelle {@link DOWNLOAD_BLOCKED_INVALID_INPUT_MESSAGE}. Adskilt fra
 *    `missing-input` efter brugerkravet 2026-07-30: "der mangler noget" og "noget er forkert" sender brugeren
 *    to forskellige steder hen, og gaterne kendte i forvejen forskellen internt (`field-error` vs
 *    `missing-fields`) — kun brugerteksten kollapsede dem til én.
 *  - `missing-input` — brugeren mangler at indtaste noget, eller en afledt beregning kan ikke dannes af den
 *    grund. Tooltippet viser ÉN universel tekst ({@link DOWNLOAD_BLOCKED_MISSING_INPUT_MESSAGE}), så alle
 *    flader svarer ens. `message` bevares som den interne/diagnostiske forklaring (tests, fejlkoder, logs).
 *  - `specific` — årsagen ER den tekst, brugeren skal læse: præcis ÉN felt-/rækkenavngiven fejl, som
 *    fortæller hvad der skal rettes. Den citeres ordret. Efter lempelsen 2026-08-13 er klassen en SNÆVER
 *    allowlist (se {@link classifyBlockingCauses}) og har LAVEST prioritet: den bruges kun, hvor ingen af
 *    de tre andre klasser gælder.
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
 * Teksten for en blokering, hvis årsager siden allerede viser i sin fejl-/advarselsboks. Ordlyden er
 * uændret fra EO's tidligere page-lokale konstant, så brugeren ser samme tekst som før — den er blot
 * flyttet fra en hardkodet ternary i `EOberegningTab` ind i gaten, hvor beslutningen hører.
 *
 * "Opgørelse" frem for "Dokumentet": klassen bruges KUN af Erstatningsopgørelse (§4 i planen), fordi det er
 * den eneste flade med en fejlboks, der blokerer download. Skulle en anden flade få en tilsvarende boks,
 * skal teksten generaliseres i samme ændring — ikke suppleres med en parallel konstant.
 */
export const DOWNLOAD_BLOCKED_BY_PAGE_ERRORS_MESSAGE = 'Opgørelse kan ikke hentes, når der er fejl ovenfor';

/**
 * Årsagens brugerrettede klasse. Se modulets hoveddoc for hvorfor det er en typet klassifikation og ikke
 * et strengmatch på `message`.
 */
export type DocumentDownloadGateReasonKind =
  | 'page-errors'
  | 'missing-input'
  | 'invalid-input'
  | 'specific';

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

/**
 * Hvad en blokering kan henføres til — producentens EKSPLICITTE angivelse, ikke en slutning.
 *
 * **Hvorfor scope er data og ikke udledt.** Et tidligere udkast ville klassificere ud fra issue-listens
 * længde ("præcis ét issue ⇒ citér det"). Det er beviseligt usikkert:
 *
 *  1. `runProjection` dedupper på `${kind}:${code}` (`inputCore/projection.ts`), så to tabelrækker med
 *     samme descriptor-id kan kollapse til ÉN post — en multi-fejl ville da se ud som en enkeltfejl.
 *  2. Projektionskroppene kalder `require` ubetinget pr. felt, så en tom formular giver N `missing`-issues.
 *     Én bounds-fejl + tre tomme felter ville da udelukke `specific`, selv om der er præcis ét RØDT felt.
 *  3. `buildFieldIssueSet` vælger højst ét aktivt issue pr. feltadresse, så længden slet ikke måler antal
 *     årsager.
 *  4. Én `FieldIssue` kan stamme fra en tværgående regel over flere felter uden at bære metadata om det.
 *
 * Scope gør derfor forskellen mellem "denne fejl kan henføres til ét felt/én række" og "denne fejl er et
 * aggregat" til noget producenten SIGER, og som en læser kan stole på.
 */
export type DocumentBlockingCause =
  /** Præcis ét rødt felt. Kun denne (og `row`) kan give en ordret citeret tooltip. */
  | Readonly<{ scope: 'field'; issue: FieldIssue }>
  /** Præcis én navngiven række, med stabil rækkeidentitet. */
  | Readonly<{ scope: 'row'; rowId: string; message: string }>
  /** Flere uafhængige input, en tabelvalidering eller en flerfeltsregel — aldrig ordret citeret. */
  | Readonly<{ scope: 'aggregate'; message: string }>
  /** Et tomt påkrævet felt (`missing`-consumerfejl). */
  | Readonly<{ scope: 'missing'; issue: ConsumerIssue }>
  /** Input er komplet og gyldigt, men beregningen kunne ikke dannes. Se §1.1 i planen. */
  | Readonly<{ scope: 'unavailable-calculation'; message: string }>;

/**
 * Oversætter en producents årsagsliste til ÉN klassificeret gate-årsag.
 *
 * Rækkefølgen er brugerens hierarki (b før c) med `specific` som snæver undtagelse:
 *
 *  1. Præcis ÉN `field`/`row`-cause med en konkret tekst → `specific` (ordret citat).
 *  2. Mindst én `field`-cause → `invalid-input` ("noget forkert" slår "noget uudfyldt").
 *  3. Mindst én `missing`-cause → `missing-input`.
 *  4. Ellers (`aggregate`/`unavailable-calculation`) → `missing-input` med `fallbackMessage`.
 *
 * Trin 1 genbruger `resolveFieldIssueTooltip` frem for at gentage allowlisten `bounds|rule`. Den funktion
 * ejer allerede afgørelsen "har dette issue en konkret tekst værd at vise" — inklusive et `format`-issue med
 * en codec-leveret `detail.tooltip`, som en håndskrevet reason-test taber. Efter omlægningen bor sondringen
 * ÉT sted, delt af feltets eget tooltip og knappens, hvilket er den paritet `error-contract.md` §4 kræver.
 */
export const classifyBlockingCauses = (
  code: string,
  causes: readonly DocumentBlockingCause[],
  fallbackMessage: string
): DocumentDownloadGateReason => {
  /**
   * `specific` kræver at der er præcis ÉN rød årsag, OG at den har en konkret tekst.
   *
   * Begge led er nødvendige, og de gør forskellige ting:
   *
   *  - Kravet om ÉN rød årsag er lempelsen: er to felter røde, ville et citat af det ene udpege det som
   *    "fejlen" og skjule det andet.
   *  - Kravet om konkret tekst er allowlisten: en `format`-rejection uden `detail.tooltip` (fx en malformet
   *    dato) har intet at sige ud over feltets navn, som allerede står ved markøren.
   *
   * Antallet måles på de RØDE årsager, ikke på hele listen: projektionerne kalder `require` pr. felt, så en
   * halvt udfyldt formular giver mange samtidige `missing`-årsager, uden at det gør den ene røde fejl
   * mindre citerbar. Til gengæld tælles røde årsager UDEN konkret tekst med — de er reelle, uafhængige fejl,
   * og skal derfor kunne diskvalificere et citat, selv om de ikke selv kan citeres.
   */
  const redCauses = causes.filter((cause) => cause.scope === 'field' || cause.scope === 'row');
  const only = redCauses.length === 1 ? redCauses[0] : undefined;
  if (only !== undefined) {
    const text = only.scope === 'row' ? only.message : resolveFieldIssueTooltip(only.issue);
    if (text !== FIELD_ISSUE_GENERIC_TOOLTIP) return { code, message: text, kind: 'specific' };
  }
  const firstField = causes.find((cause) => cause.scope === 'field');
  if (firstField?.scope === 'field') {
    return { code, message: firstField.issue.message, kind: 'invalid-input' };
  }
  const firstMissing = causes.find((cause) => cause.scope === 'missing');
  if (firstMissing?.scope === 'missing') {
    return { code, message: firstMissing.issue.message, kind: 'missing-input' };
  }
  const firstOther = causes.find(
    (cause) => cause.scope === 'aggregate' || cause.scope === 'unavailable-calculation'
  );
  const message = firstOther !== undefined && 'message' in firstOther ? firstOther.message : fallbackMessage;
  return { code, message, kind: 'missing-input' };
};

/**
 * Blokering udledt af en producents årsagsliste. Den kanoniske vej for en gate, der KAN opregne sine
 * årsager — så klassen bliver udledt frem for gættet ved hvert callsite.
 */
export const blockDocumentDownloadFromCauses = (
  code: string,
  causes: readonly DocumentBlockingCause[],
  fallbackMessage: string
): DocumentDownloadGateResult => ({
  canDownload: false,
  reasons: [classifyBlockingCauses(code, causes, fallbackMessage)],
});

/**
 * Oversætter en `ProjectionResult`s issues til causes.
 *
 * `ConsumerIssue` med `reason: 'rule'` bliver `aggregate`, IKKE `missing`: en consumerplaceret domæneregel
 * er ikke samme tilstand som et tomt felt (`error-contract.md` §1.1), og at lade den falde i
 * `missing`-grenen ville give "Indtastning mangler" på et felt, der er udfyldt.
 */
export const toBlockingCauses = (
  issues: readonly (FieldIssue | ConsumerIssue)[]
): readonly DocumentBlockingCause[] =>
  issues.map((issue): DocumentBlockingCause =>
    issue.kind === 'field'
      ? { scope: 'field', issue }
      : issue.reason === 'missing'
        ? { scope: 'missing', issue }
        : { scope: 'aggregate', message: issue.message }
  );

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
    case 'page-errors':
      return DOWNLOAD_BLOCKED_BY_PAGE_ERRORS_MESSAGE;
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
 * **`page-errors` vinder alt.** Er fejlen allerede synlig i sidens fejlboks, er den henvisning det, brugeren
 * skal læse — uanset om en af de underliggende fejl kunne navngives (brugerbeslutning 2026-08-13:
 * forudsigelighed over handlingsanvisning).
 *
 * `invalid-input` slår `missing-input`, fordi noget FORKERT er mere akut end noget uudfyldt: det uudfyldte
 * felt bliver ofte udfyldt i samme arbejdsgang, mens en afvist værdi kræver, at brugeren finder og retter
 * den. Det er samme forrang, de enkelte gates i forvejen bruger internt (rød feltfejl før manglende felt).
 *
 * `specific` er SIDST, ikke først. Det er omvendt af den oprindelige model, hvor et ordret citat vandt alt.
 * Efter lempelsen 2026-08-13 er et citat kun tilladt for præcis én felt-/rækkefejl (§2), og i enhver
 * blokering, hvor en af de tre andre klasser også gælder, er deres tekst den rigtige: en side med en
 * fejlboks skal henvise til boksen, og en blokering med flere røde felter skal ikke fremhæve ét af dem.
 */
const REASON_KIND_PRIORITY: Readonly<Record<DocumentDownloadGateReasonKind, number>> = {
  'page-errors': 0,
  'invalid-input': 1,
  'missing-input': 2,
  specific: 3,
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
 * Blokering, hvor årsagerne allerede står i sidens fejl-/advarselsboks. `message` bevares som den interne
 * forklaring (typisk den første fejlrækkes tekst), så koder/tests/logs stadig kan skelne to blokeringer, der
 * deler brugerteksten.
 */
export const blockDocumentDownloadForPageErrors = (
  reason: Readonly<{ code: string; message: string }>
): DocumentDownloadGateResult => ({
  canDownload: false,
  reasons: [{ ...reason, kind: 'page-errors' }],
});

/**
 * Blokering, hvor input er komplet og gyldigt, men beregningen ikke kunne dannes — fx en manglende lovsats
 * for beregningsåret, en tabel uden en eneste komplet række eller nul SH-dage i de indtastede perioder.
 *
 * Klassen er `missing-input`, fordi brugerens praktiske handling ER at udfylde mere. Men den har sin egen
 * konstruktør, så valget er BEVIDST: før lå disse blokeringer i den samme `blockDocumentDownload`-default
 * som ægte tomme felter, og en fremtidig gate kunne derfor falde i den uden at have taget stilling.
 */
export const blockDocumentDownloadForUnavailableCalculation = (
  reason: Readonly<{ code: string; message: string }>
): DocumentDownloadGateResult => ({
  canDownload: false,
  reasons: [{ ...reason, kind: 'missing-input' }],
});

/**
 * Blokering fra ÉT rødt feltissue. Klassifikationen deles nu med {@link classifyBlockingCauses}, så
 * "hvornår er en feltfejl værd at citere" kun er besvaret ét sted.
 *
 * Tidligere gentog denne funktion allowlisten inline som `reason === 'bounds' || reason === 'rule'`. Det
 * havde et hul: et `format`-issue med en codec-leveret `detail.tooltip` (fx en konkret datogrænse) faldt i
 * den generiske gren, selv om feltets eget tooltip viste den konkrete tekst.
 */
export const blockDocumentDownloadForFieldIssue = (
  issue: FieldIssue,
  code: string
): DocumentDownloadGateResult =>
  blockDocumentDownloadFromCauses(code, [{ scope: 'field', issue }], issue.message);

/**
 * Blokering med en konkret, brugerrettet årsag, der citeres ordret.
 *
 * **Snæver allowlist (lempelse 2026-08-13).** Brug den KUN, når blokeringen kan henføres til præcis ÉT felt
 * eller ÉN navngiven række, og teksten fortæller brugeren hvad der skal rettes. Er årsagen et aggregat over
 * flere rækker, en tabelvalidering eller en flerfeltsregel, ville et citat af én af fejlene give brugeren
 * indtryk af, at det er den eneste — brug da {@link blockDocumentDownload} eller
 * {@link blockDocumentDownloadForInvalidInput}. Kan årsagerne opregnes, er
 * {@link blockDocumentDownloadFromCauses} at foretrække, fordi den afgør klassen frem for at stole på
 * callsitets vurdering.
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

/** Én årsag, hvis besked skal citeres ordret — til gates der samler flere årsager. Se allowlisten ovenfor. */
export const specificReason = (code: string, message: string): DocumentDownloadGateReason =>
  ({ code, message, kind: 'specific' });

/** Én årsag, siden allerede viser i sin fejlboks — til gates der samler flere årsager. */
export const pageErrorsReason = (code: string, message: string): DocumentDownloadGateReason =>
  ({ code, message, kind: 'page-errors' });
