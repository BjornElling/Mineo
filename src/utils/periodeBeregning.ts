/**
 * Periode-beregninger til årslønberegning
 *
 * Funktioner til at beregne perioder, hverdage, feriedage osv.
 */

import type { DateInterval } from '../types/calculation';
import type { AarsloenTableRow } from '../schemas/formSchemas';
import { parseISODate, toISODateString, type ISODateString } from '../types/branded';
import { parseDanishDate, parseWeekString } from './shDageBeregning';
import { addDays, createDate, formatToISO } from './dateUtils';
import { beregnSHDageForDatoSet } from './shDageBeregning';
import type { Periodisering } from '../data/ydelsestyper';
import { countInclusiveUtcDays, diffUtcDaysAbs } from './utcDayMath';
import { MONTH_NAMES_DA_SHORT } from './dateFormatting';

/**
 * Periode-data returneret fra beregningsfunktioner
 */
export interface PeriodeResult {
  periodeTekst: string;
  totalEnheder: number;
  unikkeEnheder: number;
  enhedNavn: string;
  datoSet: Set<ISODateString>;
  perioder: DateInterval[];
}

const firstAndLast = <T>(values: readonly T[]): { first: T; last: T } | null => {
  if (values.length === 0) return null;
  const first = values[0];
  const last = values[values.length - 1];
  if (first === undefined || last === undefined) return null;
  return { first, last };
};

const parseMonthKey = (monthKey: string): { year: number; month: number } | null => {
  const [yearRaw, monthRaw] = monthKey.split('-');
  const year = Number.parseInt(yearRaw ?? '', 10);
  const month = Number.parseInt(monthRaw ?? '', 10);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return null;
  }
  return { year, month };
};

const parseWeekKey = (weekKey: string): { year: number; week: number } | null => {
  const [yearRaw, weekRaw] = weekKey.split('-W');
  const year = Number.parseInt(yearRaw ?? '', 10);
  const week = Number.parseInt(weekRaw ?? '', 10);
  if (!Number.isFinite(year) || !Number.isFinite(week) || week < 1 || week > 53) {
    return null;
  }
  return { year, week };
};

const isoWeeksInYear = (year: number): number => {
  const dec31 = createDate(year, 11, 31);
  const dayOfWeek = dec31.getUTCDay();
  const isLeapYear = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  return dayOfWeek === 4 || (isLeapYear && dayOfWeek === 5) ? 53 : 52;
};

/**
 * Beregner antal hverdage (mandag-fredag) i et datoSet
 */
export const beregnAntalHverdage = (datoSet: ReadonlySet<ISODateString>): number => {
  if (!datoSet || datoSet.size === 0) return 0;

  let antalHverdage = 0;

  datoSet.forEach((dateStr) => {
    const date = parseISODate(dateStr);
    if (!date) return;
    const dayOfWeek = date.getUTCDay();

    // Mandag = 1, Fredag = 5
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      antalHverdage++;
    }
  });

  return antalHverdage;
};

/**
 * Beregner antal feriedage på et år baseret på ret til 6. ferieuge
 */
export const beregnFeriedagePaaEtAar = (retTilSjetteFerieuge: boolean): number => {
  return retTilSjetteFerieuge ? 30 : 25;
};

/**
 * Tjekker om de indtastede data svarer til nøjagtig 1 års data
 *
 * @param {string} loenperiode - "maaned" | "uge" | "dag"
 * @param {number} unikkeEnheder - Antal unikke enheder fra periodeData
 * @param {Set<string>} datoSet - Set af datoer (kun for dagsløn)
 * @returns {boolean} True hvis nøjagtig 1 års data
 */
export const erNoejagtEtAar = (loenperiode: string, unikkeEnheder: number, datoSet?: ReadonlySet<ISODateString>) => {
  if (loenperiode === 'maaned') {
    return unikkeEnheder === 12;
  } else if (loenperiode === 'dag') {
    // Tjek om der er 365 eller 366 dage (skudår)
    if (unikkeEnheder !== 365 && unikkeEnheder !== 366) {
      return false;
    }

    // Tjek yderligere at det faktisk er et sammenhængende år
    if (!datoSet) {
      return false;
    }

    const dates = Array.from(datoSet)
      .map((d) => parseISODate(d))
      .filter((d): d is Date => d !== undefined)
      .sort((a, b) => a.getTime() - b.getTime());

    if (dates.length === 0) {
      return false;
    }
    const firstDate = dates[0];
    const lastDate = dates[dates.length - 1];

    const diffDays = diffUtcDaysAbs(firstDate, lastDate);

    // Skal være 364 dage mellem første og sidste (365 dage inklusiv)
    return diffDays === 364 || diffDays === 365;
  } else if (loenperiode === 'uge') {
    // Ugeløn skal ALTID omregnes (365/7 = 52,14 uger)
    return false;
  }

  return false;
};

/**
 * Beregner månedsperioder fra tabeldata
 */
/**
 * Beregner maanedsperioder (inklusiv) ud fra tabeldata.
 * Bruger kalender-iteration for at bygge et datoSet (DST-safe uden ms-diff).
 */
export const beregnMaanedPeriode = (tableData: AarsloenTableRow[]): PeriodeResult | null => {
  const maaneder = new Set<string>();
  const datoSet = new Set<ISODateString>();
  const perioder: Array<{ start: Date; end: Date }> = [];

  tableData.forEach(row => {
    const maaned = row.col0_maaned;
    const aar = row.col1_maaned;

    if (maaned && aar) {
      const maanedNum = parseInt(maaned, 10);
      const aarNum = parseInt(aar, 10);

      if (maanedNum >= 1 && maanedNum <= 12 && aarNum >= 1900 && aarNum <= 2099) {
        maaneder.add(`${aarNum}-${String(maanedNum).padStart(2, '0')}`);

        // Beregn første og sidste dag i måneden
        const foersteDag = createDate(aarNum, maanedNum - 1, 1);
        const sidsteDag = createDate(aarNum, maanedNum, 0);

        // Tilføj periode
        perioder.push({ start: foersteDag, end: sidsteDag });

        // Tilføj alle dage i måneden til datoSet
        let currentDate = new Date(foersteDag);
        while (currentDate <= sidsteDag) {
          datoSet.add(formatToISO(currentDate));
          currentDate = addDays(currentDate, 1);
        }
      }
    }
  });

  if (maaneder.size === 0) {
    return null;
  }

  // Find min og max måned
  const sortedMaaneder = Array.from(maaneder).sort();
  const monthRange = firstAndLast(sortedMaaneder);
  if (!monthRange) {
    return null;
  }

  // Parse min måned
  const minParsed = parseMonthKey(monthRange.first);
  const maxParsed = parseMonthKey(monthRange.last);
  if (!minParsed || !maxParsed) {
    return null;
  }
  const minAar = minParsed.year;
  const minMnd = minParsed.month;
  const maxAar = maxParsed.year;
  const maxMnd = maxParsed.month;

  // Beregn total antal måneder i intervallet
  const totalMaaneder = (maxAar - minAar) * 12 + (maxMnd - minMnd) + 1;

  // Formater periode-tekst
  const periodeTekst = `${MONTH_NAMES_DA_SHORT[minMnd - 1]} ${minAar} - ${MONTH_NAMES_DA_SHORT[maxMnd - 1]} ${maxAar}`;

  return {
    periodeTekst,
    totalEnheder: totalMaaneder,
    unikkeEnheder: maaneder.size,
    enhedNavn: maaneder.size === 1 ? 'måned' : 'måneder',
    datoSet,
    perioder
  };
};

/**
 * Beregner ugeperioder fra tabeldata
 */
/**
 * Beregner ugeperioder (inklusiv) ud fra tabeldata.
 * Bruger kalender-iteration for at bygge et datoSet (DST-safe uden ms-diff).
 */
export const beregnUgePeriode = (tableData: AarsloenTableRow[]): PeriodeResult | null => {
  const uger = new Set<string>();
  const datoSet = new Set<ISODateString>();
  const perioder: Array<{ start: Date; end: Date }> = [];

  tableData.forEach(row => {
    const ugeFra = row.col0_uge;
    const ugeTil = row.col1_uge;

    if (ugeFra && ugeTil) {
      const fraData = parseWeekString(ugeFra);
      const tilData = parseWeekString(ugeTil);

      if (fraData && tilData) {
        // Tilføj periode
        perioder.push({ start: fraData.start, end: tilData.end });

        // Parse uge-numre fra input
        const [ugeFraNum, aarFra] = ugeFra.split('/').map(s => parseInt(s, 10));
        const [ugeTilNum, aarTil] = ugeTil.split('/').map(s => parseInt(s, 10));

        // Tilføj alle uger i intervallet (ugeFra til ugeTil)
        if (aarFra === aarTil) {
          // Samme år - simpel løkke
          for (let uge = ugeFraNum; uge <= ugeTilNum; uge++) {
            uger.add(`${aarFra}-W${String(uge).padStart(2, '0')}`);
          }
        } else {
          // Forskellige år - håndter år-overgang
          // Tilføj uger fra ugeFra til sidste ISO-uge i aarFra
          const maxUgeFra = isoWeeksInYear(aarFra);
          for (let uge = ugeFraNum; uge <= maxUgeFra; uge++) {
            uger.add(`${aarFra}-W${String(uge).padStart(2, '0')}`);
          }
          // Tilføj uger fra uge 1 til ugeTil i aarTil
          for (let uge = 1; uge <= ugeTilNum; uge++) {
            uger.add(`${aarTil}-W${String(uge).padStart(2, '0')}`);
          }
          // Tilføj eventuelle mellemliggende år (hvis aarTil - aarFra > 1)
          for (let aar = aarFra + 1; aar < aarTil; aar++) {
            for (let uge = 1; uge <= isoWeeksInYear(aar); uge++) {
              uger.add(`${aar}-W${String(uge).padStart(2, '0')}`);
            }
          }
        }

        // Tilføj alle dage mellem fra og til til datoSet
        let currentDate = new Date(fraData.start);
        while (currentDate <= tilData.end) {
          datoSet.add(formatToISO(currentDate));
          currentDate = addDays(currentDate, 1);
        }
      }
    }
  });

  if (uger.size === 0) {
    return null;
  }

  // Find min og max uge
  const sortedUger = Array.from(uger).sort();
  const weekRange = firstAndLast(sortedUger);
  if (!weekRange) {
    return null;
  }

  // Parse min uge
  const minParsed = parseWeekKey(weekRange.first);
  const maxParsed = parseWeekKey(weekRange.last);
  if (!minParsed || !maxParsed) {
    return null;
  }
  const minAar = minParsed.year;
  const minUgeNum = minParsed.week;
  const maxAar = maxParsed.year;
  const maxUgeNum = maxParsed.week;

  // Beregn total antal uger
  let totalUger = 0;
  if (minAar === maxAar) {
    totalUger = maxUgeNum - minUgeNum + 1;
  } else {
    totalUger += isoWeeksInYear(minAar) - minUgeNum + 1;
    for (let year = minAar + 1; year < maxAar; year++) {
      totalUger += isoWeeksInYear(year);
    }
    totalUger += maxUgeNum;
  }

  const periodeTekst = `uge ${minUgeNum}/${minAar} - uge ${maxUgeNum}/${maxAar}`;

  return {
    periodeTekst,
    totalEnheder: totalUger,
    unikkeEnheder: uger.size,
    enhedNavn: uger.size === 1 ? 'uge' : 'uger',
    datoSet,
    perioder
  };
};

/**
 * Hjælpefunktion til at formatere dato til dansk format
 */
const formatDanskDato = (date: Date): string => {
  const dag = date.getUTCDate();
  const maaned = date.getUTCMonth();
  const aar = date.getUTCFullYear();
  return `${dag}. ${MONTH_NAMES_DA_SHORT[maaned]} ${aar}`;
};

/**
 * Beregner dagsperioder fra tabeldata
 */
/**
 * Beregner dagsperioder (inklusiv) ud fra tabeldata.
 * Bruger countInclusiveUtcDays for samlet antal dage.
 */
export const beregnDagPeriode = (tableData: AarsloenTableRow[]): PeriodeResult | null => {
  const dage = new Set<ISODateString>();
  const perioder: Array<{ start: Date; end: Date }> = [];

  tableData.forEach(row => {
    const datoFra = row.col0_dag;
    const datoTil = row.col1_dag;

    if (datoFra && datoTil) {
      const fraDate = parseDanishDate(datoFra);
      const tilDate = parseDanishDate(datoTil);

      if (fraDate && tilDate) {
        // Tilføj periode
        perioder.push({ start: fraDate, end: tilDate });

        // Tilføj alle dage mellem fra og til
        let currentDate = new Date(fraDate);
        while (currentDate <= tilDate) {
          dage.add(formatToISO(currentDate));
          currentDate = addDays(currentDate, 1);
        }
      }
    }
  });

  if (dage.size === 0) {
    return null;
  }

  // Find min og max dato
  const sortedDage = Array.from(dage).sort();
  const dayRange = firstAndLast(sortedDage);
  if (!dayRange) {
    return null;
  }
  const minDato = parseISODate(toISODateString(dayRange.first)) ?? null;
  const maxDato = parseISODate(toISODateString(dayRange.last)) ?? null;
  if (!minDato || !maxDato) {
    return null;
  }

  // Beregn total antal dage i intervallet
  const totalDage = countInclusiveUtcDays(minDato, maxDato);
  if (totalDage === null) {
    return null;
  }

  const periodeTekst = `${formatDanskDato(minDato)} - ${formatDanskDato(maxDato)}`;

  return {
    periodeTekst,
    totalEnheder: totalDage,
    unikkeEnheder: dage.size,
    enhedNavn: dage.size === 1 ? 'dag' : 'dage',
    datoSet: dage,
    perioder
  };
};

/**
 * Beregner antal dage i en periode baseret på periodiseringstype
 *
 * Bruges til beregning af ydelse pr. dag for offentlige ydelser.
 *
 * @param fraDato - Startdato (dansk format dd-mm-åååå)
 * @param tilDato - Slutdato (dansk format dd-mm-åååå)
 * @param periodisering - 'kalenderdage' | 'arbejdsdage'
 * @param ydelsestype - Ydelsestype (bruges til speciel regel for Sygedagpenge)
 * @returns Antal dage, eller null hvis datoer er ugyldige
 */
/**
 * Beregner periodiseringsdage inklusiv start/slut.
 * Bygger et datoSet via kalender-iteration (DST-safe uden ms-diff).
 */
export const beregnPeriodiseringsDage = (
  fraDato: string | undefined,
  tilDato: string | undefined,
  periodisering: Periodisering,
  ydelsestype?: string
): number | null => {
  if (!fraDato || !tilDato) return null;

  const fra = parseDanishDate(fraDato);
  const til = parseDanishDate(tilDato);
  if (!fra || !til || fra > til) return null;

  // Byg et Set af alle datoer i perioden (ISO-format)
  const datoSet = new Set<ISODateString>();
  let current = new Date(fra);
  while (current <= til) {
    datoSet.add(formatToISO(current));
    current = addDays(current, 1);
  }

  switch (periodisering) {
    case 'kalenderdage': {
      // Alle dage fra-til inklusiv
      return datoSet.size;
    }
    case 'arbejdsdage': {
      // Hverdage minus SH-dage
      // SPECIEL REGEL: For Sygedagpenge før 2. juli 2012 fratrækkes IKKE SH-dage
      const hverdage = beregnAntalHverdage(datoSet);

      // Tjek om det er Sygedagpenge før 2. juli 2012
      if (ydelsestype === 'sygedagpenge') {
        // Parse til-dato til sammenligning
        const tilParsed = parseDanishDate(tilDato);
        if (tilParsed) {
          // 2. juli 2012 = 02-07-2012
          const skaeringsdato = createDate(2012, 6, 2); // Måned er 0-indekseret
          if (tilParsed < skaeringsdato) {
            // Før 2. juli 2012 - beregn UDEN fradrag af SH-dage
            return hverdage;
          }
        }
      }

      // Standard arbejdsdage-beregning: hverdage minus SH-dage
      const shDage = beregnSHDageForDatoSet(datoSet);
      return hverdage - shDage;
    }
    default:
      return null;
  }
};
