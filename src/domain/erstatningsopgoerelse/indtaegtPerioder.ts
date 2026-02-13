import type {
  AarsloenTableRow,
  ErstatningsopgoerelseValues,
  Loenperiode,
  OffentligeYdelserRow,
} from '../../schemas/formSchemas';
import type { ISODateString } from '../../types/branded';
import { dateToISO, isISODateString } from '../../types/branded';
import { calculateAarsloenRowDerived } from '../../utils/aarsloenTableCalculations';
import { parseAmount } from '../../utils/formatUtils';
import { createDate, parseDanishDate, parseWeekString } from '../../utils/dateUtils';
import { countInclusiveUtcDays } from '../../utils/utcDayMath';
import { ydelsestyper } from '../../data/ydelsestyper';
import { beregnHelligdage } from '../../utils/shDageBeregning';
import { mergeIsoDateRanges } from './periodMerging';
import { buildClampedTafRanges, resolveTafConstraintBounds } from './tafPeriodConstraints';
import { getAarsloenErrorRowIdSet } from './indkomstRowValidation';
import { isoDateToDate } from '../dates/isoDate';
import { isAarsloenTableValueEffectivelyEmptyForValidation } from '../../utils/aarsloenTableValidation';
import {
  LOEN_PERIODISERING,
  type LoenPeriodisering,
  resolveLoenPeriodiseringForAnsaettelsesforhold,
} from './loenPeriodisering';

export type IsoRange = Readonly<{ fra: ISODateString; til: ISODateString }>;

type DateInterval = Readonly<{ start: Date; end: Date }>;

export type IncomeEmployerAmount = Readonly<{
  id: string;
  index: number;
  name: string;
  amount: number;
  breakdown: Readonly<{
    ferieberet: number;
    fpFvShSo: number;
    pension: number;
    atp: number;
    samlet: number;
  }>;
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

const getIsoRange = (fra: ISODateString | undefined, til: ISODateString | undefined): IsoRange | undefined => {
  if (!fra || !til) return undefined;
  if (fra > til) return undefined;
  return { fra, til };
};

const getOverlapDays = (interval: DateInterval, ranges: readonly IsoRange[]): number => {
  if (ranges.length === 0) return 0;
  let total = 0;
  for (const range of ranges) {
    const rangeStart = isoDateToDate(range.fra);
    const rangeEnd = isoDateToDate(range.til);
    const start = interval.start > rangeStart ? interval.start : rangeStart;
    const end = interval.end < rangeEnd ? interval.end : rangeEnd;
    if (start > end) continue;
    const days = countInclusiveUtcDays(start, end);
    if (days) total += days;
  }
  return total;
};

const getOverlappingIsoRange = (
  a: IsoRange | undefined,
  b: IsoRange | undefined
): IsoRange | undefined => {
  if (!a || !b) return undefined;
  const fra = a.fra > b.fra ? a.fra : b.fra;
  const til = a.til < b.til ? a.til : b.til;
  if (fra > til) return undefined;
  return { fra, til };
};

const iterateIsoDatesInclusive = (
  fra: ISODateString,
  til: ISODateString,
  onDate: (iso: ISODateString, date: Date) => void
): void => {
  const current = isoDateToDate(fra);
  const end = isoDateToDate(til);
  while (current <= end) {
    const iso = dateToISO(current);
    if (iso) onDate(iso, current);
    current.setUTCDate(current.getUTCDate() + 1);
  }
};

const buildShDageSet = (fra: ISODateString, til: ISODateString): ReadonlySet<ISODateString> => {
  const start = isoDateToDate(fra);
  const end = isoDateToDate(til);
  const set = new Set<ISODateString>();
  for (let year = start.getUTCFullYear(); year <= end.getUTCFullYear(); year += 1) {
    const helligdage = beregnHelligdage(year);
    for (const helligdag of helligdage) {
      const iso = dateToISO(helligdag);
      if (!iso || iso < fra || iso > til) continue;
      const dow = helligdag.getUTCDay();
      if (dow >= 1 && dow <= 5) set.add(iso);
    }
  }
  return set;
};

const addWeekdayNonShDatesFromRange = (
  set: Set<ISODateString>,
  range: IsoRange,
  shDage: ReadonlySet<ISODateString>
): void => {
  iterateIsoDatesInclusive(range.fra, range.til, (iso, d) => {
    const dow = d.getUTCDay();
    if (dow < 1 || dow > 5) return;
    if (shDage.has(iso)) return;
    set.add(iso);
  });
};

const allocateWeekdayDates = (args: {
  range: IsoRange | undefined;
  count: number;
  shDage: ReadonlySet<ISODateString>;
  reserved: Set<ISODateString>;
}): ReadonlySet<ISODateString> => {
  const { range, count, shDage, reserved } = args;
  if (!range || count <= 0) return new Set<ISODateString>();

  const selected = new Set<ISODateString>();
  let remaining = Math.max(0, Math.trunc(count));
  if (remaining === 0) return selected;

  iterateIsoDatesInclusive(range.fra, range.til, (iso, d) => {
    if (remaining <= 0) return;
    const dow = d.getUTCDay();
    if (dow < 1 || dow > 5) return;
    if (shDage.has(iso) || reserved.has(iso)) return;
    selected.add(iso);
    reserved.add(iso);
    remaining -= 1;
  });

  return selected;
};

const buildArbejdsdageSet = (
  values: ErstatningsopgoerelseValues,
  bounds: IsoRange
): ReadonlySet<ISODateString> => {
  const shDage = buildShDageSet(bounds.fra, bounds.til);

  const explicitFerie = new Set<ISODateString>();
  for (const row of [...(values.ferieperioder ?? []), ...(values.fravaerPerioder ?? [])]) {
    const rowRange = getIsoRange(row.fra, row.til);
    const overlap = getOverlappingIsoRange(rowRange, bounds);
    if (!overlap) continue;
    addWeekdayNonShDatesFromRange(explicitFerie, overlap, shDage);
  }

  const loseFerie = new Set<ISODateString>();
  for (const row of values.tafPerioder ?? []) {
    const rowRange = getIsoRange(row.fra, row.til);
    const overlap = getOverlappingIsoRange(rowRange, bounds);
    if (!overlap) continue;
    const loseCount = typeof row.loseFeriedage === 'number' ? Math.max(0, Math.trunc(row.loseFeriedage)) : 0;
    if (loseCount <= 0) continue;
    let remaining = loseCount;
    iterateIsoDatesInclusive(overlap.fra, overlap.til, (iso, d) => {
      if (remaining <= 0) return;
      const dow = d.getUTCDay();
      if (dow < 1 || dow > 5) return;
      if (shDage.has(iso) || explicitFerie.has(iso) || loseFerie.has(iso)) return;
      loseFerie.add(iso);
      remaining -= 1;
    });
  }

  const reserved = new Set<ISODateString>([...explicitFerie, ...loseFerie]);
  const oevrigeFravaersdageCount =
    values.oevrigtFravaerUdenLoen === 'Ja' && typeof values.oevrigeFravaersdage === 'number'
      ? values.oevrigeFravaersdage
      : 0;
  const beregningsRange = getIsoRange(values.periodeTilBeregningFra, values.periodeTilBeregningTil);
  const relevantBeregningsRange = getOverlappingIsoRange(beregningsRange, bounds);
  const oevrigtFravaer = allocateWeekdayDates({
    range: relevantBeregningsRange,
    count: oevrigeFravaersdageCount,
    shDage,
    reserved,
  });

  const allFerie = new Set<ISODateString>([...explicitFerie, ...loseFerie, ...oevrigtFravaer]);
  const arbejdsdage = new Set<ISODateString>();
  iterateIsoDatesInclusive(bounds.fra, bounds.til, (iso, d) => {
    const dow = d.getUTCDay();
    if (dow < 1 || dow > 5) return;
    if (shDage.has(iso)) return;
    if (allFerie.has(iso)) return;
    arbejdsdage.add(iso);
  });

  return arbejdsdage;
};

const getPeriodiseringsdage = (args: {
  interval: DateInterval;
  ranges: readonly IsoRange[];
  periodisering: LoenPeriodisering;
  arbejdsdageSet: ReadonlySet<ISODateString>;
}): Readonly<{ total: number; overlap: number }> => {
  const { interval, ranges, periodisering, arbejdsdageSet } = args;
  const totalDays = countInclusiveUtcDays(interval.start, interval.end);
  if (!totalDays || totalDays <= 0) return { total: 0, overlap: 0 };

  if (periodisering === LOEN_PERIODISERING.KALENDERDAGE) {
    return { total: totalDays, overlap: getOverlapDays(interval, ranges) };
  }

  let total = 0;
  let overlap = 0;
  for (let i = 0; i < totalDays; i += 1) {
    const date = new Date(interval.start.getTime());
    date.setUTCDate(interval.start.getUTCDate() + i);
    const iso = dateToISO(date);
    if (!iso) continue;
    if (!arbejdsdageSet.has(iso)) continue;
    total += 1;
    if (ranges.some((range) => iso >= range.fra && iso <= range.til)) {
      overlap += 1;
    }
  }

  return { total, overlap };
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

const isLoenRowEffectivelyEmptyForLoenperiode = (row: AarsloenTableRow, loenperiode: Loenperiode): boolean => {
  const periodKeys: ReadonlyArray<keyof AarsloenTableRow> = loenperiode === 'maaned'
    ? ['col0_maaned', 'col1_maaned']
    : loenperiode === 'uge'
      ? ['col0_uge', 'col1_uge']
      : ['col0_dag', 'col1_dag'];

  const keys: ReadonlyArray<keyof AarsloenTableRow> = [...periodKeys, 'col2', 'col3', 'col4', 'col5'];
  return keys.every((key) => isAarsloenTableValueEffectivelyEmptyForValidation(row[key]));
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
    const previousRange = ranges[index - 1];
    return previousRange ? previousRange.til < range.fra : true;
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
  const allLoenIntervals: DateInterval[] = [];
  ansaettelser.forEach((af) => {
    (af.indtaegtsoplysningerTableData ?? []).forEach((row) => {
      const interval = parseAarsloenRowInterval(row, af.loenperiode);
      if (!interval) return;
      allLoenIntervals.push(interval);
    });
  });
  const rangeBoundFra = ranges.reduce<ISODateString | undefined>((acc, range) => (acc ? (acc < range.fra ? acc : range.fra) : range.fra), undefined);
  const rangeBoundTil = ranges.reduce<ISODateString | undefined>((acc, range) => (acc ? (acc > range.til ? acc : range.til) : range.til), undefined);
  const intervalBoundFra = allLoenIntervals.reduce<ISODateString | undefined>((acc, interval) => {
    const iso = dateToISO(interval.start);
    if (!iso) return acc;
    return acc ? (acc < iso ? acc : iso) : iso;
  }, undefined);
  const intervalBoundTil = allLoenIntervals.reduce<ISODateString | undefined>((acc, interval) => {
    const iso = dateToISO(interval.end);
    if (!iso) return acc;
    return acc ? (acc > iso ? acc : iso) : iso;
  }, undefined);
  const boundsFraCandidates = [rangeBoundFra, intervalBoundFra, values.periodeTilBeregningFra].filter(
    (value): value is ISODateString => isISODateString(value)
  );
  const boundsTilCandidates = [rangeBoundTil, intervalBoundTil, values.periodeTilBeregningTil].filter(
    (value): value is ISODateString => isISODateString(value)
  );
  const boundsFra = boundsFraCandidates.reduce<ISODateString | undefined>((acc, iso) => (acc ? (acc < iso ? acc : iso) : iso), undefined);
  const boundsTil = boundsTilCandidates.reduce<ISODateString | undefined>((acc, iso) => (acc ? (acc > iso ? acc : iso) : iso), undefined);
  const arbejdsdageSet =
    boundsFra && boundsTil && boundsFra <= boundsTil
      ? buildArbejdsdageSet(values, { fra: boundsFra, til: boundsTil })
      : new Set<ISODateString>();
  const loenErrorRowIdsByEmploymentId = new Map<string, ReadonlySet<string>>(
    ansaettelser.map((af) => [af.id, getAarsloenErrorRowIdSet(af.indtaegtsoplysningerTableData ?? [], af.loenperiode)])
  );

  for (let index = 0; index < ansaettelser.length; index += 1) {
    const af = ansaettelser[index];
    const periodisering = resolveLoenPeriodiseringForAnsaettelsesforhold(af);
    const errorRowIds = loenErrorRowIdsByEmploymentId.get(af.id) ?? new Set<string>();
    const classifyLoenRow = (row: AarsloenTableRow): RowEligibility => {
      if (isLoenRowEffectivelyEmptyForLoenperiode(row, af.loenperiode)) return 'empty';
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
    const breakdown = { ferieberet: 0, fpFvShSo: 0, pension: 0, atp: 0, samlet: 0 };
    for (const row of af.indtaegtsoplysningerTableData ?? []) {
      const eligibility = classifyLoenRow(row);
      if (eligibility !== 'valid') continue;
      const interval = parseAarsloenRowInterval(row, af.loenperiode);
      if (!interval) continue; // defensiv: eligibility 'valid' kræver interval
      const periodiseringsdage = getPeriodiseringsdage({
        interval,
        ranges,
        periodisering,
        arbejdsdageSet,
      });
      if (periodiseringsdage.total <= 0 || periodiseringsdage.overlap <= 0) continue;
      const derived = calculateAarsloenRowDerived(row, satser);
      const atp = parseAmount(row.col5);
      // NOTE: Fail-closed by design.
      // Ikke-finite afledte beløb må aldrig indgå tavst i summer.
      if (!Number.isFinite(derived.samlet) || derived.samlet <= 0) continue;
      const fraction = periodiseringsdage.overlap / periodiseringsdage.total;
      const ferieberetContrib = derived.ferieberet * fraction;
      const fpFvShSoStbContrib = derived.fpFvShSo * fraction;
      const pensionContrib = derived.pension * fraction;
      const atpContrib = atp * fraction;
      const samletContrib = derived.samlet * fraction;
      if (
        !Number.isFinite(ferieberetContrib) ||
        !Number.isFinite(fpFvShSoStbContrib) ||
        !Number.isFinite(pensionContrib) ||
        !Number.isFinite(atpContrib) ||
        !Number.isFinite(samletContrib) ||
        samletContrib <= 0
      ) {
        continue;
      }
      breakdown.ferieberet += ferieberetContrib;
      breakdown.fpFvShSo += fpFvShSoStbContrib;
      breakdown.pension += pensionContrib;
      breakdown.atp += atpContrib;
      breakdown.samlet += samletContrib;
    }
    if (Number.isFinite(breakdown.samlet) && breakdown.samlet > 0) {
      employers.push({
        id: af.id,
        index,
        name: (af.navnPaaArbejdssted ?? '').trim(),
        amount: breakdown.samlet,
        breakdown,
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
