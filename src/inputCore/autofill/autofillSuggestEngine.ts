import {
  MAX_REPRESENTABLE_YEAR,
  MIN_REPRESENTABLE_YEAR,
  floorDivideMonthIndex,
  fromAbsoluteMonth,
  projectAbsoluteMonthSeries,
  projectDateSeries,
  projectMonthOfYearSeries,
  projectWeekSeries,
  toAbsoluteMonth,
  type WeekAutofillValue,
} from './autofillSeries';
import type {
  AutofillColumn,
  AutofillSampleValue,
  AutofillSuggestModel,
  AutofillSuggestion,
} from './autofillSuggestModel';
import { addDays, createDate, getDaysInMonth, parseWeekString } from '../../utils/dateUtils';
import { diffUtcDays } from '../../utils/utcDayMath';
import { dateToISO, parseISODate } from '../../types/branded';

// Autofill-suggest, lag 4 (motoren). Ren funktion af modellen: ingen React, ingen reader, ingen DOM.
//
// ── Motorens tre regler ─────────────────────────────────────────────────────────────────────────────
// Reglerne følger inputfelt-kontrakten §1.5. Produktionskald bruger præcis de to rækker over målet,
// så ældre udfyldte celler aldrig kan skjule et hul eller give et tilsyneladende sikkert gæt:
//
//  1. **Ghosten står KUN i cellen umiddelbart under en udfyldt celle i SAMME kolonne.** Er cellen
//     ovenover tom, findes der intet forslag – uanset hvad der står længere oppe, og uanset om rækken
//     ovenover er udfyldt i andre kolonner. Reglen er hele forudsigeligheden: forslaget bygger altid på
//     noget, brugeren kan se lige over caret, og den anden foregående række bekræfter mønstret.
//  2. **Kun faste periodeintervaller genkendes.** Måned og år er ÉN serie, og fra-/til-datoer kobles,
//     når de to seneste perioder er sammenhængende.
//  3. **Beløb kræver to ens værdier.** En længere mållængde stopper gentagelsen; ved årsskifte og
//     1. marts kan den seneste forskellige værdi foreslås.

/** Kolonnen med det givne indeks, eller `null`. */
const columnAt = (model: AutofillSuggestModel, colIndex: number): AutofillColumn | null =>
  model.columns.find((column) => column.colIndex === colIndex) ?? null;

/**
 * Prøverne i rækkerne OVER `rowIndex`, i visningsorden, afkodet af `pick`.
 *
 * `pick` er en narrowing-funktion frem for en art-parameter, så udtrækket sker gennem den diskriminerede
 * union og ikke gennem en type-assertion: begge celler skal have brugbare prøver af samme art. Et hul
 * eller en prøve af en anden art afbryder mønstret i stedet for at lade ældre rækker træde til.
 */
const collectAbove = <TValue>(
  column: AutofillColumn,
  rowIndex: number,
  pick: (sample: AutofillSampleValue) => TValue | null
): readonly TValue[] => {
  if (rowIndex < 2) return [];
  const collected: TValue[] = [];
  for (let index = rowIndex - 2; index < rowIndex; index += 1) {
    const sample = column.samples[index];
    if (sample === undefined) return [];
    const value = pick(sample);
    if (value === null) return [];
    collected.push(value);
  }
  return collected;
};

/**
 * Det årstal, der lægger `month` tættest på månedsindekset `reference`.
 *
 * Funktionen bruges to steder, og begge har samme spørgsmål: hvilket kalenderår hører en måned til, når
 * kun måneden er kendt? Reglen er «tættest på referencen» og IKKE «det næste årstal efter den», fordi
 * den skal være retningsneutral. Står rækkerne 12/2025, 11/2025, 10/2025, foreslår månedskolonnen 9, og
 * en fremadskubbende regel ville svare 2026 på årskolonnen – altså modsige sit eget månedsforslag i
 * samme række. Uafgjort (måneden ligger præcis et halvt år fra begge sider) afgøres af referencens eget
 * år, så den fremadgående serie fortsætter fremad.
 */
const yearPlacingMonthNearest = (reference: number, month: number): number | null => {
  const referenceYear = floorDivideMonthIndex(reference);
  let bestYear: number | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const year of [referenceYear, referenceYear - 1, referenceYear + 1]) {
    if (year < MIN_REPRESENTABLE_YEAR || year > MAX_REPRESENTABLE_YEAR) continue;
    const distance = Math.abs(toAbsoluteMonth(year, month) - reference);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestYear = year;
    }
  }
  return bestYear;
};

/**
 * Måned/år-parrene over `rowIndex` som absolutte månedsindeks, med årstallet UDLEDT hvor det mangler.
 *
 * Udledningen er reviewets vigtigste rettelse i denne fil. Tidligere talte KUN rækker, hvor begge celler
 * havde en prøve, og det gav præcis den fejl, udvikleren fotograferede: står månederne 1, 2, 3, 4 med
 * årstal i de tre første rækker og en tom årscelle i den fjerde, faldt måned 4 ud af serien. Mønstret
 * blev dannet af 1, 2, 3, og ghosten foreslog 4 – i rækken UNDER en celle, hvor der allerede stod 4.
 * Brugeren læser månedskolonnen som 1, 2, 3, 4 og forventer 5.
 *
 * Derfor: hele månedskolonnen bærer prøver. Et manglende årstal udledes som det kalenderår, der lægger
 * måneden tættest på naboprøven – retningsneutralt, så en faldende serie ikke pludselig springer et år
 * frem. Findes der ikke ét ægte årstal i kolonnen, er der ingen kalender at placere månederne i, og
 * motoren falder tilbage til den rene månedsserie (`projectMonthOfYearSeries`).
 *
 * Ankeret er den FØRSTE række med et ægte årstal, og der udledes både fremad og bagud fra det. Uden
 * bagud-udledningen ville en glemt årscelle i den øverste række koste hele dens månedsprøve.
 */
const absoluteMonthSamplesAbove = (
  monthColumn: AutofillColumn,
  yearColumn: AutofillColumn,
  rowIndex: number
): readonly number[] => {
  if (rowIndex < 2) return [];
  const entries: { month: number; year: number | null }[] = [];
  for (let index = rowIndex - 2; index < rowIndex; index += 1) {
    const month = monthColumn.samples[index];
    if (month === undefined || month.kind !== 'monthOfYear') return [];
    const year = yearColumn.samples[index];
    entries.push({
      month: month.month,
      year: year !== undefined && year.kind === 'year' ? year.year : null,
    });
  }

  const anchorIndex = entries.findIndex((entry) => entry.year !== null);
  const anchor = anchorIndex < 0 ? undefined : entries[anchorIndex];
  if (anchor?.year === undefined || anchor.year === null) return [];

  const absolute: (number | undefined)[] = entries.map(() => undefined);
  absolute[anchorIndex] = toAbsoluteMonth(anchor.year, anchor.month);

  // Fremad og bagud fra ankeret. Et ægte årstal bruges som det står; et manglende udledes af naboen i
  // den retning, gennemløbet går, så udledningen altid har en placeret prøve at måle fra.
  const placeFrom = (index: number, neighbour: number): void => {
    const entry = entries[index];
    if (entry === undefined) return;
    if (entry.year !== null) {
      absolute[index] = toAbsoluteMonth(entry.year, entry.month);
      return;
    }
    const year = yearPlacingMonthNearest(neighbour, entry.month);
    if (year === null) return;
    absolute[index] = toAbsoluteMonth(year, entry.month);
  };

  for (let index = anchorIndex + 1; index < entries.length; index += 1) {
    const previous = absolute[index - 1];
    if (previous === undefined) break;
    placeFrom(index, previous);
  }
  for (let index = anchorIndex - 1; index >= 0; index -= 1) {
    const next = absolute[index + 1];
    if (next === undefined) break;
    placeFrom(index, next);
  }

  return absolute.filter((value): value is number => value !== undefined);
};

const pickDate = (sample: AutofillSampleValue) => (sample.kind === 'date' ? sample.iso : null);
const pickWeek = (sample: AutofillSampleValue): WeekAutofillValue | null =>
  sample.kind === 'week' ? { week: sample.week, year: sample.year } : null;
const pickMonth = (sample: AutofillSampleValue) => (sample.kind === 'monthOfYear' ? sample.month : null);

type PeriodSpan = Readonly<{ start: Date; end: Date; length: number }>;

const periodSpanAt = (model: AutofillSuggestModel, column: AutofillColumn, rowIndex: number): PeriodSpan | null => {
  const indices = column.amountPeriodColIndices;
  if (indices === undefined) return null;
  const fromColumn = columnAt(model, indices[0]);
  const toColumn = columnAt(model, indices[1]);
  const from = fromColumn?.samples[rowIndex];
  const to = toColumn?.samples[rowIndex];
  if (from === undefined || to === undefined) return null;

  if (from.kind === 'date' && to.kind === 'date') {
    const start = parseISODate(from.iso);
    const end = parseISODate(to.iso);
    if (start === undefined || end === undefined || end.getTime() < start.getTime()) return null;
    return { start, end, length: diffUtcDays(start, end) + 1 };
  }
  if (from.kind === 'week' && to.kind === 'week') {
    const startInterval = parseWeekString(`${String(from.week)}/${String(from.year)}`);
    const endInterval = parseWeekString(`${String(to.week)}/${String(to.year)}`);
    if (startInterval === null || endInterval === null || endInterval.end.getTime() < startInterval.start.getTime()) return null;
    return { start: startInterval.start, end: endInterval.end, length: diffUtcDays(startInterval.start, endInterval.end) / 7 + 1 };
  }
  if (from.kind === 'monthOfYear' && to.kind === 'year') {
    const monthColumn = fromColumn;
    const yearColumn = toColumn;
    if (monthColumn === null || yearColumn === null) return null;
    const linkedMonth = monthColumn.samples[rowIndex];
    const linkedYear = yearColumn.samples[rowIndex];
    if (linkedMonth?.kind !== 'monthOfYear' || linkedYear?.kind !== 'year') return null;
    const start = createDate(linkedYear.year, linkedMonth.month - 1, 1);
    const end = createDate(linkedYear.year, linkedMonth.month, 0);
    return { start, end, length: 1 };
  }
  return null;
};

const isFirstOfMonth = (date: Date, month: number): boolean => date.getUTCMonth() === month - 1 && date.getUTCDate() === 1;
const isLastFebruaryDay = (date: Date): boolean => date.getUTCMonth() === 1 && date.getUTCDate() === getDaysInMonth(date);

const crossesSalaryIncreaseBoundary = (span: PeriodSpan): boolean => {
  const { start, end } = span;
  if (start.getUTCFullYear() !== end.getUTCFullYear()) return true;
  if (isFirstOfMonth(start, 1) || end.getUTCMonth() === 11 && end.getUTCDate() === 31) return true;
  if (isFirstOfMonth(start, 3) || isLastFebruaryDay(end)) return true;
  for (let year = start.getUTCFullYear(); year <= end.getUTCFullYear(); year += 1) {
    const marchFirst = createDate(year, 2, 1);
    if (start <= marchFirst && marchFirst <= end) return true;
  }
  return false;
};

const isCurrentPeriodLonger = (model: AutofillSuggestModel, column: AutofillColumn, rowIndex: number): boolean => {
  const current = periodSpanAt(model, column, rowIndex);
  const previous = periodSpanAt(model, column, rowIndex - 1);
  const beforePrevious = periodSpanAt(model, column, rowIndex - 2);
  return current !== null && previous !== null && beforePrevious !== null
    && current.length > Math.min(previous.length, beforePrevious.length);
};

// Uens beløb må kun springe gentagelseskravet over, når perioderne viser en forventelig satsgrænse.
const hasSalaryIncreaseBoundary = (model: AutofillSuggestModel, column: AutofillColumn, rowIndex: number): boolean =>
  [rowIndex - 2, rowIndex - 1, rowIndex]
    .some((index) => {
      const span = periodSpanAt(model, column, index);
      return span !== null && crossesSalaryIncreaseBoundary(span);
    });

/**
 * Den projicerede værdi for en celle, uden formatering.
 *
 * Eksporteret alene for testbarhed: den måler mønstret uden at gå gennem feltets codec. Synlighedsreglen
 * (regel 1) hører i {@link resolveAutofillSuggestion} og ikke her, så en test kan måle et mønster
 * isoleret fra spørgsmålet om, hvorvidt ghosten faktisk må vises.
 */
export const projectAutofillColumnValue = (
  model: AutofillSuggestModel,
  colIndex: number,
  rowIndex: number
): AutofillSampleValue | null => {
  const column = columnAt(model, colIndex);
  if (column === null || rowIndex < 0) return null;

  // Regel 3: både beløb og katalogvalg kræver to ens værdier. Beløb har desuden periodelængde- og
  // grænsevilkår; ét udfyldt felt over målet kan ikke begrunde en gentagelse.
  if (column.kind === 'amount' || column.kind === 'choice') {
    const above = column.samples[rowIndex - 1];
    const before = column.samples[rowIndex - 2];
    if (above === undefined || above.kind !== column.kind || before === undefined || before.kind !== column.kind) return null;
    if (column.kind === 'choice') return before.value === above.value ? above : null;
    if (before.value === above.value) return isCurrentPeriodLonger(model, column, rowIndex) ? null : above;
    return hasSalaryIncreaseBoundary(model, column, rowIndex) ? above : null;
  }

  if (column.kind === 'date') {
    if (column.pairedDateRole === 'start' && column.linkedColIndex !== undefined) {
      const endColumn = columnAt(model, column.linkedColIndex);
      if (endColumn?.kind === 'date') {
        const starts = collectAbove(column, rowIndex, pickDate);
        const ends = collectAbove(endColumn, rowIndex, pickDate);
        const previousStart = starts[0] === undefined ? undefined : parseISODate(starts[0]);
        const latestStart = starts[1] === undefined ? undefined : parseISODate(starts[1]);
        const previousEnd = ends[0] === undefined ? undefined : parseISODate(ends[0]);
        const latestEnd = ends[1] === undefined ? undefined : parseISODate(ends[1]);
        // Sammenhængende perioder kan skifte længde. At fremskrive startdatoens egen afstand kan da
        // lande før seneste slutdato (01-04 til 26-04, 27-04 til 24-05 gav 23-05); brug næste dag efter slut.
        if (previousStart && latestStart && previousEnd && latestEnd
          && previousStart.getTime() <= previousEnd.getTime()
          && latestStart.getTime() <= latestEnd.getTime()
          && addDays(previousEnd, 1).getTime() === latestStart.getTime()
          && projectDateSeries(ends) !== null) {
          const nextStart = addDays(latestEnd, 1);
          const iso = dateToISO(nextStart);
          return Number.isNaN(nextStart.getTime()) || iso === undefined ? null : { kind: 'date', iso };
        }
      }
    }
    const next = projectDateSeries(collectAbove(column, rowIndex, pickDate));
    if (next === null) return null;
    if (column.pairedDateRole === 'start' && column.linkedColIndex !== undefined) {
      const endColumn = columnAt(model, column.linkedColIndex);
      const lastEnd = endColumn?.samples[rowIndex - 1];
      const projectedStart = parseISODate(next);
      if (endColumn?.kind === 'date' && lastEnd?.kind === 'date' && projectedStart !== undefined) {
        const latestEnd = parseISODate(lastEnd.iso);
        if (latestEnd !== undefined && projectedStart.getTime() <= latestEnd.getTime()) return null;
      }
    }
    return { kind: 'date', iso: next };
  }

  if (column.kind === 'week') {
    const next = projectWeekSeries(collectAbove(column, rowIndex, pickWeek));
    return next === null ? null : { kind: 'week', week: next.week, year: next.year };
  }

  const linked = column.linkedColIndex === undefined ? null : columnAt(model, column.linkedColIndex);

  if (column.kind === 'monthOfYear') {
    if (linked !== null && linked.kind === 'year') {
      const next = projectAbsoluteMonthSeries(absoluteMonthSamplesAbove(column, linked, rowIndex));
      if (next !== null) return { kind: 'monthOfYear', month: fromAbsoluteMonth(next).month };
    }
    // Uden ét ægte årstal findes der ingen kalender at wrappe i; måneden fortsætter da modulært.
    const next = projectMonthOfYearSeries(collectAbove(column, rowIndex, pickMonth));
    return next === null ? null : { kind: 'monthOfYear', month: next };
  }

  if (linked !== null && linked.kind === 'monthOfYear') {
    const next = projectAbsoluteMonthSeries(absoluteMonthSamplesAbove(linked, column, rowIndex));
    if (next !== null) {
      // Har brugeren allerede tastet månedens tal i målrækken, er det DEN, der bestemmer årstallet –
      // ellers kunne de to celler i samme række modsige hinanden.
      const committedMonth = linked.samples[rowIndex];
      if (committedMonth !== undefined && committedMonth.kind === 'monthOfYear') {
        const year = yearPlacingMonthNearest(next, committedMonth.month);
        return year === null ? null : { kind: 'year', year };
      }
      return { kind: 'year', year: fromAbsoluteMonth(next).year };
    }
  }

  return null;
};

/**
 * Forslaget for én celle, eller `null`.
 *
 * To synlighedsregler afgør, om der overhovedet regnes et mønster:
 *
 *  - **Cellen selv skal være tom.** Det er ikke kun en optimering, men den strukturelle garanti for, at et
 *    Enter-accept ikke kan overskrive noget (`keyboard-navigation.md`: «Enter overskriver værdi uden
 *    brugerens samtykke» er en fejl).
 *  - **Cellen umiddelbart OVER skal være udfyldt** (regel 1). Reglen måles på CELLEN og ikke på rækken.
 *    Forskellen er den, udvikleren fotograferede: en række med en tastet måned, men en tom årscelle, er
 *    udfyldt som RÆKKE – og en rækkeprøve lod derfor årskolonnen foreslå et årstal i rækken NEDENUNDER,
 *    to celler under det seneste årstal. Med celleprøven kan forslaget aldrig springe over en tom celle,
 *    og «to linjer under den seneste indtastning» er udelukket ved konstruktion.
 */
export const resolveAutofillSuggestion = (
  model: AutofillSuggestModel,
  rowId: string,
  colIndex: number
): AutofillSuggestion | null => {
  const rowIndex = model.rowIds.indexOf(rowId);
  if (rowIndex < 1) return null;
  const column = columnAt(model, colIndex);
  if (column === null) return null;
  if (column.samples[rowIndex] !== undefined) return null;
  if (column.samples[rowIndex - 1] === undefined) return null;

  const value = projectAutofillColumnValue(model, colIndex, rowIndex);
  if (value === null) return null;

  return column.format(value);
};
