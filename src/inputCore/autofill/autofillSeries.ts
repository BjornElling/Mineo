import {
  addDays,
  addMonths,
  createDate,
  getDaysInMonth,
  isoWeekOfDate,
  isoWeeksInYear,
  parseWeekString,
} from '../../utils/dateUtils';
import { diffUtcDays } from '../../utils/utcDayMath';
import { dateToISO, parseISODate, type ISODateString } from '../../types/branded';
import { DEFAULT_AMOUNT_PRECISION } from '../../utils/amountInputUtils';
import { isSafeCanonicalDecimal } from '../../utils/numericSafety';

// Autofill-suggest, lag 2 (ren mønstergenkendelse). Modulet er framework-frit, totalt og kaster ikke: hver
// funktion svarer `null`, når serien ikke bærer et mønster. Det er et bevidst designkrav og ikke
// forsigtighed – en autofill kører på HALVT indtastede tabeller med ugyldige, delvise og manglende
// værdier, og en runtime-fejl dér ville ramme brugeren midt i en indtastning.
//
// ── Hvorfor MODAL-skridtet og ikke «de to seneste rækker» ────────────────────────────────────────────
// Den oprindelige plan dannede mønstret ud af de to seneste udfyldte rækker. Det knækker på det krav,
// udvikleren udtrykkeligt stillede: er januar–juni og august–november indtastet, skal december foreslås.
// De to seneste rækker er da oktober og november (skridt +1) og ville faktisk give december – men den
// samme regel giver et FORKERT svar, når hullet ligger til sidst: juni og august (skridt +2) ville
// foreslå oktober, hvor brugeren vil have september.
//
// Derfor vælges det skridt, der forekommer HYPPIGST mellem seriens naboer, med det senest forekommende
// skridt som tiebreak. Et enkelt hul ændrer ikke længere mønstret, og med præcis to prøver er det modale
// skridt trivielt det ene, der findes – kravet om «mønster efter to rækker» er dermed uændret.

/**
 * Er `candidate` BASISSKRIDTET bag `other` – altså det skridt, `other` ville være, hvis en række manglede?
 *
 * Et hul i serien giver altid et skridt, der er et helt multiplum af det sande skridt med samme fortegn:
 * januar → februar → april giver +1 og +2. Prædikatet bruges KUN som tiebreak (se `selectModalStep`), så
 * en ægte kadence, der har flertal, aldrig overtrumfes af sit eget basisskridt: fire kvartaler (+3, +3,
 * +3) og ét enkelt +1 vinder stadig som +3.
 */
export const isBaseNumericStepOf = (candidate: number, other: number): boolean =>
  candidate !== 0
  && other !== 0
  && Math.sign(candidate) === Math.sign(other)
  && Math.abs(other) > Math.abs(candidate)
  && other % candidate === 0;

/**
 * Vælg det hyppigst forekommende skridt.
 *
 * Uafgjort afgøres i to trin. FØRST vinder et skridt, der er basisskridtet bag et andet af de uafgjorte
 * (`isBaseOf`): januar, februar, april giver præcis ét +1 og ét +2, og uden trinnet ville forslaget blive
 * juni frem for maj – kravet om at et HUL ikke må ændre mønstret ville altså kun holde, når det sande
 * skridt havde flertal. DEREFTER vinder det SENESTE skridt, så et bevidst skift af kadence sidst i
 * tabellen slår et lige så hyppigt ældre skridt af en anden art.
 */
const selectModalStep = <TStep>(
  steps: readonly TStep[],
  keyOf: (step: TStep) => string,
  isBaseOf?: (candidate: TStep, other: TStep) => boolean
): TStep | null => {
  if (steps.length === 0) return null;
  const counts = new Map<string, number>();
  const lastIndex = new Map<string, number>();
  const stepByKey = new Map<string, TStep>();
  steps.forEach((step, index) => {
    const key = keyOf(step);
    counts.set(key, (counts.get(key) ?? 0) + 1);
    lastIndex.set(key, index);
    stepByKey.set(key, step);
  });

  const topCount = Math.max(...counts.values());
  const tiedKeys = [...counts.keys()].filter((key) => counts.get(key) === topCount);
  if (tiedKeys.length === 1) return stepByKey.get(tiedKeys[0] ?? '') ?? null;

  if (isBaseOf !== undefined) {
    const baseKey = tiedKeys.find((key) => tiedKeys.some((otherKey) => {
      if (otherKey === key) return false;
      const candidate = stepByKey.get(key);
      const other = stepByKey.get(otherKey);
      return candidate !== undefined && other !== undefined && isBaseOf(candidate, other);
    }));
    if (baseKey !== undefined) return stepByKey.get(baseKey) ?? null;
  }

  const latestKey = tiedKeys.reduce(
    (best, key) => ((lastIndex.get(key) ?? -1) > (lastIndex.get(best) ?? -1) ? key : best),
    tiedKeys[0] ?? ''
  );
  return stepByKey.get(latestKey) ?? null;
};

/**
 * Skridtene mellem naboprøver. En nabopar, der ikke bærer et lovligt skridt, springes over frem for at
 * ugyldiggøre hele serien: en enkelt urimelig afstand (fx en tastefejl på et årstal) må ikke slukke
 * autofillen for de øvrige rækker.
 */
const consecutiveSteps = <TValue, TStep>(
  values: readonly TValue[],
  stepBetween: (from: TValue, to: TValue) => TStep | null
): readonly TStep[] => {
  const steps: TStep[] = [];
  for (let index = 1; index < values.length; index += 1) {
    const step = stepBetween(values[index - 1], values[index]);
    if (step !== null) steps.push(step);
  }
  return steps;
};

/** Fælles form: mindst to prøver, modalt skridt, anvendt på den SIDSTE prøve. */
const projectSeries = <TValue, TStep>(
  values: readonly TValue[],
  stepBetween: (from: TValue, to: TValue) => TStep | null,
  keyOf: (step: TStep) => string,
  apply: (last: TValue, step: TStep) => TValue | null,
  isBaseOf?: (candidate: TStep, other: TStep) => boolean
): TValue | null => {
  if (values.length < 2) return null;
  const step = selectModalStep(consecutiveSteps(values, stepBetween), keyOf, isBaseOf);
  if (step === null) return null;
  return apply(values[values.length - 1], step);
};

// ── Datoserier ───────────────────────────────────────────────────────────────────────────────────────

/**
 * Et datoskridt. De tre arter findes, fordi et månedsmønster IKKE er et dagsmønster: 31-01 → 28-02 er 28
 * dage, men mønstret er «sidste dag i næste måned», og næste værdi er 31-03 – ikke 28-03.
 */
export type DateAutofillStep =
  | Readonly<{ kind: 'days'; days: number }>
  | Readonly<{ kind: 'monthsSameDay'; months: number }>
  | Readonly<{ kind: 'monthsLastDay'; months: number }>;

/**
 * Det repræsenterbare årsdomæne for enhver autofill-værdi (samme grænse som `ISODateString`).
 *
 * Eksporteret, fordi kolonnebyggerne skal afvise en prøve uden for domænet på VEJEN IND – ellers kan en
 * historisk streng fra et tolerant `.eo`-load nå kalenderaritmetikken og komme ud som `NaN`.
 */
export const MIN_REPRESENTABLE_YEAR = 1900;
export const MAX_REPRESENTABLE_YEAR = 2100;

/** Loft for et dagsskridt. Et interval over godt et år er ikke et mønster, men to urelaterede datoer. */
const MAX_DAY_STEP = 400;
/** Loft for et månedsskridt (to år). Samme begrundelse som dagsloftet. */
const MAX_MONTH_STEP = 24;

const monthDelta = (from: Date, to: Date): number =>
  (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + (to.getUTCMonth() - from.getUTCMonth());

const isLastDayOfMonth = (date: Date): boolean => date.getUTCDate() === getDaysInMonth(date);

export const dateAutofillStepBetween = (from: Date, to: Date): DateAutofillStep | null => {
  const months = monthDelta(from, to);
  if (months !== 0 && Math.abs(months) <= MAX_MONTH_STEP) {
    // Rækkefølgen er en forrang: «sidste dag i måneden» genkendes FØR «samme dag i måneden», fordi den
    // 31. i en 31-dags måned opfylder begge, og kun sidste-dag-formen kan fortsætte korrekt til februar.
    if (isLastDayOfMonth(from) && isLastDayOfMonth(to)) return { kind: 'monthsLastDay', months };
    if (from.getUTCDate() === to.getUTCDate()) return { kind: 'monthsSameDay', months };
  }
  const days = diffUtcDays(from, to);
  if (!Number.isInteger(days) || Math.abs(days) > MAX_DAY_STEP) return null;
  return { kind: 'days', days };
};

export const applyDateAutofillStep = (base: Date, step: DateAutofillStep): Date => {
  if (step.kind === 'days') return addDays(base, step.days);
  if (step.kind === 'monthsSameDay') return addMonths(base, step.months);
  // `addMonths` clamper til månedens længde; for sidste-dag-mønstret skal dagen tværtimod VOKSE til den
  // nye måneds længde (28-02 → 31-03). Derfor regnes skridtet fra den 1. og lander på månedens sidste dag.
  const firstOfMonth = addMonths(createDate(base.getUTCFullYear(), base.getUTCMonth(), 1), step.months);
  return createDate(firstOfMonth.getUTCFullYear(), firstOfMonth.getUTCMonth() + 1, 0);
};

/**
 * Næste dato i serien.
 *
 * Årsskifte er ikke en særregel her: både dags- og månedsskridt regnes på kalenderdage og lander frit i
 * næste år (28-12 + 7 dage → 04-01, 01-12 + 1 måned → 01-01). Det er netop kravet: DATOER må krydse
 * årsskiftet, mens beløb ikke må – og beløbsgaten hører derfor i motoren, ikke her.
 */
export const projectDateSeries = (values: readonly ISODateString[]): ISODateString | null => {
  const dates: Date[] = [];
  for (const value of values) {
    const parsed = parseISODate(value);
    if (parsed !== undefined) dates.push(parsed);
  }
  const next = projectSeries(
    dates,
    dateAutofillStepBetween,
    (step) => (step.kind === 'days' ? `d:${String(step.days)}` : `${step.kind}:${String(step.months)}`),
    (last, step) => applyDateAutofillStep(last, step),
    // Kun skridt af SAMME art kan være basisskridt for hinanden: `days: 31` og `monthsSameDay: 1` kan
    // beskrive samme afstand, men er to forskellige mønstre, og det ene er ikke «det andet med et hul».
    (candidate, other) => candidate.kind === other.kind
      && isBaseNumericStepOf(
        candidate.kind === 'days' ? candidate.days : candidate.months,
        other.kind === 'days' ? other.days : other.months
      )
  );
  if (next === null) return null;
  // `dateToISO` afviser en dato uden for det repræsenterbare domæne (1900–2100), så et mønster, der
  // ville løbe ud over det, giver intet forslag frem for en værdi feltet ikke kan bære.
  return dateToISO(next) ?? null;
};

// ── Ugeserier ────────────────────────────────────────────────────────────────────────────────────────

export type WeekAutofillValue = Readonly<{ week: number; year: number }>;

/** Loft for et ugeskridt. Fire uger er det største mønster, kravet nævner; loftet er rundet rigeligt op. */
const MAX_WEEK_STEP = 60;

/**
 * Ugens mandag. Regnestykket går gennem den kanoniske {@link parseWeekString}, så ugeforståelsen er
 * DEN SAMME som periodeberegningens – ikke en anden fortolkning af ISO-uger i et andet modul.
 */
const mondayOfWeek = (value: WeekAutofillValue): Date | null => {
  const interval = parseWeekString(`${String(value.week)}/${String(value.year)}`);
  if (interval === null) return null;
  // `parseWeekString` validerer ikke sit eget `Date`-resultat: et urimeligt årstal giver et Invalid Date,
  // som ellers ville forplante sig som `NaN` gennem hele aritmetikken og ud i ghost-teksten.
  return Number.isNaN(interval.start.getTime()) ? null : interval.start;
};

/**
 * Ugeskridtet regnes som HELE uger mellem de to mandage – ikke som en differens af ugenumre.
 *
 * Forskellen er årsskiftet: uge 52/2025 → uge 01/2026 er ét skridt, men ugenumrene skifter fra 52 til 1.
 * Et ugenummer-regnestykke skulle da selv kende, om året havde 52 eller 53 uger; mandagsdifferencen
 * kender det gratis.
 */
export const weekAutofillStepBetween = (
  from: WeekAutofillValue,
  to: WeekAutofillValue
): number | null => {
  const fromMonday = mondayOfWeek(from);
  const toMonday = mondayOfWeek(to);
  if (fromMonday === null || toMonday === null) return null;
  const days = diffUtcDays(fromMonday, toMonday);
  if (days % 7 !== 0) return null;
  const weeks = days / 7;
  return Math.abs(weeks) > MAX_WEEK_STEP ? null : weeks;
};

/** Næste uge i serien, inklusive årsskifte (52/2025 → 01/2026 og 53/2020 → 01/2021). */
export const projectWeekSeries = (values: readonly WeekAutofillValue[]): WeekAutofillValue | null =>
  projectSeries(
    values,
    weekAutofillStepBetween,
    (weeks) => `w:${String(weeks)}`,
    (last, weeks) => {
      const monday = mondayOfWeek(last);
      if (monday === null) return null;
      const target = addDays(monday, weeks * 7);
      if (Number.isNaN(target.getTime())) return null;
      const resolved = isoWeekOfDate(target);
      // Ugeværdien skal kunne skrives som «UU/ÅÅÅÅ» i feltet. Prøven er `Number.isInteger`-kontrolleret
      // FØR intervalprøven, fordi en ren `< min || > max`-test er NaN-blind (begge sammenligninger er
      // falske for NaN) og derfor ville fail-OPENE på præcis den værdi, guarden findes for.
      if (!Number.isInteger(resolved.week) || !Number.isInteger(resolved.year)) return null;
      if (resolved.year < MIN_REPRESENTABLE_YEAR || resolved.year > MAX_REPRESENTABLE_YEAR) return null;
      if (resolved.week < 1 || resolved.week > isoWeeksInYear(resolved.year)) return null;
      return resolved;
    },
    isBaseNumericStepOf
  );

// ── Måned, år og måned/år-par ────────────────────────────────────────────────────────────────────────

/** Loft for et månedsskridt i en måned/år-serie. Samme tal som datoernes månedsloft. */
const MAX_ABSOLUTE_MONTH_STEP = MAX_MONTH_STEP;
/** Loft for et rent årsskridt. Et hop over hundrede år er ikke et mønster. */
const MAX_YEAR_STEP = 100;

/** Absolut månedsindeks (år × 12 + måned − 1) – den lineære form af et måned/år-par. */
export const toAbsoluteMonth = (year: number, month: number): number => year * 12 + (month - 1);

/**
 * Etagedivision af et månedsindeks med årets 12 måneder.
 *
 * Skrevet som «træk resten fra og divider op» frem for en direkte etagedivision, fordi den kanoniske
 * afrundingsnorm (`numeric/no-direct-rounding`) forbeholder de direkte afrundingsfunktioner de
 * auditerede moduler – og fordi formen her er eksakt heltalsaritmetik uden en afrunding at diskutere.
 * Restberegningen er fortegnssikker, så et (teoretisk) negativt indeks etagedeler korrekt frem for at
 * trunkere mod nul.
 */
export const floorDivideMonthIndex = (absolute: number): number => {
  const remainder = ((absolute % 12) + 12) % 12;
  return (absolute - remainder) / 12;
};

export const fromAbsoluteMonth = (absolute: number): Readonly<{ year: number; month: number }> => ({
  year: floorDivideMonthIndex(absolute),
  month: (((absolute % 12) + 12) % 12) + 1,
});

/**
 * Næste måned/år-par.
 *
 * Serien regnes som ÉT absolut månedsindeks og ikke som to uafhængige kolonner. Det er hele grunden til
 * koblingen: efter 12/2025 er næste par 01/2026, og årstallet vokser, fordi måneden wrappede – ikke fordi
 * årskolonnen selv havde et mønster (den stod på 2025 hele vejen).
 */
export const projectAbsoluteMonthSeries = (values: readonly number[]): number | null =>
  projectSeries(
    values,
    (from, to) => {
      const delta = to - from;
      return Math.abs(delta) > MAX_ABSOLUTE_MONTH_STEP ? null : delta;
    },
    (delta) => `m:${String(delta)}`,
    (last, delta) => {
      const next = last + delta;
      if (!Number.isInteger(next)) return null;
      const { year } = fromAbsoluteMonth(next);
      return year < MIN_REPRESENTABLE_YEAR || year > MAX_REPRESENTABLE_YEAR ? null : next;
    },
    isBaseNumericStepOf
  );

/**
 * Næste måned, når årskolonnen ikke bidrager med prøver.
 *
 * Skridtet er MODULÆRT, så 11 → 12 fortsætter til 1 (kravet «næste måned med wrap fra 12 til 1»). Uden en
 * årskolonne findes der ingen kalender at wrappe i; serien er ren måned.
 */
export const projectMonthOfYearSeries = (values: readonly number[]): number | null =>
  projectSeries(
    values.filter((month) => Number.isInteger(month) && month >= 1 && month <= 12),
    (from, to) => (((to - from) % 12) + 12) % 12,
    (delta) => `mm:${String(delta)}`,
    (last, delta) => (((last - 1 + delta) % 12) + 12) % 12 + 1,
    isBaseNumericStepOf
  );

/** Næste årstal i en ren årsserie (ingen månedskobling): konstant eller fast tilvækst. */
export const projectYearSeries = (values: readonly number[]): number | null =>
  projectSeries(
    values.filter((year) => Number.isInteger(year)),
    (from, to) => {
      const delta = to - from;
      return Math.abs(delta) > MAX_YEAR_STEP ? null : delta;
    },
    (delta) => `y:${String(delta)}`,
    (last, delta) => {
      const next = last + delta;
      if (!Number.isInteger(next)) return null;
      return next < MIN_REPRESENTABLE_YEAR || next > MAX_REPRESENTABLE_YEAR ? null : next;
    },
    isBaseNumericStepOf
  );

// ── Beløbsserier ─────────────────────────────────────────────────────────────────────────────────────

/**
 * Næste beløb: KUN en gentagelse af den samme værdi.
 *
 * Et beløbsmønster med tilvækst er bevidst ikke understøttet. En løn, der er steget to gange, kan ikke
 * antages at stige igen med samme kroner – og et gæt på et beløb er den dyreste fejl, en autofill kan
 * lave i en erstatningsopgørelse. Kravet siger «ens værdi», og de to seneste prøver skal derfor være ens.
 */
export const projectConstantAmountSeries = (values: readonly number[]): number | null => {
  if (values.length < 2) return null;
  const last = values[values.length - 1];
  if (last !== values[values.length - 2]) return null;
  return isSafeCanonicalDecimal(last, DEFAULT_AMOUNT_PRECISION) ? last : null;
};

/** Næste katalogvalg: kun gentagelse af det samme, allerede kendte valg. */
export const projectConstantChoiceSeries = (values: readonly string[]): string | null => {
  if (values.length < 2) return null;
  const last = values[values.length - 1];
  return last !== undefined && last === values[values.length - 2] && last.trim() !== '' ? last : null;
};
