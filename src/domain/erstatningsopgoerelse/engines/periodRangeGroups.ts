import type { ISODateString } from '../../../types/branded';
import type { ErstatningsopgoerelseValues } from '../../../schemas/formSchemas';
import { buildBeregningsperiodeRange, buildTafRanges } from '../helpers/indtaegtPerioder';
import { erDetteFoersteErstatningsopgoerelse } from '../validation/eoNummerValidering';

type BilagLoenindkomstOgOffentligeYdelserIndgaar = ErstatningsopgoerelseValues['eoBilagLoenindkomstOgOffentligeYdelserIndgaar'];

export type IsoRange = Readonly<{ fra: ISODateString; til: ISODateString }>;

export type PeriodRangeGroup = Readonly<{
  label: string | null;
  ranges: readonly IsoRange[];
}>;

export const BILAG_MODE_ALLE = 'Alle' as const;
export const BILAG_MODE_PERIODEN = 'Perioden' as const;

export const normalizeBilagIndkomstYdelserMode = (
  mode: BilagLoenindkomstOgOffentligeYdelserIndgaar
): typeof BILAG_MODE_ALLE | typeof BILAG_MODE_PERIODEN => {
  return mode === BILAG_MODE_ALLE ? BILAG_MODE_ALLE : BILAG_MODE_PERIODEN;
};

export const buildPeriodRangeGroups = (
  eoValues: ErstatningsopgoerelseValues,
  mode: BilagLoenindkomstOgOffentligeYdelserIndgaar,
  allRanges: readonly IsoRange[]
): readonly PeriodRangeGroup[] => {
  if (mode === BILAG_MODE_ALLE) {
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
