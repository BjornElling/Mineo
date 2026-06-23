/**
 * KL-lønaftaler – akkumulerede reguleringssatser fra de kommunale lønaftaler.
 *
 * Modellen er en enkelt indeksserie (modsat KRL-satstabellen, der har fire
 * delserier). Hver række beskriver én aftalt regulering på en given dato med
 * den akkumulerede indeksværdi efter reguleringen (fx 1,124454).
 *
 * To afledte repræsentationer bygges fra den samme kilde:
 *  - `klLoenaftaleRaekker`: alle linjer (også ikke-regulerende og delkomponenter
 *    på samme dato) til brug i det dokument brugeren kan downloade.
 *  - `klSatstabelVaerdier`: den deduplikerede satstabel beregningsmotoren bruger,
 *    hvor flere reguleringer på samme dato er slået sammen til den endelige
 *    akkumulerede værdi, og rene ikke-regulerende datoer er udeladt.
 *
 * Beregning i Mineo kan kun foretages fra 1. januar 2005, så serien starter ved
 * den akkumulerede værdi pr. 1. april 2005 (basis-indekset for 2005-vinduet).
 *
 * Reguleringsprocent følger samme konvention som KRL: `(indeks − 1) × 100`
 * (fx indeks 1,124454 → 12,4454). De afledte procenter er identiske med KRL's
 * "KTO (kommuner)"-serie, fordi de bygger på de samme kommunale lønaftaler.
 */

import { toDanishDateString, type DanishDateString } from '../types/branded';
import { formatDanishDate, getInclusivePeriodEndByMonths, parseDanishDate } from '../utils/dateUtils';
import { roundByMethod } from '../utils/rounding';

// ===== TYPER =====

/** Én linje i KL-lønaftalernes oversigt (kilde til download-dokumentet). */
export interface KLLoenaftaleRow {
  readonly fraDato: DanishDateString;
  /** Reguleringens art, fx "Generelle stigninger" eller "Ingen regulering". */
  readonly regulering: string;
  /** Reguleringens procentsats som vist, fx "1,30%" — tom streng når der ikke reguleres. */
  readonly procent: string;
  /** Akkumuleret indeksværdi efter linjen, fx 1,124454. */
  readonly indeks: number;
}

/** Én deduplikeret reguleringssats brugt af beregningsmotoren. */
export interface KLSatsVaerdi {
  readonly fraDato: DanishDateString;
  /** Reguleringsprocent, fx 12.4454 (= (indeks − 1) × 100). */
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
 * Samlet rå-tabel: [fraDato, regulering, procent, akkumuleret indeks].
 *
 * Reguleringens art og procentsats holdes i hver sin kolonne (datoen står i sin egen
 * kolonne). Nummerering og "pr. den <dato>"-halen fra lønaftalerne er udeladt.
 * Procenten er tom streng på linjer uden regulering.
 */
const klLoenaftaleRaekkerData: ReadonlyArray<readonly [fraDato: string, regulering: string, procent: string, indeks: number]> = [
  ['01-04-2005', 'Ingen regulering (trinprojektet)',                       '',         1.124454],
  ['01-01-2006', 'Generelle stigninger',                                   '0,69%',    1.132213],
  ['01-01-2006', 'Særlig aftalt regulering',                               '0,70%',    1.140138],
  ['01-10-2006', 'Særlig regulering',                                      '1,00%',    1.151539],
  ['01-04-2007', 'Generelle stigninger',                                   '0,80%',    1.160535],
  ['01-10-2007', 'Særlig regulering',                                      '0,41%',    1.165293],
  ['01-04-2008', 'Generelle stigninger',                                   '4,09%',    1.212953],
  ['01-10-2008', 'Særlig regulering',                                      '1,47%',    1.230783],
  ['01-04-2009', 'Generelle stigninger',                                   '0,20%',    1.233114],
  ['01-10-2009', 'Generelle stigninger',                                   '0,68%',    1.241038],
  ['01-10-2009', 'Særlig regulering',                                      '0,48%',    1.246995],
  ['01-04-2010', 'Generelle stigninger',                                   '0,50%',    1.252821],
  ['01-04-2010', 'Særlig aftalt regulering',                               '-0,32%',   1.248812],
  ['01-10-2010', 'Ingen regulering',                                       '',         1.248812],
  ['01-04-2011', 'Ingen regulering',                                       '',         1.248812],
  ['01-01-2012', 'Særlig regulering',                                      '-0,08%',   1.247813],
  ['01-01-2012', 'Generelle stigninger',                                   '1,71%',    1.268904],
  ['01-10-2012', 'Generelle stigninger',                                   '0,20%',    1.271371],
  ['01-10-2012', 'Særlig regulering',                                      '-0,05%',   1.270735],
  ['01-04-2013', 'Generelle stigninger',                                   '0,50%',    1.277089],
  ['01-10-2013', 'Generelle stigninger',                                   '0,60%',    1.284713],
  ['01-10-2013', 'Særlig regulering',                                      '-0,48%',   1.278546],
  ['01-01-2014', 'Generelle stigninger',                                   '0,50%',    1.284900],
  ['01-10-2014', 'Generelle stigninger',                                   '0,37%',    1.289602],
  ['01-10-2014', 'Særlig regulering',                                      '0,26%',    1.292955],
  ['01-04-2015', 'Generelle stigninger',                                   '0,96%',    1.305367],
  ['01-10-2015', 'Generelle stigninger',                                   '0,35%',    1.309892],
  ['01-10-2015', 'Særlig regulering',                                      '0,11%',    1.311333],
  ['01-01-2016', 'Generelle stigninger',                                   '0,50%',    1.317798],
  ['01-10-2016', 'Generelle stigninger',                                   '1,00%',    1.330728],
  ['01-10-2016', 'Særlig regulering',                                      '-0,12%',   1.329131],
  ['01-01-2017', 'Generelle stigninger',                                   '1,20%',    1.344646],
  ['01-10-2017', 'Generelle stigninger',                                   '0,80%',    1.354990],
  ['01-10-2017', 'Særlig regulering',                                      '-0,60%',   1.346860],
  ['01-04-2018', 'Generelle stigninger',                                   '1,10%',    1.361675],
  ['01-10-2018', 'Generelle stigninger',                                   '1,30%',    1.379184],
  ['01-10-2018', 'Særlig regulering',                                      '-0,14%',   1.377253],
  ['01-04-2019', 'Ingen regulering, men grundsatsforhøjelse',              '',         1.377253],
  ['01-10-2019', 'Generelle stigninger',                                   '1,00%',    1.390722],
  ['01-10-2019', 'Særlig regulering',                                      '0,01%',    1.390861],
  ['01-01-2020', 'Generelle stigninger',                                   '1,60%',    1.412411],
  ['01-04-2020', 'Generelle stigninger',                                   '0,40%',    1.417798],
  ['01-10-2020', 'Generelle stigninger',                                   '0,70%',    1.427226],
  ['01-10-2020', 'Særlig regulering',                                      '0,09%',    1.428511],
  ['01-04-2021', 'Generelle stigninger',                                   '1,00%',    1.442796],
  ['01-10-2021', 'Generelle stigninger',                                   '1,01%',    1.457224],
  ['01-10-2021', 'Særlig regulering',                                      '-0,02%',   1.456933],
  ['01-04-2022', 'Ingen regulering, men grundsatsforhøjelse',              '',         1.456933],
  ['01-10-2022', 'Generelle stigninger',                                   '1,90%',    1.484075],
  ['01-10-2022', 'Særlig regulering',                                      '0,67%',    1.494018],
  ['01-04-2023', 'Generelle stigninger',                                   '0,30%',    1.498304],
  ['01-10-2023', 'Generelle stigninger',                                   '0,81%',    1.509875],
  ['01-10-2023', 'Særlig regulering',                                      '0,47%',    1.516971],
  ['01-04-2024', 'Generelle stigninger',                                   '4,00%',    1.577650],
  ['01-10-2024', 'Særlig regulering',                                      '1,30%',    1.598159],
  ['01-04-2025', 'Ingen regulering, men grundsatsforhøjelse',              '',         1.598159],
  ['01-10-2025', 'Generelle stigninger',                                   '0,24%',    1.601800],
  ['01-10-2025', 'Særlig regulering',                                      '0,07%',    1.602921],
  ['01-11-2025', 'Generelle stigninger',                                   '0,20%',    1.605955],
  ['01-11-2025', 'Særlig regulering (sfa. ultimo-forhandlingen)',          '0,54%',    1.614627],
  ['01-04-2026', 'Generelle stigninger, inkl. teknisk korrektion (0,20%)', '2,40%',    1.653378],
  ['01-10-2026', 'Generelle stigninger',                                   '0,70%',    1.664680],
  ['01-10-2026', 'Særlig regulering',                                      '-0,16%',   1.662017],
  ['01-04-2027', 'Ingen regulering, men grundsatsforhøjelse',              '',         1.662017],
];

/**
 * Alle linjer i KL-lønaftalerne, kronologisk (ældste først).
 * Bruges til det dokument brugeren downloader.
 */
export const klLoenaftaleRaekker: ReadonlyArray<KLLoenaftaleRow> = klLoenaftaleRaekkerData.map(
  ([fraDato, regulering, procent, indeks]) => ({ fraDato: d(fraDato), regulering, procent, indeks })
);

// ===== AFLEDT SATSTABEL (beregning) =====

const indeksTilReguleringsPct = (indeks: number): number =>
  roundByMethod((indeks - 1) * 100, 4, 'halfAwayFromZero');

/**
 * Deduplikeret kronologisk indeksserie ([dato, akkumuleret indeks], ældste først):
 *  - flere reguleringer på samme dato slås sammen til datoens endelige indeks
 *    (sidste linje på datoen vinder),
 *  - rene ikke-regulerende datoer (uændret indeks ift. forrige) udelades,
 *  - basis-indekset (første dato) bevares altid.
 *
 * Både satstabellen og den periodevise reguleringsprocent afledes fra denne ene
 * serie, så de to repræsentationer altid er indbyrdes konsistente. Indekset holdes
 * råt (6 decimaler) her, så periodeforholdet beregnes uden afrundingstab.
 */
const dedupedIndeksSerie: ReadonlyArray<readonly [DanishDateString, number]> = (() => {
  // Endelig akkumuleret indeks pr. dato (sidste linje på datoen vinder).
  const finalIndeksByDato = new Map<DanishDateString, number>();
  for (const row of klLoenaftaleRaekker) {
    finalIndeksByDato.set(row.fraDato, row.indeks);
  }

  const serie: Array<readonly [DanishDateString, number]> = [];
  let prevIndeks: number | undefined;
  for (const [dato, indeks] of finalIndeksByDato) {
    // Udelad datoer der ikke ændrer det akkumulerede indeks (men bevar første).
    if (prevIndeks !== undefined && indeks === prevIndeks) continue;
    serie.push([dato, indeks] as const);
    prevIndeks = indeks;
  }
  return serie;
})();

/**
 * KL-lønaftalernes satstabel, sorteret nyeste først (som KRL-satstabellen).
 * Reguleringsprocenter, fx 65.3378 = 65,3378 %.
 */
export const klSatstabelVaerdier: ReadonlyArray<KLSatsVaerdi> = dedupedIndeksSerie
  .map(([fraDato, indeks]) => ({ fraDato, reguleringsPct: indeksTilReguleringsPct(indeks) }))
  .reverse();

// ===== PERIODEVIS REGULERINGSPROCENT =====

/**
 * Den realiserede regulering pr. dato, afledt af forholdet mellem datoens
 * akkumulerede indeks og den forrige regulerende datos indeks:
 * (indeks_nu / indeks_forrige − 1) × 100, afrundet til 2 decimaler.
 *
 * Dette er den korrekte perioderegulering — ikke en sammenlægning af de nominelle
 * aftaletrin på datoen. De nominelle trin ganger ikke rent op til det akkumulerede
 * indeks (fx 1.10.2022: nominelt 1,90 % + 0,67 % = 2,57 %, men det akkumulerede
 * indeks svarer til +2,55 %), og det akkumulerede indeks er den autoritative kilde.
 * Ved at aflede procenten fra indeksforholdet er "Regulering"-kolonnen altid
 * konsistent med "Akkumuleret regulering": kæder man periodernes regulering fra
 * basis, rammer man indekset igen. Basisdatoen (første linje) har ingen forudgående
 * periode og udelades derfor.
 */
const klPeriodeReguleringPctByDato: ReadonlyMap<DanishDateString, number> = (() => {
  const map = new Map<DanishDateString, number>();
  let prevIndeks: number | undefined;
  for (const [dato, indeks] of dedupedIndeksSerie) {
    if (prevIndeks !== undefined) {
      map.set(dato, roundByMethod((indeks / prevIndeks - 1) * 100, 2, 'halfAwayFromZero'));
    }
    prevIndeks = indeks;
  }
  return map;
})();

/**
 * Returnerer den realiserede reguleringsprocent for en given dato (procentpoint),
 * afledt af det akkumulerede indeks. undefined for basisdatoen og for datoer der
 * ikke er en regulerende dato i KL-lønaftalerne.
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
