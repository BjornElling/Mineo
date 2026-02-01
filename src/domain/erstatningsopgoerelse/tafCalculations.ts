import type { FerieperiodeRow } from '../../schemas/formSchemas';
import type { ISODateString } from '../../types/branded';
import { formatToISO } from '../../utils/dateUtils';
import { countInclusiveUtcDays } from '../../utils/utcDayMath';
import { beregnHelligdage } from '../../utils/shDageBeregning';
import { isoDateToDate } from '../dates/isoDate';

// TODO(a): Gennemgå hele appen for brug af begreberne "arbejdsdage" vs. "hverdage" og verificér at labels/tekster matcher beregningerne ift. fradrag/ikke-fradrag af SH-dage.

export const calculateKalenderdageInclusive = (
  fra: ISODateString | undefined,
  til: ISODateString | undefined
): number | null => {
  if (!fra || !til) return null;
  if (fra > til) return null;

  const fraDate = isoDateToDate(fra);
  const tilDate = isoDateToDate(til);

  const days = countInclusiveUtcDays(fraDate, tilDate);
  return days !== null && days >= 1 ? days : null;
};

export const calculateTafAntalMaaneder = (
  fra: ISODateString | undefined,
  til: ISODateString | undefined,
  _ferieperioder: readonly FerieperiodeRow[],
  loseFeriedage: number,
  oevrigeFravaersdage: number = 0
): number | null => {
  /**
   * Inclusive day-by-day iteration is intentional:
   * - Month fractions depend on each calendar day.
   * - DST-safe because we advance by calendar day, not ms-diff.
   */
  if (!fra || !til) return null;
  if (fra > til) return null;

  const fraDate = isoDateToDate(fra);
  const tilDate = isoDateToDate(til);

  // Opbyg set af alle dage i perioden
  const periodeDage = new Set<ISODateString>();
  const currentDate = new Date(fraDate);
  while (currentDate <= tilDate) {
    periodeDage.add(formatToISO(currentDate));
    currentDate.setDate(currentDate.getDate() + 1);
  }

  // Beregn måned-værdier: hver dag tæller som 1/antal-dage-i-måneden
  let antalMaaneder = 0;
  for (const isoStr of periodeDage) {
    const year = Number.parseInt(isoStr.slice(0, 4), 10);
    const month = Number.parseInt(isoStr.slice(5, 7), 10);
    const dageIMaaned = new Date(year, month, 0).getDate();
    antalMaaneder += 1 / dageIMaaned;
  }

  // Fradrag for øvrige fraværsdage (4,8 % måned pr. dag).
  const oevrigeFravaersdageFradrag = Math.max(0, oevrigeFravaersdage) * 0.048;

  const resultat = antalMaaneder - oevrigeFravaersdageFradrag;

  // Sørg for at resultatet aldrig bliver negativt
  const begrænsedResultat = Math.max(0, resultat);

  return Math.round(begrænsedResultat * 100) / 100;
};

export const calculateTafAntalArbejdsdage = (
  fra: ISODateString | undefined,
  til: ISODateString | undefined,
  ferieperioder: readonly FerieperiodeRow[],
  loseFeriedage: number
): number | null => {
  const breakdown = calculateTafArbejdsdageBreakdown(fra, til, ferieperioder, loseFeriedage);
  return breakdown ? breakdown.tafDage : null;
};

export type TafArbejdsdageBreakdown = Readonly<{
  arbejdsdage: number;
  shDage: number;
  arbejdsdageMinusSH: number;
  feriedage: number;
  loseFeriedage: number;
  tafDage: number;
}>;

export const calculateTafArbejdsdageBreakdown = (
  fra: ISODateString | undefined,
  til: ISODateString | undefined,
  ferieperioder: readonly FerieperiodeRow[],
  loseFeriedage: number
): TafArbejdsdageBreakdown | null => {
  if (!fra || !til) return null;
  if (fra > til) return null;

  const fraDate = isoDateToDate(fra);
  const tilDate = isoDateToDate(til);

  const datoSet = new Set<ISODateString>();
  let antalHverdage = 0;

  const currentDate = new Date(fraDate);
  while (currentDate <= tilDate) {
    const isoStr = formatToISO(currentDate);
    datoSet.add(isoStr);

    const dayOfWeek = currentDate.getDay();
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      antalHverdage += 1;
    }

    currentDate.setDate(currentDate.getDate() + 1);
  }

  const ferieDageSet = new Set<ISODateString>();
  for (const feriePeriode of ferieperioder) {
    if (!feriePeriode.fra || !feriePeriode.til) continue;
    if (feriePeriode.fra > feriePeriode.til) continue;

    const ferieFra = isoDateToDate(feriePeriode.fra);
    const ferieTil = isoDateToDate(feriePeriode.til);

    const ferieCurrent = new Date(ferieFra);
    while (ferieCurrent <= ferieTil) {
      const isoStr = formatToISO(ferieCurrent);
      if (datoSet.has(isoStr)) {
        const dow = ferieCurrent.getDay();
        if (dow >= 1 && dow <= 5) {
          ferieDageSet.add(isoStr);
        }
      }
      ferieCurrent.setDate(ferieCurrent.getDate() + 1);
    }
  }

  let antalSHDage = 0;
  for (let year = fraDate.getFullYear(); year <= tilDate.getFullYear(); year += 1) {
    const helligdage = beregnHelligdage(year);
    for (const helligdag of helligdage) {
      const isoStr = formatToISO(helligdag);
      const dow = helligdag.getDay();
      const erHverdag = dow >= 1 && dow <= 5;
      if (erHverdag && datoSet.has(isoStr) && !ferieDageSet.has(isoStr)) {
        antalSHDage += 1;
      }
    }
  }

  const arbejdsdageMinusSH = antalHverdage - antalSHDage;
  const tafDage = arbejdsdageMinusSH - ferieDageSet.size - loseFeriedage;

  return {
    arbejdsdage: antalHverdage,
    shDage: antalSHDage,
    arbejdsdageMinusSH,
    feriedage: ferieDageSet.size,
    loseFeriedage,
    tafDage,
  };
};
