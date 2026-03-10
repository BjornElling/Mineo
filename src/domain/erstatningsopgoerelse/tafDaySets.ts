import type { FerieperiodeRow, TafPeriodeRow } from '../../schemas/formSchemas';
import type { ISODateString } from '../../types/branded';
import { dateToISO } from '../../types/branded';
import { isoDateToDate } from '../dates/isoDate';
import { addDays } from '../../utils/dateUtils';
import { beregnHelligdage } from '../../utils/shDageBeregning';
import { toNonNegativeInt } from '../../utils/numberUtils';
import { getValidTafRange } from './tafPeriodConstraints';

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
  let currentDate = new Date(fraDate);
  while (currentDate <= tilDate) {
    datoSet.add(toIsoOrThrow(currentDate, 'datoSet'));
    currentDate = addDays(currentDate, 1);
  }
  return datoSet;
};

export const buildDatoSetInclusive = (fra: ISODateString, til: ISODateString): Set<ISODateString> => {
  const fraDate = isoDateToDate(fra);
  const tilDate = isoDateToDate(til);
  return buildDatoSetInclusiveFromDates(fraDate, tilDate);
};

export const buildFerieDageSet = (
  ferieperioder: readonly { fra?: ISODateString; til?: ISODateString }[],
  datoSet: ReadonlySet<ISODateString>
): Set<ISODateString> => {
  const ferieDageSet = new Set<ISODateString>();
  for (const periode of ferieperioder) {
    if (!periode.fra || !periode.til) continue;
    if (periode.fra > periode.til) continue;
    const ferieFra = isoDateToDate(periode.fra);
    const ferieTil = isoDateToDate(periode.til);
    let ferieCurrent = new Date(ferieFra);
    while (ferieCurrent <= ferieTil) {
      const isoStr = toIsoOrThrow(ferieCurrent, 'ferieperiode');
      if (datoSet.has(isoStr) && isWeekdayUtc(ferieCurrent)) {
        ferieDageSet.add(isoStr);
      }
      ferieCurrent = addDays(ferieCurrent, 1);
    }
  }
  return ferieDageSet;
};

export const buildShDageSet = (
  fraDate: Date,
  tilDate: Date,
  datoSet: ReadonlySet<ISODateString>
): Set<ISODateString> => {
  const shDageSet = new Set<ISODateString>();
  for (let year = fraDate.getUTCFullYear(); year <= tilDate.getUTCFullYear(); year += 1) {
    const helligdage = beregnHelligdage(year);
    for (const helligdag of helligdage) {
      const isoStr = toIsoOrThrow(helligdag, 'helligdag');
      if (isWeekdayUtc(helligdag) && datoSet.has(isoStr)) {
        shDageSet.add(isoStr);
      }
    }
  }
  return shDageSet;
};

export const buildShDageSetFromIsoRange = (fra: ISODateString, til: ISODateString): Set<ISODateString> => {
  const fraDate = isoDateToDate(fra);
  const tilDate = isoDateToDate(til);
  if (fraDate > tilDate) return new Set<ISODateString>();
  const datoSet = buildDatoSetInclusiveFromDates(fraDate, tilDate);
  return buildShDageSet(fraDate, tilDate, datoSet);
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

  let candidate = new Date(fraDate);
  while (candidate <= tilDate && remaining > 0) {
    const iso = toIsoOrThrow(candidate, 'lose feriedage');
    if (isWeekdayUtc(candidate) && !blocked.has(iso)) {
      selected.add(iso);
      remaining -= 1;
    }
    candidate = addDays(candidate, 1);
  }

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

const isDateWithinRanges = (
  iso: ISODateString,
  ranges: readonly Readonly<{ fra: ISODateString; til: ISODateString }>[]
): boolean => ranges.some((range) => iso >= range.fra && iso <= range.til);

export const buildTafArbejdsdageSetFromRows = (
  rows: ReadonlyArray<TafPeriodeRow>,
  ferieperioder: ReadonlyArray<FerieperiodeRow>,
  options: Readonly<{ authoritativeRanges?: readonly Readonly<{ fra: ISODateString; til: ISODateString }>[] }> = {}
): ReadonlySet<ISODateString> => {
  const authoritativeRanges = options.authoritativeRanges ?? [];
  const useAuthoritativeRanges = authoritativeRanges.length > 0;
  const arbejdsdage = new Set<ISODateString>();

  for (const row of rows) {
    const validRange = getValidTafRange(row);
    if (!validRange) continue;
    const loseFeriedage = typeof row.loseFeriedage === 'number' ? row.loseFeriedage : 0;
    const set = buildTafArbejdsdageSetForRange(validRange.fra, validRange.til, ferieperioder, loseFeriedage);
    for (const dato of set) {
      if (!useAuthoritativeRanges || isDateWithinRanges(dato, authoritativeRanges)) {
        arbejdsdage.add(dato);
      }
    }
  }

  return arbejdsdage;
};
