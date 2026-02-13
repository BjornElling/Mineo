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
import { ydelsestyper } from '../../data/ydelsestyper';
import { beregnHelligdage } from '../../utils/shDageBeregning';
import { mergeIsoDateRanges } from './periodMerging';
import { buildClampedTafRanges, resolveTafConstraintBounds } from './tafPeriodConstraints';
import { getAarsloenErrorRowIdSet } from './indkomstRowValidation';
import { isoDateToDate } from '../dates/isoDate';
import { isAarsloenTableValueEffectivelyEmptyForValidation } from '../../utils/aarsloenTableValidation';
import { computeTafBeregningsenhed, TAF_BEREGNES_SOM } from './tafBeregningsenhed';
import {
  buildLoenArbejdsdageSet,
  periodiserBeloebForArbejdsdage,
  periodiserBeloebForMaaneder,
  periodiserBeloebForOffentligYdelse,
  SYGEDAGPENGE_SH_CUTOFF,
} from './periodiseringsMotor';

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

const resolveYdelsestype = (raw: string): Readonly<{ key: string; label: string; periodisering: (typeof ydelsestyper)[string]['periodisering'] }> | null => {
  const direct = ydelsestyper[raw];
  if (direct) {
    return { key: raw, label: direct.label, periodisering: direct.periodisering };
  }
  const normalizedRaw = raw.trim().toLowerCase();
  for (const [key, config] of Object.entries(ydelsestyper)) {
    if (config.label.trim().toLowerCase() === normalizedRaw) {
      return { key, label: config.label, periodisering: config.periodisering };
    }
  }
  return null;
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
  const beregningsenhed = computeTafBeregningsenhed(values);
  const arbejdsdageSet =
    boundsFra && boundsTil && boundsFra <= boundsTil
      ? buildLoenArbejdsdageSet(
        { fra: boundsFra, til: boundsTil },
        [...(values.ferieperioder ?? []), ...(values.fravaerPerioder ?? [])]
      )
      : new Set<ISODateString>();
  const shDaysForYdelser =
    boundsFra && boundsTil && boundsFra <= boundsTil
      ? buildShDageSet(boundsFra, boundsTil)
      : new Set<ISODateString>();
  const loenErrorRowIdsByEmploymentId = new Map<string, ReadonlySet<string>>(
    ansaettelser.map((af) => [af.id, getAarsloenErrorRowIdSet(af.indtaegtsoplysningerTableData ?? [], af.loenperiode)])
  );

  for (let index = 0; index < ansaettelser.length; index += 1) {
    const af = ansaettelser[index];
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
      const derived = calculateAarsloenRowDerived(row, satser);
      const atp = parseAmount(row.col5);
      // NOTE: Fail-closed by design.
      // Ikke-finite afledte beløb må aldrig indgå tavst i summer.
      if (!Number.isFinite(derived.samlet) || derived.samlet <= 0) continue;

      const periodiser = (amount: number): number => {
        if (beregningsenhed === TAF_BEREGNES_SOM.MAANEDER) {
          return periodiserBeloebForMaaneder({
            totalBeloeb: amount,
            interval,
            ranges,
          });
        }
        return periodiserBeloebForArbejdsdage({
          totalBeloeb: amount,
          interval,
          ranges,
          arbejdsdageSet,
        });
      };

      const ferieberetContrib = periodiser(derived.ferieberet);
      const fpFvShSoStbContrib = periodiser(derived.fpFvShSo);
      const pensionContrib = periodiser(derived.pension);
      const atpContrib = periodiser(atp);
      const samletContrib = periodiser(derived.samlet);
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
    const amount = parseAmount(row.ydelse) + parseAmount(row.tillaeg);
    if (import.meta.env.DEV) {
      const hasAmountInput = row.ydelse !== undefined || row.tillaeg !== undefined;
      if (hasAmountInput && !Number.isFinite(amount)) {
        throw new Error(`Offentlig ydelse-række ${row.id} har ikke-finite beløb.`);
      }
    }
    if (!Number.isFinite(amount) || amount <= 0) continue;
    const rawType = row.ydelsestype?.trim() ?? '';
    const resolvedType = resolveYdelsestype(rawType);
    if (!resolvedType) continue;
    const typeKey = resolvedType.key;
    const label = resolvedType.label;
    const periodiseretAmount = ranges.reduce((sum, range) => {
      return sum + periodiserBeloebForOffentligYdelse({
        totalBeloeb: amount,
        interval,
        range,
        periodisering: resolvedType.periodisering,
        ydelsestypeKey: typeKey,
        shDays: shDaysForYdelser,
        sygedagpengeShCutoff: SYGEDAGPENGE_SH_CUTOFF,
      });
    }, 0);
    if (!Number.isFinite(periodiseretAmount) || periodiseretAmount <= 0) continue;
    // NOTE: Fail-closed semantics kræver sporbar aggregation.
    // Rækker uden type må ikke sammenklappes via label.
    const key = typeKey !== '' ? `type:${typeKey}` : `row:${row.id}`;
    const existing = benefitsMap.get(key);
    if (existing) {
      existing.amount += periodiseretAmount;
    } else {
      benefitsMap.set(key, { label, typeKey, amount: periodiseretAmount });
    }
  }

  const benefits: IncomeBenefitAmount[] = [];
  for (const entry of benefitsMap.values()) {
    if (entry.amount <= 0) continue;
    benefits.push({ typeKey: entry.typeKey, label: entry.label, amount: entry.amount });
  }

  return { employers, benefits };
};
