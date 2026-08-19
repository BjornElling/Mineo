/**
 * ASL-årslønsmaksimum – kanonisk opslags-gateway (§ 24).
 *
 * `aarsloenAslMax` er en *datakilde* (år → maksimal årsløn), ikke en beregning.
 * Den blev tidligere slået op rå (`aarsloenAslMax[year]`) ~10 forskellige steder,
 * der hver gentog det samme "findes / er positiv-finit"-værn og hver formulerede
 * sin egen brugervendte "mangler"-besked (mindst fem afvigende ordlyde). Denne fil
 * er det ENESTE opslagspunkt:
 *
 *  - `resolveAslAarsloensmaksimumForAar(aar)` – slå beløbet op for ét år, eller
 *    `undefined` hvis året ikke er dækket (manglende/ikke-positiv/ikke-finit/ikke-
 *    heltal). Erstatter både grænse-validering og opreguleringsmotorens indeks-læsning.
 *  - `formatAslAarsloensmaksimumMissing*` – ÉN brugervendt ordlyd for "sats mangler",
 *    så samme situation læses ens uanset fane (årsløn, EET, forsørgertab, EO-regulering).
 *
 * Bemærk: selve opreguleringen (idx[målår]/idx[kildeår] og akkumuleret reguleringssats)
 * forbliver i `opreguleringsmotorer.ts` – de to motorer løser forskellige matematiske
 * problemer. Det er kun *opslaget af tabellen* der konsolideres her.
 */

import {
  aarsloenAslMax,
  getYearBoundsForYearlyRate,
  type YearlyRate,
} from '../../data/lovbestemteRates';

/** Den kanoniske brugervendte betegnelse for ASL-årslønsmaksimum. Ét sted. */
const ASL_MAKS_NOUN = 'ASL-maks-sats';

/**
 * Kanonisk opslag af ASL-årslønsmaksimum for ét år.
 *
 * Returnerer beløbet hvis året er dækket af en positiv-finit sats, ellers `undefined`.
 * `indeks` kan injiceres (default = `aarsloenAslMax`), så opreguleringsmotoren og
 * test-stier kan dele samme opslags-semantik mod et alternativt år→beløb-map.
 */
export const resolveAslAarsloensmaksimumForAar = (
  aar: number,
  indeks: YearlyRate = aarsloenAslMax
): number | undefined => {
  if (!Number.isInteger(aar)) return undefined;
  const value = indeks[aar];
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined;
};

/**
 * Dækningsgrænse-suffiks: `" (satser findes kun for A–B)"` – én kilde til den oplysning.
 * Tom streng hvis tabellen er tom (fail-open på selve hjælpeteksten, ikke på værnet).
 */
export const aslAarsloensmaksimumBoundsSuffix = (indeks: YearlyRate = aarsloenAslMax): string => {
  const bounds = getYearBoundsForYearlyRate(indeks);
  return bounds ? ` (satser findes kun for ${bounds.minYear}–${bounds.maxYear})` : '';
};

/** Kanonisk besked når ASL-maks mangler for ét år. ÉN ordlyd overalt. */
export const formatAslAarsloensmaksimumMissing = (
  aar: number,
  indeks: YearlyRate = aarsloenAslMax
): string => `${ASL_MAKS_NOUN} mangler for år ${aar}${aslAarsloensmaksimumBoundsSuffix(indeks)}.`;

/**
 * Kanonisk besked når ASL-maks mangler for en liste af år (regulerings-dækningstjek).
 * Samme ordlyd/terminologi som enkelt-år-varianten; udelader "år"-ordet foran listen,
 * jf. den hidtidige `formatMissingYears`-form ("2004" / "2004, 2005").
 */
export const formatAslAarsloensmaksimumMissingForYears = (
  aar: readonly number[],
  indeks: YearlyRate = aarsloenAslMax
): string =>
  `${ASL_MAKS_NOUN} mangler for ${aar.length === 1 ? `${aar[0]}` : aar.join(', ')}${aslAarsloensmaksimumBoundsSuffix(indeks)}.`;
