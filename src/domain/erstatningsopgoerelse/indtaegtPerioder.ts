import type {
  AarsloenTableRow,
  ErstatningsopgoerelseValues,
  Loenperiode,
  OffentligeYdelserRow,
} from '../../schemas/formSchemas';
import type { ISODateString } from '../../types/branded';
import { isISODateString } from '../../types/branded';
import { calculateAarsloenRowDerived, isAarsloenRowEffectivelyEmpty } from '../../utils/aarsloenTableCalculations';
import { parseAmount } from '../../utils/formatUtils';
import { parseDanishDate, parseWeekString } from '../../utils/dateUtils';
import { countInclusiveUtcDays } from '../../utils/utcDayMath';
import { ydelsestyper } from '../../data/ydelsestyper';
import { mergeIsoDateRanges } from './periodMerging';

export type IsoRange = Readonly<{ fra: ISODateString; til: ISODateString }>;

type DateInterval = Readonly<{ start: Date; end: Date }>;

export type IncomeEmployerAmount = Readonly<{
  id: string;
  index: number;
  name: string;
  amount: number;
}>;

export type IncomeBenefitAmount = Readonly<{
  typeKey: string;
  label: string;
  amount: number;
}>;

export type IncomePeriodResult = Readonly<{
  employers: readonly IncomeEmployerAmount[];
  benefits: readonly IncomeBenefitAmount[];
}>;

const toUtcDay = (date: Date): Date => {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
};

const isoDateToUtcDate = (isoDate: ISODateString): Date => {
  const [yearStr, monthStr, dayStr] = isoDate.split('-');
  const year = Number.parseInt(yearStr, 10);
  const month = Number.parseInt(monthStr, 10);
  const day = Number.parseInt(dayStr, 10);
  return new Date(Date.UTC(year, month - 1, day));
};

const getIsoRange = (fra: ISODateString | undefined, til: ISODateString | undefined): IsoRange | undefined => {
  if (!fra || !til) return undefined;
  if (fra > til) return undefined;
  return { fra, til };
};

const getOverlapDays = (interval: DateInterval, ranges: readonly IsoRange[]): number => {
  if (ranges.length === 0) return 0;
  let total = 0;
  for (const range of ranges) {
    const rangeStart = isoDateToUtcDate(range.fra);
    const rangeEnd = isoDateToUtcDate(range.til);
    const start = interval.start > rangeStart ? interval.start : rangeStart;
    const end = interval.end < rangeEnd ? interval.end : rangeEnd;
    if (start > end) continue;
    const days = countInclusiveUtcDays(start, end);
    if (days) total += days;
  }
  return total;
};

const parseAarsloenRowInterval = (row: AarsloenTableRow, loenperiode: Loenperiode): DateInterval | null => {
  if (loenperiode === 'maaned') {
    const monthRaw = row.col0_maaned?.trim() ?? '';
    const yearRaw = row.col1_maaned?.trim() ?? '';
    if (monthRaw === '' || yearRaw === '') return null;

    const month = Number.parseInt(monthRaw, 10);
    const year = Number.parseInt(yearRaw, 10);
    if (!Number.isFinite(month) || !Number.isFinite(year)) return null;
    if (month < 1 || month > 12) return null;
    if (year < 1900 || year > 2100) return null;

    const start = new Date(Date.UTC(year, month - 1, 1));
    const end = new Date(Date.UTC(year, month, 0));
    return { start, end };
  }

  if (loenperiode === 'uge') {
    const fraUge = row.col0_uge?.trim() ?? '';
    const tilUge = row.col1_uge?.trim() ?? '';
    if (fraUge === '' || tilUge === '') return null;

    const fra = parseWeekString(fraUge);
    const til = parseWeekString(tilUge);
    if (!fra || !til) return null;
    if (fra.start > til.end) return null;
    return { start: toUtcDay(fra.start), end: toUtcDay(til.end) };
  }

  const fraDato = row.col0_dag?.trim() ?? '';
  const tilDato = row.col1_dag?.trim() ?? '';
  if (fraDato === '' || tilDato === '') return null;

  const fra = parseDanishDate(fraDato);
  const til = parseDanishDate(tilDato);
  if (!fra || !til) return null;
  if (fra > til) return null;
  return { start: toUtcDay(fra), end: toUtcDay(til) };
};

const parseOffentligInterval = (row: OffentligeYdelserRow): DateInterval | null => {
  const fraStr = row.fraDato?.trim() ?? '';
  const tilStr = row.tilDato?.trim() ?? '';
  if (fraStr === '' || tilStr === '') return null;
  const fra = parseDanishDate(fraStr);
  const til = parseDanishDate(tilStr);
  if (!fra || !til) return null;
  if (fra > til) return null;
  return { start: toUtcDay(fra), end: toUtcDay(til) };
};

export const buildTafRanges = (values: ErstatningsopgoerelseValues): IsoRange[] => {
  const ranges = (values.tafPerioder ?? [])
    .map((row) => {
      if (!isISODateString(row.fra) || !isISODateString(row.til)) return undefined;
      return getIsoRange(row.fra, row.til);
    })
    .filter((range): range is IsoRange => Boolean(range));
  return mergeIsoDateRanges(ranges, { mergeAdjacent: true });
};

export const buildBeregningsperiodeRange = (
  values: ErstatningsopgoerelseValues
): IsoRange | undefined => {
  if (!isISODateString(values.periodeTilBeregningFra) || !isISODateString(values.periodeTilBeregningTil)) {
    return undefined;
  }
  return getIsoRange(values.periodeTilBeregningFra, values.periodeTilBeregningTil);
};

export const buildIncomeForRanges = (
  values: ErstatningsopgoerelseValues,
  rawRanges: readonly IsoRange[]
): IncomePeriodResult => {
  const ranges = mergeIsoDateRanges(rawRanges, { mergeAdjacent: true });
  if (ranges.length === 0) return { employers: [], benefits: [] };

  const employers: IncomeEmployerAmount[] = [];
  const ansaettelser = values.loenindkomstAnsaettelsesforhold ?? [];

  for (let index = 0; index < ansaettelser.length; index += 1) {
    const af = ansaettelser[index];
    const satser = {
      feriePct: af.feriePct,
      fritvalgPct: af.fritvalgPct,
      shSoPct: af.shSoPct,
      storeBededagPct: af.storeBededagPct,
      pensionPct: af.pensionPct,
    };
    let sum = 0;
    for (const row of af.indtaegtsoplysningerTableData ?? []) {
      if (isAarsloenRowEffectivelyEmpty(row)) continue;
      const interval = parseAarsloenRowInterval(row, af.loenperiode);
      if (!interval) continue;
      const totalDays = countInclusiveUtcDays(interval.start, interval.end);
      if (!totalDays || totalDays <= 0) continue;
      const overlapDays = getOverlapDays(interval, ranges);
      if (overlapDays <= 0) continue;
      const derived = calculateAarsloenRowDerived(row, satser);
      const fraction = overlapDays / totalDays;
      sum += derived.samlet * fraction;
    }
    if (sum > 0) {
      employers.push({
        id: af.id,
        index,
        name: (af.navnPaaArbejdssted ?? '').trim(),
        amount: sum,
      });
    }
  }

  const benefitsMap = new Map<string, { label: string; typeKey: string; amount: number }>();
  for (const row of values.offentligeYdelserRows ?? []) {
    const interval = parseOffentligInterval(row);
    if (!interval) continue;
    const totalDays = countInclusiveUtcDays(interval.start, interval.end);
    if (!totalDays || totalDays <= 0) continue;
    const overlapDays = getOverlapDays(interval, ranges);
    if (overlapDays <= 0) continue;
    const amount = parseAmount(row.ydelse) + parseAmount(row.tillaeg);
    if (!Number.isFinite(amount) || amount <= 0) continue;
    const fraction = overlapDays / totalDays;
    const typeKey = row.ydelsestype?.trim() ?? '';
    const label = typeKey !== '' ? (ydelsestyper[typeKey]?.label ?? typeKey) : 'Offentlig ydelse';
    const key = typeKey !== '' ? typeKey : label;
    const existing = benefitsMap.get(key);
    if (existing) {
      existing.amount += amount * fraction;
    } else {
      benefitsMap.set(key, { label, typeKey, amount: amount * fraction });
    }
  }

  const benefits: IncomeBenefitAmount[] = [];
  for (const entry of benefitsMap.values()) {
    if (entry.amount <= 0) continue;
    benefits.push({ typeKey: entry.typeKey, label: entry.label, amount: entry.amount });
  }

  return { employers, benefits };
};
