import type {
  ErstatningsopgoerelseValues,
  LoenindkomstAnsaettelsesforhold,
  StandardLoenTableRow,
} from '../../../schemas/formSchemas';
import { amountValueToNumber } from '../../../utils/expressionAmount';
import { dateToISO, parseISODate, type ISODateString } from '../../../types/branded';
import type { IsoRange } from '../validation/tafPeriodConstraints';
import { parseAarsloenRowInterval } from '../helpers/indtaegtPerioder';
import { TAF_BEREGNES_SOM, type TafBeregningsenhed } from '../helpers/tafBeregningsenhed';
import { optaelArbejdsdage } from './periodiseringsMotor';
import { rangesOverlap } from '../../../utils/closedDateRange';
import {
  buildSingleDateRange,
  clipRangesToInclusiveUpperBound,
  mergeIsoDateRanges,
  subtractIsoDateRanges,
} from './isoRangeAlgebra';

const FOUR_MONTHS_EPSILON = 1e-12;

const dateInMonthFraction = (iso: ISODateString, mode: TafBeregningsenhed): number => {
  const date = parseISODate(iso);
  if (!date) return 0;
  if (mode === TAF_BEREGNES_SOM.MAANEDER) {
    const daysInMonth = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
    return daysInMonth > 0 ? 1 / daysInMonth : 0;
  }
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const monthStart = dateToISO(new Date(Date.UTC(year, month, 1)));
  const monthEnd = dateToISO(new Date(Date.UTC(year, month + 1, 0)));
  if (!monthStart || !monthEnd) return 0;
  const workdays = optaelArbejdsdage({
    fra: monthStart,
    til: monthEnd,
    ferieperioder: [],
    loseFeriedage: 0,
    context: { kind: 'taf' },
  }) ?? 0;
  return workdays > 0 ? 1 / workdays : 0;
};

// Loftet tæller hele sygeforløbet. Fradrag for sygeløn og ferie sker først senere i
// periodepipelinen og må derfor ikke flyttes ind i denne beregning.
export const resolveSfggCapCutoffDate = (
  sortedCountedDates: readonly ISODateString[],
  mode: TafBeregningsenhed
): ISODateString | null => {
  let totalMonths = 0;
  for (const iso of sortedCountedDates) {
    totalMonths += dateInMonthFraction(iso, mode);
    if (totalMonths + FOUR_MONTHS_EPSILON >= 4) return iso;
  }
  return null;
};

export const hasPositiveSfggIncome = (row: StandardLoenTableRow): boolean => {
  const values = [row.col2, row.col3, row.col4, row.col5]
    .map((value) => amountValueToNumber(value))
    .filter((value): value is number => value !== undefined);
  return values.some((value) => value > 0);
};

const buildIncomeExcludedRanges = (employment: LoenindkomstAnsaettelsesforhold): IsoRange[] => {
  const ranges: IsoRange[] = [];
  for (const row of employment.indtaegtsoplysningerTableData ?? []) {
    if (!hasPositiveSfggIncome(row)) continue;
    const interval = parseAarsloenRowInterval(row, employment.loenperiode);
    if (!interval) continue;
    const fra = dateToISO(interval.start);
    const til = dateToISO(interval.end);
    if (fra && til && fra <= til) ranges.push({ fra, til });
  }
  return mergeIsoDateRanges(ranges, { mergeAdjacent: true });
};

const getValidFerieRanges = (
  ferieperioder: ErstatningsopgoerelseValues['ferieperioder']
): IsoRange[] => (ferieperioder ?? [])
  .filter((row): row is (typeof row & { fra: ISODateString; til: ISODateString }) => Boolean(row.fra && row.til))
  .map((row) => ({ fra: row.fra, til: row.til }))
  .filter((range) => range.fra <= range.til);

export type SfggPeriodeAfkortning =
  | Readonly<{ aarsag: 'foersteSygedag' }>
  | Readonly<{ aarsag: 'cap4mdr'; dato: ISODateString }>
  | Readonly<{ aarsag: 'ansaettelsesophoer'; dato: ISODateString }>
  | Readonly<{ aarsag: 'sygeloen' }>;

export type SfggAfkortning = Readonly<{
  aarsag: 'cap4mdr' | 'ansaettelsesophoer';
  verbum: 'bortfaldt' | 'bortfalder';
  dato: ISODateString;
}>;

export type SfggPeriodeComputation = Readonly<{
  /** Efter første dag, loft, ophør og sygeløn, men før feriefradrag. */
  visningsperiode: readonly IsoRange[];
  /** Visningsperioden efter feriefradrag. */
  eligibleRanges: readonly IsoRange[];
  afkortninger: readonly SfggPeriodeAfkortning[];
}>;

/**
 * Den faste rækkefølge er en domæneregel: første sygedag → firemånedersloft →
 * ansættelsesophør → sygeløn → ferie. Ombytning kan ændre både loft og synlig forklaring.
 */
export const buildSfggPeriode = (args: Readonly<{
  tafRanges: readonly IsoRange[];
  firstExcludedDate: ISODateString | null;
  employmentHadFirstExcludedDate: boolean;
  capReachedDate: ISODateString | null;
  ansaettelsesophorDate: ISODateString | null;
  foerstEfterSygeloen: boolean;
  employment: LoenindkomstAnsaettelsesforhold;
  ferieperioder: ErstatningsopgoerelseValues['ferieperioder'];
}>): SfggPeriodeComputation => {
  const afkortninger: SfggPeriodeAfkortning[] = [];
  let ranges: readonly IsoRange[] = [...args.tafRanges];

  if (args.firstExcludedDate && args.employmentHadFirstExcludedDate) {
    ranges = subtractIsoDateRanges(ranges, [buildSingleDateRange(args.firstExcludedDate)]);
    afkortninger.push({ aarsag: 'foersteSygedag' });
  }
  ranges = clipRangesToInclusiveUpperBound(ranges, args.capReachedDate);
  ranges = clipRangesToInclusiveUpperBound(ranges, args.ansaettelsesophorDate);
  if (args.capReachedDate && (!args.ansaettelsesophorDate || args.capReachedDate <= args.ansaettelsesophorDate)) {
    afkortninger.push({ aarsag: 'cap4mdr', dato: args.capReachedDate });
  } else if (args.ansaettelsesophorDate) {
    afkortninger.push({ aarsag: 'ansaettelsesophoer', dato: args.ansaettelsesophorDate });
  }
  if (args.foerstEfterSygeloen) {
    const excludedRanges = buildIncomeExcludedRanges(args.employment);
    const overlaps = excludedRanges.some((excluded) => ranges.some((range) => rangesOverlap(range, excluded)));
    ranges = subtractIsoDateRanges(ranges, excludedRanges);
    if (overlaps) afkortninger.push({ aarsag: 'sygeloen' });
  }
  const visningsperiode = ranges;
  const ferieRanges = mergeIsoDateRanges(getValidFerieRanges(args.ferieperioder), { mergeAdjacent: true });
  return {
    visningsperiode,
    eligibleRanges: subtractIsoDateRanges(visningsperiode, ferieRanges),
    afkortninger,
  };
};
