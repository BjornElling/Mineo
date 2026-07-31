import type { ISODateString } from '../types/branded';
import { toISODateString } from '../types/branded';

/**
 * Indskudte lønregulerings-tillæg — Mineo
 *
 * Single source of truth for de tillæg, der ved lønregulering skal **indskydes udefra**
 * i lønpakken, fordi de ikke følger af overenskomstens egne satstabeller. Hvert tillæg er
 * et procentpoint-tillæg med en eller flere virkningsdatoer.
 *
 * Bindende regler ejes af `src/contracts/indskudte-loentillaeg-contract.md`.
 *
 * DER FINDES PRÆCIS ÉT INDSKUDT TILLÆG:
 * - **Store Bededagstillæg** (afskaffelsen af Store Bededag): 0,45 procentpoint fra 1-1-2024.
 *
 * Antag ikke flere. **Særligt ferietillæg** er IKKE et tillæg i dette program: det er et rent
 * fremtidigt udviklingsprojekt, og der må ikke indregnes særligt ferietillæg nogen steder.
 * Dets satstrappe blev fjernet herfra 2026-07-31, fordi data, der kun venter på at blive koblet
 * ind, læses som en forudsætning om, at tillægget skal bruges. Se kontraktens §6.
 */

const iso = (date: string): ISODateString => toISODateString(date);

/**
 * Et procentpoint-tillæg gyldigt fra og med en virkningsdato.
 * Et tillæg med flere historiske satser modelleres som en trappe af `Satstrin` sorteret
 * stigende efter `fraOgMed`. Satsen for en given dato er det seneste trin hvis `fraOgMed`
 * ligger på eller før datoen (ingen sats før det tidligste trin).
 */
export interface IndskudtLoentillaegSatstrin {
  /** Virkningsdato (inkl.) for denne sats. */
  readonly fraOgMed: ISODateString;
  /** Tillæggets størrelse i procentpoint (fx 0.45 = 0,45 procentpoint). */
  readonly procentpoint: number;
}

// ============================================================================
// STORE BEDEDAGSTILLÆG
// ============================================================================

/**
 * Virkningsdato for Store Bededagstillægget (afskaffelsen af Store Bededag).
 * Tillægget gælder fra og med 1. januar 2024.
 */
export const STORE_BEDEDAG_START: ISODateString = iso('2024-01-01');

/**
 * Store Bededagstillægget angivet i procentpoint (0,45).
 * Indskydes i lønpakken fra `STORE_BEDEDAG_START` når lønnen reguleres med
 * "Almindelig løn på helligdage".
 */
export const STORE_BEDEDAG_PCT = 0.45;

/** Store Bededagstillægget som satstrappe (ét trin). */
export const STORE_BEDEDAG_SATSTRAPPE: readonly IndskudtLoentillaegSatstrin[] = [
  { fraOgMed: STORE_BEDEDAG_START, procentpoint: STORE_BEDEDAG_PCT },
];

// ============================================================================
// FÆLLES OPSLAG
// ============================================================================

/**
 * Slår tillæggets procentpoint-sats op for en given dato i en satstrappe.
 *
 * @returns Det seneste trins `procentpoint` hvis `fraOgMed` ≤ `dato`; ellers 0
 *          (intet tillæg gælder før det tidligste trin).
 */
export const resolveIndskudtLoentillaegPct = (
  satstrappe: readonly IndskudtLoentillaegSatstrin[],
  dato: ISODateString
): number => {
  let resolved = 0;
  for (const trin of satstrappe) {
    if (trin.fraOgMed <= dato) {
      resolved = trin.procentpoint;
    }
  }
  return resolved;
};
