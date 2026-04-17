import type { StandardLoenTableRow, Loenperiode } from '../../schemas/formSchemas';
import type { ISODateString } from '../../types/branded';
import { parseAmount, parsePercentToDecimal } from '../../utils/numberParsing';
import { roundByMethod } from '../../utils/rounding';
import { parseAarsloenRowInterval } from '../erstatningsopgoerelse/helpers/aarsloenRowInterval';
import { dateToISO, parseISODate } from '../../types/branded';
import { countInclusiveUtcDays } from '../../utils/utcDayMath';
import { isAmountValueStrict } from '../../utils/tableValidationCommon';

export type StandardLoenSatserInput = {
  feriePct?: string | number;
  fritvalgPct?: string | number;
  shSoPct?: string | number;
  storeBededagPct?: string | number;
  pensionPct?: string | number;
};

export type StandardLoenRateSegment = Readonly<{
  fra: ISODateString;
  til: ISODateString;
  satser: StandardLoenSatserInput;
}>;

export type StandardLoenRowDerived = {
  loenPlusLoen2: number;
  loenPlusLoen2PlusIkkePensLoen: number;
  fpFvShSo: number;
  pension: number;
  samlet: number;
};

export type StandardLoenProjectedAmounts = Readonly<{
  grundloen: number;
  tillaeg: number;
  ikkePensionsgivende: number;
  atp: number;
  loenPlusLoen2: number;
  loenPlusLoen2PlusIkkePensLoen: number;
  fpFvShSo: number;
  pension: number;
  samlet: number;
}>;

export const roundStandardLoenAmountToTwoDecimals = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  return roundByMethod(value, 2, 'halfAwayFromZero');
};

const roundStandardLoenDerivedToTwoDecimals = (
  derived: StandardLoenRowDerived
): StandardLoenRowDerived => ({
  loenPlusLoen2: roundStandardLoenAmountToTwoDecimals(derived.loenPlusLoen2),
  loenPlusLoen2PlusIkkePensLoen: roundStandardLoenAmountToTwoDecimals(derived.loenPlusLoen2PlusIkkePensLoen),
  fpFvShSo: roundStandardLoenAmountToTwoDecimals(derived.fpFvShSo),
  pension: roundStandardLoenAmountToTwoDecimals(derived.pension),
  samlet: roundStandardLoenAmountToTwoDecimals(derived.samlet),
});

export const isStandardLoenTableCellEffectivelyEmpty = (value: unknown): boolean => {
  if (value === undefined || value === null) return true;
  if (isAmountValueStrict(value)) {
    if (!Number.isFinite(value.value)) return true;
    if (value.value === 0) return true;
    return value.kind === 'expression' && value.expression.trim() === '';
  }
  if (typeof value === 'number') return !Number.isFinite(value) || value === 0;
  if (typeof value !== 'string') return false;
  return value.trim() === '';
};

export const calculateStandardLoenDerivedFromAmounts = (
  amounts: Readonly<{
    loen: number;
    loen2: number;
    ikkePensionsgivende: number;
    atp: number;
  }>,
  satser: StandardLoenSatserInput
): StandardLoenRowDerived => {
  const ferie = parsePercentToDecimal(satser.feriePct);
  const fritvalg = parsePercentToDecimal(satser.fritvalgPct);
  const shSo = parsePercentToDecimal(satser.shSoPct);
  const storeBededag = parsePercentToDecimal(satser.storeBededagPct);
  const pensionPct = parsePercentToDecimal(satser.pensionPct);

  const totalPct = ferie + fritvalg + shSo + storeBededag;
  const loenPlusLoen2 = amounts.loen + amounts.loen2;
  const loenPlusLoen2PlusIkkePensLoen = loenPlusLoen2 + amounts.ikkePensionsgivende;

  // FP/FV/SH/SO/St.B. beregnes af Løn + Løn(2) + ikke-pensionsgivende løn.
  const fpFvShSo = totalPct > 0 ? loenPlusLoen2PlusIkkePensLoen * totalPct : 0;

  // Pensionsgrundlaget er Løn + Løn(2), opregnet med de samlede tillægsprocenter.
  const pension = pensionPct > 0 ? loenPlusLoen2 * (1 + totalPct) * pensionPct : 0;

  // ATP er et tillæg, som lægges til til sidst (ingen afledte ydelser beregnes af ATP).
  const samlet = loenPlusLoen2PlusIkkePensLoen + fpFvShSo + pension + amounts.atp;

  return { loenPlusLoen2, loenPlusLoen2PlusIkkePensLoen, fpFvShSo, pension, samlet };
};

const resolveRowAmounts = (row: StandardLoenTableRow) => ({
  loen: parseAmount(row.col2),
  loen2: parseAmount(row.col3),
  ikkePensionsgivende: parseAmount(row.col4),
  atp: parseAmount(row.col5),
});

const getSegmentOverlapDays = (
  segment: StandardLoenRateSegment,
  rowFra: ISODateString,
  rowTil: ISODateString
): number => {
  const overlapFra = segment.fra > rowFra ? segment.fra : rowFra;
  const overlapTil = segment.til < rowTil ? segment.til : rowTil;
  if (overlapFra > overlapTil) return 0;
  const overlapFraDate = parseISODate(overlapFra);
  const overlapTilDate = parseISODate(overlapTil);
  if (!overlapFraDate || !overlapTilDate) return 0;
  return countInclusiveUtcDays(overlapFraDate, overlapTilDate) ?? 0;
};

const buildZeroProjectedAmounts = (): StandardLoenProjectedAmounts => ({
  grundloen: 0,
  tillaeg: 0,
  ikkePensionsgivende: 0,
  atp: 0,
  loenPlusLoen2: 0,
  loenPlusLoen2PlusIkkePensLoen: 0,
  fpFvShSo: 0,
  pension: 0,
  samlet: 0,
});

const resolveSatserForDate = (
  iso: ISODateString,
  fallbackSatser: StandardLoenSatserInput,
  rateSegments: readonly StandardLoenRateSegment[]
): StandardLoenSatserInput => {
  if (rateSegments.length === 0) return fallbackSatser;
  const matchingSegment = rateSegments.find((segment) => iso >= segment.fra && iso <= segment.til);
  return matchingSegment?.satser ?? fallbackSatser;
};

export const calculateStandardLoenProjectedAmounts = (
  row: StandardLoenTableRow,
  satser: StandardLoenSatserInput,
  options: Readonly<{
    loenperiode: Loenperiode;
    allocationDates: readonly ISODateString[];
    selectedDates?: readonly ISODateString[];
    rateSegments?: readonly StandardLoenRateSegment[];
  }>
): StandardLoenProjectedAmounts => {
  const interval = parseAarsloenRowInterval(row, options.loenperiode);
  if (!interval) return buildZeroProjectedAmounts();

  const amounts = resolveRowAmounts(row);
  const allocationDates = Array.from(new Set(options.allocationDates)).filter((iso) => {
    const date = parseISODate(iso);
    return date ? date >= interval.start && date <= interval.end : false;
  });
  if (allocationDates.length === 0) return buildZeroProjectedAmounts();

  const selectedDateSet = new Set(options.selectedDates ?? allocationDates);
  const selectedDates = allocationDates.filter((iso) => selectedDateSet.has(iso));
  if (selectedDates.length === 0) return buildZeroProjectedAmounts();

  const rateSegments = options.rateSegments ?? [];
  const dailyAmounts = {
    loen: amounts.loen / allocationDates.length,
    loen2: amounts.loen2 / allocationDates.length,
    ikkePensionsgivende: amounts.ikkePensionsgivende / allocationDates.length,
    atp: amounts.atp / allocationDates.length,
  };

  let grundloen = 0;
  let tillaeg = 0;
  let ikkePensionsgivende = 0;
  let atp = 0;
  let loenPlusLoen2 = 0;
  let loenPlusLoen2PlusIkkePensLoen = 0;
  let fpFvShSo = 0;
  let pension = 0;
  let samlet = 0;

  for (const iso of selectedDates) {
    const derived = calculateStandardLoenDerivedFromAmounts(
      dailyAmounts,
      resolveSatserForDate(iso, satser, rateSegments)
    );
    grundloen += dailyAmounts.loen;
    tillaeg += dailyAmounts.loen2;
    ikkePensionsgivende += dailyAmounts.ikkePensionsgivende;
    atp += dailyAmounts.atp;
    loenPlusLoen2 += derived.loenPlusLoen2;
    loenPlusLoen2PlusIkkePensLoen += derived.loenPlusLoen2PlusIkkePensLoen;
    fpFvShSo += derived.fpFvShSo;
    pension += derived.pension;
    samlet += derived.samlet;
  }

  return {
    grundloen,
    tillaeg,
    ikkePensionsgivende,
    atp,
    loenPlusLoen2,
    loenPlusLoen2PlusIkkePensLoen,
    fpFvShSo,
    pension,
    samlet,
  };
};

export const calculateStandardLoenRowDerived = (
  row: StandardLoenTableRow,
  satser: StandardLoenSatserInput,
  options?: Readonly<{
    loenperiode?: Loenperiode;
    rateSegments?: readonly StandardLoenRateSegment[];
  }>
): StandardLoenRowDerived => {
  const amounts = resolveRowAmounts(row);
  const rateSegments = options?.rateSegments ?? [];
  if (!options?.loenperiode || rateSegments.length === 0) {
    return calculateStandardLoenDerivedFromAmounts(amounts, satser);
  }

  const interval = parseAarsloenRowInterval(row, options.loenperiode);
  const rowFra = interval ? dateToISO(interval.start) : undefined;
  const rowTil = interval ? dateToISO(interval.end) : undefined;
  if (!rowFra || !rowTil) {
    return calculateStandardLoenDerivedFromAmounts(amounts, satser);
  }

  const rowFraDate = parseISODate(rowFra);
  const rowTilDate = parseISODate(rowTil);
  const totalDays = rowFraDate && rowTilDate ? (countInclusiveUtcDays(rowFraDate, rowTilDate) ?? 0) : 0;
  if (totalDays <= 0) {
    return calculateStandardLoenDerivedFromAmounts(amounts, satser);
  }

  const resolvedSegments = rateSegments
    .map((segment) => ({
      segment,
      overlapDays: getSegmentOverlapDays(segment, rowFra, rowTil),
    }))
    .filter((entry) => entry.overlapDays > 0);

  if (resolvedSegments.length === 0) {
    return calculateStandardLoenDerivedFromAmounts(amounts, satser);
  }

  let loenPlusLoen2 = 0;
  let loenPlusLoen2PlusIkkePensLoen = 0;
  let fpFvShSo = 0;
  let pension = 0;
  let samlet = 0;

  for (const entry of resolvedSegments) {
    const share = entry.overlapDays / totalDays;
    const segmentAmounts = {
      loen: amounts.loen * share,
      loen2: amounts.loen2 * share,
      ikkePensionsgivende: amounts.ikkePensionsgivende * share,
      atp: amounts.atp * share,
    };
    const derived = calculateStandardLoenDerivedFromAmounts(segmentAmounts, entry.segment.satser);
    loenPlusLoen2 += derived.loenPlusLoen2;
    loenPlusLoen2PlusIkkePensLoen += derived.loenPlusLoen2PlusIkkePensLoen;
    fpFvShSo += derived.fpFvShSo;
    pension += derived.pension;
    samlet += derived.samlet;
  }

  // Segmentflowet introducerer brøkandele af ellers hele beløb. Vi afrunder først
  // efter den samlede segment-summering, så én lønrække fortsat ender i den
  // kanoniske 2-decimal beløbssemantik uden præafrunding af delsegmenter.
  return roundStandardLoenDerivedToTwoDecimals({
    loenPlusLoen2,
    loenPlusLoen2PlusIkkePensLoen,
    fpFvShSo,
    pension,
    samlet,
  });
};

const PERIOD_KEYS_BY_LOENPERIODE: Readonly<Record<Loenperiode, readonly (keyof StandardLoenTableRow)[]>> = {
  maaned: ['col0_maaned', 'col1_maaned'],
  uge: ['col0_uge', 'col1_uge'],
  dag: ['col0_dag', 'col1_dag'],
};

const AMOUNT_KEYS: readonly (keyof StandardLoenTableRow)[] = [
  'col2',
  'col3',
  'col4',
  'col5',
];

export const isStandardLoenRowEffectivelyEmpty = (
  row: StandardLoenTableRow,
  loenperiode?: Loenperiode
): boolean => {
  const editableKeys = loenperiode
    ? [...PERIOD_KEYS_BY_LOENPERIODE[loenperiode], ...AMOUNT_KEYS]
    : [...PERIOD_KEYS_BY_LOENPERIODE.maaned, ...PERIOD_KEYS_BY_LOENPERIODE.uge, ...PERIOD_KEYS_BY_LOENPERIODE.dag, ...AMOUNT_KEYS];

  for (const key of editableKeys) {
    const value = row[key];
    if (!isStandardLoenTableCellEffectivelyEmpty(value)) return false;
  }
  return true;
};

export const hasCompletePeriodForLoenperiode = (row: StandardLoenTableRow, loenperiode: Loenperiode): boolean => {
  if (loenperiode === 'maaned') return !isStandardLoenTableCellEffectivelyEmpty(row.col0_maaned) && !isStandardLoenTableCellEffectivelyEmpty(row.col1_maaned);
  if (loenperiode === 'uge') return !isStandardLoenTableCellEffectivelyEmpty(row.col0_uge) && !isStandardLoenTableCellEffectivelyEmpty(row.col1_uge);
  return !isStandardLoenTableCellEffectivelyEmpty(row.col0_dag) && !isStandardLoenTableCellEffectivelyEmpty(row.col1_dag);
};

export const hasAtLeastOneValidRow = (rows: readonly StandardLoenTableRow[], loenperiode: Loenperiode, satser: StandardLoenSatserInput): boolean => {
  return rows.some((row) => {
    if (!hasCompletePeriodForLoenperiode(row, loenperiode)) return false;
    return calculateStandardLoenRowDerived(row, satser).samlet !== 0;
  });
};
