import type {
  AarsloenTableRow,
  ErstatningsopgoerelseValues,
  Loenperiode,
  OffentligeYdelserRow,
} from '../../schemas/formSchemas';
import type { ISODateString } from '../../types/branded';
import { amountValueToNumber } from '../../utils/expressionAmount';
import { isAarsloenRowEffectivelyEmpty } from '../../utils/aarsloenTableCalculations';
import { getOffentligeYdelserRowFilledState } from '../../utils/offentligeYdelserTableValidation';
import { buildBeregningsperiodeRange, buildIncomeForRanges, buildTafRanges, parseAarsloenRowInterval } from './indtaegtPerioder';
import { resolveLoenudviklingKilde } from './angivetLoenHelpers';
import type { IsoRange } from './periodRangeGroups';
import { parseDanishToIso, parseOptionalIsoDate } from './sharedPdfUtils';

type BilagLoenindkomstOgOffentligeYdelserIndgaar =
  ErstatningsopgoerelseValues['eoBilagLoenindkomstOgOffentligeYdelserIndgaar'];

// Overlap er inklusiv begge endepunkter.
const isIsoRangeOverlap = (a: IsoRange, b: IsoRange): boolean => a.fra <= b.til && b.fra <= a.til;

export const buildBilagIndkomstYdelserRanges = (
  eoValues: ErstatningsopgoerelseValues,
  mode: BilagLoenindkomstOgOffentligeYdelserIndgaar
): readonly IsoRange[] => {
  if (mode === 'Alle') return [];
  // "Perioden" skal følge de aktuelle TAF-perioder (clampet til gældende bounds).
  // Hvis der ingen TAF-perioder er, returneres tom liste.
  return buildTafRanges(eoValues);
};

const shouldIncludeByBilagRanges = (
  mode: BilagLoenindkomstOgOffentligeYdelserIndgaar,
  ranges: readonly IsoRange[],
  rowRange: IsoRange | null
): boolean => {
  // NOTE: Fail-closed by design.
  // Rækker uden gyldigt dato-interval medtages aldrig i PDF-bilag.
  if (!rowRange) return false;
  if (mode === 'Alle') return true;
  // NOTE: Fail-closed by design.
  // Når "Perioden" er valgt uden gyldige bilag-ranges, medtages ingen rækker.
  if (ranges.length === 0) return false;
  return ranges.some((range) => isIsoRangeOverlap(rowRange, range));
};

export const hasAarsloenRowOverlapWithRanges = (
  row: AarsloenTableRow,
  loenperiode: Loenperiode,
  mode: BilagLoenindkomstOgOffentligeYdelserIndgaar,
  ranges: readonly IsoRange[]
): boolean => {
  const interval = parseAarsloenRowInterval(row, loenperiode);
  if (!interval) return shouldIncludeByBilagRanges(mode, ranges, null);
  const fra = parseOptionalIsoDate(
    `${interval.start.getUTCFullYear()}-${String(interval.start.getUTCMonth() + 1).padStart(2, '0')}-${String(interval.start.getUTCDate()).padStart(2, '0')}`
  );
  const til = parseOptionalIsoDate(
    `${interval.end.getUTCFullYear()}-${String(interval.end.getUTCMonth() + 1).padStart(2, '0')}-${String(interval.end.getUTCDate()).padStart(2, '0')}`
  );
  if (!fra || !til || fra > til) return shouldIncludeByBilagRanges(mode, ranges, null);
  const rowRange: IsoRange = { fra, til };
  return shouldIncludeByBilagRanges(mode, ranges, rowRange);
};

export const hasOffentligYdelseRowOverlapWithRanges = (
  row: OffentligeYdelserRow,
  mode: BilagLoenindkomstOgOffentligeYdelserIndgaar,
  ranges: readonly IsoRange[]
): boolean => {
  const fra = parseDanishToIso(row.fraDato);
  const til = parseDanishToIso(row.tilDato);
  if (!fra || !til || fra > til) return shouldIncludeByBilagRanges(mode, ranges, null);
  const rowRange: IsoRange = { fra, til };
  return shouldIncludeByBilagRanges(mode, ranges, rowRange);
};

const isOffentligeYdelserRowEmpty = (row: OffentligeYdelserRow): boolean => {
  return !getOffentligeYdelserRowFilledState(row).hasAnyFilled;
};

export const hasNonZeroLoenAmount = (value: AarsloenTableRow['col2']): boolean => {
  const numeric = amountValueToNumber(value);
  return numeric !== undefined;
};

export const shouldIncludeLoenRowInBilag = (params: Readonly<{
  row: AarsloenTableRow;
  loenperiode: Loenperiode;
  mode: BilagLoenindkomstOgOffentligeYdelserIndgaar;
  ranges: readonly IsoRange[];
  errorRowIds: ReadonlySet<string>;
}>): boolean => {
  const { row, loenperiode, mode, ranges, errorRowIds } = params;
  if (isAarsloenRowEffectivelyEmpty(row)) return false;
  // NOTE: Fail-closed by design.
  // PDF må kun vise rækker uden valideringsfejl.
  if (errorRowIds.has(row.id)) return false;
  const hasAnyIncomeInput =
    hasNonZeroLoenAmount(row.col2) ||
    hasNonZeroLoenAmount(row.col3) ||
    hasNonZeroLoenAmount(row.col4) ||
    hasNonZeroLoenAmount(row.col5);
  if (!hasAnyIncomeInput) return false;
  return hasAarsloenRowOverlapWithRanges(row, loenperiode, mode, ranges);
};

export const shouldIncludeOffentligYdelseRowInBilag = (params: Readonly<{
  row: OffentligeYdelserRow;
  mode: BilagLoenindkomstOgOffentligeYdelserIndgaar;
  ranges: readonly IsoRange[];
  errorRowIds: ReadonlySet<string>;
}>): boolean => {
  const { row, mode, ranges, errorRowIds } = params;
  if (isOffentligeYdelserRowEmpty(row)) return false;
  // NOTE: Fail-closed by design.
  // PDF må kun vise rækker uden valideringsfejl.
  if (errorRowIds.has(row.id)) return false;
  const hasAnyAmountInput =
    amountValueToNumber(row.ydelse) !== undefined ||
    amountValueToNumber(row.tillaeg) !== undefined;
  if (!hasAnyAmountInput) return false;
  return hasOffentligYdelseRowOverlapWithRanges(row, mode, ranges);
};

export const shouldIncludeReguleringBilag = (
  eoValues: ErstatningsopgoerelseValues
): boolean => {
  if (eoValues.beregnesUdFra === 'Beregningsperiode') {
    const beregningsperiodeRange = buildBeregningsperiodeRange(eoValues);
    if (!beregningsperiodeRange) return true;

    const income = buildIncomeForRanges(eoValues, [beregningsperiodeRange]);
    const employerIdsWithIncome = new Set(income.employers.map((entry) => entry.id));
    const reguleringskilder = resolveLoenudviklingKilde(eoValues);
    const kilderMedIndkomst = reguleringskilder.filter((kilde) => employerIdsWithIncome.has(kilde.id));
    if (kilderMedIndkomst.length === 0) return true;
    const alleIngen = kilderMedIndkomst.every((kilde) => kilde.loenudviklingBeregningsgrundlag === 'Ingen');
    return !alleIngen;
  }

  if (eoValues.beregnesUdFra === 'Angivet månedsløn' || eoValues.beregnesUdFra === 'Angivet dagsløn') {
    return eoValues.eoAngivetLoenLoenudvikling.loenudviklingBeregningsgrundlag !== 'Ingen';
  }

  return true;
};
