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
 * AKTUELT DÆKKEDE TILLÆG:
 * - **Store Bededagstillæg** (afskaffelsen af Store Bededag): 0,45 procentpoint fra 1-1-2024.
 *
 * FORBEREDT, MEN ENDNU IKKE IMPLEMENTERET I BEREGNINGEN:
 * - **Særligt ferietillæg**: historisk 0,96 % → forhøjet til 1,48 % pr. 1-5-2024.
 *   Trappen er modelleret nedenfor, men er endnu ikke koblet ind i lønudviklings-/
 *   pakkeberegningen. Når den implementeres, sker det via samme "indskudt tillæg fra en
 *   virkningsdato"-mønster som Store Bededag (jf. kontrakten §4).
 *
 * Disse to er — jf. kontrakten — de eneste tillæg, der indskydes udefra. Antag ikke flere.
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
// SÆRLIGT FERIETILLÆG (forberedt — ikke koblet ind i beregningen endnu)
// ============================================================================

/**
 * Virkningsdato for forhøjelsen af det særlige ferietillæg (0,96 % → 1,48 %).
 * Gælder fra og med 1. maj 2024.
 */
export const SAERLIGT_FERIETILLAEG_FORHOEJELSE_START: ISODateString = iso('2024-05-01');

/** Det særlige ferietillæg før forhøjelsen (0,96 procentpoint). */
export const SAERLIGT_FERIETILLAEG_PCT_FOER = 0.96;

/** Det særlige ferietillæg efter forhøjelsen pr. 1-5-2024 (1,48 procentpoint). */
export const SAERLIGT_FERIETILLAEG_PCT_EFTER = 1.48;

/**
 * Det særlige ferietillæg som satstrappe.
 *
 * BEMÆRK: Det tidligste trin har `fraOgMed` = systemets nedre datogrænse (1-1-2005), fordi
 * 0,96 %-satsen var gældende før forhøjelsen og dækker hele perioden frem til 1-5-2024.
 * Datagrænsen holdes bevidst i sync med `DATE_2005_01_01` i `dateRanges.ts`.
 */
export const SAERLIGT_FERIETILLAEG_SATSTRAPPE: readonly IndskudtLoentillaegSatstrin[] = [
  { fraOgMed: iso('2005-01-01'), procentpoint: SAERLIGT_FERIETILLAEG_PCT_FOER },
  { fraOgMed: SAERLIGT_FERIETILLAEG_FORHOEJELSE_START, procentpoint: SAERLIGT_FERIETILLAEG_PCT_EFTER },
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
