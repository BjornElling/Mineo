import type { YearlyRate } from '../../../data/lovbestemteRates';
import { svieSmerteMax, svieSmertePrDag } from '../../../data/lovbestemteRates';
import { isoDateToDate } from '../../dates/isoDate';
import type { ISODateString } from '../../../types/branded';
import { addMonths } from '../../../utils/dateUtils';

/** Svie/smerte-satser er kun dækket, når både dagsatsen og maksimumssatsen findes. */
export const hasSvieSmerteSatserForAar = (
  year: number,
  rates: Readonly<{ prDag: YearlyRate; max: YearlyRate }> = { prDag: svieSmertePrDag, max: svieSmerteMax }
): boolean =>
  typeof rates.prDag[year] === 'number' && typeof rates.max[year] === 'number';

/** Returnerer kalenderåret én måned efter en canonical dato med den fælles måned-clamp-semantik. */
export const getYearOneMonthAfter = (isoDate: ISODateString): number =>
  addMonths(isoDateToDate(isoDate), 1).getUTCFullYear();

/**
 * Finder det nyeste fuldt dækkede svie/smerte-satsår, som ikke ligger efter målet.
 *
 * En udgivelse kan mangle fremtidige satser ved årsskiftet. I stedet for at indsætte et år,
 * validatoren med sikkerhed vil afvise, falder knappen tilbage til den seneste komplette satsrække.
 */
export const findLatestSvieSmerteSatsAarAtOrBefore = (
  targetYear: number,
  rates: Readonly<{ prDag: YearlyRate; max: YearlyRate }> = { prDag: svieSmertePrDag, max: svieSmerteMax }
): number | undefined => {
  const years = Object.keys(rates.prDag)
    .map(Number)
    .filter((year) => Number.isInteger(year) && year <= targetYear && hasSvieSmerteSatserForAar(year, rates));

  return years.length === 0 ? undefined : Math.max(...years);
};

/**
 * Er satserne for `senereAar` højere end for `valgtAar`? Et senere år med uændrede satser giver brugeren
 * intet at vinde, så det er ikke en grund til at advare.
 */
export const erSvieSmerteSatserHoejere = (
  senereAar: number,
  valgtAar: number,
  rates: Readonly<{ prDag: YearlyRate; max: YearlyRate }> = { prDag: svieSmertePrDag, max: svieSmerteMax }
): boolean => {
  const senerePrDag = rates.prDag[senereAar];
  const senereMax = rates.max[senereAar];
  if (typeof senerePrDag !== 'number' || typeof senereMax !== 'number') return false;
  return senerePrDag > (rates.prDag[valgtAar] ?? Number.NEGATIVE_INFINITY)
    || senereMax > (rates.max[valgtAar] ?? Number.NEGATIVE_INFINITY);
};

/** Udleder knapværdien fra datoen én måned efter opgørelses-/dagsdatoen. */
export const resolveSvieSmerteSatsAarForReferenceDate = (
  referenceDate: ISODateString,
  rates?: Readonly<{ prDag: YearlyRate; max: YearlyRate }>
): number | undefined => findLatestSvieSmerteSatsAarAtOrBefore(getYearOneMonthAfter(referenceDate), rates);
