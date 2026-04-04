import type {
  StandardLoenTableRow,
  ErstatningsopgoerelseValues,
  Loenperiode,
  OffentligeYdelserRow,
} from '../../../schemas/formSchemas';
import type { ISODateString } from '../../../types/branded';
import { dateToISO, isISODateString } from '../../../types/branded';
import { calculateStandardLoenProjectedAmounts } from '../../aarsloen/standardLoenRowCalculations';
import { parseAmount } from '../../../utils/numberParsing';
import { createDate, parseDanishDate } from '../../../utils/dateUtils';
import { ydelsestyper } from '../../../data/ydelsestyper';
import { type DateInterval, type IsoRange, validateIsoRange } from '../../../utils/isoDateHelpers';
import { mergeIsoDateRanges } from '../engines/periodMerging';
import {
  buildClampedTafRanges,
  clampTafRange,
  resolveTafEoPeriodeBounds,
  resolveTafFejlgivendeBounds,
} from '../validation/tafPeriodConstraints';
import { getStandardLoenErrorRowIdSet } from '../validation/indkomstRowValidation';
import { isStandardLoenTableValueEffectivelyEmptyForValidation } from '../../aarsloen/standardLoenTableValidation';
import { computeTafBeregningsenhed, TAF_BEREGNES_SOM } from './tafBeregningsenhed';
import { parseAarsloenRowInterval } from './aarsloenRowInterval';
import { buildShDageSetFromIsoRange } from '../engines/tafDaySets';
import { buildLoenindkomstRateSegments } from './loenindkomstSatser';
import {
  buildLoenArbejdsdageSet,
  periodiserBeloebForOffentligYdelse,
  SYGEDAGPENGE_SH_CUTOFF,
} from '../engines/periodiseringsMotor';
import { iterateDatesInclusive } from '../../../utils/isoDateHelpers';

export type { IsoRange } from '../../../utils/isoDateHelpers';
export { parseAarsloenRowInterval } from './aarsloenRowInterval';

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

export type IncomeCalculationContext = Readonly<{
  boundsFra: ISODateString;
  boundsTil: ISODateString;
  arbejdsdageSet: ReadonlySet<ISODateString>;
  shDaysForYdelser: ReadonlySet<ISODateString>;
  loenErrorRowIdsByEmploymentId: ReadonlyMap<string, ReadonlySet<string>>;
}>;

type RowEligibility = 'empty' | 'invalid' | 'valid';

const isLoenRowEffectivelyEmptyForLoenperiode = (row: StandardLoenTableRow, loenperiode: Loenperiode): boolean => {
  const periodKeys: ReadonlyArray<keyof StandardLoenTableRow> = loenperiode === 'maaned'
    ? ['col0_maaned', 'col1_maaned']
    : loenperiode === 'uge'
      ? ['col0_uge', 'col1_uge']
      : ['col0_dag', 'col1_dag'];

  const keys: ReadonlyArray<keyof StandardLoenTableRow> = [...periodKeys, 'col2', 'col3', 'col4', 'col5'];
  return keys.every((key) => isStandardLoenTableValueEffectivelyEmptyForValidation(row[key]));
};

const parseOffentligInterval = (row: OffentligeYdelserRow): DateInterval | null => {
  const fraStr = row.fraDato?.trim() ?? '';
  const tilStr = row.tilDato?.trim() ?? '';
  if (fraStr === '' || tilStr === '') return null;
  const fra = parseDanishDate(fraStr);
  const til = parseDanishDate(tilStr);
  if (!fra || !til) return null;
  if (fra > til) return null;
  return {
    start: createDate(fra.getUTCFullYear(), fra.getUTCMonth(), fra.getUTCDate()),
    end: createDate(til.getUTCFullYear(), til.getUTCMonth(), til.getUTCDate()),
  };
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

export const buildTafRanges = (
  values: ErstatningsopgoerelseValues,
  options?: Readonly<{ skadesdatoISO?: ISODateString }>
): IsoRange[] => {
  // Tre-trins clamping (jf. eo-snapshot-contract.md §2.3):
  // 1. Clamp mod fejlgivende øvre grænser (differencekrav, endelig EET, og ved skader
  //    opstået før 2011-06-16 tillige midlertidig EET) — validator rapporterer violation
  const constraintSource = { ...values, skadesdatoISO: options?.skadesdatoISO };
  const fejlgivendeBounds = resolveTafFejlgivendeBounds(constraintSource);
  const afterFejlgivende = buildClampedTafRanges(values.tafPerioder ?? [], fejlgivendeBounds);
  // 2. Merge overlappende og tilstødende ranges
  const merged = mergeIsoDateRanges(afterFejlgivende, { mergeAdjacent: true });
  // 3. Stille clamping mod EO-perioden (ingen fejlindikation)
  const eoBounds = resolveTafEoPeriodeBounds(values);
  const result: IsoRange[] = [];
  for (const range of merged) {
    const clamped = clampTafRange(range, eoBounds);
    if (clamped) result.push(clamped);
  }
  return result;
};

export const buildBeregningsperiodeRange = (
  values: ErstatningsopgoerelseValues
): IsoRange | undefined => {
  if (!isISODateString(values.periodeTilBeregningFra) || !isISODateString(values.periodeTilBeregningTil)) {
    return undefined;
  }
  return validateIsoRange(values.periodeTilBeregningFra, values.periodeTilBeregningTil);
};

const resolveIncomeBounds = (
  values: ErstatningsopgoerelseValues,
  ranges: readonly IsoRange[]
): Readonly<{ boundsFra: ISODateString; boundsTil: ISODateString } | null> => {
  const ansaettelser = values.loenindkomstAnsaettelsesforhold ?? [];
  const allLoenIntervals: DateInterval[] = [];
  ansaettelser.forEach((af) => {
    (af.indtaegtsoplysningerTableData ?? []).forEach((row) => {
      const interval = parseAarsloenRowInterval(row, af.loenperiode);
      if (!interval) return;
      allLoenIntervals.push(interval);
    });
  });
  const allOffentligIntervals: DateInterval[] = [];
  (values.offentligeYdelserRows ?? []).forEach((row) => {
    const interval = parseOffentligInterval(row);
    if (!interval) return;
    allOffentligIntervals.push(interval);
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
  const offentligIntervalBoundFra = allOffentligIntervals.reduce<ISODateString | undefined>((acc, interval) => {
    const iso = dateToISO(interval.start);
    if (!iso) return acc;
    return acc ? (acc < iso ? acc : iso) : iso;
  }, undefined);
  const offentligIntervalBoundTil = allOffentligIntervals.reduce<ISODateString | undefined>((acc, interval) => {
    const iso = dateToISO(interval.end);
    if (!iso) return acc;
    return acc ? (acc > iso ? acc : iso) : iso;
  }, undefined);

  const boundsFraCandidates = [rangeBoundFra, intervalBoundFra, offentligIntervalBoundFra, values.periodeTilBeregningFra].filter(
    (value): value is ISODateString => isISODateString(value)
  );
  const boundsTilCandidates = [rangeBoundTil, intervalBoundTil, offentligIntervalBoundTil, values.periodeTilBeregningTil].filter(
    (value): value is ISODateString => isISODateString(value)
  );
  const boundsFra = boundsFraCandidates.reduce<ISODateString | undefined>((acc, iso) => (acc ? (acc < iso ? acc : iso) : iso), undefined);
  const boundsTil = boundsTilCandidates.reduce<ISODateString | undefined>((acc, iso) => (acc ? (acc > iso ? acc : iso) : iso), undefined);
  if (!boundsFra || !boundsTil || boundsFra > boundsTil) return null;
  return { boundsFra, boundsTil };
};

const areRangesWithinBounds = (
  ranges: readonly IsoRange[],
  boundsFra: ISODateString,
  boundsTil: ISODateString
): boolean => ranges.every((range) => range.fra >= boundsFra && range.til <= boundsTil);

const isDateInRanges = (iso: ISODateString, ranges: readonly IsoRange[]): boolean =>
  ranges.some((range) => iso >= range.fra && iso <= range.til);

export const buildIncomeCalculationContext = (
  values: ErstatningsopgoerelseValues,
  rawRanges: readonly IsoRange[]
): IncomeCalculationContext | null => {
  const ranges = mergeIsoDateRanges(rawRanges, { mergeAdjacent: true });
  if (ranges.length === 0) return null;
  const bounds = resolveIncomeBounds(values, ranges);
  if (!bounds) return null;

  const beregningsenhed = computeTafBeregningsenhed(values);
  const arbejdsdageSet =
    beregningsenhed === TAF_BEREGNES_SOM.ARBEJDSDAGE
      ? buildLoenArbejdsdageSet(
        { fra: bounds.boundsFra, til: bounds.boundsTil },
        [...(values.ferieperioder ?? []), ...(values.fravaerPerioder ?? [])]
      )
      : new Set<ISODateString>();
  const shDaysForYdelser = buildShDageSetFromIsoRange(bounds.boundsFra, bounds.boundsTil);
  const ansaettelser = values.loenindkomstAnsaettelsesforhold ?? [];
  const loenErrorRowIdsByEmploymentId = new Map<string, ReadonlySet<string>>(
    ansaettelser.map((af) => [af.id, getStandardLoenErrorRowIdSet(af.indtaegtsoplysningerTableData ?? [], af.loenperiode)])
  );

  return {
    boundsFra: bounds.boundsFra,
    boundsTil: bounds.boundsTil,
    arbejdsdageSet,
    shDaysForYdelser,
    loenErrorRowIdsByEmploymentId,
  };
};

export const buildIncomeForRanges = (
  values: ErstatningsopgoerelseValues,
  rawRanges: readonly IsoRange[],
  context?: IncomeCalculationContext | null,
  skadesdato?: ISODateString
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
  const beregningsenhed = computeTafBeregningsenhed(values);
  const ansaettelser = values.loenindkomstAnsaettelsesforhold ?? [];
  const resolvedContext = (
    context
      && areRangesWithinBounds(ranges, context.boundsFra, context.boundsTil)
      ? context
      : buildIncomeCalculationContext(values, ranges)
  );
  const arbejdsdageSet = resolvedContext?.arbejdsdageSet ?? new Set<ISODateString>();
  const shDaysForYdelser = resolvedContext?.shDaysForYdelser ?? new Set<ISODateString>();
  const loenErrorRowIdsByEmploymentId = resolvedContext?.loenErrorRowIdsByEmploymentId
    ?? new Map<string, ReadonlySet<string>>(
      ansaettelser.map((af) => [af.id, getStandardLoenErrorRowIdSet(af.indtaegtsoplysningerTableData ?? [], af.loenperiode)])
    );
  const employers: IncomeEmployerAmount[] = [];

  const buildAllocationDates = (interval: DateInterval): readonly ISODateString[] => {
    const allocationDates: ISODateString[] = [];
    iterateDatesInclusive(interval.start, interval.end, (date) => {
      const iso = dateToISO(date);
      if (!iso) return;
      if (beregningsenhed === TAF_BEREGNES_SOM.ARBEJDSDAGE && !arbejdsdageSet.has(iso)) return;
      allocationDates.push(iso);
    });
    return allocationDates;
  };

  const buildSelectedDates = (allocationDates: readonly ISODateString[]): readonly ISODateString[] =>
    allocationDates.filter((iso) => isDateInRanges(iso, ranges));

  for (let index = 0; index < ansaettelser.length; index += 1) {
    const af = ansaettelser[index];
    const errorRowIds = loenErrorRowIdsByEmploymentId.get(af.id) ?? new Set<string>();
    const classifyLoenRow = (row: StandardLoenTableRow): RowEligibility => {
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
      const fra = dateToISO(interval.start);
      const til = dateToISO(interval.end);
      const allocationDates = buildAllocationDates(interval);
      if (allocationDates.length === 0) continue;
      const selectedDates = buildSelectedDates(allocationDates);
      if (selectedDates.length === 0) continue;

      const projected = calculateStandardLoenProjectedAmounts(row, satser, {
        loenperiode: af.loenperiode,
        allocationDates,
        selectedDates,
        rateSegments: fra && til
          ? buildLoenindkomstRateSegments({
            ansaettelsesforhold: af,
            skadesdato,
            fra,
            til,
          })
          : undefined,
      });

      const ferieberetContrib = projected.ferieberet;
      const fpFvShSoStbContrib = projected.fpFvShSo;
      const pensionContrib = projected.pension;
      const atpContrib = projected.atp;
      const samletContrib = projected.samlet;
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
    if (!interval) return 'invalid';
    return 'valid';
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
