/**
 * KL-lønaftaler – periodevise reguleringssatser fra de kommunale lønaftaler.
 *
 * SÆRLIG KL-LOGIK — denne model regulerer trinvist på selve lønnen og har andre
 * visninger end de øvrige reguleringsmodeller. Normativt overblik:
 * docs/domain/taf/kl-loenaftaler-regulering.md
 *
 * Modellen er en enkelt serie af periode-reguleringer (modsat KRL-satstabellen,
 * der har fire delserier). Hver række beskriver én reguleringsprocent på en given
 * dato (fx 1,40 % pr. 1. januar 2006). Der lagres bevidst INGEN akkumuleret
 * regulering i kilden — den akkumulerede serie beregnes af programmet (se
 * `klSatstabelVaerdier` nedenfor), og selve reguleringen mellem to datoer beregnes
 * af reguleringsmotoren i forbindelse med erstatningsberegningen, præcis som for
 * KRL-satstabellen, statistikmodellerne og overenskomsterne (forholdet mellem
 * indeks på segment- og basisdatoen).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * NOTE TIL FREMADRETTET VEDLIGEHOLDELSE (tilføjelse af nye satser):
 *
 *  - Reguleringsværdierne fremkommer ved at tage den procentvise fremskrivning i
 *    akkumuleret regulering og afrunde til nærmeste 0,05 %.
 *  - Værdierne er derfor beregningsteknisk unøjagtige. De indgår bevidst alligevel,
 *    fordi formålet er at lave en parallel til Erstatningsnævnets (forkerte)
 *    reguleringssatser — ikke at ramme den matematisk korrekte lønudvikling.
 *
 * Nye rækker tilføjes kronologisk (ældste først) som [dato, periode-procent].
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Beregning i Mineo kan kun foretages fra 1. januar 2005, så serien starter ved
 * 1. april 2005, der fungerer som basisdato (0,00 % — intet akkumuleret indeks
 * fremført fra før 2005).
 */

import { toDanishDateString, type DanishDateString } from '../types/branded';
import { formatDanishDate, getInclusivePeriodEndByMonths, parseDanishDate } from '../utils/dateUtils';
import { roundByMethod } from '../utils/rounding';

// ===== TYPER =====

/** Én linje i KL-lønaftalernes oversigt (kilde til download-dokumentet). */
export interface KLLoenaftaleRow {
  readonly fraDato: DanishDateString;
  /** Periode-reguleringsprocent, fx 1.40 (= 1,40 %). */
  readonly reguleringPct: number;
}

/** Én reguleringssats brugt af beregningsmotoren (akkumuleret, afledt af kilden). */
export interface KLSatsVaerdi {
  readonly fraDato: DanishDateString;
  /** Akkumuleret reguleringsprocent, fx 12.4454 (= (akkumuleret indeks − 1) × 100). */
  readonly reguleringsPct: number;
}

export type KLReguleringsDatoInterval = Readonly<{
  fraDato: DanishDateString;
  tilDato: DanishDateString;
}>;

// ===== HELPER =====

const d = (dateStr: string): DanishDateString => toDanishDateString(dateStr);

// ===== KILDE-DATA (kronologisk, ældste først) =====

/**
 * Periode-reguleringssatser: [fraDato, periode-procent].
 *
 * 1. april 2005 (0,00 %) er basisdatoen. Hver efterfølgende sats er den realiserede
 * regulering i den pågældende periode (ikke en akkumuleret værdi).
 */
const klReguleringsraekkerData: ReadonlyArray<readonly [fraDato: string, reguleringPct: number]> = [
  ['01-04-2005', 0.00],
  ['01-01-2006', 1.40],
  ['01-10-2006', 1.00],
  ['01-04-2007', 0.80],
  ['01-10-2007', 0.40],
  ['01-04-2008', 4.10],
  ['01-10-2008', 1.45],
  ['01-04-2009', 0.20],
  ['01-10-2009', 1.15],
  ['01-04-2010', 0.15],
  ['01-01-2012', 1.60],
  ['01-10-2012', 0.15],
  ['01-04-2013', 0.50],
  ['01-10-2013', 0.10],
  ['01-01-2014', 0.50],
  ['01-10-2014', 0.65],
  ['01-04-2015', 0.95],
  ['01-10-2015', 0.45],
  ['01-01-2016', 0.50],
  ['01-10-2016', 0.85],
  ['01-01-2017', 1.15],
  ['01-10-2017', 0.15],
  ['01-04-2018', 1.10],
  ['01-10-2018', 1.15],
  ['01-10-2019', 1.00],
  ['01-01-2020', 1.55],
  ['01-04-2020', 0.40],
  ['01-10-2020', 0.75],
  ['01-04-2021', 1.00],
  ['01-10-2021', 1.00],
  ['01-10-2022', 2.55],
  ['01-04-2023', 0.30],
  ['01-10-2023', 1.25],
  ['01-04-2024', 4.00],
  ['01-10-2024', 1.30],
  ['01-10-2025', 0.30],
  ['01-11-2025', 0.75],
  ['01-04-2026', 2.40],
  ['01-10-2026', 0.50],
];

/**
 * Alle linjer i KL-lønaftalerne, kronologisk (ældste først).
 * Bruges til det dokument brugeren downloader.
 */
export const klLoenaftaleRaekker: ReadonlyArray<KLLoenaftaleRow> = klReguleringsraekkerData.map(
  ([fraDato, reguleringPct]) => ({ fraDato: d(fraDato), reguleringPct })
);

// ===== AFLEDT SATSTABEL (beregning) =====

/**
 * Akkumuleret indeksserie ([dato, akkumuleret indeks], ældste først), beregnet af
 * programmet ved at kæde periode-satserne fra basisdatoen:
 *   indeks_0 = 1            (basisdato, 0,00 %)
 *   indeks_n = indeks_{n−1} × (1 + periode-procent_n / 100)
 *
 * Indekset holdes råt (fuld præcision) her, så periodeforholdet i motoren beregnes
 * uden akkumuleret afrundingstab.
 */
const akkumuleretIndeksSerie: ReadonlyArray<readonly [DanishDateString, number]> = (() => {
  const serie: Array<readonly [DanishDateString, number]> = [];
  let acc = 1;
  for (const { fraDato, reguleringPct } of klLoenaftaleRaekker) {
    acc *= 1 + reguleringPct / 100;
    serie.push([fraDato, acc] as const);
  }
  return serie;
})();

const indeksTilReguleringsPct = (indeks: number): number =>
  roundByMethod((indeks - 1) * 100, 4, 'halfAwayFromZero');

/**
 * KL-lønaftalernes satstabel, sorteret nyeste først (som KRL-satstabellen).
 * Akkumulerede reguleringsprocenter, fx 65.3378 = 65,3378 %.
 */
export const klSatstabelVaerdier: ReadonlyArray<KLSatsVaerdi> = akkumuleretIndeksSerie
  .map(([fraDato, indeks]) => ({ fraDato, reguleringsPct: indeksTilReguleringsPct(indeks) }))
  .reverse();

// ===== PERIODEVIS REGULERINGSPROCENT =====

/**
 * Den indtastede periode-reguleringsprocent pr. dato (kilde-værdien som vist).
 * Bruges i reguleringsværdi-oversigten.
 */
const klPeriodeReguleringPctByDato: ReadonlyMap<DanishDateString, number> = new Map(
  klLoenaftaleRaekker.map((row) => [row.fraDato, row.reguleringPct])
);

/**
 * Returnerer den indtastede periode-reguleringsprocent for en given dato
 * (procentpoint). undefined for datoer der ikke er en regulerende dato i
 * KL-lønaftalerne.
 */
export const getKLReguleringPctForDato = (fraDato: DanishDateString): number | undefined =>
  klPeriodeReguleringPctByDato.get(fraDato);

// ===== OPSLAG =====

/** Returnerer KL-lønaftalernes satstabel (nyeste først). */
export const getKLSatstabelVaerdier = (): ReadonlyArray<KLSatsVaerdi> => klSatstabelVaerdier;

/**
 * Returnerer dato-intervallet for KL-lønaftalerne.
 *
 * fraDato = ældste regulerings-startdato
 * tilDato = nyeste regulerings-startdato + 6 måneder − 1 dag
 *           (satserne behandles som 6-måneders perioder i Mineo, som KRL)
 */
export const getReguleringsDatoIntervalForKL = (): KLReguleringsDatoInterval | undefined => {
  if (klSatstabelVaerdier.length === 0) return undefined;

  // Værdier er sorteret nyeste først.
  const nyeste = klSatstabelVaerdier[0];
  const aeldste = klSatstabelVaerdier[klSatstabelVaerdier.length - 1];

  const nyesteDate = parseDanishDate(nyeste.fraDato);
  if (!nyesteDate) return undefined;

  const tilDato = formatDanishDate(getInclusivePeriodEndByMonths(nyesteDate, 6));

  return {
    fraDato: aeldste.fraDato,
    tilDato,
  };
};
