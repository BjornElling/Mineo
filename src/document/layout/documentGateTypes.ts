import {
  FIELD_ISSUE_GENERIC_TOOLTIP,
  resolveFieldIssueTooltip,
  type ConsumerIssue,
  type FieldIssue,
} from '../../inputCore/inputIssue';

/**
 * Download-gatens resultat og dens BRUGERRETTEDE årsagsklassifikation.
 *
 * **Hvorfor en `kind` og ikke kun en besked.** Var beskeden både den interne forklaring OG den tekst,
 * brugeren læste i tooltippet, ville det give to problemer:
 *
 *  1. Gatebeskederne er lange og gate-interne ("Der er ikke beregnet en PDF-klar EAL- eller ASL-del.",
 *     "Ingen gyldige rækker i tabel", "Fatale beregningsfejl"). De beskriver gatens egen tilstandsmaskine,
 *     ikke hvad brugeren skal GØRE.
 *  2. Der ville ikke være nogen måde at skelne "brugeren mangler at indtaste noget" fra "der findes en
 *     konkret, specifik fejl, som er værd at citere" – fx EO-rækkemotorens "Feriegodtgørelse er ikke
 *     udfyldt". Uden den skelnen kunne teksten kun forenkles med strengmatch pr. gate, som ville drifte.
 *
 * Klassifikationen er derfor DATA på årsagen:
 *
 *  - `page-errors` – blokeringen skyldes fejl, siden ALLEREDE viser i sin egen fejl-/advarselsboks.
 *    Tooltippet henviser til boksen ({@link DOWNLOAD_BLOCKED_BY_PAGE_ERRORS_MESSAGE}) frem for at gentage
 *    eller citere en enkelt af fejlene. Bevidst valg: forudsigelighed over
 *    handlingsanvisning – viser boksen en fejl, siger knappen ALTID det samme, også når fejlen kunne
 *    navngives. Klassen har derfor den HØJESTE prioritet.
 *  - `invalid-input` – der ER indtastet noget, men det er ugyldigt (en rød feltfejl blokerer projektionen).
 *    Tooltippet viser den universelle {@link DOWNLOAD_BLOCKED_INVALID_INPUT_MESSAGE}. Adskilt fra
 *    `missing-input`, fordi "der mangler noget" og "noget er forkert" sender brugeren to forskellige steder
 *    hen; gaterne kender forskellen internt (`field-error` vs `missing-fields`), og brugerteksten må ikke
 *    kollapse dem til én.
 *  - `missing-input` – brugeren mangler at indtaste noget, eller en afledt beregning kan ikke dannes af den
 *    grund. Tooltippet viser ÉN universel tekst ({@link DOWNLOAD_BLOCKED_MISSING_INPUT_MESSAGE}), så alle
 *    flader svarer ens. `message` bevares som den interne/diagnostiske forklaring (tests, fejlkoder, logs).
 *  - `specific` – årsagen ER den tekst, brugeren skal læse: præcis ÉN felt-/rækkenavngiven fejl, som
 *    fortæller hvad der skal rettes. Den citeres ordret. Klassen er en SNÆVER
 *    allowlist (se {@link classifyBlockingCauses}) og har LAVEST prioritet: den bruges kun, hvor ingen af
 *    de tre andre klasser gælder.
 *
 * `resolveDocumentGateTooltip` er det ENE sted, den beslutning omsættes til tooltiptekst.
 */

/**
 * Den universelle brugerrettede tekst for enhver blokering, der i praksis betyder "du mangler at indtaste
 * noget". Én tekst på alle flader.
 */
export const DOWNLOAD_BLOCKED_MISSING_INPUT_MESSAGE = 'Indtastning mangler';

/**
 * Den universelle brugerrettede tekst for en blokering, hvor der ER indtastet noget ugyldigt.
 *
 * Den ER feltets eget generiske tooltip ({@link FIELD_ISSUE_GENERIC_TOOLTIP}) – ikke blot samme ordlyd.
 * Knappen og det felt, brugeren skal rette, skal sige det samme, og to literaler med samme betydning kan
 * drifte uden at nogen test bliver rød. Aliaset gør kravet til en kendsgerning.
 */
export const DOWNLOAD_BLOCKED_INVALID_INPUT_MESSAGE = FIELD_ISSUE_GENERIC_TOOLTIP;

/**
 * Teksten for en blokering, hvis årsager siden allerede viser i sin fejl-/advarselsboks. Den bor i gaten,
 * hvor beslutningen hører, ikke i en ternary på siden.
 *
 * Teksten nævner det dokument, knappen henter. Klassen bruges KUN af Erstatningsopgørelse
 * (`document-output-contract.md` §A5.1), fordi det er den eneste flade med en fejlboks, der blokerer
 * download – men fladen har fire knapper, og uden navnet ville de
 * tre TAF-dokumenter sige «Opgørelse kan ikke hentes …» om sig selv. Uden navn er det opgørelsen.
 */
export const buildDownloadBlockedByPageErrorsMessage = (documentName = 'Opgørelse'): string =>
  `${documentName} kan ikke hentes, når der er fejl ovenfor`;

export const DOWNLOAD_BLOCKED_BY_PAGE_ERRORS_MESSAGE = buildDownloadBlockedByPageErrorsMessage();

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
  /** Kun for `page-errors`: det dokument, knappen henter, som tooltippen nævner. */
  documentName?: string;
}>;

/**
 * Hvad en blokering kan henføres til – producentens EKSPLICITTE angivelse, ikke en slutning.
 *
 * **Hvorfor scope er data og ikke udledt.** At klassificere ud fra issue-listens længde ("præcis ét issue
 * ⇒ citér det") er beviseligt usikkert:
 *
 *  1. `runProjection` dedupper på `${kind}:${code}` (`inputCore/projection.ts`), så to tabelrækker med
 *     samme descriptor-id kan kollapse til ÉN post – en multi-fejl ville da se ud som en enkeltfejl.
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
  /** Præcis én navngiven række, med stabil rækkeidentitet. Rød som `field`. */
  | Readonly<{ scope: 'row'; rowId: string; message: string }>
  /**
   * Flere uafhængige input, en tabelvalidering eller en flerfeltsregel – aldrig ordret citeret.
   *
   * `kind` er PÅKRÆVET, fordi et aggregat er den ENESTE cause-form, hvis klasse ikke kan udledes af
   * formen selv: "tabellen har fejl" siger intet om, hvorvidt cellerne er udfyldt forkert eller slet
   * ikke udfyldt. En hardkodet klasse for alle tabelfejl ville fx svare «Fejl i indtastning» på en
   * lønrække med komplet periode og INTET beløb – en ren mangel – selv om `TableError.issue` skelner
   * `invalid` fra `partial_period`/`missing_amount`.
   *
   * Klassen er derfor et VALG, producenten skal træffe pr. årsag – og et valg, en læser kan
   * efterprøve mod den fejl, årsagen kom af.
   */
  | Readonly<{ scope: 'aggregate'; kind: DocumentBlockingCauseClass; message: string }>
  /** Et tomt påkrævet felt (`missing`-consumerfejl). */
  | Readonly<{ scope: 'missing'; issue: ConsumerIssue }>
  /** Input er komplet og gyldigt, men beregningen kunne ikke dannes (`document-output-contract.md` §A5.1). */
  | Readonly<{ scope: 'unavailable-calculation'; message: string }>;

/**
 * De to klasser, en INPUT-blokering kan have. `page-errors` og `specific` er visningsvalg oven på dem
 * (henvis til boksen / citér ordret) og hører derfor ikke til her.
 */
export type DocumentBlockingCauseClass = Extract<
  DocumentDownloadGateReasonKind,
  'invalid-input' | 'missing-input'
>;

/**
 * Den ENE oversættelse fra en årsags FORM til brugerens to klasser.
 *
 * Skelnen: «Fejl i indtastning» bruges, når der ER indtastet
 * noget, men indtastningen er forkert (feltet får rød ring – uanset om det er format eller en
 * grænse); «Indtastning mangler» bruges, når der mangler en indtastning. Det er hele programmets
 * princip, ikke en regel for downloadknapper alene.
 *
 * Switchen er UDTØMMENDE med vilje: en ny `scope` giver en compile-fejl netop her, så klassen bliver
 * besvaret sammen med den nye årsagsform frem for at falde i en default-gren.
 */
export const classifyBlockingCause = (cause: DocumentBlockingCause): DocumentBlockingCauseClass => {
  switch (cause.scope) {
    // En `FieldIssue` er pr. definition afsluttet input, der blev afvist (§1.6) – der ER indtastet
    // noget. En `row`-cause er dens rækkeækvivalent og bærer samme røde markering.
    case 'field':
    case 'row':
      return 'invalid-input';
    case 'missing':
      return 'missing-input';
    // Input er komplet og gyldigt, men beregningen kan ikke dannes. Brugerens praktiske handling ER
    // at udfylde mere, så klassen er `missing-input` – se `blockDocumentDownloadForUnavailableCalculation`.
    case 'unavailable-calculation':
      return 'missing-input';
    case 'aggregate':
      return cause.kind;
  }
};

/** Årsagens INTERNE forklaring, uanset form. Aldrig brugertekst – se modulets hoveddoc. */
const causeMessage = (cause: DocumentBlockingCause): string =>
  cause.scope === 'field' || cause.scope === 'missing' ? cause.issue.message : cause.message;

/**
 * Oversætter en producents årsagsliste til ÉN klassificeret gate-årsag.
 *
 * Rækkefølgen er et fast hierarki med `specific` som snæver undtagelse:
 *
 *  1. Præcis ÉN `field`/`row`-cause med en konkret tekst → `specific` (ordret citat).
 *  2. Mindst én årsag, der klassificeres som `invalid-input` → `invalid-input`
 *     ("noget forkert" slår "noget uudfyldt").
 *  3. Mindst én årsag, der klassificeres som `missing-input` → `missing-input`.
 *  4. Tom liste → `missing-input` med `fallbackMessage`.
 *
 * Trin 2–3 spørger `classifyBlockingCause` frem for at matche på `scope`. Et match på kun
 * `scope: 'field'` og `scope: 'missing'` ville lade en `row`-cause – som er lige så rød som en feltfejl –
 * falde hele vejen ned i `missing-input`, så to samtidige out-of-range-procenter på Årsløn svarede
 * «Indtastning mangler» på udfyldte felter. Én udtømmende klassifikation lukker begge retninger på én gang.
 *
 * Trin 1 genbruger `resolveFieldIssueTooltip` frem for at gentage allowlisten `bounds|rule`. Den funktion
 * ejer allerede afgørelsen "har dette issue en konkret tekst værd at vise" – inklusive et `format`-issue med
 * en codec-leveret `detail.tooltip`, som en håndskrevet reason-test taber. Sondringen bor dermed ÉT sted,
 * delt af feltets eget tooltip og knappens, hvilket er den paritet `error-contract.md` §4 kræver.
 */
export const classifyBlockingCauses = (
  code: string,
  causes: readonly DocumentBlockingCause[],
  fallbackMessage: string
): DocumentDownloadGateReason => {
  /**
   * `specific` kræver at der er præcis ÉN årsag i hele listen, den skal være en felt-/rækkeårsag, OG den
   * skal have en konkret tekst.
   *
   * Begge led er nødvendige, og de gør forskellige ting:
   *
   *  - Kravet om ÉN årsag er lempelsen: er der flere samtidige årsager, ville et citat af den ene udpege
   *    den som "fejlen" og skjule de øvrige – også hvis de øvrige er manglende input.
   *  - Kravet om konkret tekst er allowlisten: en `format`-rejection uden `detail.tooltip` (fx en malformet
   *    dato) har intet at sige ud over feltets navn, som allerede står ved markøren.
   *
   * Antallet måles på hele listen. En samtidig `missing`- eller aggregatårsag må ikke skjules af et citat af
   * den ene røde feltfejl; så falder klassifikationen i stedet tilbage til den fælles invalid-/missing-
   * prioritet nedenfor.
   */
  const only = causes.length === 1 && (causes[0]?.scope === 'field' || causes[0]?.scope === 'row')
    ? causes[0]
    : undefined;
  if (only !== undefined) {
    const text = only.scope === 'row' ? only.message : resolveFieldIssueTooltip(only.issue);
    if (text !== FIELD_ISSUE_GENERIC_TOOLTIP) return { code, message: text, kind: 'specific' };
  }
  const firstInvalid = causes.find((cause) => classifyBlockingCause(cause) === 'invalid-input');
  if (firstInvalid !== undefined) {
    return { code, message: causeMessage(firstInvalid), kind: 'invalid-input' };
  }
  const firstMissing = causes.find((cause) => classifyBlockingCause(cause) === 'missing-input');
  if (firstMissing !== undefined) {
    return { code, message: causeMessage(firstMissing), kind: 'missing-input' };
  }
  // Kun en TOM liste når hertil: `classifyBlockingCause` er udtømmende, så enhver årsag har en klasse.
  return { code, message: fallbackMessage, kind: 'missing-input' };
};

/**
 * Blokering udledt af en producents årsagsliste. Den kanoniske vej for en gate, der KAN opregne sine
 * årsager – så klassen bliver udledt frem for gættet ved hvert callsite.
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
 * `ConsumerIssue` med `reason: 'rule'` bliver `aggregate` med klassen `invalid-input`, IKKE `missing`: en
 * consumerplaceret domæneregel er ikke samme tilstand som et tomt felt (`error-contract.md` §1.1) – felterne
 * ER udfyldt, og det er sammensætningen af dem, der er forkert. Klassen står på årsagen, så en udfyldt,
 * regelstridig sammensætning ikke falder igennem til "Indtastning mangler".
 */
export const toBlockingCauses = (
  issues: readonly (FieldIssue | ConsumerIssue)[]
): readonly DocumentBlockingCause[] =>
  issues.map((issue): DocumentBlockingCause =>
    issue.kind === 'field'
      ? { scope: 'field', issue }
      : issue.reason === 'missing'
        ? { scope: 'missing', issue }
        : { scope: 'aggregate', kind: 'invalid-input', message: issue.message }
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
 * Den brugerrettede tooltiptekst for en blokerende årsag – det ENE sted, `kind` oversættes til tekst.
 *
 * Ligger her frem for i React-laget, fordi valget er en egenskab ved ÅRSAGEN, ikke ved den flade der tegner
 * knappen. Havde hver flade valgt selv, ville "universel tekst" være en konvention, ingen kunne håndhæve –
 * og præcis den slags drift var årsagen til, at to sider viste årsagen både som tekst og tooltip.
 */
export const resolveDocumentGateTooltip = (reason: DocumentDownloadGateReason): string => {
  switch (reason.kind) {
    case 'page-errors':
      return buildDownloadBlockedByPageErrorsMessage(reason.documentName);
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
 * viser én tekst – så valget skal være en egenskab ved klassifikationen, ikke ved den rækkefølge, en gate
 * tilfældigvis pusher sine årsager i.
 *
 * **`page-errors` vinder alt.** Er fejlen allerede synlig i sidens fejlboks, er den henvisning det, brugeren
 * skal læse – uanset om en af de underliggende fejl kunne navngives (bevidst valg:
 * forudsigelighed over handlingsanvisning).
 *
 * `invalid-input` slår `missing-input`, fordi noget FORKERT er mere akut end noget uudfyldt: det uudfyldte
 * felt bliver ofte udfyldt i samme arbejdsgang, mens en afvist værdi kræver, at brugeren finder og retter
 * den. Det er samme forrang, de enkelte gates i forvejen bruger internt (rød feltfejl før manglende felt).
 *
 * `specific` er SIDST, ikke først (`document-output-contract.md` §A5.1). Et citat er kun tilladt for præcis
 * én felt-/rækkefejl, og i enhver
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
 * Den PRIMÆRE årsag i en blokering – den, hvis tekst brugeren skal se. `undefined` kun for en tom liste (en
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
 * kalde – så ingen knap selv rækker ned i `reasons[0]`.
 */
export const resolveBlockedGateTooltip = (
  reasons: readonly DocumentDownloadGateReason[]
): string | undefined => {
  const primary = resolvePrimaryGateReason(reasons);
  return primary === undefined ? undefined : resolveDocumentGateTooltip(primary);
};

/**
 * Blokering, hvor brugeren mangler at indtaste noget. `message` er den interne forklaring; brugeren ser den
 * universelle tekst. Dette er DEFAULTEN for en gate-blokering – en gate skal aktivt vælge `specific`.
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
 *
 * ⚠️ Klassen er HARDKODET her – funktionen ser ingen data og kan derfor ikke tage fejl af, hvad den får at
 * vide. Den må kun bruges, når gatens gren er BEVISELIGT ét-klasset, altså når betingelsen ikke kan være
 * sand for en manglende indtastning. Dækker grenen både «udfyldt forkert» og «ikke udfyldt», er den
 * halvdelen af tiden forkert. Kan årsagerne
 * opregnes, er {@link blockDocumentDownloadFromCauses} den rigtige, og et nyt kaldssted skal føjes til
 * allowlisten i arkitekturreglen `document/gate-class-hardcoded-invalid-input`.
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
  reason: Readonly<{ code: string; message: string; documentName?: string }>
): DocumentDownloadGateResult => ({
  canDownload: false,
  reasons: [{ ...reason, kind: 'page-errors' }],
});

/**
 * Blokering, hvor input er komplet og gyldigt, men beregningen ikke kunne dannes – fx en manglende lovsats
 * for beregningsåret, en tabel uden en eneste komplet række eller nul SH-dage i de indtastede perioder.
 *
 * Klassen er `missing-input`, fordi brugerens praktiske handling ER at udfylde mere. Men den har sin egen
 * konstruktør, så valget er BEVIDST: lå disse blokeringer i den samme `blockDocumentDownload`-default
 * som ægte tomme felter, kunne en ny gate falde i den uden at have taget stilling.
 */
export const blockDocumentDownloadForUnavailableCalculation = (
  reason: Readonly<{ code: string; message: string }>
): DocumentDownloadGateResult => ({
  canDownload: false,
  reasons: [{ ...reason, kind: 'missing-input' }],
});

/**
 * Blokering fra ÉT rødt feltissue. Klassifikationen deles med {@link classifyBlockingCauses}, så
 * "hvornår er en feltfejl værd at citere" kun er besvaret ét sted. En inline allowlist
 * (`reason === 'bounds' || reason === 'rule'`) ville lade et `format`-issue med en codec-leveret
 * `detail.tooltip` (fx en konkret datogrænse) falde i den generiske gren, selv om feltets eget tooltip
 * viser den konkrete tekst.
 */
export const blockDocumentDownloadForFieldIssue = (
  issue: FieldIssue,
  code: string
): DocumentDownloadGateResult =>
  blockDocumentDownloadFromCauses(code, [{ scope: 'field', issue }], issue.message);

/**
 * Blokering med en konkret, brugerrettet årsag, der citeres ordret.
 *
 * **Snæver allowlist.** Brug den KUN, når blokeringen kan henføres til præcis ÉT felt
 * eller ÉN navngiven række, og teksten fortæller brugeren hvad der skal rettes. Er årsagen et aggregat over
 * flere rækker, en tabelvalidering eller en flerfeltsregel, ville et citat af én af fejlene give brugeren
 * indtryk af, at det er den eneste – brug da {@link blockDocumentDownload} eller
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

/** Én årsag, klassificeret som "mangler indtastning" – til gates der samler flere årsager. */
export const missingInputReason = (code: string, message: string): DocumentDownloadGateReason =>
  ({ code, message, kind: 'missing-input' });

/** Én årsag, klassificeret som "ugyldig indtastning" – til gates der samler flere årsager. */
export const invalidInputReason = (code: string, message: string): DocumentDownloadGateReason =>
  ({ code, message, kind: 'invalid-input' });

/** Én årsag, hvis besked skal citeres ordret – til gates der samler flere årsager. Se allowlisten ovenfor. */
export const specificReason = (code: string, message: string): DocumentDownloadGateReason =>
  ({ code, message, kind: 'specific' });

/** Én årsag, siden allerede viser i sin fejlboks – til gates der samler flere årsager. */
export const pageErrorsReason = (code: string, message: string): DocumentDownloadGateReason =>
  ({ code, message, kind: 'page-errors' });
