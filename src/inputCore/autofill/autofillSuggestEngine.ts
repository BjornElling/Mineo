import { isoYear } from '../../utils/isoDateHelpers';
import {
  MAX_REPRESENTABLE_YEAR,
  MIN_REPRESENTABLE_YEAR,
  floorDivideMonthIndex,
  fromAbsoluteMonth,
  projectAbsoluteMonthSeries,
  projectConstantAmountSeries,
  projectDateSeries,
  projectMonthOfYearSeries,
  projectWeekSeries,
  projectYearSeries,
  toAbsoluteMonth,
  type WeekAutofillValue,
} from './autofillSeries';
import type {
  AutofillColumn,
  AutofillSampleValue,
  AutofillSuggestModel,
  AutofillSuggestion,
} from './autofillSuggestModel';

// Autofill-suggest, lag 4 (motoren). Ren funktion af modellen: ingen React, ingen reader, ingen DOM.
// Motoren ejer tre ting, som mønstergenkendelsen i `autofillSeries.ts` ikke kan se:
//
//  1. HVILKE prøver der indgår: kun rækkerne OVER målrækken, i visningsorden. Autofill fremskriver; den
//     ekstrapolerer aldrig bagud til en tom række over de udfyldte.
//  2. KOBLINGEN mellem måned og år, som er to kolonner men ÉN serie.
//  3. BELØBSGATEN: et beløb foreslås aldrig hen over et årsskifte (brugerkrav).

/** Kolonnen med det givne indeks, eller `null`. */
const columnAt = (model: AutofillSuggestModel, colIndex: number): AutofillColumn | null =>
  model.columns.find((column) => column.colIndex === colIndex) ?? null;

/**
 * Prøverne i rækkerne OVER `rowIndex`, i visningsorden, afkodet af `pick`.
 *
 * `pick` er en narrowing-funktion frem for en art-parameter, så udtrækket sker gennem den diskriminerede
 * union og ikke gennem en type-assertion: en prøve af en anden art bliver `null` og springes over.
 * Netop dét er også kravets filter – tomme, delvise og fejlbehæftede celler bærer ingen prøve og
 * udelades, så mønstret dannes af de øvrige rækker.
 */
const collectAbove = <TValue>(
  column: AutofillColumn,
  rowIndex: number,
  pick: (sample: AutofillSampleValue) => TValue | null
): readonly TValue[] => {
  const collected: TValue[] = [];
  const limit = Math.min(rowIndex, column.samples.length);
  for (let index = 0; index < limit; index += 1) {
    const sample = column.samples[index];
    if (sample === undefined) continue;
    const value = pick(sample);
    if (value !== null) collected.push(value);
  }
  return collected;
};

/**
 * Måned/år-parrene over `rowIndex` som absolutte månedsindeks.
 *
 * Kun rækker, hvor BEGGE celler har en brugbar prøve, tæller: et par kan ikke placeres i kalenderen uden
 * begge halvdele, og en halv række må ikke forskyde serien.
 */
const absoluteMonthSamplesAbove = (
  monthColumn: AutofillColumn,
  yearColumn: AutofillColumn,
  rowIndex: number
): readonly number[] => {
  const collected: number[] = [];
  const limit = Math.min(rowIndex, monthColumn.samples.length, yearColumn.samples.length);
  for (let index = 0; index < limit; index += 1) {
    const month = monthColumn.samples[index];
    const year = yearColumn.samples[index];
    if (month === undefined || month.kind !== 'monthOfYear') continue;
    if (year === undefined || year.kind !== 'year') continue;
    collected.push(toAbsoluteMonth(year.year, month.month));
  }
  return collected;
};

/**
 * Det årstal, der placerer målrækkens ALLEREDE INDTASTEDE måned tættest på seriens næste plads.
 *
 * Situationen er den, udvikleren beskrev: brugeren har afsluttet 12/2025 og står nu i den nye rækkes
 * årscelle. Mønstret alene svarer 2026, og det er rigtigt – men kun så længe måneden i den nye række er
 * den, mønstret forudsagde. Har brugeren i stedet skrevet fx marts, er det den indtastede måned, der skal
 * bestemme årstallet.
 *
 * Reglen er «tættest på det projicerede månedsindeks» og IKKE «det næste årstal efter den seneste prøve».
 * Forskellen viser sig i en faldende serie, som blot er ét ekstra klik på kolonneoverskriften væk: står
 * rækkerne 12/2025, 11/2025, 10/2025, foreslår månedskolonnen 9, og en fremadskubbende regel ville da
 * svare 2026 på årskolonnen – altså modsige sit eget månedsforslag i samme række. Uafgjort (måneden
 * ligger præcis et halvt år fra begge sider) afgøres af det projicerede års egen plads, så den
 * fremadgående serie fortsætter fremad.
 */
const yearNearestProjectedMonth = (projectedAbsoluteMonth: number, month: number): number | null => {
  const projectedYear = floorDivideMonthIndex(projectedAbsoluteMonth);
  let bestYear: number | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const year of [projectedYear, projectedYear - 1, projectedYear + 1]) {
    if (year < MIN_REPRESENTABLE_YEAR || year > MAX_REPRESENTABLE_YEAR) continue;
    const distance = Math.abs(toAbsoluteMonth(year, month) - projectedAbsoluteMonth);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestYear = year;
    }
  }
  return bestYear;
};

const pickDate = (sample: AutofillSampleValue) => (sample.kind === 'date' ? sample.iso : null);
const pickWeek = (sample: AutofillSampleValue): WeekAutofillValue | null =>
  sample.kind === 'week' ? { week: sample.week, year: sample.year } : null;
const pickAmount = (sample: AutofillSampleValue) => (sample.kind === 'amount' ? sample.value : null);
const pickMonth = (sample: AutofillSampleValue) => (sample.kind === 'monthOfYear' ? sample.month : null);
const pickYear = (sample: AutofillSampleValue) => (sample.kind === 'year' ? sample.year : null);

/**
 * Den projicerede værdi for en celle – uden formatering og uden beløbsgaten.
 *
 * Eksporteret, fordi beløbsgaten skal kunne spørge om periodestartens projicerede år for netop den række,
 * brugeren står i: står der endnu ingen startdato, er det jo FORSLAGET til startdatoen, der afgør, om
 * rækken tilhører et nyt kalenderår.
 */
export const projectAutofillColumnValue = (
  model: AutofillSuggestModel,
  colIndex: number,
  rowIndex: number
): AutofillSampleValue | null => {
  const column = columnAt(model, colIndex);
  if (column === null || rowIndex < 0) return null;

  if (column.kind === 'date') {
    const next = projectDateSeries(collectAbove(column, rowIndex, pickDate));
    return next === null ? null : { kind: 'date', iso: next };
  }

  if (column.kind === 'week') {
    const next = projectWeekSeries(collectAbove(column, rowIndex, pickWeek));
    return next === null ? null : { kind: 'week', week: next.week, year: next.year };
  }

  if (column.kind === 'amount') {
    const next = projectConstantAmountSeries(collectAbove(column, rowIndex, pickAmount));
    return next === null ? null : { kind: 'amount', value: next };
  }

  const linked = column.linkedColIndex === undefined ? null : columnAt(model, column.linkedColIndex);

  if (column.kind === 'monthOfYear') {
    if (linked !== null && linked.kind === 'year') {
      const next = projectAbsoluteMonthSeries(absoluteMonthSamplesAbove(column, linked, rowIndex));
      if (next !== null) return { kind: 'monthOfYear', month: fromAbsoluteMonth(next).month };
    }
    // Uden brugbare årsprøver findes der ingen kalender at wrappe i; måneden fortsætter da modulært.
    const next = projectMonthOfYearSeries(collectAbove(column, rowIndex, pickMonth));
    return next === null ? null : { kind: 'monthOfYear', month: next };
  }

  if (linked !== null && linked.kind === 'monthOfYear') {
    const pairs = absoluteMonthSamplesAbove(linked, column, rowIndex);
    const next = projectAbsoluteMonthSeries(pairs);
    if (next !== null) {
      const committedMonth = linked.samples[rowIndex];
      if (committedMonth !== undefined && committedMonth.kind === 'monthOfYear') {
        const year = yearNearestProjectedMonth(next, committedMonth.month);
        return year === null ? null : { kind: 'year', year };
      }
      return { kind: 'year', year: fromAbsoluteMonth(next).year };
    }
  }
  const next = projectYearSeries(collectAbove(column, rowIndex, pickYear));
  return next === null ? null : { kind: 'year', year: next };
};

/** Kalenderåret i en prøve, eller `null` for en prøve der ikke selv bærer et år. */
const yearOfSample = (sample: AutofillSampleValue | null | undefined): number | null => {
  if (sample === null || sample === undefined) return null;
  if (sample.kind === 'date') return isoYear(sample.iso);
  if (sample.kind === 'week') return sample.year;
  if (sample.kind === 'year') return sample.year;
  return null;
};

/** Sidste række OVER `rowIndex` med en brugbar prøve i kolonnen, eller `null`. */
const lastSampledRowAbove = (column: AutofillColumn, rowIndex: number): number | null => {
  for (let index = Math.min(rowIndex, column.samples.length) - 1; index >= 0; index -= 1) {
    if (column.samples[index] !== undefined) return index;
  }
  return null;
};

/**
 * Beløbsgaten: må beløbskolonnen foreslå i denne række?
 *
 * Reglen er udviklerens: **beløb standser ved årsskifte**, og det afgørende er, om rækkens STARTDATO
 * ligger i et nyt kalenderår. Et nyt kalenderår betyder nye satser, ny regulering og typisk ny løn – og
 * programmet må ikke gætte det tal.
 *
 * Målrækkens år læses først af rækkens egen periodestart; er den endnu ikke indtastet, bruges det FORSLAG,
 * startkolonnen selv ville give (det er den værdi, brugeren er ved at acceptere).
 *
 * Kan året ikke fastslås på begge sider, er gaten inaktiv. Den slår altså kun til på et POSITIVT
 * observeret årsskifte, ikke på uvished: er periodekolonnen tom hele vejen, findes der intet årsskifte at
 * standse ved, og en gate på uvished ville slukke autofillen for enhver tabel uden periodedatoer.
 */
const amountGateAllows = (
  model: AutofillSuggestModel,
  column: AutofillColumn,
  rowIndex: number
): boolean => {
  const anchorColIndex = model.yearAnchorColIndex;
  if (anchorColIndex === null || anchorColIndex === column.colIndex) return true;
  const anchor = columnAt(model, anchorColIndex);
  if (anchor === null || anchor.kind === 'amount') return true;

  // Referenceåret læses i den seneste række over målrækken med en ANKERprøve – ikke i den seneste række
  // med en BELØBSprøve. De to er ikke det samme, og forskellen åbnede gaten: en delvist udfyldt række med
  // et beløb, men uden periodestart (netop den slags række, kravet siger skal springes over) gjorde
  // referenceåret ukendt, og beløbet blev da foreslået hen over årsskiftet alligevel. Det seneste kendte
  // år i tabellen er den rigtige reference.
  const referenceRowIndex = lastSampledRowAbove(anchor, rowIndex);
  if (referenceRowIndex === null) return true;
  const referenceYear = yearOfSample(anchor.samples[referenceRowIndex]);
  if (referenceYear === null) return true;

  const targetYear = yearOfSample(anchor.samples[rowIndex])
    ?? yearOfSample(projectAutofillColumnValue(model, anchorColIndex, rowIndex));
  if (targetYear === null) return true;

  return targetYear === referenceYear;
};

/**
 * Forslaget for én celle, eller `null` når kolonnen ikke bærer et mønster.
 *
 * En celle, der allerede HAR en afsluttet værdi, får aldrig et forslag. Det er ikke kun en optimering:
 * det er den strukturelle garanti for, at et Enter-accept ikke kan overskrive noget
 * (`keyboard-navigation.md`: «Enter overskriver værdi uden brugerens samtykke» er en fejl).
 */
export const resolveAutofillSuggestion = (
  model: AutofillSuggestModel,
  rowId: string,
  colIndex: number
): AutofillSuggestion | null => {
  const rowIndex = model.rowIds.indexOf(rowId);
  if (rowIndex < 0) return null;
  const column = columnAt(model, colIndex);
  if (column === null) return null;
  if (column.samples[rowIndex] !== undefined) return null;

  const value = projectAutofillColumnValue(model, colIndex, rowIndex);
  if (value === null) return null;
  if (column.kind === 'amount' && !amountGateAllows(model, column, rowIndex)) return null;

  return column.format(value);
};
