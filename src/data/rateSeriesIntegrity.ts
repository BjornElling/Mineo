import { getInclusivePeriodEndDanishDate, parseDanishDate } from '../utils/dateUtils';
import type { DanishDateString } from '../types/branded';

/**
 * Fælles integritets- og dæknings-primitiver for reguleringssatskilder (regulering-redesign R5).
 *
 * Reguleringssatserne lever i flere separate datafiler (statistik-indeks, ASL-maksimum,
 * KRL-satstabel, KL-lønaftaler, overenskomst-satser, offentlige lønsatser, sygedagpenge).
 * Hver kilde skal ved modul-load fail-close på ægte datafejl, så et fremtidigt datahul
 * ikke giver tavs under-regulering. Tidligere gentog hver kilde sin egen kopi af de samme
 * mekaniske tjek (strengt sorteret dato-serie, ingen interiort års-hul). Disse primitiver
 * samler den delte logik ét sted, så beviset for "et interiort hul er umuligt" og for
 * "carry-forward-serien er korrekt sorteret" bor ét sted i stedet for spredt over 3-5 filer.
 *
 * Integritets-primitiverne er tal-neutrale: de kaster kun ved korrupt data og aldrig for
 * valide serier. Kilde-specifik integritet, der kun findes ét sted (KRL's per-kolonne
 * interiort null-hul, sygedagpenges lukkede-interval-kontinuitet), bevidst IKKE trukket
 * herind – der er ingen duplikering at fjerne, og en abstraktion for én bruger ville sløre
 * logikken.
 *
 * Modulet ejer desuden `resolveSeriesCoverageInterval`, der udleder kildens dæknings-interval
 * af den SAMME sorteringsretning, guarden håndhæver. Det hører hjemme her og ikke i et eget
 * modul, netop fordi retningen er den fælles forudsætning: sorteringen er kun værd at
 * håndhæve, fordi noget læser serien positionelt, og det positionelle opslag er kun sikkert,
 * fordi sorteringen håndhæves. At holde de to sider af den ene antagelse i samme fil er det,
 * der gør dem svære at lade drive fra hinanden.
 */

export type DanishDateOrder = 'ascending' | 'descending';

/**
 * En reguleringskildes dækkede dato-interval. `fraDato` er kildens tidligste registrerede
 * satsdato, `tilDato` den seneste satsdato + kildens periodelængde − 1 dag.
 *
 * Kilderne re-eksporterer hver sit navngivne alias af denne form (fx
 * `KRLReguleringsDatoInterval`) af hensyn til deres eksisterende offentlige API.
 */
export type CoverageInterval = Readonly<{
  fraDato: DanishDateString;
  tilDato: DanishDateString;
}>;

/**
 * Håndhæver at en satsserie er sorteret strengt monotont med unikke, parsbare danske
 * datoer i den angivne retning.
 *
 * Tre carry-forward-satskilder delte tidligere hver sin kopi af denne løkke: KRL og
 * overenskomst er nyeste-først (`descending`, fordi opslaget returnerer den første sats i
 * array-rækkefølge hvor `fraDato ≤ dato`), og KL-lønaftaler er ældste-først (`ascending`,
 * den trinvise kæde). Et brud på sorteringen ville få carry-forward-opslaget til at
 * returnere en forkert (ældre/nyere) sats eller få et positionelt udledt dæknings-interval
 * til at pege forkert – begge dele en tavs forkert regulering.
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
 * satsserie – et helt manglende år midt i serien (interiort hul) ville få et
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

/**
 * Kildens dæknings-interval i danske datoer: fra seriens tidligste satsdato til den
 * seneste satsdato + `periodeMaaneder` − 1 dag.
 *
 * Fire carry-forward-kilder (KRL-satstabel, KL-lønaftaler, offentlige lønsatser,
 * privat overenskomst) udledte hver sin kopi af det samme interval ved at læse
 * `serie[0]` og `serie[serie.length - 1]` positionelt. Det er kun korrekt, hvis serien
 * er sorteret i netop den retning, kilden antager – og den antagelse stod udelukkende
 * som en kommentar ved siden af opslaget, mens den håndhævede sortering var
 * konfigureret et andet sted (`assertStrictlyMonotonicByDanishDate` ved modul-load).
 * De to kunne derfor drive fra hinanden: vendes en kildes sortering, ville guarden
 * fange det, men vendes BÅDE sorteringen og guardens `order` (den nærliggende
 * "rettelse"), ville de positionelle opslag tavst bytte om på `fraDato` og `tilDato`
 * og give et spejlvendt dæknings-interval – dvs. en falsk "uden for dækning"-gate på
 * hele det reelle interval og ingen gate uden for det.
 *
 * Her er retningen derfor et argument til DENNE funktion, som udleder begge ender af
 * intervallet ud fra den. Kilden staver stadig retningen selv, men gør det ét sted til
 * ét formål, og resultatet er fail-closed: en tom serie eller en ikke-parsbar seneste
 * dato giver `undefined` (ingen dækning) frem for et interval, der ser gyldigt ud.
 *
 * Serien forudsættes sorteret; det håndhæves separat af
 * `assertStrictlyMonotonicByDanishDate` ved modul-load med samme `order`.
 */
export const resolveSeriesCoverageInterval = <T>(opts: {
  /** Satsserien, sorteret i `order`-retningen (håndhævet ved modul-load). */
  readonly series: readonly T[];
  readonly getDato: (item: T) => DanishDateString;
  readonly order: DanishDateOrder;
  /** Antal måneder den seneste sats dækker frem (KRL/KL/offentlig: 6; privat overenskomst: 12). */
  readonly periodeMaaneder: number;
}): CoverageInterval | undefined => {
  if (opts.series.length === 0) return undefined;

  const first = opts.series[0];
  const last = opts.series[opts.series.length - 1];
  const aeldste = opts.order === 'ascending' ? first : last;
  const nyeste = opts.order === 'ascending' ? last : first;

  const tilDato = getInclusivePeriodEndDanishDate(opts.getDato(nyeste), opts.periodeMaaneder);
  if (!tilDato) return undefined;

  return { fraDato: opts.getDato(aeldste), tilDato };
};

/**
 * Samme dæknings-interval, men for en serie hvis rækkefølge IKKE er en invariant: enderne
 * findes ved at scanne hele serien frem for at læse dens positioner.
 *
 * Formen er bevidst adskilt fra `resolveSeriesCoverageInterval`, fordi de to hviler på
 * modsatte forudsætninger, og en fælles "find enderne"-funktion ville skjule hvilken der
 * gælder. Den statistiske indeksserie er den ene forbruger: dens `kvartal`-nøgle er ikke en
 * dansk dato (og kan derfor ikke sammenlignes med de andres dato-primitiv), og
 * beregningsstien (`buildStatistikIndexEntries`) sorterer selv eksplicit før brug – så
 * serien har ingen håndhævet lagringsrækkefølge, et positionelt opslag kunne bygge på.
 *
 * `getSortKey` skal være strengt voksende i tid (fx ÅÅÅÅK-kvartalstallet), og `getStartDato`
 * oversætter det valgte element til dets startdato. Fail-closed: tom serie eller en
 * ikke-parsbar seneste startdato giver `undefined`.
 */
export const resolveUnorderedSeriesCoverageInterval = <T>(opts: {
  readonly series: readonly T[];
  /** Strengt voksende-i-tid sorteringsnøgle for et element. */
  readonly getSortKey: (item: T) => number;
  readonly getStartDato: (item: T) => DanishDateString;
  readonly periodeMaaneder: number;
}): CoverageInterval | undefined => {
  if (opts.series.length === 0) return undefined;

  let aeldste = opts.series[0];
  let nyeste = opts.series[0];
  let minKey = opts.getSortKey(aeldste);
  let maxKey = minKey;

  for (const item of opts.series) {
    const key = opts.getSortKey(item);
    if (key < minKey) {
      minKey = key;
      aeldste = item;
    }
    if (key > maxKey) {
      maxKey = key;
      nyeste = item;
    }
  }

  const tilDato = getInclusivePeriodEndDanishDate(opts.getStartDato(nyeste), opts.periodeMaaneder);
  if (!tilDato) return undefined;

  return { fraDato: opts.getStartDato(aeldste), tilDato };
};
