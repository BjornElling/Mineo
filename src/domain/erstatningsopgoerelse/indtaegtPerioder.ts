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
import { createDate, parseDanishDate, parseWeekString } from '../../utils/dateUtils';
import { countInclusiveUtcDays } from '../../utils/utcDayMath';
import { ydelsestyper } from '../../data/ydelsestyper';
import { mergeIsoDateRanges } from './periodMerging';
import { buildClampedTafRanges, resolveTafConstraintBounds } from './tafPeriodConstraints';
import { getAarsloenErrorRowIdSet } from './indkomstRowValidation';

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

type RowEligibility = 'empty' | 'invalid' | 'valid';

const toUtcDay = (date: Date): Date => {
  return createDate(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
};

const isoDateToUtcDate = (isoDate: ISODateString): Date => {
  const [yearStr, monthStr, dayStr] = isoDate.split('-');
  const year = Number.parseInt(yearStr, 10);
  const month = Number.parseInt(monthStr, 10);
  const day = Number.parseInt(dayStr, 10);
  return createDate(year, month - 1, day);
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

export const parseAarsloenRowInterval = (row: AarsloenTableRow, loenperiode: Loenperiode): DateInterval | null => {
  if (loenperiode === 'maaned') {
    const monthRaw = row.col0_maaned?.trim() ?? '';
    const yearRaw = row.col1_maaned?.trim() ?? '';
    if (monthRaw === '' || yearRaw === '') return null;

    const month = Number.parseInt(monthRaw, 10);
    const year = Number.parseInt(yearRaw, 10);
    if (!Number.isFinite(month) || !Number.isFinite(year)) return null;
    if (month < 1 || month > 12) return null;
    if (year < 1900 || year > 2100) return null;

    const start = createDate(year, month - 1, 1);
    const end = createDate(year, month, 0);
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
  const bounds = resolveTafConstraintBounds(values);
  const ranges = buildClampedTafRanges(values.tafPerioder ?? [], bounds);
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
  const areRangesDisjoint = ranges.every((range, index) => {
    if (index === 0) return true;
    return ranges[index - 1]!.til < range.fra;
  });
  if (!areRangesDisjoint) {
    // NOTE: Fail-closed by design.
    // Uventede overlappende ranges må ikke kunne give dobbelttælling.
    if (import.meta.env.DEV) {
      console.warn('Indkomstberegning: overlap i beregnings-ranges; beregning afbrydes fail-closed.');
    }
    return { employers: [], benefits: [] };
  }

  const employers: IncomeEmployerAmount[] = [];
  const ansaettelser = values.loenindkomstAnsaettelsesforhold ?? [];
  const loenErrorRowIdsByEmploymentId = new Map<string, ReadonlySet<string>>(
    ansaettelser.map((af) => [af.id, getAarsloenErrorRowIdSet(af.indtaegtsoplysningerTableData ?? [], af.loenperiode)])
  );

  for (let index = 0; index < ansaettelser.length; index += 1) {
    const af = ansaettelser[index];
    const errorRowIds = loenErrorRowIdsByEmploymentId.get(af.id) ?? new Set<string>();
    const classifyLoenRow = (row: AarsloenTableRow): RowEligibility => {
      if (isAarsloenRowEffectivelyEmpty(row)) return 'empty';
      if (errorRowIds.has(row.id)) return 'invalid';
      const interval = parseAarsloenRowInterval(row, af.loenperiode);
      if (!interval && import.meta.env.DEV) {
        throw new Error(
          `Indkomst-række ${row.id} kan ikke parses til periode, men er ikke markeret som fejl. ` +
          'Validation/parsing mismatch i fail-closed pipeline.'
        );
      }
      return interval ? 'valid' : 'invalid';
    };
    const satser = {
      feriePct: af.feriePct,
      fritvalgPct: af.fritvalgPct,
      shSoPct: af.shSoPct,
      storeBededagPct: af.storeBededagPct,
      pensionPct: af.pensionPct,
    };
    let sum = 0;
    for (const row of af.indtaegtsoplysningerTableData ?? []) {
      const eligibility = classifyLoenRow(row);
      if (eligibility !== 'valid') continue;
      const interval = parseAarsloenRowInterval(row, af.loenperiode);
      if (!interval) continue; // defensiv: eligibility 'valid' kræver interval
      const totalDays = countInclusiveUtcDays(interval.start, interval.end);
      if (!totalDays || totalDays <= 0) continue;
      const overlapDays = getOverlapDays(interval, ranges);
      if (overlapDays <= 0) continue;
      const derived = calculateAarsloenRowDerived(row, satser);
      // NOTE: Fail-closed by design.
      // Ikke-finite afledte beløb må aldrig indgå tavst i summer.
      if (!Number.isFinite(derived.samlet) || derived.samlet <= 0) continue;
      const fraction = overlapDays / totalDays;
      sum += derived.samlet * fraction;
    }
    if (Number.isFinite(sum) && sum > 0) {
      employers.push({
        id: af.id,
        index,
        name: (af.navnPaaArbejdssted ?? '').trim(),
        amount: sum,
      });
    }
  }

  const benefitsMap = new Map<string, { label: string; typeKey: string; amount: number }>();
  const classifyOffentligRow = (row: OffentligeYdelserRow): RowEligibility => {
    const hasAnyFilled =
      (row.fraDato?.trim() ?? '') !== '' ||
      (row.tilDato?.trim() ?? '') !== '' ||
      (row.ydelsestype?.trim() ?? '') !== '' ||
      row.ydelse !== undefined ||
      row.tillaeg !== undefined;
    if (!hasAnyFilled) return 'empty';
    // NOTE: Fail-closed by design.
    // Offentlige ydelser indgår kun med udfyldt ydelsestype og gyldig periode.
    if ((row.ydelsestype?.trim() ?? '') === '') return 'invalid';
    const interval = parseOffentligInterval(row);
    if (!interval && import.meta.env.DEV) {
      throw new Error(
        `Offentlig ydelse-række ${row.id} kan ikke parses til periode.`
      );
    }
    return interval ? 'valid' : 'invalid';
  };
  for (const row of values.offentligeYdelserRows ?? []) {
    if (classifyOffentligRow(row) !== 'valid') continue;
    const interval = parseOffentligInterval(row);
    if (!interval) continue;
    const totalDays = countInclusiveUtcDays(interval.start, interval.end);
    if (!totalDays || totalDays <= 0) continue;
    const overlapDays = getOverlapDays(interval, ranges);
    if (overlapDays <= 0) continue;
    const amount = parseAmount(row.ydelse) + parseAmount(row.tillaeg);
    if (import.meta.env.DEV) {
      const hasAmountInput = row.ydelse !== undefined || row.tillaeg !== undefined;
      if (hasAmountInput && !Number.isFinite(amount)) {
        throw new Error(`Offentlig ydelse-række ${row.id} har ikke-finite beløb.`);
      }
    }
    if (!Number.isFinite(amount) || amount <= 0) continue;
    const fraction = overlapDays / totalDays;
    const typeKey = row.ydelsestype?.trim() ?? '';
    const label = typeKey !== '' ? (ydelsestyper[typeKey]?.label ?? typeKey) : 'Offentlig ydelse';
    // NOTE: Fail-closed semantics kræver sporbar aggregation.
    // Rækker uden type må ikke sammenklappes via label.
    const key = typeKey !== '' ? `type:${typeKey}` : `row:${row.id}`;
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
