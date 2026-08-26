import type { StandardLoenTableRow } from '../../schemas/formSchemas';
import type { AarsloenBeregningResult } from '../../types/calculation';
import type { Loenperiode } from '../../types/loen';
import type { PeriodeResult } from '../../utils/periodeBeregning';
import { formatCountWithUnit } from '../../utils/formatUtils';
import { isStandardLoenRowEffectivelyEmpty } from './standardLoenRowCalculations';

/**
 * «Antal <enhed> i de indtastede perioder» – ÉN ordlyd for skærm og dokument (BB-112).
 *
 * Teksten stod tidligere hardkodet seks steder (fire i `AarsloenBeregningSection.tsx`, to i
 * `aarsloenDocument.ts`) i formen «Antal måneder i indtastede perioder» – uden «de», som resten af siden
 * bruger («Antal feriedage … i **de** indtastede perioder»). Samme størrelse havde altså to navne én linje
 * fra hinanden, og fladen er netop bygget på, at brugeren skal kunne efterprøve tallet ved at læse
 * mellemregningerne.
 *
 * `buildSummary` herunder danner samme ordlyd for Beregningsprincipper-boksen; begge læser denne funktion.
 */
export const aarsloenAntalEnhederLabel = (
  enhedPlural: string,
  isSinglePeriod: boolean
): string => isSinglePeriod
  ? `Antal ${enhedPlural} i den indtastede periode`
  : `Antal ${enhedPlural} i de indtastede perioder`;

/**
 * Mellemregningens parentes: «(23 hverdage - 2 feriedage)», eller INTET når der ikke er noget at trække fra.
 *
 * Uden værnet blev linjen en tautologi – «Hverdage i beregningsperioden (23 hverdage): 23 hverdage» – fordi
 * parentesen er tænkt som et fradragsregnestykke. Samme tal på begge sider af kolonet får brugeren til at
 * lede efter en forskel, der ikke findes.
 */
export const aarsloenFradragsParentes = (
  grundtal: string,
  fradrag: readonly string[]
): string => {
  const aktiveFradrag = fradrag.filter((led) => led !== '');
  return aktiveFradrag.length === 0 ? '' : ` (${grundtal}${aktiveFradrag.join('')})`;
};

/**
 * Omregningsformlen: «33.750,00 / 21 × 231», eller «33.750,00 × 12» når divisoren er 1.
 *
 * Særreglen for én enhed fandtes allerede i dokumentgeneratoren, men ikke på skærmen, så skærmen skrev
 * «(33.750,00 / 1 × 12)» – en division uden indhold, som gør formlen sværere at læse, og som fik den, der
 * sammenholdt skærm og bilag, til at lede efter en forskel. Reglen bor nu ét sted, så begge skriver ens.
 */
export const aarsloenOmregningFormel = (
  beloeb: string,
  divisor: number,
  faktor: string
): string => divisor === 1 ? `${beloeb} × ${faktor}` : `${beloeb} / ${divisor} × ${faktor}`;

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
  /**
   * Om grundlaget er ÉN periode. Eksponeret, så Beregning-boksen kan bygge sine egne linjer med samme
   * ental/flertal som Beregningsprincipper-boksen frem for at udlede det af labelteksten.
   */
  isSinglePeriod: boolean;
}>;

const buildSummary = (
  definition: AarsloenIndtastetEnhedDefinition,
  isSinglePeriod: boolean
): AarsloenIndtastetEnhedSummary => ({
  label: aarsloenAntalEnhederLabel(definition.labelUnitPlural, isSinglePeriod),
  value: formatCountWithUnit(definition.count, definition.singular, definition.plural),
  isSinglePeriod,
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
