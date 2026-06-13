/**
 * Opregulerings-motorer (to kanoniske metoder)
 *
 * Programmet opregulerer beløb fra ét år til et andet på PRÆCIS to måder. Begge
 * er samlet her, så alle steder i koden bruger samme implementering og samme
 * fail-closed-semantik:
 *
 *  1. ASL-årslønsmaksimum-indeks  (`opregulerMedAslAarsloensmaksimum`)
 *     - Faktor = idx[målår] / idx[kildeår], hvor idx er `aarsloenAslMax`
 *       (erstatningsansvarslovens § 24 årslønsmaksimum).
 *     - Bruges hvor opregulering følger ÅRSLØNSMAKSIMUM (fx fremskrivning af årsløn
 *       efter ASL, ASL-statistik-lønudvikling, forsørgertabsydelser).
 *
 *  2. Akkumuleret reguleringssats  (`opregulerMedAkkumuleretReguleringssats`)
 *     - Faktor = ∏_{y=kildeår+1}^{målår} (1 + sats[y] / 100), hvor sats er
 *       `reguleringssats` (EAL § 15 / ASL § 25 — i praksis "tilpasningsprocenten
 *       plus to procent", den almene statslige regulering per 1. januar).
 *     - Bruges hvor opregulering følger den AKKUMULEREDE REGULERINGSSATS for de
 *       mellemliggende år (fx fremskrivning af årsløn ved EET efter EAL, regulering
 *       af offentlige ydelser, og TAF opreguleret til beregningsåret).
 *
 * Begge motorer returnerer samme resultatform: { faktor, deltaPct, manglendeAar }.
 *  - `faktor`   er den u-afrundede multiplikative faktor (1 = ingen opregulering).
 *  - `deltaPct` er u-afrundet (faktor − 1) × 100. Kald, der viser en procent,
 *    afrunder selv (typisk `roundByMethod(deltaPct, 2, 'halfAwayFromZero')`), så
 *    afrundingsansvaret forbliver hos visningslaget.
 *  - `manglendeAar` er de år, hvor det nødvendige indeks/sats mangler. Er listen
 *    ikke-tom, er `faktor`/`deltaPct` IKKE pålidelige; kalderen skal fail-close.
 *
 * For målår ≤ kildeår returneres faktor 1 / deltaPct 0 (ingen opregulering frem
 * i tid). Akkumuleret reguleringssats kræver dog stadig satsdækning for start-
 * og slutåret, fordi manglende satsdata skal give en synlig feltfejl frem for en
 * tavs "ingen regulering"-sti.
 */

import { aarsloenAslMax, reguleringssats, type YearlyRate } from '../../data/lovbestemteRates';

export type OpreguleringResultat = Readonly<{
  /** Multiplikativ opreguleringsfaktor (u-afrundet). 1 = ingen opregulering. */
  faktor: number;
  /** (faktor − 1) × 100, u-afrundet. Visningslaget afrunder selv. */
  deltaPct: number;
  /** År hvor nødvendigt indeks/sats mangler. Ikke-tom ⇒ fail-close. */
  manglendeAar: readonly number[];
}>;

export type OpreguleringInput = Readonly<{
  /** Året beløbet er udtrykt i (basisåret). */
  kildeAar: number;
  /** Året der opreguleres til. */
  maalAar: number;
}>;

const isPositiveFinite = (value: number | undefined): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0;

const NO_OPREGULERING: OpreguleringResultat = { faktor: 1, deltaPct: 0, manglendeAar: [] };

const resultFromFaktor = (faktor: number, manglendeAar: readonly number[]): OpreguleringResultat => ({
  faktor,
  deltaPct: (faktor - 1) * 100,
  manglendeAar,
});

const pushMissingYear = (years: number[], year: number): void => {
  if (!years.includes(year)) years.push(year);
};

/**
 * Bygger `manglendeAar` for ikke-heltallige år-input uden at slå indeks/sats op.
 * Dedup'er via `pushMissingYear`, så fx to ens NaN-endepunkter kun rapporteres
 * én gang (NaN === NaN er false, så et rå filter ville give [NaN, NaN]).
 */
const nonIntegerYears = (kildeAar: number, maalAar: number): number[] => {
  const manglendeAar: number[] = [];
  if (!Number.isInteger(kildeAar)) pushMissingYear(manglendeAar, kildeAar);
  if (!Number.isInteger(maalAar)) pushMissingYear(manglendeAar, maalAar);
  return manglendeAar;
};

/**
 * Metode 1 — ASL-årslønsmaksimum-indeks.
 *
 * Faktor = idx[målår] / idx[kildeår] (idx = `aarsloenAslMax`).
 * Mangler indeks for ét af de to år, returneres `manglendeAar` med de(t) berørte år.
 */
export const opregulerMedAslAarsloensmaksimum = (
  input: OpreguleringInput,
  indeks: YearlyRate = aarsloenAslMax
): OpreguleringResultat => {
  const { kildeAar, maalAar } = input;
  if (!Number.isInteger(kildeAar) || !Number.isInteger(maalAar)) {
    return { faktor: 1, deltaPct: 0, manglendeAar: nonIntegerYears(kildeAar, maalAar) };
  }
  const kildeIndeks = indeks[kildeAar];
  const maalIndeks = indeks[maalAar];
  const manglendeAar: number[] = [];
  if (!isPositiveFinite(kildeIndeks)) pushMissingYear(manglendeAar, kildeAar);
  if (!isPositiveFinite(maalIndeks)) pushMissingYear(manglendeAar, maalAar);
  if (manglendeAar.length > 0) {
    return { faktor: 1, deltaPct: 0, manglendeAar };
  }
  if (maalAar <= kildeAar) return NO_OPREGULERING;

  return resultFromFaktor(maalIndeks / kildeIndeks, []);
};

/**
 * Metode 2 — akkumuleret reguleringssats ("tilpasningsprocenten plus to procent").
 *
 * Faktor = ∏_{y=kildeår+1}^{målår} (1 + sats[y] / 100) (sats = `reguleringssats`).
 * Mangler en sats for et af de mellemliggende år, returneres `manglendeAar`.
 */
export const opregulerMedAkkumuleretReguleringssats = (
  input: OpreguleringInput,
  satser: YearlyRate = reguleringssats
): OpreguleringResultat => {
  const { kildeAar, maalAar } = input;
  if (!Number.isInteger(kildeAar) || !Number.isInteger(maalAar)) {
    return { faktor: 1, deltaPct: 0, manglendeAar: nonIntegerYears(kildeAar, maalAar) };
  }
  const manglendeAar: number[] = [];
  // Datadækningen er en selvstændig invariant: startår, slutår og alle mellemår
  // skal findes, selv om startårets sats ikke multipliceres ind i faktorformlen.
  const fraAar = Math.min(kildeAar, maalAar);
  const tilAar = Math.max(kildeAar, maalAar);
  for (let year = fraAar; year <= tilAar; year += 1) {
    const sats = satser[year];
    if (typeof sats !== 'number' || !Number.isFinite(sats)) {
      manglendeAar.push(year);
    }
  }
  if (manglendeAar.length > 0) {
    return { faktor: 1, deltaPct: 0, manglendeAar };
  }
  if (maalAar <= kildeAar) return NO_OPREGULERING;

  let faktor = 1;
  for (let year = kildeAar + 1; year <= maalAar; year += 1) {
    faktor *= 1 + satser[year] / 100;
  }
  return resultFromFaktor(faktor, []);
};
