/**
 * TAF fordelt på kalenderår – ren præsentationsberegning
 *
 * Årsbeløb er præsentation – samlet TAF-krav er autoritativt.
 * Afrundingslinjen korrigerer altid differensen mellem sum(yearTafOre)
 * og det autoritative samletTafKravOre.
 */

import type { ISODateString } from '../../types/branded';
import type { ErstatningsopgoerelseValues } from '../../schemas/formSchemas';
import type { PdfModel, MoneyOre, LoenudviklingSegment } from './eoPdfModel';
import {
  buildTafArbejdsdageSet,
  countTafArbejdsdageInRange,
  segmentAmountOreV3,
  roundKroner,
  toOre,
} from './eoPdfModel';
import { beregnArbejdsdageOgMaaneder } from './arbejdsdageMaaneder';
import { buildTafRanges, buildIncomeForRanges } from './indtaegtPerioder';
import { TAF_BEREGNES_SOM } from './tafBeregningsenhed';

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
  yearTafOre: MoneyOre;
}>;

export type TafPerYearPresentation = Readonly<{
  years: readonly TafYearEntry[];
  sumYearTafOre: MoneyOre;
  afrundingOre: MoneyOre;
  samletTafKravOre: MoneyOre;
}>;

// ─── Utilities ──────────────────────────────────────────────────────────

/**
 * Splitter en inklusiv [fra, til] range ved kalenderårsskift.
 * Begge grænser er inklusive (identisk med alle andre range-funktioner i systemet).
 */
export const splitRangeByCalendarYearsInclusive = (
  fra: ISODateString,
  til: ISODateString
): Array<{ fra: ISODateString; til: ISODateString; year: number }> => {
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
  tafArbejdsdageSet: Set<ISODateString> | null
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
      amountOre: segmentAmountOreV3(baseLoenKroner, quantity, original.deltaPct),
    };
  }

  // Måneder: identisk med EO-model (beregnArbejdsdageOgMaaneder med tomme sets, 4 decimaler)
  const stats = beregnArbejdsdageOgMaaneder(
    subFra,
    subTil,
    new Set<ISODateString>(),
    new Set<ISODateString>()
  );
  const quantity = Math.round(stats.maaneder * 10_000) / 10_000;
  if (quantity <= 0) return null;
  const baseLoenKroner = original.maanedsloenOre / 100;
  return {
    fra: subFra,
    til: subTil,
    kind: 'maaneder',
    quantity,
    unitAmountOre: original.maanedsloenOre,
    deltaPct: original.deltaPct,
    amountOre: segmentAmountOreV3(baseLoenKroner, quantity, original.deltaPct),
  };
};

export const buildTafPerYearPresentation = (
  model: PdfModel,
  eoValues: ErstatningsopgoerelseValues
): TafPerYearPresentation | null => {
  const taf = model.tabtArbejdsfortjeneste;
  const loenudvikling = taf.loenudvikling;
  if (!loenudvikling || loenudvikling.beregnedeSegmenter.length === 0) return null;
  if (loenudvikling.loenudviklingTotal.status !== 'ok') return null;

  const samletTafKravOre = taf.tabtArbejdsfortjenesteOre;
  const isArbejdsdage = taf.tafBeregningsenhed === TAF_BEREGNES_SOM.ARBEJDSDAGE;
  const tafArbejdsdageSet = isArbejdsdage ? buildTafArbejdsdageSet(eoValues) : null;

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

  // 2. Bestem årstal sorteret numerisk
  const sortedYears = [...yearSegmentsMap.keys()].sort((a, b) => a - b);
  if (sortedYears.length === 0) return null;

  // 3. Byg TAF-ranges for fradragsberegning
  const tafRanges = buildTafRanges(eoValues);

  // 4. Byg TafYearEntry for hvert år
  const years: TafYearEntry[] = [];

  for (const year of sortedYears) {
    const segments = yearSegmentsMap.get(year)!;
    // Segmenter sorteret efter fra-dato
    segments.sort((a, b) => (a.fra < b.fra ? -1 : a.fra > b.fra ? 1 : 0));

    // Klip TAF-ranges til det pågældende kalenderår for fradragsberegning
    const yearStart = `${year}-01-01` as ISODateString;
    const yearEnd = `${year}-12-31` as ISODateString;
    const yearClippedRanges = tafRanges.flatMap((range) => {
      const clippedFra = range.fra > yearStart ? range.fra : yearStart;
      const clippedTil = range.til < yearEnd ? range.til : yearEnd;
      if (clippedFra > clippedTil) return [];
      return [{ fra: clippedFra, til: clippedTil }];
    });

    const income = buildIncomeForRanges(eoValues, yearClippedRanges);

    // Konvertér fradrag til øre – stabil rækkefølge (employers først, derefter benefits)
    const deductions: TafYearDeduction[] = [];
    for (const emp of income.employers) {
      if (emp.amount <= 0) continue;
      const amountOre = toOre(roundKroner(emp.amount));
      deductions.push({ label: emp.name || 'Lønindkomst', amountOre });
    }
    for (const ben of income.benefits) {
      if (ben.amount <= 0) continue;
      const amountOre = toOre(roundKroner(ben.amount));
      deductions.push({ label: ben.label, amountOre });
    }

    const yearIncomeOre = segments.reduce((sum, s) => sum + s.amountOre, 0) as MoneyOre;
    const yearDeductionsOre = deductions.reduce((sum, d) => sum + d.amountOre, 0) as MoneyOre;
    const yearTafOre = (yearIncomeOre - yearDeductionsOre) as MoneyOre;

    years.push({
      year,
      segments,
      deductions,
      yearIncomeOre,
      yearDeductionsOre,
      yearTafOre,
    });
  }

  const sumYearTafOre = years.reduce((sum, y) => sum + y.yearTafOre, 0) as MoneyOre;
  const afrundingOre = (samletTafKravOre - sumYearTafOre) as MoneyOre;

  if (process.env.NODE_ENV === 'development') {
    const check = sumYearTafOre + afrundingOre;
    if (check !== samletTafKravOre) {
      console.error(
        `[TAF per år] Invariant brudt: sum(yearTafOre) + afrunding (${check}) !== samletTafKravOre (${samletTafKravOre})`
      );
    }
  }

  return {
    years,
    sumYearTafOre,
    afrundingOre,
    samletTafKravOre,
  };
};
