/**
 * Format-placeholders pr. semantisk feltfamilie: ÉN kilde til "hvilken FORM har værdien?".
 *
 * Reglen er normativ: en placeholder beskriver **udelukkende værdiens
 * form** – `mm`, `åååå`, `uu/åååå`, `dd-mm-åååå`, `0,00`. Den må ALDRIG bære
 *
 * - en valideringsgrænse (`åååå (≤2026)` – den konkrete regression fundet lukkede),
 * - en status- eller manglende-værdi-besked, eller
 * - noget andet, der ændrer sig med tilstand eller kalender.
 *
 * Grænser og fejl hører i feltissues og tooltips (§1.6/§1.8). To konkurrerende beskrivelser af samme felt er
 * netop det, der lod en årstalsafhængig tekst leve i visningslaget uden at nogen kontrakt fejlede.
 *
 * Konstanterne aftages af feltFAMILIEN som default (`YearField`/`GridYearCell` osv.) – ikke af tabellerne.
 * Det er bevidst: `GridYearCell`/`GridWeekCell` havde INGEN default, så hver tabel udfyldte formen selv (og én
 * af dem forkert). Familien kender sin egen form; en tabel gør ikke. En tabel må kun override, når feltets
 * domæne har en reelt anden FORMATREPRÆSENTATION (fx månedens `mm` i en periodekolonne) – aldrig for at vise
 * bounds, validering eller status.
 *
 * Modulet ligger i `utils/` sammen med `DEFAULT_AMOUNT_PLACEHOLDER`/`DEFAULT_PERCENT_PLACEHOLDER`, som er de
 * samme slags konstanter. Det gør det også aftageligt for den transiente (ikke-sagsdata) familie, uden at den
 * skal importere fra `inputCore/react/fields` – datoens form er den samme for brugeren, uanset om feltet
 * persisteres.
 */

/** År: fire cifre. Ingen øvre/nedre grænse i teksten – den hører i feltets issue/tooltip. */
export const YEAR_FORMAT_PLACEHOLDER = 'åååå';

/** Uge/år: ugenummer og årstal. */
export const WEEK_FORMAT_PLACEHOLDER = 'uu/åååå';

/** Dansk datoform. */
export const DATE_FORMAT_PLACEHOLDER = 'dd-mm-åååå';

/** Måned: to cifre. Brugt af løntabellens periodekolonner, hvor formen er måneden alene. */
export const MONTH_FORMAT_PLACEHOLDER = 'mm';

/** Dag i måneden: to cifre. */
export const DAY_FORMAT_PLACEHOLDER = 'dd';
