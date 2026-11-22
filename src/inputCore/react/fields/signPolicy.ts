import type { FieldCodec, FieldSignPolicy } from '../../fieldCodec';
import type { FieldRef } from '../../fieldDescriptor';
import { normalizeMinusCharacters } from '../../../utils/draftNormalization';

/**
 * Den ENE vej fra et felts descriptor til dens fortegns-politik.
 *
 * **Fundet, denne modul lukker.** `allowNegative` var erklæret på hvert numerisk codec i produktionskataloget
 * – 30+ steder – og honoreret af INGENTING. Hver feltkomponent hardkodede i stedet sit eget svar:
 *
 *   - `PercentField`        → `allowNegative: true`   (men ALLE procent-descriptorer er `false`)
 *   - `GridPercentCell`     → `allowNegative: false`  (samme familie, modsat svar)
 *   - `IntegerField`        → `allowNegative: true`   (alle heltals-descriptorer er `false`)
 *   - `GridIntegerCell`     → `allowNegative: true`   (månedscellen 1..12)
 *   - `AmountField`         → `allowNegative: true`
 *
 * Symptomet brugeren fandt var, at et minustegn kunne tastes som første tegn i et procentfelt. Årsagen var
 * ikke en manglende `false` på ét callsite, men at politikken slet ikke havde en vej fra det sted, den ER
 * erklæret, til det sted, den skal virke. To flader af samme feltfamilie kunne derfor svare forskelligt uden
 * at noget blev rødt.
 *
 * Politikken læses HER af begge flader fra `field.descriptor.codec.signPolicy`. En ny numerisk
 * feltkomponent kan ikke længere vælge selv – og et nyt descriptor-felt får automatisk den rigtige adfærd på
 * både formular og grid.
 *
 * **Hvad dette IKKE ændrer (§1.6).** Et fortegn er stadig en BOUNDS-regel, ikke et formatbrud:
 * `parseForSettle` er fortegns-blind, paste bevarer et indsat minus, og bounds-validatoren ejer stadig den
 * røde fejl for en negativ værdi, der NÅR frem – fx fra en indlæst `.eo`-fil. Politikken styrer udelukkende,
 * hvad der kan TASTES, så et ulovligt fortegn ikke kan opstå ved indtastning i første omgang.
 */

/**
 * `true`, hvis feltet må indeholde en negativ værdi.
 *
 * Fail-open på et codec UDEN politik (`undefined`) er bevidst: de ikke-numeriske familier – tekst, valg,
 * dato, uge, år, brøk – erklærer ingen politik, og for dem er "må minus tastes?" enten meningsløst eller
 * ejet af deres eget format-filter. En fail-closed default ville stille afvise tegn i familier, denne regel
 * ikke handler om.
 */
export const codecAllowsNegative = <T>(codec: FieldCodec<T>): boolean =>
  codec.signPolicy !== 'nonNegative';

/** Som {@link codecAllowsNegative}, men læst direkte fra et bundet felt – komponenternes normale indgang. */
export const fieldAllowsNegative = <T>(field: FieldRef<T>): boolean =>
  codecAllowsNegative(field.descriptor.codec);

/**
 * Normaliserer typografiske minustegn til ASCII '-' i tekst, der er på vej ind i en draft – men KUN for
 * familier med et fortegnsbegreb (dem, der erklærer en `signPolicy`).
 *
 * **Hvorfor her.** Fundet BB-430: `10−1` (U+2212) og `10–1` (U+2013) blev indsat som `101`, fordi
 * tegnfilteret kun kender ASCII-minus og derfor sprang tegnet over, så cifrene smeltede sammen. Et felt
 * med negative beløb fik `−1200` som +1200. Normaliseringen sker FØR tegnfilteret, så tegnet derefter
 * møder præcis de samme regler som '-' – også §8.2's regel om, at et unært minus springes over i et felt
 * uden negative værdier. Tegnklassen er den kanoniske i `utils/draftNormalization.ts`.
 *
 * Tekst-, dato-, uge- og årsfamilierne erklærer ingen politik og får teksten uændret: i fritekst er en
 * tankestreg indhold, og i dato/uge er ethvert ikke-alfanumerisk tegn allerede en separator.
 */
export const normalizeSignCharactersForCodec = (
  codec: Readonly<{ signPolicy?: FieldSignPolicy }>,
  text: string
): string => codec.signPolicy === undefined ? text : normalizeMinusCharacters(text);

/**
 * `true`, hvis tasten er et enkelt tegn, som {@link normalizeSignCharactersForCodec} oversætter.
 *
 * Keydown-filteret ser det UOVERSATTE tegn og ville derfor afvise det. Surfacerne springer filteret over
 * for netop disse taster og lader `onDraftChange` vurdere den oversatte draft med det samme prædikat.
 */
export const isTranslatedSignKey = (
  codec: Readonly<{ signPolicy?: FieldSignPolicy }>,
  key: string
): boolean => key.length === 1 && normalizeSignCharactersForCodec(codec, key) !== key;

/** Den erklærede politik, eller `undefined` for en familie uden fortegns-begreb. */
export const fieldSignPolicy = <T>(field: FieldRef<T>): FieldSignPolicy | undefined =>
  field.descriptor.codec.signPolicy;
