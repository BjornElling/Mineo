/**
 * Dato-værn for dokument-output (kanal-neutralt, sidste forsvarslinje)
 *
 * Alle datoer i Mineos dokumenter SKAL vises i dansk format (DD-MM-ÅÅÅÅ eller
 * "d. mmmm åååå"). Datoer formateres altid ved kilden via de kanoniske formattere
 * (`formatDateShort`/`formatDateLong` ≈ `formatISOToDanish`/`formatIsoDateLong`).
 *
 * Dette modul er IKKE den primære formatering – det er et centralt sikkerhedsnet,
 * der fanger en rå ISO-dato (ÅÅÅÅ-MM-DD), hvis en generator ved en fejl sender en
 * uformateret dato videre til writer- eller tabel-laget. Begge dokumentkanaler (PDF
 * og Word) router deres tekst gennem dette værn, så en ISO-dato aldrig kan nå frem
 * til et brugersynligt dokument:
 *
 *  - i udvikling: høj-lydt `console.error` (en brudt invariant, jf. console-politik),
 *    så lækagen bliver opdaget og rettet ved kilden.
 *  - i produktion: tavs, deterministisk omformatering til dansk DD-MM-ÅÅÅÅ, så en
 *    fremtidig, utestet lækage-sti aldrig viser brugeren en ISO-dato.
 *
 * Værnet er en ren string→string-transformation uden Date/tidszone: det ombytter blot
 * felterne i en allerede valideret ISO-streng (samme kalenderdag, dansk rækkefølge).
 * Den maskin-tjekbare regel håndhæves af `documentDateFormatGuard.test.ts`.
 */

import { isISODateString } from '../../types/branded';
import { formatISOToDanish } from '../../utils/dateFormatting';

/**
 * En bar ISO-dato (ÅÅÅÅ-MM-DD) som selvstændigt token. Lookbehind/lookahead på cifre
 * sikrer, at vi kun rammer en isoleret 4-2-2-dato og aldrig en del af et længere
 * tal eller et journalnummer (fx "2024-001234" har 6-cifret hale → intet match).
 * En dansk dato (DD-MM-ÅÅÅÅ) starter med 2 cifre og matcher derfor heller ikke.
 */
const ISO_DATE_TOKEN = /(?<!\d)\d{4}-\d{2}-\d{2}(?!\d)/g;

/**
 * Erstatter alle gyldige, bare ISO-dato-tokens i `value` med dansk DD-MM-ÅÅÅÅ.
 * Returnerer den omformaterede streng plus de fundne ISO-datoer (tom = ingen lækage).
 *
 * Et token der matcher mønsteret, men ikke er en reel dato (fx "1234-56-78"), lades
 * urørt – `isISODateString` validerer interval og kalendergyldighed.
 */
export const reformatStrayIsoDates = (value: string): Readonly<{ text: string; found: readonly string[] }> => {
  const found: string[] = [];
  const text = value.replace(ISO_DATE_TOKEN, (match) => {
    if (!isISODateString(match)) return match;
    const danish = formatISOToDanish(match);
    if (!danish) return match;
    found.push(match);
    return danish;
  });
  return { text, found };
};

/** Sandt hvis strengen indeholder mindst én gyldig bar ISO-dato. */
export const containsRawIsoDate = (value: string): boolean => {
  if (typeof value !== 'string' || value.indexOf('-') === -1) return false;
  return reformatStrayIsoDates(value).found.length > 0;
};

/**
 * Centralt værn: kald på al brugersynlig dokumenttekst, lige før den når en kanal.
 * Lader almindelig tekst (uden bar ISO-dato) passere uændret – herunder danske datoer,
 * beløb, uge-/årstal og overskrifter – og omformaterer kun en stray ISO-dato.
 */
export const guardDocumentDateText = (value: string): string => {
  // Hurtig udvej: kun strenge med bindestreg kan rumme en ISO-dato.
  if (typeof value !== 'string' || value.indexOf('-') === -1) return value;

  const { text, found } = reformatStrayIsoDates(value);
  if (found.length === 0) return value;

  if (import.meta.env.DEV) {
    const list = found.map((iso) => `"${iso}"`).join(', ');
    console.error(
      `[dokument-output] Rå ISO-dato ${list} nåede frem til et dokument og blev auto-omformateret til dansk. ` +
        'Formatér datoen ved kilden via formatDateShort/formatDateLong.'
    );
  }

  return text;
};
