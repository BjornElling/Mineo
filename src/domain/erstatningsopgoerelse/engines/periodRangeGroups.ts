import type { ISODateString } from '../../../types/branded';
import type { ErstatningsopgoerelseValues } from '../../../schemas/formSchemas';
import { buildBeregningsperiodeRange, buildTafRanges } from '../helpers/indtaegtPerioder';
import { erDetteFoersteErstatningsopgoerelse } from '../validation/eoNummerValidering';

type EoBilagLoenindkomstOgOffentligeYdelserIndgaar = ErstatningsopgoerelseValues['eoBilagLoenindkomstOgOffentligeYdelserIndgaar'];

export type IsoRange = Readonly<{ fra: ISODateString; til: ISODateString }>;

export type CalendarYearIsoRange = IsoRange & Readonly<{ year: number }>;

export type PeriodRangeGroup = Readonly<{
  label: string | null;
  ranges: readonly IsoRange[];
}>;

export const EO_BILAG_MODE_ALLE = 'Alle' as const;
export const EO_BILAG_MODE_PERIODEN = 'Perioden' as const;

export const normalizeEoBilagIndkomstYdelserMode = (
  mode: EoBilagLoenindkomstOgOffentligeYdelserIndgaar
): typeof EO_BILAG_MODE_ALLE | typeof EO_BILAG_MODE_PERIODEN => {
  return mode === EO_BILAG_MODE_ALLE ? EO_BILAG_MODE_ALLE : EO_BILAG_MODE_PERIODEN;
};

export const splitIsoRangeByCalendarYearsInclusive = (
  fra: ISODateString,
  til: ISODateString
): readonly CalendarYearIsoRange[] => {
  if (fra > til) {
    throw new Error(`splitIsoRangeByCalendarYearsInclusive: fra (${fra}) > til (${til})`);
  }

  const fraYear = Number.parseInt(fra.slice(0, 4), 10);
  const tilYear = Number.parseInt(til.slice(0, 4), 10);
  if (!Number.isInteger(fraYear) || !Number.isInteger(tilYear)) {
    throw new Error('splitIsoRangeByCalendarYearsInclusive: ugyldigt år');
  }

  const result: CalendarYearIsoRange[] = [];
  for (let year = fraYear; year <= tilYear; year += 1) {
    const yearStart = `${year}-01-01` as ISODateString;
    const yearEnd = `${year}-12-31` as ISODateString;
    result.push({
      fra: year === fraYear ? fra : yearStart,
      til: year === tilYear ? til : yearEnd,
      year,
    });
  }
  return result;
};

export const buildPeriodRangeGroups = (
  eoValues: ErstatningsopgoerelseValues,
  mode: EoBilagLoenindkomstOgOffentligeYdelserIndgaar,
  allRanges: readonly IsoRange[]
): readonly PeriodRangeGroup[] => {
  if (mode === EO_BILAG_MODE_ALLE) {
    return [{ label: null, ranges: allRanges }];
  }

  const groups: PeriodRangeGroup[] = [];
  const erFoersteOpgoerelse = erDetteFoersteErstatningsopgoerelse(eoValues.eoNummer);
  const beregningsperiodeRange =
    eoValues.beregnesUdFra === 'Beregningsperiode' ? buildBeregningsperiodeRange(eoValues) : undefined;
  const tafRanges = buildTafRanges(eoValues);

  if (erFoersteOpgoerelse && beregningsperiodeRange) {
    groups.push({ label: 'Beregningsperiode', ranges: [beregningsperiodeRange] });
  }

  if (tafRanges.length > 0) {
    groups.push({ label: 'TAF-periode', ranges: tafRanges });
  }

  return groups;
};
