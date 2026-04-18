import type { StandardLoenTableRow } from '../../schemas/formSchemas';
import type { AarsloenBeregningResult } from '../../types/calculation';
import type { Loenperiode } from '../../types/loen';
import type { PeriodeResult } from '../../utils/periodeBeregning';
import { formatCountWithUnit } from '../../utils/formatUtils';
import { isStandardLoenRowEffectivelyEmpty } from './standardLoenRowCalculations';

type AarsloenIndtastetEnhedDefinition = Readonly<{
  count: number;
  singular: string;
  plural: string;
  labelUnitPlural: string;
  labelUnitSingular: string;
}>;

export type AarsloenIndtastetEnhedSummary = Readonly<{
  label: string;
  value: string;
}>;

const buildSummary = (
  definition: AarsloenIndtastetEnhedDefinition,
  isSinglePeriod: boolean
): AarsloenIndtastetEnhedSummary => ({
  label: isSinglePeriod
    ? `Antal ${definition.labelUnitPlural} i den indtastede periode`
    : `Antal ${definition.labelUnitPlural} i de indtastede perioder`,
  value: formatCountWithUnit(definition.count, definition.singular, definition.plural),
});

const resolveFallbackDefinition = (
  periodeData: PeriodeResult | null,
  loenperiode: Loenperiode
): AarsloenIndtastetEnhedDefinition => {
  const count = periodeData?.unikkeEnheder ?? 0;

  if (loenperiode === 'maaned') {
    return { count, singular: 'måned', plural: 'måneder', labelUnitPlural: 'måneder', labelUnitSingular: 'måneden' };
  }

  if (loenperiode === 'uge') {
    return { count, singular: 'uge', plural: 'uger', labelUnitPlural: 'uger', labelUnitSingular: 'ugen' };
  }

  return {
    count,
    singular: 'kalenderdag',
    plural: 'kalenderdage',
    labelUnitPlural: 'kalenderdage',
    labelUnitSingular: 'kalenderdagen',
  };
};

export const resolveAarsloenIndtastetEnhedSummary = (params: Readonly<{
  tableData: readonly StandardLoenTableRow[];
  periodeData: PeriodeResult | null;
  beregningsData: AarsloenBeregningResult;
  loenperiode: Loenperiode;
}>): AarsloenIndtastetEnhedSummary => {
  const { tableData, periodeData, beregningsData, loenperiode } = params;
  const filledRowCount = tableData.filter((row) => !isStandardLoenRowEffectivelyEmpty(row, loenperiode)).length;
  const isSinglePeriod = filledRowCount === 1;

  if (beregningsData.metode === 'A') {
    return buildSummary({
      count: beregningsData.hverdageIPeriode,
      singular: 'hverdag',
      plural: 'hverdage',
      labelUnitPlural: 'hverdage',
      labelUnitSingular: 'hverdagen',
    }, isSinglePeriod);
  }

  if (beregningsData.metode === 'B') {
    return buildSummary({
      count: beregningsData.arbejdsdageIPeriode,
      singular: 'hverdag',
      plural: 'hverdage',
      labelUnitPlural: 'hverdage',
      labelUnitSingular: 'hverdagen',
    }, isSinglePeriod);
  }

  if (beregningsData.metode === 'C') {
    if (loenperiode === 'maaned') {
      return buildSummary({
        count: beregningsData.antalEnheder,
        singular: 'måned',
        plural: 'måneder',
        labelUnitPlural: 'måneder',
        labelUnitSingular: 'måneden',
      }, isSinglePeriod);
    }

    if (loenperiode === 'uge') {
      return buildSummary({
        count: beregningsData.antalEnheder,
        singular: 'uge',
        plural: 'uger',
        labelUnitPlural: 'uger',
        labelUnitSingular: 'ugen',
      }, isSinglePeriod);
    }

    if (loenperiode === 'dag' && beregningsData.antalHeleKalendermaaneder !== null) {
      return buildSummary({
        count: beregningsData.antalHeleKalendermaaneder,
        singular: 'måned',
        plural: 'måneder',
        labelUnitPlural: 'måneder',
        labelUnitSingular: 'måneden',
      }, isSinglePeriod);
    }

    return buildSummary({
      count: beregningsData.arbejdsdageIPeriode,
      singular: 'hverdag',
      plural: 'hverdage',
      labelUnitPlural: 'hverdage',
      labelUnitSingular: 'hverdagen',
    }, isSinglePeriod);
  }

  return buildSummary(resolveFallbackDefinition(periodeData, loenperiode), isSinglePeriod);
};
