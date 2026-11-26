import type { FieldCodec, FieldSignPolicy } from '../../fieldCodec';
import type { FieldRef } from '../../fieldDescriptor';
import { normalizeMinusCharacters } from '../../../utils/draftNormalization';

/**
 * Den ENE vej fra et felts descriptor til dens fortegns-politik.
 *
 * Politikken erklæres på codec'en og læses HER af både formular og grid fra
 * `field.descriptor.codec.signPolicy`. Ingen feltkomponent må vælge selv: ellers kan to flader af samme
 * feltfamilie svare forskelligt uden at noget bliver rødt – fx et minustegn som første tegn i et procentfelt.
 * Et nyt descriptor-felt får dermed automatisk samme adfærd på begge flader.
 *
 * **Afgrænsning.** Et fortegn er en BOUNDS-regel, ikke et formatbrud: `parseForSettle` er fortegns-blind, og
 * bounds-validatoren ejer den røde fejl for en negativ værdi, der NÅR frem – fx fra en indlæst `.eo`-fil.
 * Politikken styrer, hvad der kan tastes og indsættes: i et felt uden negative værdier springes et minus
 * over, også ved paste (`input-field-behavior-contract.md` §1.2a, `form-contract.md` §8.2).
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
 * **Hvorfor her.** Tegnfilteret kender kun ASCII-minus og springer andre tegn over: uden normaliseringen
 * indsættes `10−1` (U+2212) og `10–1` (U+2013) som `101`, og et felt med negative beløb får `−1200` som +1200. Normaliseringen sker FØR tegnfilteret, så tegnet derefter
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
