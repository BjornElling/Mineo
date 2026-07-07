import { parseDanishDate } from '../utils/dateUtils';

/**
 * Fælles integritets-primitiver for reguleringssatskilder (regulering-redesign R5).
 *
 * Reguleringssatserne lever i flere separate datafiler (statistik-indeks, ASL-maksimum,
 * KRL-satstabel, KL-lønaftaler, overenskomst-satser, offentlige lønsatser, sygedagpenge).
 * Hver kilde skal ved modul-load fail-close på ægte datafejl, så et fremtidigt datahul
 * ikke giver tavs under-regulering. Tidligere gentog hver kilde sin egen kopi af de samme
 * mekaniske tjek (strengt sorteret dato-serie, ingen interiort års-hul). Disse primitiver
 * samler den delte logik ét sted, så beviset for "et interiort hul er umuligt" og for
 * "carry-forward-serien er korrekt sorteret" bor ét sted i stedet for spredt over 3-5 filer.
 *
 * Primitiverne er tal-neutrale: de kaster kun ved korrupt data og aldrig for valide serier.
 * Kilde-specifik integritet, der kun findes ét sted (KRL's per-kolonne interiort null-hul,
 * sygedagpenges lukkede-interval-kontinuitet), bevidst IKKE trukket herind — der er ingen
 * duplikering at fjerne, og en abstraktion for én bruger ville sløre logikken.
 */

export type DanishDateOrder = 'ascending' | 'descending';

/**
 * Håndhæver at en satsserie er sorteret strengt monotont med unikke, parsbare danske
 * datoer i den angivne retning.
 *
 * Tre carry-forward-satskilder delte tidligere hver sin kopi af denne løkke: KRL og
 * overenskomst er nyeste-først (`descending`, fordi opslaget returnerer den første sats i
 * array-rækkefølge hvor `fraDato ≤ dato`), og KL-lønaftaler er ældste-først (`ascending`,
 * den trinvise kæde). Et brud på sorteringen ville få carry-forward-opslaget til at
 * returnere en forkert (ældre/nyere) sats eller få et positionelt udledt dæknings-interval
 * til at pege forkert — begge dele en tavs forkert regulering.
 *
 * Serien forudsættes ikke-tom-tjekket separat af kalderen (tom serie er vacuøst sorteret).
 */
export const assertStrictlyMonotonicByDanishDate = <T>(
  items: readonly T[],
  opts: {
    /** Udtrækker den danske fraDato-streng fra et element. */
    readonly getDato: (item: T) => string;
    readonly order: DanishDateOrder;
    /** Kilde-label til fejlbeskeder, fx `KRL-satstabel` eller `Overenskomst "3F-Bygge"`. */
    readonly label: string;
  }
): void => {
  let prevTime: number | null = null;
  for (const item of items) {
    const rawDato = opts.getDato(item);
    const parsed = parseDanishDate(rawDato);
    if (!parsed) {
      throw new Error(`${opts.label}: ugyldig fraDato "${rawDato}"`);
    }
    const time = parsed.getTime();
    if (prevTime !== null) {
      const inOrder = opts.order === 'ascending' ? time > prevTime : time < prevTime;
      if (!inOrder) {
        const retning = opts.order === 'ascending' ? 'ældste-først' : 'nyeste-først';
        throw new Error(
          `${opts.label}: satserne skal være sorteret strengt ${retning} med unikke datoer; ` +
            `"${rawDato}" bryder rækkefølgen`
        );
      }
    }
    prevTime = time;
  }
};

/**
 * Håndhæver at hvert kalenderår fra ældste til nyeste er repræsenteret i en årlig
 * satsserie — et helt manglende år midt i serien (interiort hul) ville få et
 * "seneste indeks ≤ dato"-opslag til stiltiende at videreføre forrige års sats i det
 * manglende års segment (tavs under-regulering, silent-path S6).
 *
 * To årlige satskilder delte tidligere denne kontinuitets-løkke: statistik-indeksserien
 * (år udledt af kvartals-nøglen) og ASL-årslønsmaksimum (år-nøgle, hvor en ikke-finit værdi
 * tæller som fraværende). Kalderen udleder selv min/max og hvad der tæller som "til stede",
 * så primitivet er agnostisk over for det underliggende nøgle-format.
 *
 * Fyrer aldrig for en sammenhængende serie; kun et ægte helt manglende år kaster.
 */
export const assertNoInteriorYearGap = (opts: {
  readonly minYear: number;
  readonly maxYear: number;
  /** Sandt hvis året findes i serien med en gyldig værdi. */
  readonly isYearPresent: (year: number) => boolean;
  /** Kilde-label til fejlbesked, fx `Statistisk lønindeks "ILON12"` eller `ASL-årslønsmaksimum`. */
  readonly label: string;
}): void => {
  for (let year = opts.minYear; year <= opts.maxYear; year += 1) {
    if (!opts.isYearPresent(year)) {
      throw new Error(
        `${opts.label} mangler år ${year} i serien (${opts.minYear}–${opts.maxYear}); ` +
          'et hul midt i serien ville give tavs under-regulering'
      );
    }
  }
};
