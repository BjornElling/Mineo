import type { FerieperiodeRow, TafPeriodeRow } from '../../../schemas/formSchemas';
import type { ISODateString } from '../../../types/branded';
import { dateToISO } from '../../../types/branded';
import { isoDateToDate } from '../../dates/isoDate';
import { iterateDatesInclusive, type IsoRange } from '../../../utils/isoDateHelpers';
import { buildSHDageSetForDatoSet, buildSHDageSetForIsoRange } from '../../dates/shDageBeregning';
import { toNonNegativeInt } from '../../../utils/numberParsing';
import { getValidTafRange } from '../validation/tafPeriodConstraints';
import { mergeIsoDateRanges } from './isoRangeAlgebra';

export type TafFerieFravaerSummary = Readonly<{
  ferieperioder: readonly IsoRange[];
  feriedage: number;
  loseFeriedage: number;
  totalFeriedage: number;
}>;

export const isWeekdayUtc = (date: Date): boolean => {
  const dayOfWeek = date.getUTCDay();
  return dayOfWeek >= 1 && dayOfWeek <= 5;
};

const toIsoOrThrow = (date: Date, context: string): ISODateString => {
  const iso = dateToISO(date);
  if (!iso) {
    throw new Error(`Kunne ikke formatere ISO-dato (${context}).`);
  }
  return iso;
};

export const buildDatoSetInclusiveFromDates = (fraDate: Date, tilDate: Date): Set<ISODateString> => {
  if (fraDate > tilDate) {
    throw new Error('buildDatoSetInclusiveFromDates: fraDate > tilDate');
  }
  const datoSet = new Set<ISODateString>();
  iterateDatesInclusive(fraDate, tilDate, (date) => {
    datoSet.add(toIsoOrThrow(date, 'datoSet'));
  });
  return datoSet;
};

export const buildDatoSetInclusive = (fra: ISODateString, til: ISODateString): Set<ISODateString> => {
  const fraDate = isoDateToDate(fra);
  const tilDate = isoDateToDate(til);
  return buildDatoSetInclusiveFromDates(fraDate, tilDate);
};

export const buildFerieDageSet = (
  ferieperioder: readonly { fra?: ISODateString; til?: ISODateString }[],
  datoSet: ReadonlySet<ISODateString>,
  options: Readonly<{ includeWeekends?: boolean }> = {}
): Set<ISODateString> => {
  const ferieDageSet = new Set<ISODateString>();
  const includeWeekends = options.includeWeekends === true;
  if (datoSet.size === 0) return ferieDageSet;
  const sortedDates = Array.from(datoSet).sort();
  const rangeFra = sortedDates[0];
  const rangeTil = sortedDates[sortedDates.length - 1];
  const shDageSet = buildShDageSet(isoDateToDate(rangeFra), isoDateToDate(rangeTil), datoSet);
  for (const periode of ferieperioder) {
    if (!periode.fra || !periode.til) continue;
    if (periode.fra > periode.til) continue;
    const constrainedFra = periode.fra > rangeFra ? periode.fra : rangeFra;
    const constrainedTil = periode.til < rangeTil ? periode.til : rangeTil;
    if (constrainedFra > constrainedTil) continue;
    const ferieFra = isoDateToDate(constrainedFra);
    const ferieTil = isoDateToDate(constrainedTil);
    iterateDatesInclusive(ferieFra, ferieTil, (ferieCurrent) => {
      const isoStr = toIsoOrThrow(ferieCurrent, 'ferieperiode');
      // SH-dage omfatter kun hverdagshelligdage. Ved kalenderdage skal helligdage på weekend
      // derfor fortsat tælle som kalenderdage og må ikke filtreres bort her.
      if (datoSet.has(isoStr) && !shDageSet.has(isoStr) && (includeWeekends || isWeekdayUtc(ferieCurrent))) {
        ferieDageSet.add(isoStr);
      }
    });
  }
  return ferieDageSet;
};

export const buildShDageSet = (
  fraDate: Date,
  tilDate: Date,
  datoSet: ReadonlySet<ISODateString>
): Set<ISODateString> => {
  if (fraDate > tilDate || datoSet.size === 0) {
    return new Set<ISODateString>();
  }
  return new Set(buildSHDageSetForDatoSet(datoSet));
};

export const buildShDageSetFromIsoRange = (fra: ISODateString, til: ISODateString): Set<ISODateString> => {
  const fraDate = isoDateToDate(fra);
  const tilDate = isoDateToDate(til);
  if (fraDate > tilDate) return new Set<ISODateString>();
  return new Set(buildSHDageSetForIsoRange(fra, til));
};

export const placeLoseFeriedage = (
  fra: ISODateString,
  til: ISODateString,
  count: number,
  blocked: ReadonlySet<ISODateString>
): Set<ISODateString> => {
  const fraDate = isoDateToDate(fra);
  const tilDate = isoDateToDate(til);
  if (fraDate > tilDate) return new Set<ISODateString>();

  const selected = new Set<ISODateString>();
  let remaining = toNonNegativeInt(count);
  if (remaining === 0) return selected;

  iterateDatesInclusive(fraDate, tilDate, (candidate) => {
    const iso = toIsoOrThrow(candidate, 'lose feriedage');
    if (isWeekdayUtc(candidate) && !blocked.has(iso)) {
      selected.add(iso);
      remaining -= 1;
    }
    return remaining > 0 ? undefined : false;
  });

  return selected;
};

export const buildTafArbejdsdageSetForRange = (
  fra: ISODateString,
  til: ISODateString,
  ferieperioder: readonly { fra?: ISODateString; til?: ISODateString }[],
  loseFeriedage: number
): Set<ISODateString> => {
  const fraDate = isoDateToDate(fra);
  const tilDate = isoDateToDate(til);
  if (fraDate > tilDate) {
    if (import.meta.env.DEV) {
      console.warn('TAF-arbejdsdage: ugyldigt dato-interval ignoreret.', { fra, til });
    }
    return new Set<ISODateString>();
  }
  const datoSet = buildDatoSetInclusiveFromDates(fraDate, tilDate);
  const ferieDageSet = buildFerieDageSet(ferieperioder, datoSet);
  const shDageSet = buildShDageSet(fraDate, tilDate, datoSet);
  const blockedLoseFerie = new Set<ISODateString>([...ferieDageSet, ...shDageSet]);
  const placedLoseFeriedage = placeLoseFeriedage(fra, til, loseFeriedage, blockedLoseFerie);

  const arbejdsdage = new Set<ISODateString>();
  for (const isoStr of datoSet) {
    const date = isoDateToDate(isoStr);
    if (!isWeekdayUtc(date)) continue;
    if (ferieDageSet.has(isoStr)) continue;
    if (shDageSet.has(isoStr)) continue;
    if (placedLoseFeriedage.has(isoStr)) continue;
    arbejdsdage.add(isoStr);
  }

  return arbejdsdage;
};

const intersectIsoRange = (left: IsoRange, right: IsoRange): IsoRange | null => {
  const fra = left.fra > right.fra ? left.fra : right.fra;
  const til = left.til < right.til ? left.til : right.til;
  return fra <= til ? { fra, til } : null;
};

const rangesOverlap = (left: IsoRange, right: IsoRange): boolean =>
  left.fra <= right.til && left.til >= right.fra;

const sumLoseFeriedageForSourceRows = (
  rows: ReadonlyArray<TafPeriodeRow>,
  range: IsoRange
): number => {
  let sum = 0;
  for (const row of rows) {
    const validRange = getValidTafRange(row);
    if (!validRange || !rangesOverlap(validRange, range)) continue;
    // Løse feriedage er additive pr. kilde-række: validerede TAF-kilde-rækker
    // overlapper ikke, så flere rækker repræsenterer selvstændige ferieperioder.
    // Dagene placeres først efter at autoritative TAF-ranges er merget/clampet,
    // så samme merged range kun behandles én gang.
    sum += typeof row.loseFeriedage === 'number' ? row.loseFeriedage : 0;
  }
  return sum;
};

const buildPlacedLoseFeriedageForRange = (
  range: IsoRange,
  ferieperioder: ReadonlyArray<FerieperiodeRow>,
  loseFeriedage: number
): Set<ISODateString> => {
  if (loseFeriedage <= 0) return new Set<ISODateString>();
  const datoSet = buildDatoSetInclusive(range.fra, range.til);
  const ferieDageSet = buildFerieDageSet(ferieperioder, datoSet);
  const shDageSet = buildShDageSet(isoDateToDate(range.fra), isoDateToDate(range.til), datoSet);
  const blockedLoseFerie = new Set<ISODateString>([...ferieDageSet, ...shDageSet]);
  return placeLoseFeriedage(range.fra, range.til, loseFeriedage, blockedLoseFerie);
};

export const buildTafFerieFravaerSummary = (
  rows: ReadonlyArray<TafPeriodeRow>,
  ferieperioder: ReadonlyArray<FerieperiodeRow>,
  authoritativeRanges: readonly IsoRange[]
): TafFerieFravaerSummary => {
  if (authoritativeRanges.length === 0) {
    return { ferieperioder: [], feriedage: 0, loseFeriedage: 0, totalFeriedage: 0 };
  }

  const ferieDates = new Set<ISODateString>();
  const constrainedFerieperioder: IsoRange[] = [];

  for (const ferieperiode of ferieperioder) {
    if (!ferieperiode.fra || !ferieperiode.til || ferieperiode.fra > ferieperiode.til) continue;
    const ferieRange = { fra: ferieperiode.fra, til: ferieperiode.til };
    for (const tafRange of authoritativeRanges) {
      const constrained = intersectIsoRange(ferieRange, tafRange);
      if (!constrained) continue;
      const datoSet = buildDatoSetInclusive(constrained.fra, constrained.til);
      const datesInConstrainedRange = buildFerieDageSet([constrained], datoSet);
      if (datesInConstrainedRange.size === 0) continue;
      constrainedFerieperioder.push(constrained);
      for (const dato of datesInConstrainedRange) {
        ferieDates.add(dato);
      }
    }
  }

  const loseFerieDates = new Set<ISODateString>();
  for (const range of authoritativeRanges) {
    const loseFeriedage = sumLoseFeriedageForSourceRows(rows, range);
    const placedLoseFeriedage = buildPlacedLoseFeriedageForRange(range, ferieperioder, loseFeriedage);
    for (const dato of placedLoseFeriedage) {
      loseFerieDates.add(dato);
    }
  }

  const feriedage = ferieDates.size;
  const loseFeriedage = loseFerieDates.size;

  return {
    ferieperioder: mergeIsoDateRanges(constrainedFerieperioder, { mergeAdjacent: true }),
    feriedage,
    loseFeriedage,
    totalFeriedage: feriedage + loseFeriedage,
  };
};

export const buildTafArbejdsdageSetFromRows = (
  rows: ReadonlyArray<TafPeriodeRow>,
  ferieperioder: ReadonlyArray<FerieperiodeRow>,
  options: Readonly<{ authoritativeRanges?: readonly IsoRange[] }> = {}
): ReadonlySet<ISODateString> => {
  // undefined = ikke leveret (brug rå TAF-rækker som basis).
  // [] = leveret men tom (ingen TAF-dage i perioden — returner tomt sæt straks).
  const authoritativeRanges = options.authoritativeRanges;
  if (authoritativeRanges !== undefined && authoritativeRanges.length === 0) {
    return new Set<ISODateString>();
  }
  const useAuthoritativeRanges = authoritativeRanges !== undefined && authoritativeRanges.length > 0;
  const arbejdsdage = new Set<ISODateString>();

  if (useAuthoritativeRanges) {
    for (const range of authoritativeRanges) {
      const loseFeriedage = sumLoseFeriedageForSourceRows(rows, range);
      const set = buildTafArbejdsdageSetForRange(range.fra, range.til, ferieperioder, loseFeriedage);
      for (const dato of set) {
        arbejdsdage.add(dato);
      }
    }
    return arbejdsdage;
  }

  for (const row of rows) {
    const validRange = getValidTafRange(row);
    if (!validRange) continue;
    const loseFeriedage = typeof row.loseFeriedage === 'number' ? row.loseFeriedage : 0;
    const set = buildTafArbejdsdageSetForRange(validRange.fra, validRange.til, ferieperioder, loseFeriedage);
    for (const dato of set) {
      arbejdsdage.add(dato);
    }
  }

  return arbejdsdage;
};
