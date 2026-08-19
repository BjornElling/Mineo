/**
 * Kanonisk ASCII-slug for danske etiketter.
 *
 * Ét sted for "lav en maskinlæsbar ASCII-nøgle ud af en dansk brugervendt tekst".
 * Bruges til interne id'er (fx graf-serie-id), fejlkode-suffikser og ASCII-sikre
 * filnavnsdele – dvs. steder hvor resultatet skal bestå af `[a-z0-9]` plus en
 * separator, uanset hvilke danske tegn kilden indeholder.
 *
 * Hvorfor ikke bare `NFKD` + `[^a-z0-9]`? Det var den tidligere form på tre
 * forskellige callsites, og den er forkert for dansk: `NFKD` dekomponerer `Å`→`a`
 * og `Ä`→`a`, men `ø` har INGEN dekomposition og blev derfor spist som separator.
 * `Årsløn` blev `arsl-n` og `Ærø` blev `a-r-` – begge tabte betydningsbærende tegn
 * og kunne kollidere med en anden etiket. Derfor translittereres de danske
 * særtegn eksplicit (`ø`→`oe`, `æ`→`ae`, `å`→`aa`) FØR `NFKD` rydder resten af
 * de diakritiske tegn.
 *
 * Bemærk: dette er IKKE filnavns-sanitering. `sanitizeFilenamePart` i
 * `src/document/documentFileName.ts` er den kanoniske regel for dokument-filnavne
 * og bevarer bevidst danske tegn, store bogstaver og mellemrum, fordi filnavnet
 * er brugervendt. Brug denne slug kun hvor resultatet skal være rent ASCII.
 *
 * Sluggen er bevidst IKKE injektiv: to etiketter der kun adskiller sig ved tegn
 * uden for `[a-z0-9]`, giver samme slug (`"Løn"` og `"Loen"` → `loen`). Brug den
 * derfor ikke som eneste nøgle, hvor kollision ville tabe data – de nuværende
 * forbrug (graf-serie-id ved siden af en selvstændig `label`, fejlkode-suffiks,
 * filnavnsdel) tåler det alle.
 */

/**
 * Danske og nordiske særtegn har ingen (eller en tabsgivende) `NFKD`-dekomposition
 * og skal derfor translittereres eksplicit. Rækkefølgen er uden betydning, da alle
 * nøgler er enkelttegn.
 *
 * Konventionen er `ø`→`oe`, `æ`→`ae`, `å`→`aa` – den samme som kodebasens egne
 * identifikatorer bruger overalt (`aarsloen`, `opgoerelse`, `loenindkomst`,
 * `foersoergertab`). Vælg ikke den kortere `ø`→`o`-form her: den ville give slugs
 * der afviger fra de modul- og feltnavne, samme domænebegreb har i resten af koden.
 */
const DANISH_TRANSLITERATION: Readonly<Record<string, string>> = {
  ø: 'oe',
  Ø: 'oe',
  æ: 'ae',
  Æ: 'ae',
  å: 'aa',
  Å: 'aa',
  // Svensk/norsk/tysk nabotegn, så delte datasæt og indsatte etiketter er dækket.
  ö: 'oe',
  Ö: 'oe',
  ä: 'ae',
  Ä: 'ae',
  ü: 'ue',
  Ü: 'ue',
  ß: 'ss',
};

const TRANSLITERATION_PATTERN = new RegExp(
  `[${Object.keys(DANISH_TRANSLITERATION).join('')}]`,
  'g'
);

export type AsciiSlugOptions = Readonly<{
  /** Tegn der erstatter hvert løb af ikke-ASCII-alfanumeriske tegn. Default `'-'`. */
  separator?: string;
  /** Værdi der returneres, når kilden ikke indeholder noget sluggbart tegn. Default `''`. */
  fallback?: string;
}>;

/**
 * Oversætter en dansk etiket til en ASCII-slug med kun `[a-z0-9]` og `separator`.
 *
 * - Danske/nordiske særtegn translittereres (`Årsløn` → `aarsloen`).
 * - Øvrige diakritiske tegn fjernes via `NFKD` (`café` → `cafe`).
 * - Løb af øvrige tegn kollapses til én separator, og separatorer trimmes fra
 *   begge ender.
 * - Er resultatet tomt, returneres `fallback`.
 */
export const asciiSlug = (value: string, options?: AsciiSlugOptions): string => {
  const separator = options?.separator ?? '-';
  const fallback = options?.fallback ?? '';

  const transliterated = value.replace(
    TRANSLITERATION_PATTERN,
    (char) => DANISH_TRANSLITERATION[char] ?? char
  );

  const slug = transliterated
    .normalize('NFKD')
    // Fjern de kombinerende diakritiske tegn NFKD lige har udskilt.
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, separator);

  const trimmed = trimSeparator(slug, separator);
  return trimmed.length > 0 ? trimmed : fallback;
};

/**
 * Trimmer separator-løb fra begge ender uden at bygge en dynamisk regex
 * (separatoren kan være et regex-metategn).
 */
const trimSeparator = (value: string, separator: string): string => {
  if (separator.length === 0) {
    return value;
  }
  let start = 0;
  let end = value.length;
  while (value.startsWith(separator, start)) {
    start += separator.length;
  }
  while (end - separator.length >= start && value.startsWith(separator, end - separator.length)) {
    end -= separator.length;
  }
  return value.slice(start, end);
};
