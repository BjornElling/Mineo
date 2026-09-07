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
//
// ── Hvorfor en PERIODEserie skal være strengt monoton ────────────────────────────────────────────────
// Modalvalget alene var ikke nok. Reviewet 2026-09-07 kørte motoren på halvt indtastede tabeller og fandt
// tre familier af forslag, som ingen bruger kan læse som «næste værdi»:
//
//  - **Gentagelsen.** 6, 6 og 5, 6, 6 foreslog 6 igen. Skridtet mellem to ens naboprøver er 0, og med
//    lige stemmer vandt netop det, fordi tiebreaket tog det SENESTE skridt. En periodekolonne, der
//    gentager sig, er en indtastning på vej til at blive rettet – ikke en kadence.
//  - **Retningsskiftet.** 1, 2, 1 foreslog december året før, og 2025, 2026, 2025 foreslog 2024. Vilkårligt
//    hvilken af de to retninger der vandt, modsagde forslaget den serie, brugeren så.
//  - **Den uafgjorte kadence.** 01-01, 15-01, 01-02 foreslog 18-02: to lige hyppige dagsskridt (+14 og
//    +17), hvor det seneste vandt. Halvmånedsperioder ER et mønster, men ikke et, motoren kender, og et
//    gæt midt imellem to kadencer er værre end ingen ghost.
//
// Derfor gælder for hver periodeart (dato, uge, måned/år, årstal): nulskridt kasseres, blandede retninger
// ugyldiggør serien, og et uafgjort valg mellem to skridt af SAMME art giver intet forslag, medmindre det
// ene er det andets basisskridt. Beløb og katalogvalg er ikke periodeserier – dér er gentagelsen hele
// mønstret, og de har deres egne projektioner nederst i filen.

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
 * Formen af én serieart: hvordan et skridt måles, identificeres, retningsbestemmes og anvendes.
 *
 * Samlet i ét objekt frem for seks positionelle parametre, fordi de fem periodearter nu deler alle
 * reglerne og kun adskiller sig i tre-fire af felterne. Som stillingsparametre kunne en ny art nemt
 * udelade netop det prædikat, der håndhæver en af invarianterne, og forskellen ville først vise sig som
 * et urimeligt forslag i en halvt indtastet tabel.
 */
type SeriesShape<TValue, TStep> = Readonly<{
  /** Skridtet mellem to naboprøver, eller `null` når parret ikke bærer et lovligt skridt. */
  stepBetween: (from: TValue, to: TValue) => TStep | null;
  /** Skridtets identitet i modalvalget. */
  keyOf: (step: TStep) => string;
  /** Anvend det valgte skridt på seriens sidste prøve. */
  apply: (last: TValue, step: TStep) => TValue | null;
  /**
   * Skridtets retning: negativ, nul eller positiv. Nulskridt kasseres, og blandede retninger
   * ugyldiggør serien – se filhovedet for de forslag, de to regler findes for.
   */
  signOf: (step: TStep) => number;
  /** Er `candidate` basisskridtet bag `other`? Første tiebreak. */
  isBaseOf?: (candidate: TStep, other: TStep) => boolean;
  /**
   * Er de to skridt af samme ART?
   *
   * En uafgjort hyppighed INDEN FOR én art er en inkonsistent serie (+14 og +17 dage) og giver intet
   * forslag. Er arterne forskellige (et dagsinterval og et månedsinterval), er der derimod tale om et
   * bevidst skift af kadence, og det seneste skridt vinder.
   */
  sameKind?: (a: TStep, b: TStep) => boolean;
  /**
   * Skridtet, når kolonnen kun har ÉN prøve at fremskrive fra.
   *
   * Findes kun for MÅNEDSserierne, og det er ikke en bekvemmelighed. Kravet er udviklerens «altid én
   * måned op», og uden et defaultskridt var den første række efter en tom tabel usammenhængende: skrev
   * brugeren måned 1, år 2026 og løn 30.000 og gik en række ned, fik LØNNEN en ghost (den gentager blot
   * cellen ovenover), mens måned og år stod tomme, fordi et mønster krævede to prøver. To ghosts og to
   * tomme celler i samme række, uden nogen forskel brugeren kunne se.
   *
   * En månedskolonne har en kanonisk enhed – én måned – og derfor et forsvarligt skridt fra en enkelt
   * prøve. Uge- og datokolonner har det IKKE: en dagskolonne kan bære uge-, 14-dages- eller
   * månedsperioder, og et gæt på hvilken ville være et gæt på brugerens kadence. De kræver fortsat to
   * prøver.
   */
  defaultStep?: TStep;
}>;

/**
 * Vælg det hyppigst forekommende skridt.
 *
 * Uafgjort afgøres i tre trin. FØRST vinder et skridt, der er basisskridtet bag et andet af de uafgjorte
 * (`isBaseOf`): januar, februar, april giver præcis ét +1 og ét +2, og uden trinnet ville forslaget blive
 * juni frem for maj – kravet om at et HUL ikke må ændre mønstret ville altså kun holde, når det sande
 * skridt havde flertal. DEREFTER er en uafgjort strid mellem skridt af SAMME art en inkonsistent serie, og
 * der gives intet forslag. TIL SIDST vinder det SENESTE skridt, så et bevidst skift af kadence sidst i
 * tabellen slår et lige så hyppigt ældre skridt af en anden art.
 */
const selectModalStep = <TValue, TStep>(
  steps: readonly TStep[],
  { keyOf, isBaseOf, sameKind }: SeriesShape<TValue, TStep>
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

  if (sameKind !== undefined) {
    const tiedSteps = tiedKeys
      .map((key) => stepByKey.get(key))
      .filter((step): step is TStep => step !== undefined);
    const [first] = tiedSteps;
    // To lige hyppige kadencer af samme art er ikke ét mønster med en tvivl, men to mønstre uden et
    // fælles næste skridt. Ghosten udelades frem for at vælge den ene halvdel af brugerens serie.
    if (first !== undefined && tiedSteps.every((step) => sameKind(first, step))) return null;
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

/**
 * Fælles form for en PERIODEserie: mindst to prøver, nulskridt kasseret, én entydig retning, modalt
 * skridt, anvendt på den SIDSTE prøve.
 *
 * De to filtre løber FØR modalvalget og ikke som en efterprøve af resultatet. Rækkefølgen er
 * afgørende: et nulskridt, der nåede frem til modalvalget, kunne vinde tiebreaket «seneste skridt» og
 * lade ghosten gentage rækken ovenfor – og netop det var fejlen (se filhovedet).
 */
const projectSeries = <TValue, TStep>(
  values: readonly TValue[],
  shape: SeriesShape<TValue, TStep>
): TValue | null => {
  const [onlyValue] = values;
  if (values.length === 1) {
    // Én prøve bærer ikke et mønster, men kan bære kolonnens kanoniske enhed – se `defaultStep`.
    return onlyValue === undefined || shape.defaultStep === undefined
      ? null
      : shape.apply(onlyValue, shape.defaultStep);
  }
  if (values.length === 0) return null;
  const steps = consecutiveSteps(values, shape.stepBetween)
    .filter((step) => shape.signOf(step) !== 0);
  const [firstStep] = steps;
  if (firstStep === undefined) return null;
  const direction = shape.signOf(firstStep);
  if (steps.some((step) => shape.signOf(step) !== direction)) return null;
  const step = selectModalStep(steps, shape);
  if (step === null) return null;
  return shape.apply(values[values.length - 1], step);
};

// ── Datoserier ───────────────────────────────────────────────────────────────────────────────────────

/**
 * Et datoskridt. De tre arter findes, fordi et månedsmønster IKKE er et dagsmønster: 31-01 → 28-02 er 28
 * dage, men mønstret er «sidste dag i næste måned», og næste værdi er 31-03 – ikke 28-03.
 */
export type DateAutofillStep =
  | Readonly<{ kind: 'days'; days: number }>
  | Readonly<{
      kind: 'monthsSameDay';
      months: number;
      /**
       * Mønstrets NOMINELLE dag i måneden – den dag, brugeren sigter efter, også når en kort måned har
       * clampet den. Se {@link nominalDayOfMonthPattern} for hvorfor skridtet ikke kan klare sig med
       * seriens sidste værdi alene.
       */
      nominalDay: number;
    }>
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

/**
 * Den nominelle dag bag mønstret «samme dag i hver måned», eller `null` når de to datoer ikke deler en.
 *
 * En ren `fromDag === tilDag`-prøve rakte ikke, og reviewet 2026-09-07 målte prisen: 30-01 → 28-02 er den
 * 30. i hver måned, hvor februar har clampet dagen – men fordi dagstallene er forskellige, faldt parret
 * igennem til et DAGSskridt på +29 og foreslog 29-03. Det er hverken brugerens mønster eller et tal, der
 * betyder noget.
 *
 * Derfor bæres den nominelle dag med i skridtet: en dag, der er månedens SIDSTE, kan være en clampet
 * større nominel dag, mens en dag inde i måneden er nominel som den er. Den nominelle dag er den største
 * af de to observerede, og den skal clampe til begge – ellers er der intet fælles mønster.
 */
const nominalDayOfMonthPattern = (from: Date, to: Date): number | null => {
  const fromDay = from.getUTCDate();
  const toDay = to.getUTCDate();
  const nominal = Math.max(fromDay, toDay);
  // En dag inde i måneden er ikke clampet og skal derfor selv VÆRE den nominelle dag.
  if (fromDay !== nominal && !isLastDayOfMonth(from)) return null;
  if (toDay !== nominal && !isLastDayOfMonth(to)) return null;
  if (Math.min(nominal, getDaysInMonth(from)) !== fromDay) return null;
  if (Math.min(nominal, getDaysInMonth(to)) !== toDay) return null;
  return nominal;
};

export const dateAutofillStepBetween = (from: Date, to: Date): DateAutofillStep | null => {
  const months = monthDelta(from, to);
  if (months !== 0 && Math.abs(months) <= MAX_MONTH_STEP) {
    // Rækkefølgen er en forrang: «sidste dag i måneden» genkendes FØR «samme dag i måneden», fordi den
    // 31. i en 31-dags måned opfylder begge, og kun sidste-dag-formen kan fortsætte korrekt til februar.
    if (isLastDayOfMonth(from) && isLastDayOfMonth(to)) return { kind: 'monthsLastDay', months };
    const nominalDay = nominalDayOfMonthPattern(from, to);
    if (nominalDay !== null) return { kind: 'monthsSameDay', months, nominalDay };
  }
  const days = diffUtcDays(from, to);
  if (!Number.isInteger(days) || Math.abs(days) > MAX_DAY_STEP) return null;
  return { kind: 'days', days };
};

export const applyDateAutofillStep = (base: Date, step: DateAutofillStep): Date => {
  if (step.kind === 'days') return addDays(base, step.days);
  // Skridtet regnes fra den 1. i basismåneden for BEGGE månedsformer, så målmåneden findes uafhængigt af,
  // hvad basisdatoens eget dagstal er.
  const firstOfMonth = addMonths(createDate(base.getUTCFullYear(), base.getUTCMonth(), 1), step.months);
  if (step.kind === 'monthsSameDay') {
    // Den NOMINELLE dag genclampes i målmåneden. Det er forskellen på at fortsætte mønstret og at arve en
    // clamp: 30-01 → 28-02 fortsætter til 30-03, hvor `addMonths(28-02, 1)` ville give 28-03 og lade
    // februars længde smitte af på resten af serien.
    return createDate(
      firstOfMonth.getUTCFullYear(),
      firstOfMonth.getUTCMonth(),
      Math.min(step.nominalDay, getDaysInMonth(firstOfMonth))
    );
  }
  // For sidste-dag-mønstret skal dagen tværtimod VOKSE til den nye måneds længde (28-02 → 31-03).
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
  const next = projectSeries(dates, {
    stepBetween: dateAutofillStepBetween,
    // Den nominelle dag er en del af skridtets IDENTITET: «den 1. i hver måned» og «den 30. i hver
    // måned» er to mønstre, ikke to prøver på det samme, og de må ikke tælle sammen i modalvalget.
    keyOf: (step) => {
      if (step.kind === 'days') return `d:${String(step.days)}`;
      if (step.kind === 'monthsSameDay') {
        return `monthsSameDay:${String(step.months)}:${String(step.nominalDay)}`;
      }
      return `monthsLastDay:${String(step.months)}`;
    },
    apply: (last, step) => applyDateAutofillStep(last, step),
    signOf: (step) => Math.sign(step.kind === 'days' ? step.days : step.months),
    // Kun skridt af SAMME art kan være basisskridt for hinanden: `days: 31` og `monthsSameDay: 1` kan
    // beskrive samme afstand, men er to forskellige mønstre, og det ene er ikke «det andet med et hul».
    // To månedsmønstre med forskellig NOMINEL dag er af samme grund heller ikke hinandens basisskridt.
    isBaseOf: (candidate, other) => {
      if (candidate.kind !== other.kind) return false;
      if (candidate.kind === 'monthsSameDay' && other.kind === 'monthsSameDay') {
        return candidate.nominalDay === other.nominalDay
          && isBaseNumericStepOf(candidate.months, other.months);
      }
      return isBaseNumericStepOf(
        candidate.kind === 'days' ? candidate.days : candidate.months,
        other.kind === 'days' ? other.days : other.months
      );
    },
    sameKind: (a, b) => a.kind === b.kind,
  });
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

/**
 * De rent numeriske periodearter (uge, absolut måned, årstal) har kun ÉN skridtart, så enhver uafgjort
 * strid mellem to skridt er en strid inden for arten. `sameKind` er derfor konstant sand, og tiebreaket
 * «seneste skridt» er per konstruktion utilgængeligt for dem: en serie med to lige hyppige, urelaterede
 * kadencer (+2 og +3 uger) giver intet forslag frem for at vælge den, brugeren tastede sidst.
 */
const NUMERIC_STEPS_ARE_ONE_KIND = (): boolean => true;

/** Næste uge i serien, inklusive årsskifte (52/2025 → 01/2026 og 53/2020 → 01/2021). */
export const projectWeekSeries = (values: readonly WeekAutofillValue[]): WeekAutofillValue | null =>
  projectSeries(values, {
    stepBetween: weekAutofillStepBetween,
    keyOf: (weeks) => `w:${String(weeks)}`,
    signOf: Math.sign,
    apply: (last, weeks) => {
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
    isBaseOf: isBaseNumericStepOf,
    sameKind: NUMERIC_STEPS_ARE_ONE_KIND,
  });

// ── Måned, år og måned/år-par ────────────────────────────────────────────────────────────────────────

/** Loft for et månedsskridt i en måned/år-serie. Samme tal som datoernes månedsloft. */
const MAX_ABSOLUTE_MONTH_STEP = MAX_MONTH_STEP;

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
  projectSeries(values, {
    stepBetween: (from, to) => {
      const delta = to - from;
      return Math.abs(delta) > MAX_ABSOLUTE_MONTH_STEP ? null : delta;
    },
    keyOf: (delta) => `m:${String(delta)}`,
    signOf: Math.sign,
    apply: (last, delta) => {
      const next = last + delta;
      if (!Number.isInteger(next)) return null;
      const { year } = fromAbsoluteMonth(next);
      return year < MIN_REPRESENTABLE_YEAR || year > MAX_REPRESENTABLE_YEAR ? null : next;
    },
    isBaseOf: isBaseNumericStepOf,
    sameKind: NUMERIC_STEPS_ARE_ONE_KIND,
    defaultStep: 1,
  });

/**
 * De skridt, en månedskolonne UDEN årstal kan bære: præcis én måned frem eller én måned tilbage.
 *
 * Begrænsningen er den degenererede sags pris. Med et årstal ved siden af er måneden en plads i en
 * kalender, og hvert skridt er entydigt. Uden årstal er den et punkt på en cirkel, hvor ethvert skridt
 * kan læses to veje – og den tidligere MODULÆRE skridtberegning valgte altid vejen fremad, så et
 * faldende par fik fortegnet vendt: 6, 1 blev skridtet +7 og foreslog august, 1, 12 blev +11 og foreslog
 * november. Kontrakten lover netop og kun wrappet 12 → 1 for en årsløs månedskolonne, og et skridt på
 * ±1 er det eneste, der ikke kan forveksles med sin egen modsatte retning.
 */
const CYCLIC_MONTH_STEPS: readonly number[] = Object.freeze([1, -1]);

/** Halvdelen af året. Et skridt herover læses som det tilsvarende skridt i den modsatte retning. */
const HALF_YEAR_MONTHS = 6;

/**
 * Skridtet mellem to måneder på årscirklen, målt som den KORTESTE signerede vej.
 *
 * 12 → 1 er +1 og ikke +11; 2 → 1 er −1 og ikke +11. Det er forskellen på, at 12, 1, 2 kan læses som én
 * voksende serie (tre skridt af +1) i stedet for som et retningsskifte, monotoni-reglen ville forkaste.
 */
const cyclicMonthStepBetween = (from: number, to: number): number | null => {
  const forward = (((to - from) % 12) + 12) % 12;
  const shortest = forward > HALF_YEAR_MONTHS ? forward - 12 : forward;
  return CYCLIC_MONTH_STEPS.includes(shortest) ? shortest : null;
};

/**
 * Næste måned, når årskolonnen ikke bidrager med prøver.
 *
 * Skridtet er begrænset til ±1 (se {@link CYCLIC_MONTH_STEPS}), men ANVENDES modulært, så 11 → 12
 * fortsætter til 1 og 2 → 1 fortsætter til 12. Uden en årskolonne findes der ingen kalender at placere
 * wrappet i; serien er ren måned, og et årsforslag følger ikke med.
 */
export const projectMonthOfYearSeries = (values: readonly number[]): number | null =>
  projectSeries(
    values.filter((month) => Number.isInteger(month) && month >= 1 && month <= 12),
    {
      stepBetween: cyclicMonthStepBetween,
      keyOf: (delta) => `mm:${String(delta)}`,
      signOf: Math.sign,
      apply: (last, delta) => (((last - 1 + delta) % 12) + 12) % 12 + 1,
      // Ingen `isBaseOf`: med kun ±1 som lovlige skridt kan det ene ikke være det andets basisskridt.
      sameKind: NUMERIC_STEPS_ARE_ONE_KIND,
      defaultStep: 1,
    }
  );

// Beløb og katalogvalg har bevidst INGEN projektion i dette modul. De gentager cellen umiddelbart
// ovenover, og det er hele reglen (udviklerens beslutning 2026-09-07, se motorens regel 3). Tidligere
// krævede de to ENS prøver og en gate på kalenderår, og prisen var uforudsigelighed: brugeren kunne ikke
// se, hvorfor beløbskolonnen nogle gange havde en ghost og nogle gange ikke.
