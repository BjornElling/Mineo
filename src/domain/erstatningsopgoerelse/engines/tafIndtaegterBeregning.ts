import type { TafCalculationValues } from './tafCalculationInput';
import {
  buildIncomeForRanges,
  resolveAnsaettelsesforholdNavn,
  roundIncomeBenefitAmountKroner,
  type IncomeCalculationContext,
  type IsoRange,
} from '../helpers/indtaegtPerioder';
import { TAF_FORBEHOLD_YDELSESTYPER } from '../helpers/tafForbehold';
import { sumMidlertidigtEetBeregnetEetKronerForTafRanges } from '../helpers/midlertidigtEetBilagGroups';
import type { MidlertidigtEetAfgoerelseGroup } from '../helpers/midlertidigtEetInsertRows';
import { clampMoneyOreToZero, fromKroner, roundKroner, sumMoneyOre, type MoneyOre } from '../../money/money';

export type TafIndtaegtEntry = Readonly<{ label: string; amountOre: MoneyOre }> & (
  | Readonly<{ kind: 'loen'; employmentId: string }>
  | Readonly<{ kind: 'ydelse'; typeKey: string; imported: boolean }>
);

export type TafIndtaegterBeregning = Readonly<{
  entries: readonly TafIndtaegtEntry[];
  forbeholdYdelsestyper: readonly string[];
  totalOre: MoneyOre;
}>;

/**
 * Fælles indkomstfradrag for hovedopgørelsen og årsfordelingen. Kun de valgte ranges er forskellige.
 * Navngivning, rækkefølge, afrunding og EET-bilagets særlige periodeafrunding ejes her, så en rettelse
 * ikke skal gentages i hver TAF-beregning. Grafen bruger samme periodiseringsmotor til indtægtsniveauer;
 * dens visuelle normalisering må ikke påvirke disse beløb.
 */
export const buildTafIndtaegterBeregning = (
  values: TafCalculationValues,
  ranges: readonly IsoRange[],
  options: Readonly<{
    midlertidigtEetGroups: readonly MidlertidigtEetAfgoerelseGroup[];
    incomeContext?: IncomeCalculationContext | null;
  }>
): TafIndtaegterBeregning => {
  const income = buildIncomeForRanges(values, ranges, options.incomeContext);
  const importedEet = values.midlertidigtEetFraEetSiden === 'Ja';
  const employers: TafIndtaegtEntry[] = income.employers.map((entry) => ({
    kind: 'loen',
    employmentId: entry.id,
    label: resolveAnsaettelsesforholdNavn(entry.name, entry.index),
    amountOre: fromKroner(roundKroner(entry.amount)),
  }));
  const benefits = income.benefits.map<TafIndtaegtEntry>((entry) => {
    const imported = entry.typeKey === 'midlertidigt_eet' && importedEet;
    return {
      kind: 'ydelse',
      typeKey: entry.typeKey,
      imported,
      label: entry.label,
      // Bilaget afrunder pr. periode. Afrunding af den rå totalsum her ville kunne give et andet fradrag.
      amountOre: fromKroner(imported
        ? sumMidlertidigtEetBeregnetEetKronerForTafRanges(options.midlertidigtEetGroups, ranges)
        : roundIncomeBenefitAmountKroner(entry.typeKey, entry.amount, importedEet)),
    };
  }).sort((a, b) => a.label.localeCompare(b.label, 'da-DK', { sensitivity: 'base' }));
  const entries = [...employers, ...benefits];
  return {
    entries,
    forbeholdYdelsestyper: [...new Set(income.benefits
      .map((entry) => entry.typeKey)
      .filter((typeKey) => TAF_FORBEHOLD_YDELSESTYPER.has(typeKey)))],
    totalOre: clampMoneyOreToZero(sumMoneyOre(entries.map((entry) => entry.amountOre))),
  };
};
