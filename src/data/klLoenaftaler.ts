/**
 * KL-lønaftaler – periodevise reguleringssatser fra de kommunale lønaftaler.
 *
 * SÆRLIG KL-LØNAFTALER-LOGIK — denne model regulerer trinvist på selve lønnen og har andre
 * visninger end de øvrige reguleringsmodeller. Normativt overblik:
 * docs/domain/taf/kl-loenaftaler-regulering.md
 *
 * Modellen er en enkelt serie af periode-reguleringer (modsat KRL-satstabellen,
 * der har fire delserier). Hver række beskriver én reguleringsprocent på en given
 * dato (fx 1,40 % pr. 1. januar 2006). Der lagres og eksporteres bevidst INGEN
 * akkumuleret regulering: beregningen kæder disse periodesatser direkte på lønnen
 * og afrunder lønnen efter hvert trin. Reguleringsformen KL-lønaftaler må derfor
 * ikke modelleres som et almindeligt indeksforhold i beregnings- eller
 * præsentationslaget.
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

// ===== TYPER =====

/** Én linje i KL-lønaftalernes oversigt (kilde til download-dokumentet). */
export interface KlLoenaftalerRow {
  readonly fraDato: DanishDateString;
  /** Periode-reguleringsprocent, fx 1.40 (= 1,40 %). */
  readonly reguleringPct: number;
}

export type KlLoenaftalerReguleringsDatoInterval = Readonly<{
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
export const klLoenaftalerRaekker: ReadonlyArray<KlLoenaftalerRow> = klReguleringsraekkerData.map(
  ([fraDato, reguleringPct]) => ({ fraDato: d(fraDato), reguleringPct })
);

// ===== PERIODEVIS REGULERINGSPROCENT =====

/**
 * Den indtastede periode-reguleringsprocent pr. dato (kilde-værdien som vist).
 * Bruges i reguleringsværdi-oversigten.
 */
const klPeriodeReguleringPctByDato: ReadonlyMap<DanishDateString, number> = new Map(
  klLoenaftalerRaekker.map((row) => [row.fraDato, row.reguleringPct])
);

/**
 * Returnerer den indtastede periode-reguleringsprocent for en given dato
 * (procentpoint). undefined for datoer der ikke er en regulerende dato i
 * KL-lønaftalerne.
 */
export const getKlLoenaftalerReguleringPctForDato = (fraDato: DanishDateString): number | undefined =>
  klPeriodeReguleringPctByDato.get(fraDato);

// ===== OPSLAG =====

/**
 * Returnerer dato-intervallet for KL-lønaftalerne.
 *
 * fraDato = ældste regulerings-startdato
 * tilDato = nyeste regulerings-startdato + 6 måneder − 1 dag
 *           (satserne behandles som 6-måneders perioder i Mineo, som KRL)
 */
export const getReguleringsDatoIntervalForKlLoenaftaler = (): KlLoenaftalerReguleringsDatoInterval | undefined => {
  if (klLoenaftalerRaekker.length === 0) return undefined;

  const aeldste = klLoenaftalerRaekker[0];
  const nyeste = klLoenaftalerRaekker[klLoenaftalerRaekker.length - 1];

  const nyesteDate = parseDanishDate(nyeste.fraDato);
  if (!nyesteDate) return undefined;

  const tilDato = formatDanishDate(getInclusivePeriodEndByMonths(nyesteDate, 6));

  return {
    fraDato: aeldste.fraDato,
    tilDato,
  };
};
