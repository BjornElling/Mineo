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

// Autofill-suggest, lag 4 (motoren). Ren funktion af modellen: ingen React, ingen reader, ingen DOM.
//
// ── Motorens tre regler ─────────────────────────────────────────────────────────────────────────────
// Reglerne er udviklerens, skærpet 2026-09-07 efter at have set funktionen i drift. De erstatter et
// tidligere, mere «hjælpsomt» regelsæt, hvis pris var, at brugeren ikke kunne forudsige, hvornår en
// ghost ville stå der, og hvad den ville bygge på:
//
//  1. **Ghosten står KUN i cellen umiddelbart under en udfyldt celle i SAMME kolonne.** Er cellen
//     ovenover tom, findes der intet forslag – uanset hvad der står længere oppe, og uanset om rækken
//     ovenover er udfyldt i andre kolonner. Reglen er hele forudsigeligheden: forslaget bygger altid på
//     noget, brugeren kan se lige over caret.
//  2. **Perioderne fremskrives af kolonnens eget mønster.** Måned og år er ÉN serie, så årstallet
//     skifter, når måneden wrapper. Månedsprøverne er hele månedskolonnen – også de rækker, hvor
//     årstallet endnu ikke er tastet (se `absoluteMonthSamplesAbove`).
//  3. **Beløb og katalogvalg GENTAGER cellen ovenover.** Intet mønster, ingen tilvækst, ingen
//     årsskifte-gate. Reglen er hele svaret på «hvad foreslår beløbskolonnen?».

/** Kolonnen med det givne indeks, eller `null`. */
const columnAt = (model: AutofillSuggestModel, colIndex: number): AutofillColumn | null =>
  model.columns.find((column) => column.colIndex === colIndex) ?? null;

/**
 * Prøverne i rækkerne OVER `rowIndex`, i visningsorden, afkodet af `pick`.
 *
 * `pick` er en narrowing-funktion frem for en art-parameter, så udtrækket sker gennem den diskriminerede
 * union og ikke gennem en type-assertion: en prøve af en anden art bliver `null` og springes over.
 * Netop dét er også kravets filter – tomme, delvise og fejlbehæftede celler bærer ingen prøve og
 * udelades, så mønstret dannes af de øvrige.
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
  const limit = Math.min(rowIndex, monthColumn.samples.length);
  const entries: { month: number; year: number | null }[] = [];
  for (let index = 0; index < limit; index += 1) {
    const month = monthColumn.samples[index];
    if (month === undefined || month.kind !== 'monthOfYear') continue;
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

  // Regel 3: beløb og katalogvalg gentager cellen umiddelbart over. Der findes ikke noget beløbsMØNSTER
  // at genkende – et gæt på en lønudvikling er den dyreste fejl, en autofill kan lave i en
  // erstatningsopgørelse, og en gate på kalenderår gjorde det tilfældigt, hvornår ghosten dukkede op.
  if (column.kind === 'amount' || column.kind === 'choice') {
    const above = column.samples[rowIndex - 1];
    if (above === undefined || above.kind !== column.kind) return null;
    return above;
  }

  if (column.kind === 'date') {
    const next = projectDateSeries(collectAbove(column, rowIndex, pickDate));
    return next === null ? null : { kind: 'date', iso: next };
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

  // Uden en brugbar måned/år-serie GENTAGER årskolonnen cellen ovenover.
  //
  // Faldbacket var tidligere en selvstændig årsSERIE, og den var forkert: årskolonnen alene ser rækken
  // 2025, 2026 og svarer 2027 uden at vide, hvilken måned rækken hører til. Men INTET faldback var også
  // forkert, for det ramte et almindeligt arbejdsmønster – brugeren, der udfylder kolonne for kolonne og
  // skriver årstallene først. Da findes der ingen månedsprøver, og årskolonnen fik aldrig en ghost.
  //
  // Gentagelsen er det rigtige svar netop for denne kolonne: en løntabel har 12 rækker pr. kalenderår i
  // måned-tilstand, så det samme årstal gentaget er det normale, og en tilvækst pr. række er det ikke.
  const above = column.samples[rowIndex - 1];
  return above !== undefined && above.kind === 'year' ? above : null;
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
