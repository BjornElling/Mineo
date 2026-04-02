/**
 * TAF fordelt på kalenderår – afledt beregningslag
 *
 * Dette modul fordeler det autoritative samlet TAF-krav (fra EO-modellen)
 * på kalenderår. Det er et afledt beregningslag, ikke blot præsentation:
 * - Segmenter splittes ved kalenderårsskift → nye mængder (dage/måneder) beregnes
 * - Fradrag prorateres per år via overlap med TAF-ranges
 * - Sub-segmenter afrundes individuelt via segmentAmountOre
 *
 * PRINCIP:
 *   Årsværdier må gerne være negative; summering og afrunding skal stadig være konsistente
 *   med det autoritative samlede TAF-krav.
 *   Afrunding mellem summen af år og samlet TAF-krav accepteres kun op til 1 kr. (100 øre).
 *   Overstiger afvigelsen 1 kr., returneres null (fail-closed) i stedet for en misvisende fordeling.
 *
 * samletTafKravOre beregnes ALDRIG her – det modtages fra EoModel
 * og bruges kun som facit for afrundingslinjen.
 */

import type { ISODateString } from '../../../types/branded';
import type { ErstatningsopgoerelseValues, StamdataValues } from '../../../schemas/formSchemas';
import type { TafNettoBeregningResult } from './tafNettoBeregning';
import type {
  MoneyOre,
  LoenudviklingSegment,
  Calculable,
  LoenudviklingModel,
  TafIndtaegterModel,
} from '../snapshot/eoPresentationModel';
import type { SygeferiegodtgoerelseResult } from './sygeferiegodtgoerelse';
import {
  buildTafArbejdsdageSet,
  countTafArbejdsdageInRange,
  clampMoneyOreToZero,
  segmentAmountOre,
  roundKroner,
  toOre,
} from '../snapshot/eoPresentationModel';
import { beregnArbejdsdageOgMaaneder } from './arbejdsdageMaaneder';
import { buildIncomeCalculationContext, buildIncomeForRanges } from '../helpers/indtaegtPerioder';
import { TAF_BEREGNES_SOM, type TafBeregningsenhed } from '../helpers/tafBeregningsenhed';
import { roundByMethod } from '../../../utils/rounding';
import { scaleMoneyOre } from '../shared/eoMoney';

const MAX_AFRUNDING_AFVIGELSE_ORE = 100 as MoneyOre;

/**
 * Beregner antal måneder i et inklusivt range uden SH-/feriedagsjusteringer.
 * Semantisk identisk med EO-modellen (beregnArbejdsdageOgMaaneder med tomme sets),
 * men med en eksplicit navn der ejer kontrakten, så ændringer i
 * beregnArbejdsdageOgMaaneder fanges af tests her.
 */
const beregnMaanederUdenFridage = (fra: ISODateString, til: ISODateString): number => {
  const stats = beregnArbejdsdageOgMaaneder(
    fra,
    til,
    new Set<ISODateString>(),
    new Set<ISODateString>()
  );
  return roundByMethod(stats.maaneder, 4, 'halfAwayFromZero');
};

// ─── Types ──────────────────────────────────────────────────────────────

export type TafYearSegment = Readonly<{
  fra: ISODateString;
  til: ISODateString;
  kind: 'arbejdsdage' | 'maaneder';
  quantity: number;
  unitAmountOre: MoneyOre;
  deltaPct: number;
  amountOre: MoneyOre;
}>;

export type TafYearDeduction = Readonly<{
  label: string;
  amountOre: MoneyOre;
}>;

export type TafYearEntry = Readonly<{
  year: number;
  segments: readonly TafYearSegment[];
  deductions: readonly TafYearDeduction[];
  yearIncomeOre: MoneyOre;
  yearDeductionsOre: MoneyOre;
  yearTafFoerForligOre: MoneyOre;
  yearTafOre: MoneyOre;
}>;

export type TafPerYearResult = Readonly<{
  years: readonly TafYearEntry[];
  sumYearTafOre: MoneyOre;
  afrundingOre: MoneyOre;
  samletTafKravOre: MoneyOre;
}>;

export type TafPerYearSource = Readonly<{
  stamdataValues: StamdataValues;
  loenudvikling: LoenudviklingModel | null;
  tafIndtaegter: TafIndtaegterModel | null;
  tidligereModtagetTaf: Calculable<MoneyOre>;
  sygeferiegodtgoerelse: SygeferiegodtgoerelseResult;
  tabtArbejdsfortjenesteOre: MoneyOre;
  tafBeregningsenhed: TafBeregningsenhed;
  forligFactor: number | null;
}>;

export type TafPerYearBuildOutcome =
  | Readonly<{ kind: 'ok'; result: TafPerYearResult }>
  | Readonly<{ kind: 'not_applicable'; reason: 'missing_loenudvikling' | 'missing_taf_indtaegter' }>
  | Readonly<{
    kind: 'error';
    reason: 'afrunding_over_100';
    afrundingOre: MoneyOre;
    sumYearTafOre: MoneyOre;
    samletTafKravOre: MoneyOre;
  }>;

export const buildTafPerYearSourceFromComputed = (args: Readonly<{
  stamdataValues: StamdataValues;
  tafNetto: TafNettoBeregningResult;
  tabtArbejdsfortjenesteOre: MoneyOre;
  forligFactor: number | null;
}>): TafPerYearSource => ({
  stamdataValues: args.stamdataValues,
  loenudvikling: args.tafNetto.loenudvikling,
  tafIndtaegter: args.tafNetto.tafIndtaegter,
  tidligereModtagetTaf: args.tafNetto.tidligereModtagetTaf,
  sygeferiegodtgoerelse: args.tafNetto.sygeferiegodtgoerelse,
  tabtArbejdsfortjenesteOre: args.tabtArbejdsfortjenesteOre,
  tafBeregningsenhed: args.tafNetto.tafBeregningsenhed,
  forligFactor: args.forligFactor,
});

// ─── Utilities ──────────────────────────────────────────────────────────

/**
 * Splitter en inklusiv [fra, til] range ved kalenderårsskift.
 * Begge grænser er inklusive (identisk med alle andre range-funktioner i systemet).
 *
 * Forudsætning: fra <= til (valideret af EO-modellen upstream).
 */
export const splitRangeByCalendarYearsInclusive = (
  fra: ISODateString,
  til: ISODateString
): Array<{ fra: ISODateString; til: ISODateString; year: number }> => {
  if (fra > til) {
    throw new Error(`splitRangeByCalendarYearsInclusive: fra (${fra}) > til (${til})`);
  }
  const fraYear = Number.parseInt(fra.slice(0, 4), 10);
  const tilYear = Number.parseInt(til.slice(0, 4), 10);

  if (fraYear === tilYear) {
    return [{ fra, til, year: fraYear }];
  }

  const result: Array<{ fra: ISODateString; til: ISODateString; year: number }> = [];

  // Første år: fra → 31. december
  result.push({
    fra,
    til: `${fraYear}-12-31` as ISODateString,
    year: fraYear,
  });

  // Mellemliggende hele år
  for (let y = fraYear + 1; y < tilYear; y++) {
    result.push({
      fra: `${y}-01-01` as ISODateString,
      til: `${y}-12-31` as ISODateString,
      year: y,
    });
  }

  // Sidste år: 1. januar → til
  result.push({
    fra: `${tilYear}-01-01` as ISODateString,
    til,
    year: tilYear,
  });

  return result;
};

// ─── Builder ────────────────────────────────────────────────────────────

const buildSubSegment = (
  original: LoenudviklingSegment,
  subFra: ISODateString,
  subTil: ISODateString,
  tafArbejdsdageSet: ReadonlySet<ISODateString> | null
): TafYearSegment | null => {
  if (original.kind === 'arbejdsdage') {
    if (!tafArbejdsdageSet) return null;
    const quantity = countTafArbejdsdageInRange(tafArbejdsdageSet, subFra, subTil);
    if (quantity <= 0) return null;
    const baseLoenKroner = original.dagsloenOre / 100;
    return {
      fra: subFra,
      til: subTil,
      kind: 'arbejdsdage',
      quantity,
      unitAmountOre: original.dagsloenOre,
      deltaPct: original.deltaPct,
      amountOre: segmentAmountOre(baseLoenKroner, quantity, original.deltaPct),
    };
  }

  const quantity = beregnMaanederUdenFridage(subFra, subTil);
  if (quantity <= 0) return null;
  const baseLoenKroner = original.maanedsloenOre / 100;
  return {
    fra: subFra,
    til: subTil,
    kind: 'maaneder',
    quantity,
    unitAmountOre: original.maanedsloenOre,
    deltaPct: original.deltaPct,
    amountOre: segmentAmountOre(baseLoenKroner, quantity, original.deltaPct),
  };
};

const buildYearClippedRanges = (
  year: number,
  tafRanges: readonly { fra: ISODateString; til: ISODateString }[]
): readonly { fra: ISODateString; til: ISODateString }[] => {
  const yearStart = `${year}-01-01` as ISODateString;
  const yearEnd = `${year}-12-31` as ISODateString;
  return tafRanges.flatMap((range) => {
    const clippedFra = range.fra > yearStart ? range.fra : yearStart;
    const clippedTil = range.til < yearEnd ? range.til : yearEnd;
    if (clippedFra > clippedTil) return [];
    return [{ fra: clippedFra, til: clippedTil }];
  });
};

const allocateOreByWeight = (
  totalOre: MoneyOre,
  sortedYears: readonly number[],
  weightByYear: ReadonlyMap<number, number>
): ReadonlyMap<number, MoneyOre> => {
  const result = new Map<number, MoneyOre>();
  if (totalOre <= 0 || sortedYears.length === 0) return result;

  const positiveWeights = sortedYears
    .map((year) => ({ year, weight: Math.max(0, weightByYear.get(year) ?? 0) }))
    .filter((entry) => entry.weight > 0);

  if (positiveWeights.length === 0) {
    result.set(sortedYears[0], totalOre);
    return result;
  }

  const totalWeight = positiveWeights.reduce((sum, entry) => sum + entry.weight, 0);
  if (totalWeight <= 0) {
    result.set(sortedYears[0], totalOre);
    return result;
  }

  const baseByYear = new Map<number, number>();
  const remainders: Array<{ year: number; remainder: number }> = [];
  let sumBase = 0;

  for (const entry of positiveWeights) {
    const raw = (totalOre * entry.weight) / totalWeight;
    const base = roundByMethod(raw, 0, 'floor');
    sumBase += base;
    baseByYear.set(entry.year, base);
    remainders.push({ year: entry.year, remainder: raw - base });
  }

  let remainingOre = totalOre - sumBase;
  remainders.sort((a, b) => {
    if (b.remainder !== a.remainder) return b.remainder - a.remainder;
    return a.year - b.year;
  });

  for (let i = 0; i < remainingOre; i += 1) {
    const idx = i % remainders.length;
    const year = remainders[idx].year;
    baseByYear.set(year, (baseByYear.get(year) ?? 0) + 1);
  }

  for (const [year, ore] of baseByYear) {
    if (ore > 0) {
      result.set(year, ore as MoneyOre);
    }
  }
  return result;
};

export const buildTafPerYearBuildOutcome = (
  source: TafPerYearSource,
  eoValues: ErstatningsopgoerelseValues,
  options: Readonly<{ tafRanges: readonly { fra: ISODateString; til: ISODateString }[] }>
): TafPerYearBuildOutcome => {
  const loenudvikling = source.loenudvikling;
  if (!loenudvikling || loenudvikling.beregnedeSegmenter.length === 0) {
    return { kind: 'not_applicable', reason: 'missing_loenudvikling' };
  }
  if (loenudvikling.loenudviklingTotal.status !== 'ok') {
    return { kind: 'not_applicable', reason: 'missing_loenudvikling' };
  }

  const samletTafKravOre = clampMoneyOreToZero(source.tabtArbejdsfortjenesteOre);
  const tafIndtaegterTotalOre =
    source.tafIndtaegter?.total.status === 'ok'
      ? source.tafIndtaegter.total.value
      : null;
  if (tafIndtaegterTotalOre === null) {
    return { kind: 'not_applicable', reason: 'missing_taf_indtaegter' };
  }
  const tidligereModtagetTafOre = source.tidligereModtagetTaf.status === 'ok'
    ? source.tidligereModtagetTaf.value
    : (0 as MoneyOre);

  const forligFactor = source.forligFactor;
  const isArbejdsdage = source.tafBeregningsenhed === TAF_BEREGNES_SOM.ARBEJDSDAGE;
  const tafArbejdsdageSet = isArbejdsdage
    ? buildTafArbejdsdageSet(eoValues, options.tafRanges)
    : null;
  const sygeferiegodtgoerelseByYear = new Map(
    source.sygeferiegodtgoerelse.perYear.map((entry) => [entry.year, entry.amountOre] as const)
  );
  const harValgtSygeferiegodtgoerelse = source.sygeferiegodtgoerelse.perAnsaettelsesforhold.length > 0;

  // 1. Split segmenter per kalenderår
  const yearSegmentsMap = new Map<number, TafYearSegment[]>();

  for (const segment of loenudvikling.beregnedeSegmenter) {
    const subRanges = splitRangeByCalendarYearsInclusive(segment.fra, segment.til);
    for (const sub of subRanges) {
      const subSeg = buildSubSegment(segment, sub.fra, sub.til, tafArbejdsdageSet);
      if (!subSeg) continue;
      let arr = yearSegmentsMap.get(sub.year);
      if (!arr) {
        arr = [];
        yearSegmentsMap.set(sub.year, arr);
      }
      arr.push(subSeg);
    }
  }

  // 2. Byg TAF-ranges og bestem alle relevante årstal
  const tafRanges = options.tafRanges;
  const incomeContext = buildIncomeCalculationContext(eoValues, tafRanges);

  // Samler årstal fra segmenter OG TAF-ranges (fradrag kan dække år uden segmenter)
  const allYearsSet = new Set<number>(yearSegmentsMap.keys());
  for (const range of tafRanges) {
    const rangeStartYear = Number.parseInt(range.fra.slice(0, 4), 10);
    const rangeEndYear = Number.parseInt(range.til.slice(0, 4), 10);
    for (let y = rangeStartYear; y <= rangeEndYear; y++) {
      allYearsSet.add(y);
    }
  }

  const sortedYears = [...allYearsSet].sort((a, b) => a - b);
  if (sortedYears.length === 0) {
    return { kind: 'not_applicable', reason: 'missing_loenudvikling' };
  }

  const yearClippedRangesByYear = new Map<number, readonly { fra: ISODateString; til: ISODateString }[]>();
  for (const year of sortedYears) {
    yearClippedRangesByYear.set(year, buildYearClippedRanges(year, tafRanges));
  }

  const weightByYear = new Map<number, number>();
  for (const year of sortedYears) {
    const yearRanges = yearClippedRangesByYear.get(year) ?? [];
    const weight = isArbejdsdage
      ? yearRanges.reduce((sum, range) => sum + countTafArbejdsdageInRange(tafArbejdsdageSet ?? new Set<ISODateString>(), range.fra, range.til), 0)
      : yearRanges.reduce((sum, range) => sum + beregnMaanederUdenFridage(range.fra, range.til), 0);
    weightByYear.set(year, Math.max(0, weight));
  }
  const tidligereModtagetTafByYear = allocateOreByWeight(tidligereModtagetTafOre, sortedYears, weightByYear);

  // 3. Byg TafYearEntry for hvert år
  const years: TafYearEntry[] = [];

  for (const year of sortedYears) {
    const segments = yearSegmentsMap.get(year) ?? [];
    // Segmenter sorteret efter fra-dato
    segments.sort((a, b) => (a.fra < b.fra ? -1 : a.fra > b.fra ? 1 : 0));

    // Klip TAF-ranges til det pågældende kalenderår for fradragsberegning
    const yearClippedRanges = yearClippedRangesByYear.get(year) ?? [];

    const income = buildIncomeForRanges(eoValues, yearClippedRanges, incomeContext);

    // Konvertér fradrag til øre – stabil rækkefølge (employers først, derefter benefits)
    const deductions: TafYearDeduction[] = [];
    for (const emp of income.employers) {
      if (emp.amount <= 0) continue;
      const amountOre = toOre(roundKroner(emp.amount));
      deductions.push({ label: emp.name || 'Lønindkomst', amountOre });
    }
    const sortedBenefits = [...income.benefits].sort((a, b) =>
      a.label.localeCompare(b.label, 'da-DK', { sensitivity: 'base' })
    );
    for (const ben of sortedBenefits) {
      if (ben.amount <= 0) continue;
      const amountOre = toOre(roundKroner(ben.amount));
      deductions.push({ label: ben.label, amountOre });
    }
    if (harValgtSygeferiegodtgoerelse && sygeferiegodtgoerelseByYear.has(year)) {
      deductions.push({
        label: 'Sygeferiegodtgørelse',
        amountOre: sygeferiegodtgoerelseByYear.get(year) ?? (0 as MoneyOre),
      });
    }
    const yearTidligereModtagetTafOre = tidligereModtagetTafByYear.get(year) ?? (0 as MoneyOre);
    if (yearTidligereModtagetTafOre > 0) {
      deductions.push({ label: 'Allerede betalt TAF', amountOre: yearTidligereModtagetTafOre });
    }

    const yearIncomeOre = segments.reduce((sum, s) => sum + s.amountOre, 0) as MoneyOre;
    const yearDeductionsOre = deductions.reduce((sum, d) => sum + d.amountOre, 0) as MoneyOre;
    const yearTafFoerForligOre = (yearIncomeOre - yearDeductionsOre) as MoneyOre;
    const yearTafOre = forligFactor !== null
      ? scaleMoneyOre(yearTafFoerForligOre, forligFactor)
      : yearTafFoerForligOre;

    years.push({
      year,
      segments,
      deductions,
      yearIncomeOre,
      yearDeductionsOre,
      yearTafFoerForligOre,
      yearTafOre,
    });
  }

  const reconciledYears = samletTafKravOre === 0
    ? years.map((year) => ({
      ...year,
      // Når den autoritative EO-total er clampet til 0, må årsfordelingen ikke
      // fortsat indeholde negative nettobeløb. Årslinjerne skal derfor også være 0,
      // ellers opstår et kunstigt afstemningsbrud mod facit.
      yearTafFoerForligOre: 0 as MoneyOre,
      yearTafOre: 0 as MoneyOre,
    }))
    : years.length === 1
      ? (() => {
        const [onlyYear] = years;
        if (!onlyYear) return years;
        return [{
          ...onlyYear,
          yearTafOre: samletTafKravOre,
        }] satisfies TafYearEntry[];
      })()
      : years;

  const sumYearTafOre = reconciledYears.reduce((sum, y) => sum + y.yearTafOre, 0) as MoneyOre;
  const afrundingOre = (samletTafKravOre - sumYearTafOre) as MoneyOre;
  if (Math.abs(afrundingOre) > MAX_AFRUNDING_AFVIGELSE_ORE) {
    return {
      kind: 'error',
      reason: 'afrunding_over_100',
      afrundingOre,
      sumYearTafOre,
      samletTafKravOre,
    };
  }

  if (import.meta.env.DEV) {
    const check = (sumYearTafOre + afrundingOre) as MoneyOre;
    if (check !== samletTafKravOre) {
      console.error(
        `[TAF per år] Invariant brudt: sum(yearTafOre) + afrunding (${check}) !== samletTafKravOre (${samletTafKravOre})`
      );
    }
  }

  return {
    kind: 'ok',
    result: {
      years: reconciledYears,
      sumYearTafOre,
      afrundingOre,
      samletTafKravOre,
    },
  };
};
