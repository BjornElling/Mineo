import type { ISODateString } from '../../../types/branded';
import type { ErstatningsopgoerelseValues } from '../../../schemas/formSchemas';
import { buildBeregningsperiodeRange, buildTafRanges } from '../helpers/indtaegtPerioder';
import { erDetteFoersteErstatningsopgoerelse } from '../validation/eoNummerValidering';

type EoBilagLoenindkomstOgOffentligeYdelserIndgaar = ErstatningsopgoerelseValues['eoBilagLoenindkomstOgOffentligeYdelserIndgaar'];

export type IsoRange = Readonly<{ fra: ISODateString; til: ISODateString }>;

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
