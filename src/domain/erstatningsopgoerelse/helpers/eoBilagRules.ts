import type {
  StandardLoenTableRow,
  ErstatningsopgoerelseValues,
  EoBilagLoenindkomstOgOffentligeYdelserIndgaar,
  Loenperiode,
  OffentligeYdelserRow,
} from '../../../schemas/formSchemas';
import { amountValueToNumber } from '../../../utils/expressionAmount';
import { formatToISO } from '../../../utils/dateFormatting';
import { coerceToISODateString, type ISODateString } from '../../../types/branded';
import { isStandardLoenRowEffectivelyEmpty } from '../../aarsloen/standardLoenRowCalculations';
import { getOffentligeYdelserRowFilledState } from '../validation/offentligeYdelserTableValidation';
import { buildBeregningsperiodeRange, buildIncomeForRanges, buildTafRanges, parseAarsloenRowInterval } from './indtaegtPerioder';
import { resolveLoenudviklingKilde } from './angivetLoenHelpers';
import { buildPeriodRangeGroups, type PeriodRangeGroup, type IsoRange } from '../engines/periodRangeGroups';
import { parseOptionalIsoDate } from '../helpers/eoSharedUtils';
import { computeTafBeregningsenhed, TAF_BEREGNES_SOM } from './tafBeregningsenhed';
import { getOffentligeYdelserErrorRowIdSet, getStandardLoenErrorRowIdSet } from '../validation/indkomstRowValidation';

// Overlap er inklusiv begge endepunkter.
const isIsoRangeOverlap = (a: IsoRange, b: IsoRange): boolean => a.fra <= b.til && b.fra <= a.til;

export const buildEoBilagIndkomstYdelserRanges = (
  eoValues: ErstatningsopgoerelseValues,
  mode: EoBilagLoenindkomstOgOffentligeYdelserIndgaar
): readonly IsoRange[] => {
  if (mode === 'Alle') return [];
  // "Perioden" skal følge de aktuelle TAF-perioder (clampet til gældende bounds).
  // Hvis der ingen TAF-perioder er, returneres tom liste.
  return buildTafRanges(eoValues);
};

const shouldIncludeByEoBilagRanges = (
  mode: EoBilagLoenindkomstOgOffentligeYdelserIndgaar,
  ranges: readonly IsoRange[],
  rowRange: IsoRange | null
): boolean => {
  // NOTE: Fail-closed efter design.
  // Rækker uden gyldigt dato-interval medtages aldrig i PDF-bilag.
  if (!rowRange) return false;
  if (mode === 'Alle') return true;
  // NOTE: Fail-closed efter design.
  // Når "Perioden" er valgt uden gyldige bilag-ranges, medtages ingen rækker.
  if (ranges.length === 0) return false;
  return ranges.some((range) => isIsoRangeOverlap(rowRange, range));
};

export const hasAarsloenRowOverlapWithRanges = (
  row: StandardLoenTableRow,
  loenperiode: Loenperiode,
  mode: EoBilagLoenindkomstOgOffentligeYdelserIndgaar,
  ranges: readonly IsoRange[]
): boolean => {
  const interval = parseAarsloenRowInterval(row, loenperiode);
  if (!interval) return shouldIncludeByEoBilagRanges(mode, ranges, null);
  const fra = parseOptionalIsoDate(formatToISO(interval.start));
  const til = parseOptionalIsoDate(formatToISO(interval.end));
  if (!fra || !til || fra > til) return shouldIncludeByEoBilagRanges(mode, ranges, null);
  const rowRange: IsoRange = { fra, til };
  return shouldIncludeByEoBilagRanges(mode, ranges, rowRange);
};

export const hasOffentligYdelseRowOverlapWithRanges = (
  row: OffentligeYdelserRow,
  mode: EoBilagLoenindkomstOgOffentligeYdelserIndgaar,
  ranges: readonly IsoRange[]
): boolean => {
  const fra = coerceToISODateString(row.fraDato);
  const til = coerceToISODateString(row.tilDato);
  if (!fra || !til || fra > til) return shouldIncludeByEoBilagRanges(mode, ranges, null);
  const rowRange: IsoRange = { fra, til };
  return shouldIncludeByEoBilagRanges(mode, ranges, rowRange);
};

const isOffentligeYdelserRowEmpty = (row: OffentligeYdelserRow): boolean => {
  return !getOffentligeYdelserRowFilledState(row).hasAnyFilled;
};

export const EO_BILAG_DYNAMIC_SELECTION_KEYS = [
  'loenindkomst',
  'offentligeYdelser',
  'midlertidigEet',
  'regulering',
  'shDage',
  'sygeferiegodtgoerelse',
] as const;

export type EoBilagDynamicSelectionKey = (typeof EO_BILAG_DYNAMIC_SELECTION_KEYS)[number];

export type EoBilagAvailabilityState = Readonly<{
  enabled: boolean;
  disabledReason?: string;
}>;

export type EoBilagAvailabilityMap = Readonly<Record<EoBilagDynamicSelectionKey, EoBilagAvailabilityState>>;

const EO_BILAG_PERIOD_FILTER_REASON =
  'Bilag er sat til Perioden, men der findes ingen TAF-perioder at filtrere efter.';

export const shouldRenderEoIndkomstOgYdelserBilag = (
  eoValues: ErstatningsopgoerelseValues,
  mode: EoBilagLoenindkomstOgOffentligeYdelserIndgaar
): boolean => {
  if (mode !== 'Perioden') return true;
  const ranges = buildEoBilagIndkomstYdelserRanges(eoValues, mode);
  return buildPeriodRangeGroups(eoValues, mode, ranges).length > 0;
};

const hasLoenindkomstEoBilagData = (
  values: ErstatningsopgoerelseValues,
  mode: EoBilagLoenindkomstOgOffentligeYdelserIndgaar,
  rangeGroups: readonly PeriodRangeGroup[]
): boolean => {
  return (values.loenindkomstAnsaettelsesforhold ?? []).some((af) => {
    const errorRowIds = getStandardLoenErrorRowIdSet(af.indtaegtsoplysningerTableData ?? [], af.loenperiode);
    return rangeGroups.some((group) =>
      (af.indtaegtsoplysningerTableData ?? []).some((row) => shouldIncludeLoenRowInEoBilag({
        row,
        loenperiode: af.loenperiode,
        mode,
        ranges: group.ranges,
        errorRowIds,
      }))
    );
  });
};

const hasOffentligeYdelserEoBilagData = (
  values: ErstatningsopgoerelseValues,
  mode: EoBilagLoenindkomstOgOffentligeYdelserIndgaar,
  rangeGroups: readonly PeriodRangeGroup[]
): boolean => {
  const errorRowIds = getOffentligeYdelserErrorRowIdSet(values.offentligeYdelserRows ?? []);
  return rangeGroups.some((group) =>
    (values.offentligeYdelserRows ?? []).some((row) => shouldIncludeOffentligYdelseRowInEoBilag({
      row,
      mode,
      ranges: group.ranges,
      errorRowIds,
    }))
  );
};

export const hasMidlertidigtEetYdelsestype = (
  values: Pick<ErstatningsopgoerelseValues, 'offentligeYdelserRows'>
): boolean => {
  return (values.offentligeYdelserRows ?? []).some((row) => row.ydelsestype?.trim() === 'midlertidigt_eet');
};

const hasReguleringSelection = (values: ErstatningsopgoerelseValues): boolean => {
  if (values.beregnesUdFra === 'Beregningsperiode') {
    return (values.loenindkomstAnsaettelsesforhold ?? []).some((af) => {
      const grundlag = af.loenudviklingBeregningsgrundlag;
      return grundlag !== undefined && grundlag !== 'Ingen';
    });
  }

  if (values.beregnesUdFra === 'Angivet månedsløn' || values.beregnesUdFra === 'Angivet dagsløn') {
    const grundlag = values.eoAngivetLoenLoenudvikling.loenudviklingBeregningsgrundlag;
    return grundlag !== undefined && grundlag !== 'Ingen';
  }

  return false;
};

export const hasLoenReguleringEoBilagData = (values: ErstatningsopgoerelseValues): boolean => {
  return hasReguleringSelection(values) && shouldIncludeEoReguleringBilag(values);
};

const hasSygeferiegodtgoerelseEoBilagData = (values: ErstatningsopgoerelseValues): boolean => {
  return (values.sfggAnsaettelsesforhold ?? []).some((row) => {
    const kilde = row.sfggBeregningskilde;
    return kilde !== undefined && kilde !== 'Ingen';
  });
};

export const hasOffentligeYdelserReguleringData = (params: Readonly<{
  values: ErstatningsopgoerelseValues;
  skadedatoISO?: ISODateString | undefined;
}>): boolean => {
  const { values, skadedatoISO } = params;
  if (values.beregnesUdFra !== 'Beregningsperiode') return false;
  if (values.regulerOffentligeYdelser !== 'Ja') return false;
  const beregningsperiodeRange = buildBeregningsperiodeRange(values);
  if (!beregningsperiodeRange) return false;
  const tafRanges = buildTafRanges(values);
  if (tafRanges.length === 0) return false;
  const income = buildIncomeForRanges(values, [beregningsperiodeRange], undefined, skadedatoISO);
  return income.benefits.length > 0;
};

export const getEoBilagAvailability = (params: Readonly<{
  eoValues: ErstatningsopgoerelseValues;
  skadedatoISO?: ISODateString | undefined;
}>): EoBilagAvailabilityMap => {
  const { eoValues, skadedatoISO } = params;
  const eoBilagMode = eoValues.eoBilagLoenindkomstOgOffentligeYdelserIndgaar ?? 'Perioden';
  const eoBilagRanges = buildEoBilagIndkomstYdelserRanges(eoValues, eoBilagMode);
  const eoBilagRangeGroups = buildPeriodRangeGroups(eoValues, eoBilagMode, eoBilagRanges);
  const kanViseIndkomstOgYdelserBilag = shouldRenderEoIndkomstOgYdelserBilag(eoValues, eoBilagMode);
  const tafBeregningsenhed = computeTafBeregningsenhed(eoValues);
  const harLoenindkomst = kanViseIndkomstOgYdelserBilag && hasLoenindkomstEoBilagData(eoValues, eoBilagMode, eoBilagRangeGroups);
  const harOffentligeYdelser = kanViseIndkomstOgYdelserBilag && hasOffentligeYdelserEoBilagData(eoValues, eoBilagMode, eoBilagRangeGroups);
  const harOffentligeYdelserRegulering = hasOffentligeYdelserReguleringData({
    values: eoValues,
    skadedatoISO,
  });
  const harLoenRegulering = hasLoenReguleringEoBilagData(eoValues);
  const harRegulering = harLoenRegulering || harOffentligeYdelserRegulering;
  const harSygeferiegodtgoerelse = hasSygeferiegodtgoerelseEoBilagData(eoValues);
  const midlertidigtEetFraEetSiden = eoValues.midlertidigtEetFraEetSiden === 'Ja';

  return {
    loenindkomst: harLoenindkomst
      ? { enabled: true }
      : {
          enabled: false,
          disabledReason: !kanViseIndkomstOgYdelserBilag
            ? EO_BILAG_PERIOD_FILTER_REASON
            : 'Der er ingen fejlfrie lønrækker med beløb inden for det valgte bilagsfilter.',
        },
    offentligeYdelser: harOffentligeYdelser
      ? { enabled: true }
      : {
          enabled: false,
          disabledReason: !kanViseIndkomstOgYdelserBilag
            ? EO_BILAG_PERIOD_FILTER_REASON
            : 'Der er ingen fejlfrie ydelsesrækker med beløb inden for det valgte bilagsfilter.',
        },
    midlertidigEet: midlertidigtEetFraEetSiden
      ? { enabled: true }
      : {
          enabled: false,
          disabledReason: 'Forudsætter at midlertidigt EET indsættes fra Erhvervsevnetab-siden.',
        },
    regulering: kanViseIndkomstOgYdelserBilag && harRegulering
      ? { enabled: true }
      : {
          enabled: false,
          disabledReason: !kanViseIndkomstOgYdelserBilag
            ? EO_BILAG_PERIOD_FILTER_REASON
            : 'Der er ingen løn eller offentlige ydelser, som faktisk reguleres i den aktuelle opgørelse.',
        },
    shDage: tafBeregningsenhed === TAF_BEREGNES_SOM.ARBEJDSDAGE
      ? { enabled: true }
      : {
          enabled: false,
          disabledReason: 'TAF beregnes som måneder. SH-dage er derfor ikke relevante.',
        },
    sygeferiegodtgoerelse: harSygeferiegodtgoerelse
      ? { enabled: true }
      : {
          enabled: false,
          disabledReason: 'Sygeferiegodtgørelse er ikke valgt for noget ansættelsesforhold på lønindkomst-siden.',
        },
  };
};

export const hasNonZeroLoenAmount = (value: StandardLoenTableRow['col2']): boolean => {
  const numeric = amountValueToNumber(value);
  return numeric !== undefined;
};

export const shouldIncludeLoenRowInEoBilag = (params: Readonly<{
  row: StandardLoenTableRow;
  loenperiode: Loenperiode;
  mode: EoBilagLoenindkomstOgOffentligeYdelserIndgaar;
  ranges: readonly IsoRange[];
  errorRowIds: ReadonlySet<string>;
}>): boolean => {
  const { row, loenperiode, mode, ranges, errorRowIds } = params;
  if (isStandardLoenRowEffectivelyEmpty(row, loenperiode)) return false;
  // NOTE: Fail-closed efter design.
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

export const shouldIncludeOffentligYdelseRowInEoBilag = (params: Readonly<{
  row: OffentligeYdelserRow;
  mode: EoBilagLoenindkomstOgOffentligeYdelserIndgaar;
  ranges: readonly IsoRange[];
  errorRowIds: ReadonlySet<string>;
}>): boolean => {
  const { row, mode, ranges, errorRowIds } = params;
  if (isOffentligeYdelserRowEmpty(row)) return false;
  // NOTE: Fail-closed efter design.
  // PDF må kun vise rækker uden valideringsfejl.
  if (errorRowIds.has(row.id)) return false;
  const hasAnyAmountInput =
    amountValueToNumber(row.ydelse) !== undefined ||
    amountValueToNumber(row.tillaeg) !== undefined;
  if (!hasAnyAmountInput) return false;
  return hasOffentligYdelseRowOverlapWithRanges(row, mode, ranges);
};

export const shouldIncludeEoReguleringBilag = (
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
