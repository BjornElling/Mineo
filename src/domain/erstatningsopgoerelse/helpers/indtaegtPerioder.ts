import { resolveIndkomstFerieperioder } from './indkomstFerieperioder';
import type {
  StandardLoenTableRow,
  Loenperiode,
  OffentligeYdelserRow,
} from '../../../schemas/formSchemas';
import type { TafCalculationValues } from '../engines/tafCalculationInput';
import type { ISODateString } from '../../../types/branded';
import { coerceToISODateString, dateToISO, isISODateString, parseISODate } from '../../../types/branded';
import { calculateStandardLoenProjectedAmounts, type StandardLoenProjectedAmounts } from '../../aarsloen/standardLoenRowCalculations';
import { parseAmount } from '../../../utils/numberParsing';
import { createDate } from '../../../utils/dateUtils';
import { resolveYdelsestype } from '../../../data/ydelsestyper';
import { type DateInterval, type IsoRange, validateIsoRange } from '../../../utils/isoDateHelpers';
import { mergeIsoDateRanges } from '../engines/isoRangeAlgebra';
import {
  buildClampedTafRanges,
  clampTafRange,
  resolveTafEoPeriodeBounds,
  resolveTafFejlgivendeBounds,
} from '../validation/tafPeriodConstraints';
import { getStandardLoenErrorRowIdSet } from '../validation/indkomstRowValidation';
import { isStandardLoenTableValueEffectivelyEmptyForValidation } from '../../standardLoen/standardLoenTableValidation';
import { computeTafBeregningsenhed, TAF_BEREGNES_SOM } from './tafBeregningsenhed';
import { parseAarsloenRowInterval } from '../../aarsloen/aarsloenRowInterval';
import { buildShDageSetFromIsoRange } from '../engines/tafDaySets';
import { buildLoenindkomstRateSegments } from './loenindkomstSatser';
import {
  buildOffentligYdelsePeriodiseringsGrundlag,
  buildFallbackAllocationDaysForInterval,
  countOffentligYdelseOverlapDage,
  buildLoenArbejdsdageSet,
  periodiserBeloebForOffentligYdelseMedGrundlag,
  SYGEDAGPENGE_SH_CUTOFF,
} from '../engines/periodiseringsMotor';
import { iterateDatesInclusive } from '../../../utils/isoDateHelpers';
import { roundHeleKroner, roundKroner } from '../../money/money';

export type { IsoRange } from '../../../utils/isoDateHelpers';
export { parseAarsloenRowInterval } from '../../aarsloen/aarsloenRowInterval';

export type IncomeEmployerAmount = Readonly<{
  id: string;
  index: number;
  name: string;
  amount: number;
  breakdown: Readonly<{
    loenPlusLoen2: number;
    loenPlusLoen2PlusIkkePensLoen: number;
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

/**
 * En indtægtskilde (ansættelsesforhold eller ydelsestype), hvis rækker i perioden SAMLET er negative.
 *
 * Negative rækker regnes med og modregnes i kildens øvrige indtægt (udviklerafgørelse 2026-10-19, BB-290). Er
 * kildens samlede indtægt i perioden negativ, er der ingen positiv indtægt at modregne i, og motorerne
 * (lønudviklingens basisløn, indkomstgrundlaget, fradragets sum) forudsætter en ikke-negativ indtægt pr. kilde.
 * Kilden indgår derfor IKKE i `employers`/`benefits`, men meldes her, så validatoren kan spærre med en
 * navngiven fejl i stedet for, at kilden forsvinder tavst (udviklerafgørelse 2026-10-19: en samlet negativ kilde
 * spærrer i begge perioder).
 */
export type IncomeNegativeSource = Readonly<
  | { kind: 'employer'; id: string; index: number; name: string; amount: number }
  | { kind: 'benefit'; typeKey: string; label: string; amount: number }
>;

export type IncomePeriodResultDetailed = IncomePeriodResult & Readonly<{
  negativeSources: readonly IncomeNegativeSource[];
}>;

/**
 * Under denne grænse er en sum nul. Positive og negative rækker, der går lige op (+x og −x), kan efterlade
 * flydende-komma-støj som ±1e-13, der ellers ville blive en post på «-0,00 kr.».
 */
const INCOME_ZERO_EPSILON = 1e-9;
const isEffectivelyZero = (amount: number): boolean => Math.abs(amount) < INCOME_ZERO_EPSILON;

/**
 * ENESTE navn for et ansættelsesforhold i dokumenter, bilag og beregningstekster: det indtastede
 * arbejdsstednavn, ellers kortets egen overskrift på Lønindkomst, «Ansættelsesforhold N» (1-indekseret
 * position i `loenindkomstAnsaettelsesforhold`).
 *
 * Før havde fire moduler reserven «Arbejdssted», ét «Arbejdssted N», ét «Lønindkomst» og to
 * «Ansættelsesforhold N» – så samme unavngivne ansættelsesforhold hed to ting i ét dokument, og to
 * unavngivne hed begge «Arbejdssted» (BB-279). `index` er positionen i HELE listen, aldrig i en filtreret
 * delmængde – ellers flytter nummeret sig væk fra skærmens.
 */
export const resolveAnsaettelsesforholdNavn = (navn: string | undefined, index: number): string =>
  (navn ?? '').trim() || `Ansættelsesforhold ${index + 1}`;

export type IncomeCalculationContext = Readonly<{
  boundsFra: ISODateString;
  boundsTil: ISODateString;
  arbejdsdageSet: ReadonlySet<ISODateString>;
  shDaysForYdelser: ReadonlySet<ISODateString>;
  loenErrorRowIdsByEmploymentId: ReadonlyMap<string, ReadonlySet<string>>;
}>;

type RowEligibility = 'empty' | 'invalid' | 'valid';

/**
 * Afrunding af benefit-beløb til "Indtægter i erstatningsperioden"-linjen og TAF-fordeling.
 *
 * `useWholeKronerForMidlertidigtEet` skal sættes når togglen
 * `midlertidigtEetFraEetSiden === 'Ja'` er aktiv, og runder importeret midlertidigt EET i
 * hele kroner (øvrige benefits/manuelle rækker: 2 decimaler).
 *
 * VIGTIGT: Denne funktion runder den urundede TOTALSUM én gang og bruges kun på de RÅ stier
 * (EO-inspektionens sammentælling/kontroltabel og beregningsperiode-projektionen). Det
 * AUTORITATIVE midlertidigt EET-FRADRAG bruger IKKE denne funktion – det hentes fra den
 * kanoniske, pr.-periode-afrundede bilagskilde via
 * `sumMidlertidigtEetBeregnetEetKronerForTafRanges`, så fradraget matcher "Midlertidig EET"-
 * bilagets sammentælling bit for bit (jf. `midlertidigtEetBilagGroups.ts`). Bland ikke de to:
 * total-runding her ≠ pr.-periode-runding i bilaget, og dét var netop 42.790/42.791-fejlen.
 */
export const roundIncomeBenefitAmountKroner = (
  typeKey: string,
  amount: number,
  useWholeKronerForMidlertidigtEet: boolean
): number =>
  typeKey === 'midlertidigt_eet' && useWholeKronerForMidlertidigtEet
    ? roundHeleKroner(amount)
    : roundKroner(amount);

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
  const fraIso = coerceToISODateString(row.fraDato);
  const tilIso = coerceToISODateString(row.tilDato);
  if (!fraIso || !tilIso) return null;
  const fra = parseISODate(fraIso);
  const til = parseISODate(tilIso);
  if (!fra || !til) return null;
  if (fra > til) return null;
  return {
    start: createDate(fra.getUTCFullYear(), fra.getUTCMonth(), fra.getUTCDate()),
    end: createDate(til.getUTCFullYear(), til.getUTCMonth(), til.getUTCDate()),
  };
};

// Opslaget bor i `data/ydelsestyper`, så EO-kontroltabellen forstår en gemt label præcis som
// indtægtssiden gør. Lå de hver sit sted, kunne de to sider af sammentællingen se forskellige
// ydelser – se resolverens egen kommentar.

export const buildTafRanges = (
  values: TafCalculationValues,
  options?: Readonly<{ skadedatoISO?: ISODateString }>
): IsoRange[] => {
  // Tre-trins clamping (jf. eo-snapshot-contract.md §2.3):
  // 1. Clamp mod fejlgivende øvre grænser (differencekrav, endelig EET, og ved skader
  //    opstået før 2011-06-16 tillige midlertidig EET) – validator rapporterer violation
  const constraintSource = { ...values, skadedatoISO: options?.skadedatoISO };
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
  values: TafCalculationValues
): IsoRange | undefined => {
  if (!isISODateString(values.tafBeregningsperiodeFra) || !isISODateString(values.tafBeregningsperiodeTil)) {
    return undefined;
  }
  return validateIsoRange(values.tafBeregningsperiodeFra, values.tafBeregningsperiodeTil);
};

export const buildIncomeSourceRanges = (
  values: TafCalculationValues
): IsoRange[] => {
  const ranges: IsoRange[] = [];

  for (const af of values.loenindkomstAnsaettelsesforhold ?? []) {
    for (const row of af.indtaegtsoplysningerTableData ?? []) {
      if (isLoenRowEffectivelyEmptyForLoenperiode(row, af.loenperiode)) continue;
      const interval = parseAarsloenRowInterval(row, af.loenperiode);
      const fra = interval ? dateToISO(interval.start) : undefined;
      const til = interval ? dateToISO(interval.end) : undefined;
      if (fra && til) ranges.push({ fra, til });
    }
  }

  for (const row of values.offentligeYdelserRows ?? []) {
    const interval = parseOffentligInterval(row);
    const fra = interval ? dateToISO(interval.start) : undefined;
    const til = interval ? dateToISO(interval.end) : undefined;
    if (fra && til) ranges.push({ fra, til });
  }

  return ranges.sort((a, b) => (a.fra < b.fra ? -1 : a.fra > b.fra ? 1 : a.til < b.til ? -1 : a.til > b.til ? 1 : 0));
};

export const buildIncomeInputRanges = (
  values: TafCalculationValues
): IsoRange[] => mergeIsoDateRanges(buildIncomeSourceRanges(values), { mergeAdjacent: true });

const resolveIncomeBounds = (
  values: TafCalculationValues,
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

  const boundsFraCandidates = [rangeBoundFra, intervalBoundFra, offentligIntervalBoundFra, values.tafBeregningsperiodeFra].filter(
    (value): value is ISODateString => isISODateString(value)
  );
  const boundsTilCandidates = [rangeBoundTil, intervalBoundTil, offentligIntervalBoundTil, values.tafBeregningsperiodeTil].filter(
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
  values: TafCalculationValues,
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
        // Hver ferietabel i sin egen periode (`resolveIndkomstFerieperioder`).
        resolveIndkomstFerieperioder(values)
      )
      : new Set<ISODateString>();
  const shDaysForYdelser = buildShDageSetFromIsoRange(bounds.boundsFra, bounds.boundsTil);
  const ansaettelser = values.loenindkomstAnsaettelsesforhold ?? [];
  const loenErrorRowIdsByEmploymentId = new Map<string, ReadonlySet<string>>(
    ansaettelser.map((af) => [af.id, getStandardLoenErrorRowIdSet(af.indtaegtsoplysningerTableData ?? [], af.loenperiode, af.tillaegAngivesSom)])
  );

  return {
    boundsFra: bounds.boundsFra,
    boundsTil: bounds.boundsTil,
    arbejdsdageSet,
    shDaysForYdelser,
    loenErrorRowIdsByEmploymentId,
  };
};

/** Den del af én lønrække, der ligger i perioderne – samme tal, som indgår i ansættelsesforholdets sum. */
export type LoenRowRangeShare = Readonly<{
  employmentIndex: number;
  row: StandardLoenTableRow;
  /** Dage, rækkens beløb fordeles på: arbejdsdage eller kalenderdage efter beregningsenheden. */
  allocationDayCount: number;
  /** Heraf dage i perioderne. */
  selectedDayCount: number;
  /** Rækken har ingen arbejdsdage og fordeles på fald-tilbage-dage (periodisering-contract.md §3A). */
  usesFallbackDays: boolean;
  projected: StandardLoenProjectedAmounts;
}>;

/** Den del af én ydelsesrække, der ligger i perioderne. */
export type YdelseRowRangeShare = Readonly<{
  row: OffentligeYdelserRow;
  typeKey: string;
  label: string;
  /** Rækkens samlede beløb (ydelse + tillæg). */
  amount: number;
  periodiseretAmount: number;
  periodisering: 'kalenderdage' | 'arbejdsdage';
  /** Dage, rækkens beløb fordeles på, og heraf dagene i perioderne. */
  periodiseringsDage: number;
  overlapDage: number;
  usesFallbackDays: boolean;
}>;

export type IncomeRowRangeShares = Readonly<{
  loenRows: readonly LoenRowRangeShare[];
  ydelseRows: readonly YdelseRowRangeShare[];
}>;

/**
 * Hver løn- og ydelsesrækkes andel i perioderne – rækkerne bag `buildIncomeForRanges`' summer.
 *
 * Beregningen summerer netop disse andele, og bilagets linje om delvist medregnede perioder (BB-293) læser dem
 * herfra. Der er derfor kun én fordelingsregel: linjen kan ikke vise et andet antal dage eller et andet beløb, end
 * beregningen bruger. Kun rækker med mindst én dag i perioderne kommer med.
 */
export const buildIncomeRowSharesForRanges = (
  values: TafCalculationValues,
  rawRanges: readonly IsoRange[],
  context?: IncomeCalculationContext | null,
  skadedato?: ISODateString
): IncomeRowRangeShares => {
  const ranges = mergeIsoDateRanges(rawRanges, { mergeAdjacent: true });
  const areRangesDisjoint = ranges.every((range, index) => {
    const previousRange = index === 0 ? undefined : ranges[index - 1];
    return previousRange ? previousRange.til < range.fra : true;
  });
  if (ranges.length === 0 || !areRangesDisjoint) return { loenRows: [], ydelseRows: [] };
  return buildIncomeRowSharesForMergedRanges(values, ranges, context, skadedato);
};

const buildIncomeRowSharesForMergedRanges = (
  values: TafCalculationValues,
  ranges: readonly IsoRange[],
  context: IncomeCalculationContext | null | undefined,
  skadedato: ISODateString | undefined
): IncomeRowRangeShares => {
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
      ansaettelser.map((af) => [af.id, getStandardLoenErrorRowIdSet(af.indtaegtsoplysningerTableData ?? [], af.loenperiode, af.tillaegAngivesSom)])
    );

  const buildAllocationDates = (
    interval: DateInterval
  ): Readonly<{ dates: readonly ISODateString[]; usesFallbackDays: boolean }> => {
    const allocationDates: ISODateString[] = [];
    iterateDatesInclusive(interval.start, interval.end, (date) => {
      const iso = dateToISO(date);
      if (!iso) return;
      if (beregningsenhed === TAF_BEREGNES_SOM.ARBEJDSDAGE && !arbejdsdageSet.has(iso)) return;
      allocationDates.push(iso);
    });
    if (allocationDates.length === 0 && beregningsenhed === TAF_BEREGNES_SOM.ARBEJDSDAGE) {
      // Fald-tilbage: en lønperiode der udelukkende består af feriedage har ingen arbejdsdage at
      // fordele på. Indkomsten må ikke forsvinde – fordel på fald-tilbage-dage, så beløbet fanges.
      // Dagene tælles ALDRIG som arbejdsdage (nævneren `arbejdsdageSet` er uændret; denne fald-tilbage
      // gælder kun beløbsfordelingen for netop denne post). Jf. periodisering-contract.md §3A.
      const fraISO = dateToISO(interval.start);
      const tilISO = dateToISO(interval.end);
      if (fraISO && tilISO) {
        return {
          dates: Array.from(buildFallbackAllocationDaysForInterval({ fra: fraISO, til: tilISO })).sort(),
          usesFallbackDays: true,
        };
      }
    }
    return { dates: allocationDates, usesFallbackDays: false };
  };

  const loenRows: LoenRowRangeShare[] = [];
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
    for (const row of af.indtaegtsoplysningerTableData ?? []) {
      if (classifyLoenRow(row) !== 'valid') continue;
      const interval = parseAarsloenRowInterval(row, af.loenperiode);
      if (!interval) continue; // defensiv: eligibility 'valid' kræver interval
      const fra = dateToISO(interval.start);
      const til = dateToISO(interval.end);
      const allocation = buildAllocationDates(interval);
      if (allocation.dates.length === 0) continue;
      const selectedDates = allocation.dates.filter((iso) => isDateInRanges(iso, ranges));
      if (selectedDates.length === 0) continue;

      const projected = calculateStandardLoenProjectedAmounts(row, satser, {
        loenperiode: af.loenperiode,
        allocationDates: allocation.dates,
        selectedDates,
        mode: af.tillaegAngivesSom,
        rateSegments: fra && til
          ? buildLoenindkomstRateSegments({
            ansaettelsesforhold: af,
            skadedato,
            fra,
            til,
          })
          : undefined,
      });
      loenRows.push({
        employmentIndex: index,
        row,
        allocationDayCount: allocation.dates.length,
        selectedDayCount: selectedDates.length,
        usesFallbackDays: allocation.usesFallbackDays,
        projected,
      });
    }
  }

  const classifyOffentligRow = (row: OffentligeYdelserRow): RowEligibility => {
    const hasAnyFilled =
      row.fraDato !== undefined ||
      row.tilDato !== undefined ||
      (row.ydelsestype?.trim() ?? '') !== '' ||
      row.ydelse !== undefined ||
      row.tillaeg !== undefined;
    if (!hasAnyFilled) return 'empty';
    // NOTE: Fail-closed efter design.
    // Offentlige ydelser indgår kun med udfyldt ydelsestype og gyldig periode.
    if ((row.ydelsestype?.trim() ?? '') === '') return 'invalid';
    const interval = parseOffentligInterval(row);
    if (!interval) return 'invalid';
    return 'valid';
  };
  const ydelseRows: YdelseRowRangeShare[] = [];
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
    // Negative ydelser regnes med som negative lønrækker (BB-290); kun 0 kr. bidrager intet.
    if (!Number.isFinite(amount) || amount === 0) continue;
    const resolvedType = resolveYdelsestype(row.ydelsestype?.trim() ?? '');
    if (!resolvedType) continue;
    const periodiseringsGrundlag = buildOffentligYdelsePeriodiseringsGrundlag({
      interval,
      periodisering: resolvedType.config.periodisering,
      ydelsestypeKey: resolvedType.key,
      shDays: shDaysForYdelser,
      sygedagpengeShCutoff: SYGEDAGPENGE_SH_CUTOFF,
    });
    if (!periodiseringsGrundlag) continue;
    const periodiseretAmount = ranges.reduce((sum, range) => {
      return sum + periodiserBeloebForOffentligYdelseMedGrundlag({
        totalBeloeb: amount,
        range,
        grundlag: periodiseringsGrundlag,
      });
    }, 0);
    if (!Number.isFinite(periodiseretAmount) || isEffectivelyZero(periodiseretAmount)) continue;
    ydelseRows.push({
      row,
      typeKey: resolvedType.key,
      label: resolvedType.config.label,
      amount,
      periodiseretAmount,
      periodisering: periodiseringsGrundlag.periodisering,
      periodiseringsDage: periodiseringsGrundlag.periodiseringsDage,
      overlapDage: ranges.reduce(
        (sum, range) => sum + countOffentligYdelseOverlapDage({ range, grundlag: periodiseringsGrundlag }),
        0
      ),
      usesFallbackDays: periodiseringsGrundlag.fallbackAllocationDays !== undefined,
    });
  }

  return { loenRows, ydelseRows };
};

export const buildIncomeForRanges = (
  values: TafCalculationValues,
  rawRanges: readonly IsoRange[],
  context?: IncomeCalculationContext | null,
  skadedato?: ISODateString
): IncomePeriodResult => {
  const { employers, benefits } = buildIncomeForRangesDetailed(values, rawRanges, context, skadedato);
  return { employers, benefits };
};

/** Som `buildIncomeForRanges`, men med de kilder, der samlet er negative i perioden (BB-290). */
export const buildIncomeForRangesDetailed = (
  values: TafCalculationValues,
  rawRanges: readonly IsoRange[],
  context?: IncomeCalculationContext | null,
  skadedato?: ISODateString
): IncomePeriodResultDetailed => {
  const ranges = mergeIsoDateRanges(rawRanges, { mergeAdjacent: true });
  if (ranges.length === 0) return { employers: [], benefits: [], negativeSources: [] };
  const areRangesDisjoint = ranges.every((range, index) => {
    if (index === 0) return true;
    const previousRange = ranges[index - 1];
    return previousRange ? previousRange.til < range.fra : true;
  });
  if (!areRangesDisjoint) {
    // NOTE: Fail-closed efter design.
    // Uventede overlappende ranges må ikke kunne give dobbelttælling.
    if (import.meta.env.DEV) {
      console.warn('Indkomstberegning: overlap i beregnings-ranges; beregning afbrydes fail-closed.');
    }
    return { employers: [], benefits: [], negativeSources: [] };
  }
  const ansaettelser = values.loenindkomstAnsaettelsesforhold ?? [];
  const shares = buildIncomeRowSharesForMergedRanges(values, ranges, context, skadedato);
  const employers: IncomeEmployerAmount[] = [];
  const negativeSources: IncomeNegativeSource[] = [];

  for (let index = 0; index < ansaettelser.length; index += 1) {
    const af = ansaettelser[index];
    const breakdown = { loenPlusLoen2: 0, loenPlusLoen2PlusIkkePensLoen: 0, fpFvShSo: 0, pension: 0, atp: 0, samlet: 0 };
    for (const share of shares.loenRows) {
      if (share.employmentIndex !== index) continue;
      const projected = share.projected;
      if (
        !Number.isFinite(projected.loenPlusLoen2) ||
        !Number.isFinite(projected.loenPlusLoen2PlusIkkePensLoen) ||
        !Number.isFinite(projected.fpFvShSo) ||
        !Number.isFinite(projected.pension) ||
        !Number.isFinite(projected.atp) ||
        !Number.isFinite(projected.samlet)
      ) {
        continue;
      }
      // En negativ række (en tilbagebetaling, en efterregulering) regnes med og modregnes i ansættelsesforholdets
      // øvrige løn (udviklerafgørelse 2026-10-19, BB-290). Før sprang `samletContrib <= 0` den over, mens
      // kontroltabellen talte den med, så opgørelsen standsede med «kontroluoverensstemmelser». En række på 0 kr.
      // bidrager med 0 og er uændret.
      breakdown.loenPlusLoen2 += projected.loenPlusLoen2;
      breakdown.loenPlusLoen2PlusIkkePensLoen += projected.loenPlusLoen2PlusIkkePensLoen;
      breakdown.fpFvShSo += projected.fpFvShSo;
      breakdown.pension += projected.pension;
      breakdown.atp += projected.atp;
      breakdown.samlet += projected.samlet;
    }
    if (Number.isFinite(breakdown.samlet) && !isEffectivelyZero(breakdown.samlet)) {
      const name = (af.navnPaaArbejdssted ?? '').trim();
      if (breakdown.samlet > 0) {
        employers.push({ id: af.id, index, name, amount: breakdown.samlet, breakdown });
      } else {
        negativeSources.push({ kind: 'employer', id: af.id, index, name, amount: breakdown.samlet });
      }
    }
  }

  const benefitsMap = new Map<string, { label: string; typeKey: string; amount: number }>();
  for (const share of shares.ydelseRows) {
    // NOTE: Fail-closed semantics kræver sporbar aggregation.
    // Rækker uden type må ikke sammenklappes via label.
    const key = share.typeKey !== '' ? `type:${share.typeKey}` : `row:${share.row.id}`;
    const existing = benefitsMap.get(key);
    if (existing) {
      existing.amount += share.periodiseretAmount;
    } else {
      benefitsMap.set(key, { label: share.label, typeKey: share.typeKey, amount: share.periodiseretAmount });
    }
  }

  const benefits: IncomeBenefitAmount[] = [];
  for (const entry of benefitsMap.values()) {
    if (isEffectivelyZero(entry.amount)) continue;
    if (entry.amount > 0) {
      benefits.push({ typeKey: entry.typeKey, label: entry.label, amount: entry.amount });
    } else {
      negativeSources.push({ kind: 'benefit', typeKey: entry.typeKey, label: entry.label, amount: entry.amount });
    }
  }

  return { employers, benefits, negativeSources };
};
