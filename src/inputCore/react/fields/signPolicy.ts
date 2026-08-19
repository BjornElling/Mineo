import type { FieldCodec, FieldSignPolicy } from '../../fieldCodec';
import type { FieldRef } from '../../fieldDescriptor';

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

/** Den erklærede politik, eller `undefined` for en familie uden fortegns-begreb. */
export const fieldSignPolicy = <T>(field: FieldRef<T>): FieldSignPolicy | undefined =>
  field.descriptor.codec.signPolicy;
