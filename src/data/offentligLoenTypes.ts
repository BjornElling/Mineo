/**
 * Typer for offentlige lønsatser (KL og RLTN overenskomster)
 *
 * Bruges til opslag af månedsløn og timeløn baseret på løntrin og løngruppe.
 * Data genereres fra Excel-filer via scripts/import-offentlig-loen.mjs
 */

import type { DanishDateString } from '../types/branded';

/** Overenskomsttype: KL (kommunal) eller RLTN (regional) */
export type OffentligOverenskomstType = 'KL' | 'RLTN';

/** Løntype: månedsløn eller timeløn */
export type OffentligLoenType = 'maanedsLoen' | 'timeLoen';

/** Løngruppe: 0-4 (områdetillægsgruppe) */
export type Loengruppe = 0 | 1 | 2 | 3 | 4;

/**
 * Løntrin: heltal 1-55 eller strengen '55+'
 *
 * Branded type sikrer at kun validerede værdier bruges i domænet.
 * Brug toLoentrin() til at oprette validerede værdier.
 * Brandet er required — almindelige numbers kan ikke bruges direkte.
 */
export type Loentrin = (number & { readonly __brand: 'Loentrin' }) | '55+';

/** Validerer og opretter et Loentrin. Kaster ved ugyldigt input. Accepterer tal, '55+', og numeriske strenge ("1".."55"). */
export const toLoentrin = (value: number | string): Loentrin => {
  if (value === '55+') return '55+';
  if (typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 55) {
    return value as Loentrin;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isInteger(parsed) && parsed >= 1 && parsed <= 55) {
      return parsed as Loentrin;
    }
  }
  throw new Error(`Ugyldigt løntrin: ${JSON.stringify(value)}. Skal være heltal 1-55 eller '55+'.`);
};

/** Type guard: tjekker om en værdi er et gyldigt Loentrin */
export const isValidLoentrin = (value: unknown): value is Loentrin => {
  if (value === '55+') return true;
  if (typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 55) return true;
  return false;
};

/** Én række i løntabellen — nøglebaseret, ikke positionsbaseret */
export interface OffentligLoenEntry {
  readonly loentrin: Loentrin;
  readonly maanedsLoen: Readonly<Record<Loengruppe, number>>;
  readonly timeLoen: Readonly<Record<Loengruppe, number>>;
}

/** En samlet reguleringsperiode med alle løntrin */
export interface OffentligLoenRegulering {
  readonly effectiveDate: DanishDateString;
  readonly entries: ReadonlyArray<OffentligLoenEntry>;
}

/** Resultat af et lønopslag */
export interface OffentligLoenResultat {
  readonly overenskomstType: OffentligOverenskomstType;
  readonly effectiveDate: DanishDateString;
  readonly loentrin: Loentrin;
  readonly loengruppe: Loengruppe;
  readonly maanedsLoen: number;
  readonly timeLoen: number;
}
