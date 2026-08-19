/**
 * `PageMessage` – den ENE type en fejl-/advarselsboks' indhold må have.
 *
 * ## Hvorfor typen findes
 *
 * Årsløn-siden viste i lang tid en tom "Kritisk Fejl"-boks ØVERST på siden, permanent. Årsagen var én linje i
 * viewmodellen:
 *
 * ```ts
 * const beregningsFejl = calculation?.beregningsFejl ?? [];   // kilden er `string | null`
 * ```
 *
 * Fallbacken havde den forkerte TYPE. Tre uafhængige svagheder skulle ramme samtidigt, for at det kunne blive
 * usynligt hele vejen til brugeren:
 *
 * 1. `??` snævrer ikke sin højre operand: `string | null` + `[]` bliver `string | never[]`, ikke en typefejl.
 * 2. Ingen viewmodel har en DEKLARERET returtype – sidernes context er `ReturnType<typeof useXxxViewModel>`,
 *    så inferensen ER kontrakten. Der var intet at afvige fra.
 * 3. Boksens værn var `if (!beregningsFejl) return null`. Et tomt array er TRUTHY, så værnet slap igennem, og
 *    `{[]}` renderer lovligt til ingenting, fordi `string[]` er en gyldig `ReactNode`. Ingen fejl, intet crash
 *    – bare en tom boks der påstår "Kritisk Fejl".
 *
 * Fejlklassen er derfor ikke "en forkert fallback". Den er: **en beskeds tilstedeværelse blev afgjort ved
 * truthiness på en type, hvor truthy ikke betyder "har indhold".** Enhver `string | null`-besked, der guardes
 * med `!x` eller `{x && …}`, er sårbar over for præcis samme forveksling – og en tom boks er værre end ingen
 * boks, fordi den påstår en fejl uden at kunne navngive den.
 *
 * ## Hvad typen gør
 *
 * `PageMessage` er en diskrimineret union, hvor "ingen besked" er en EKSPLICIT variant frem for en falsy værdi.
 * Der findes kun to konstruktører, og `pageMessage()` afviser tom/whitespace-tekst ved at returnere `NO_MESSAGE`
 * – så en besked-variant BÆRER altid synligt indhold. Boksen behøver derfor ikke gætte: den spørger
 * `hasPageMessage()`, og et tomt array kan slet ikke nå dertil, fordi det ikke er en `PageMessage`.
 *
 * Boks-komponenten ({@link ../messages/PageMessageBox}) er den eneste render-vej og ejer værnet, så en side
 * ikke længere kan håndrulle sit eget. AST-reglen `ui/message-box-guarded-by-page-message` håndhæver, at nye
 * fejlbokse går gennem den.
 */

/** Kanonisk "der er ingen besked at vise". Én frossen instans, så identitetssammenligning er stabil. */
export const NO_MESSAGE = Object.freeze({ kind: 'none' } as const);

export type NoMessage = typeof NO_MESSAGE;

/** En besked MED garanteret ikke-tomt indhold. Kan kun konstrueres af {@link pageMessage}. */
export type PresentMessage = Readonly<{ kind: 'message'; text: string }>;

/**
 * Indholdet af en besked-boks. `kind` afgør tilstedeværelse – ALDRIG truthiness, ALDRIG `.length`.
 *
 * En `PageMessage` kan ikke være "tilstede men tom": `pageMessage('')` og `pageMessage('   ')` giver
 * {@link NO_MESSAGE}, ikke en tom besked.
 */
export type PageMessage = NoMessage | PresentMessage;

/**
 * Løfter en rå besked til en `PageMessage`.
 *
 * `null`/`undefined`/tom/whitespace-only bliver {@link NO_MESSAGE} – det er den samme normalisering, som hver
 * fejlboks ellers ville lave forskelligt (eller glemme). Teksten trimmes, så boksens indhold er det, brugeren
 * faktisk kan læse.
 */
export const pageMessage = (text: string | null | undefined): PageMessage => {
  if (text === null || text === undefined) return NO_MESSAGE;
  const trimmed = text.trim();
  return trimmed.length === 0 ? NO_MESSAGE : { kind: 'message', text: trimmed };
};

/**
 * Den ENE tilstedeværelses-kontrol. Typeguard, så `message.text` er tilgængelig i den sande gren uden cast.
 *
 * Brug denne – ikke `!message`, ikke `message.text.length > 0`. Hele pointen med typen er, at kaldere ikke
 * selv skal formulere kriteriet.
 */
export const hasPageMessage = (message: PageMessage): message is PresentMessage => message.kind === 'message';

/**
 * Den FØRSTE tilstedeværende besked, ellers {@link NO_MESSAGE}.
 *
 * Flere sider deler én fejlboks mellem to downloads (`a ?? b`-mønsteret). Med `PageMessage` kan `??` ikke
 * bruges – `NO_MESSAGE` er ikke nullish – og det er netop meningen: prioriteringen skal udtrykkes eksplicit
 * her, hvor den er læsbar, i stedet for at hvile på at den første kilde tilfældigvis er `null` og ikke `''`.
 */
export const firstPageMessage = (...messages: readonly PageMessage[]): PageMessage =>
  messages.find(hasPageMessage) ?? NO_MESSAGE;

/**
 * Pinder en viewmodels besked-felter til `PageMessage` UDEN at fryse resten af dens form.
 *
 * Sidernes context-type er `ReturnType<typeof useXxxViewModel>` – inferensen ER kontrakten, så en forkert typet
 * værdi har intet at afvige fra og propagerer tavst hele vejen til JSX. Det var svaghed 2 i Årsløns tomme
 * "Kritisk Fejl"-boks. De to nærliggende løsninger holder ikke:
 *
 * - En FULD håndskrevet returtype pr. viewmodel ville lukke hullet, men samtidig fryse 25 urelaterede felters
 *   form (flere med anonyme, inferede shapes) og drifte fra dagen efter.
 * - `satisfies Record<TKeys, PageMessage>` afvises af excess-property-kontrollen: viewmodellen returnerer
 *   naturligvis MANGE andre felter end sine beskeder.
 *
 * Funktionen løser begge: `TVm extends PageMessageFields<TKeys>` kontrollerer de navngivne nøgler og returnerer
 * `TVm` uændret, så alle øvrige felter beholder deres præcise inferede type. En `string`, `string[]` eller
 * `null` i et besked-felt bliver en compile-fejl på selve viewmodellen – ikke en tom boks i produktionen.
 *
 * Kaldet navngiver desuden besked-felterne ÉT sted pr. side, hvilket er det AST-reglen
 * `ui/message-box-guarded-by-page-message` læser for at afgøre, om en fejlboks' kilde er dækket.
 *
 * ```ts
 * return withPageMessages<'beregningsFejl' | 'downloadErrorMessage'>()({ …, beregningsFejl, downloadErrorMessage });
 * ```
 */
export type PageMessageFields<TKeys extends string> = Readonly<Record<TKeys, PageMessage>>;

/**
 * Curry'et i to trin, fordi TypeScript ikke tillader at angive ÉN typeparameter og inferere den anden: `TKeys`
 * skal navngives eksplicit, mens `TVm` skal inferes fra objektet for at bevare dets præcise form.
 */
export const withPageMessages =
  <TKeys extends string>() =>
    <TVm extends PageMessageFields<TKeys>>(vm: TVm): TVm => vm;
