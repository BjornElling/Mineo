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
 *       `reguleringssats` (EAL § 15 / ASL § 25 – i praksis "tilpasningsprocenten
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
 * i tid). Begge motorer kræver dog stadig satsdækning for HELE intervallet (start-,
 * slut- OG alle mellemliggende år), fordi manglende satsdata skal give en synlig
 * feltfejl frem for en tavs "ingen regulering"-sti. For den akkumulerede metode er
 * mellemårs-dækningen matematisk nødvendig (produktet multiplicerer hvert års sats
 * ind); for ASL-ratioen er den bevidst ensartet snarere end nødvendig – se
 * `opregulerMedAslAarsloensmaksimum`.
 */

import { aarsloenAslMax, reguleringssats, type YearlyRate } from '../../data/lovbestemteRates';
import { resolveAslAarsloensmaksimumForAar } from './aslAarsloensmaksimum';

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
 * Kanonisk opslag af den årlige reguleringssats (EAL § 15 / ASL § 25 – "tilpasnings-
 * procenten plus to procent") for ét år. Returnerer satsen hvis året er dækket af en
 * finit sats, ellers `undefined`.
 *
 * Dette er ÉN fail-closed-opslagsadfærd for reguleringssats – parallelt med
 * `resolveAslAarsloensmaksimumForAar`. Den akkumulerede motors dæknings-check deler
 * den med det RÅ per-år-satsdisplay (offentlige ydelsers reguleringstabel, der viser
 * den enkelte års-sats i "Regulering"-kolonnen – et andet concern end motorens
 * akkumulerede faktor, men samme datakilde-opslag). Så et manglende års-sats behandles
 * identisk fail-closed, uanset om det rammer beregningen eller visningen, og der findes
 * ingen parallel rå `reguleringssats[year]`-opslagssti udenfor dette modul.
 *
 * `satser` kan injiceres (default = `reguleringssats`), så motor- og test-stier deler
 * samme opslags-semantik mod et alternativt år→sats-map.
 */
export const resolveReguleringssatsForAar = (
  aar: number,
  satser: YearlyRate = reguleringssats
): number | undefined => {
  if (!Number.isInteger(aar)) return undefined;
  const sats = satser[aar];
  return typeof sats === 'number' && Number.isFinite(sats) ? sats : undefined;
};

/**
 * Metode 1 – ASL-årslønsmaksimum-indeks.
 *
 * Faktor = idx[målår] / idx[kildeår] (idx = `aarsloenAslMax`).
 *
 * DÆKNINGSTJEK: matematisk afhænger ratioen KUN af de to endepunkter, men motoren
 * tjekker bevidst HVERT år i intervallet [min(kildeår,målår); max(...)] for dækning –
 * præcis samme fremgangsmåde som den akkumulerede motor (metode 2), så de to motorer
 * ikke har hver sit dæknings-krav. Dette er en **processuel forenkling, ikke en
 * matematisk nødvendighed** (bruger-beslutning 2026-07-07): det holder dæknings-logikken
 * ensartet og fjerner en særskilt endepunkts-kun-gren.
 *
 * Det er tal-neutralt for enhver faktisk beregning: `aarsloenAslMax` har en interiort-hul-
 * load-guard (`assertAarsloenAslMaxKontinuitet`), så et interiort år aldrig kan mangle
 * mellem to gyldige endepunkter. Kun et endepunkt UDEN FOR tabellen udløser `manglendeAar`,
 * og selve ratioen (endepunkt/endepunkt) er uændret. Eneste observerbare forskel vs. det
 * tidligere endepunkts-kun-tjek er, at `manglendeAar` for et out-of-range-interval nu kan
 * liste de mellemliggende år op til grænsen – en fail-closed-detalje, ikke et produceret tal.
 *
 * MÅ IKKE "optimeres" tilbage til et endepunkts-kun-opslag: det ville genindføre den
 * afvigende gren, denne forening netop fjernede.
 */
export const opregulerMedAslAarsloensmaksimum = (
  input: OpreguleringInput,
  indeks: YearlyRate = aarsloenAslMax
): OpreguleringResultat => {
  const { kildeAar, maalAar } = input;
  if (!Number.isInteger(kildeAar) || !Number.isInteger(maalAar)) {
    return { faktor: 1, deltaPct: 0, manglendeAar: nonIntegerYears(kildeAar, maalAar) };
  }
  // Opslaget af selve maks-tabellen går gennem den kanoniske gateway (samme
  // positiv-finit-semantik som grænse-valideringen); kun ratio-matematikken bor her.
  const kildeIndeks = resolveAslAarsloensmaksimumForAar(kildeAar, indeks);
  const maalIndeks = resolveAslAarsloensmaksimumForAar(maalAar, indeks);
  // Dæknings-tjek af hele intervallet (jf. doc ovenfor) – ensartet med metode 2.
  const manglendeAar: number[] = [];
  const fraAar = Math.min(kildeAar, maalAar);
  const tilAar = Math.max(kildeAar, maalAar);
  for (let year = fraAar; year <= tilAar; year += 1) {
    if (resolveAslAarsloensmaksimumForAar(year, indeks) === undefined) {
      manglendeAar.push(year);
    }
  }
  if (manglendeAar.length > 0 || kildeIndeks === undefined || maalIndeks === undefined) {
    return { faktor: 1, deltaPct: 0, manglendeAar };
  }
  if (maalAar <= kildeAar) return NO_OPREGULERING;

  return resultFromFaktor(maalIndeks / kildeIndeks, []);
};

/**
 * Metode 2 – akkumuleret reguleringssats ("tilpasningsprocenten plus to procent").
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
    if (resolveReguleringssatsForAar(year, satser) === undefined) {
      manglendeAar.push(year);
    }
  }
  if (manglendeAar.length > 0) {
    return { faktor: 1, deltaPct: 0, manglendeAar };
  }
  if (maalAar <= kildeAar) return NO_OPREGULERING;

  // Dæknings-loopet ovenfor har verificeret hvert mellemår, så det rå opslag her er
  // garanteret finit.
  let faktor = 1;
  for (let year = kildeAar + 1; year <= maalAar; year += 1) {
    faktor *= 1 + satser[year] / 100;
  }
  return resultFromFaktor(faktor, []);
};
