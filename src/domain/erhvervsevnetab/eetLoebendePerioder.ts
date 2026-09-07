import { getDagenFoerFolkepensionsdato } from '../../data/folkepensionAlderRates';
import type { JaNej } from '../../schemas/formSchemas';
import type { ISODateString } from '../../types/branded';
import { endOfYearIso, firstOfMonthAfterIso, getDayAfterIso, getDayBeforeIso, isoYear, minISO } from '../../utils/isoDateHelpers';
import { isUnderOrEqualTwoYearsToFpByBekendtgoerelse } from './eetKapitaliseringOpslag';
import { z } from 'zod';
import { isoDateString } from '../../schemas/formSchemas/baseSchemas';

// Den komplette periodisering bevares også ved nulkrav. Forklaringer må ikke udledes
// af den filtrerede pengetabel, hvor kapitalisering og dækkede overlap kan være usynlige.
export const eetLoebendeDelperiodeSchema = z.object({
  fra: isoDateString,
  til: isoDateString,
  satsAar: z.number().int(),
  eetPct: z.number().finite().nonnegative(),
  restEetPct: z.number().finite().nonnegative(),
  tidligereYdelsePct: z.number().finite().nonnegative(),
  kapitaliseretPct: z.number().finite().nonnegative(),
  overlap: z.boolean(),
}).strict().readonly();
export type PeriodSectionRow = z.infer<typeof eetLoebendeDelperiodeSchema>;

export const firstOfMonthAfter = firstOfMonthAfterIso;

export const hasOverlapPeriod = (virkningsdato: ISODateString, afgoerelsesdato: ISODateString): boolean =>
  virkningsdato < firstOfMonthAfter(afgoerelsesdato);

export type ResolvedAfgoerelse = Readonly<{
  rowId: string;
  afgoerelsesdato: ISODateString;
  virkningsdato: ISODateString;
  afgoerelseType: 'Midlertidig' | 'Delvist endelig' | 'Endelig';
  eetPct: number;
  kapDato: ISODateString | undefined;
  kapPct: number;
  fsTilbageholdtEet: JaNej;
  sortKey: string;
}>;

type ResolvedAfgoerelseWithKapitalisering = ResolvedAfgoerelse & Readonly<{
  effectiveKapDato: ISODateString | undefined;
  effectiveKapPct: number;
}>;

type KapitaliseringEvent = Readonly<{
  rowId: string;
  dato: ISODateString;
  pct: number;
}>;

type AfgoerelseTransition = Readonly<{
  useOverlap: boolean;
  calculateOverlap: boolean;
  cutoverDate: ISODateString;
  skaeringsDato: ISODateString | null;
}>;

type ResolvedAfgoerelseTiming = Readonly<{
  afgoerelse: ResolvedAfgoerelseWithKapitalisering;
  ophoerDato: ISODateString;
  perioder: readonly PeriodSectionRow[];
}>;

const buildFullSectionPeriods = (
  args: Readonly<{
    virkningsdato: ISODateString;
    afgoerelsesdato: ISODateString;
    slutdato: ISODateString;
  }>
): Array<Readonly<{ fra: ISODateString; til: ISODateString; satsAar: number }>> => {
  if (args.virkningsdato > args.slutdato) return [];
  const result: Array<Readonly<{ fra: ISODateString; til: ISODateString; satsAar: number }>> = [];
  const virkningsaar = isoYear(args.virkningsdato);
  const afgoerelsesaar = isoYear(args.afgoerelsesdato);

  if (virkningsaar < afgoerelsesaar) {
    // Første periode bruger afgørelsesårets sats, når virkning starter i et tidligere år.
    // Derefter skifter satsår normalt ved hvert årsskifte frem til slutdatoen.
    const firstEnd = minISO(args.slutdato, endOfYearIso(afgoerelsesaar));
    result.push({ fra: args.virkningsdato, til: firstEnd, satsAar: afgoerelsesaar });
    const nextStart = getDayAfterIso(firstEnd);
    if (!nextStart || nextStart > args.slutdato) return result;

    let cursor = nextStart;
    while (cursor <= args.slutdato) {
      const year = isoYear(cursor);
      const rowEnd = minISO(args.slutdato, endOfYearIso(year));
      result.push({ fra: cursor, til: rowEnd, satsAar: year });
      const after = getDayAfterIso(rowEnd);
      if (!after || after > args.slutdato) break;
      cursor = after;
    }
    return result;
  }

  // Når virkning og afgørelse ligger i samme år, bliver satsåret dette år uanset datoorden.
  // Hvis virkning først indtræder efter afgørelsesdatoen i et senere år, følger første satsår virkningsåret.
  const firstSatsAar = args.virkningsdato <= args.afgoerelsesdato ? afgoerelsesaar : virkningsaar;
  const firstEnd = minISO(args.slutdato, endOfYearIso(virkningsaar));
  result.push({ fra: args.virkningsdato, til: firstEnd, satsAar: firstSatsAar });

  const nextStart = getDayAfterIso(firstEnd);
  if (!nextStart || nextStart > args.slutdato) return result;

  let cursor = nextStart;
  while (cursor <= args.slutdato) {
    const year = isoYear(cursor);
    const rowEnd = minISO(args.slutdato, endOfYearIso(year));
    result.push({ fra: cursor, til: rowEnd, satsAar: year });
    const after = getDayAfterIso(rowEnd);
    if (!after || after > args.slutdato) break;
    cursor = after;
  }
  return result;
};

const buildCalendarYearSectionPeriods = (
  args: Readonly<{
    startdato: ISODateString;
    slutdato: ISODateString;
  }>
): Array<Readonly<{ fra: ISODateString; til: ISODateString; satsAar: number }>> => {
  // Bruges kun til overlapperioder, som allerede ligger før skæringsdatoen.
  // Fuld-ydelsesperioder skal fortsat bruge buildFullSectionPeriods, fordi den håndterer tilbagevirkende kraft.
  if (args.startdato > args.slutdato) return [];
  const result: Array<Readonly<{ fra: ISODateString; til: ISODateString; satsAar: number }>> = [];
  let cursor = args.startdato;

  while (cursor <= args.slutdato) {
    const year = isoYear(cursor);
    const rowEnd = minISO(args.slutdato, endOfYearIso(year));
    result.push({ fra: cursor, til: rowEnd, satsAar: year });
    const after = getDayAfterIso(rowEnd);
    if (!after || after > args.slutdato) break;
    cursor = after;
  }

  return result;
};

const splitPeriodByBoundaries = (
  period: Readonly<{ fra: ISODateString; til: ISODateString; satsAar: number }>,
  boundaries: readonly ISODateString[]
): Array<Readonly<{ fra: ISODateString; til: ISODateString; satsAar: number }>> => {
  const result: Array<Readonly<{ fra: ISODateString; til: ISODateString; satsAar: number }>> = [];
  let cursor = period.fra;
  const sortedBoundaries = [...new Set(boundaries)]
    .filter((boundary) => boundary > period.fra && boundary <= period.til)
    .sort();

  for (const boundary of sortedBoundaries) {
    const dayBeforeBoundary = getDayBeforeIso(boundary);
    if (dayBeforeBoundary && cursor <= dayBeforeBoundary) {
      result.push({ fra: cursor, til: dayBeforeBoundary, satsAar: period.satsAar });
    }
    cursor = boundary;
  }

  if (cursor <= period.til) {
    result.push({ fra: cursor, til: period.til, satsAar: period.satsAar });
  }

  return result;
};

const assertValidPeriodSectionRows = (rows: readonly PeriodSectionRow[]): PeriodSectionRow[] => {
  for (const [index, row] of rows.entries()) {
    if (row.fra > row.til) {
      throw new Error(`Invalid EET period invariant: ${row.fra} is after ${row.til}`);
    }

    const previous = rows[index - 1];
    if (!previous) continue;

    const expectedStart = getDayAfterIso(previous.til);
    if (expectedStart === undefined || row.fra !== expectedStart) {
      // Denne funktion arbejder på den komplette tekniske periodisering, før rækker med 0 kr.
      // eventuelt skjules i visningen. Derfor skal hvert teknisk delinterval være både sorteret
      // og direkte sammenhængende; ellers kan en ny skæringsregel skabe dobbelt- eller tabte dage.
      throw new Error(`Invalid EET period invariant: ${previous.til} is not directly before ${row.fra}`);
    }
  }
  return [...rows];
};

export const activeKapitaliseringPctAt = (
  events: readonly KapitaliseringEvent[],
  dato: ISODateString
): number => events.reduce((sum, event) => (event.dato <= dato ? sum + event.pct : sum), 0);

export const activeKapitaliseringPctAtExcluding = (
  events: readonly KapitaliseringEvent[],
  dato: ISODateString,
  rowId: string
): number => events.reduce((sum, event) => (event.dato <= dato && event.rowId !== rowId ? sum + event.pct : sum), 0);

export const restEetPctAt = (
  afgoerelse: Pick<ResolvedAfgoerelse, 'eetPct'>,
  events: readonly KapitaliseringEvent[],
  dato: ISODateString
): number => Math.max(0, afgoerelse.eetPct - activeKapitaliseringPctAt(events, dato));

/** Også en senere afgørelses kapitalisering kan afslutte den tidligere ydelse. */
const resolveKapitaliseringsOphoer = (
  afgoerelse: Pick<ResolvedAfgoerelse, 'eetPct'>,
  events: readonly KapitaliseringEvent[]
): ISODateString | undefined => {
  const event = events.find(({ dato }) => restEetPctAt(afgoerelse, events, dato) === 0);
  return event ? getDayBeforeIso(event.dato) : undefined;
};

export const buildKapitaliseringEvents = (
  rows: readonly ResolvedAfgoerelse[],
  skadedato: ISODateString,
  fodselsdato: ISODateString
): { resolvedRows: ResolvedAfgoerelseWithKapitalisering[]; events: KapitaliseringEvent[] } => {
  const resolvedRows: ResolvedAfgoerelseWithKapitalisering[] = [];
  const events: KapitaliseringEvent[] = [];

  for (const row of rows) {
    const isEndeligUnderOrEqualTwoYears =
      row.afgoerelseType === 'Endelig' &&
      isUnderOrEqualTwoYearsToFpByBekendtgoerelse(skadedato, fodselsdato, row.afgoerelsesdato);
    const effectiveKapDato = isEndeligUnderOrEqualTwoYears ? row.afgoerelsesdato : row.kapDato;
    const activeKapPctBeforeCurrent = effectiveKapDato
      ? activeKapitaliseringPctAt(events, effectiveKapDato)
      : 0;
    const effectiveKapPct = isEndeligUnderOrEqualTwoYears
      ? Math.max(0, row.eetPct - activeKapPctBeforeCurrent)
      : row.kapPct;

    const resolvedRow: ResolvedAfgoerelseWithKapitalisering = {
      ...row,
      effectiveKapDato,
      effectiveKapPct,
    };
    resolvedRows.push(resolvedRow);

    if (effectiveKapDato && effectiveKapPct > 0) {
      events.push({ rowId: row.rowId, dato: effectiveKapDato, pct: effectiveKapPct });
    }
  }

  return {
    resolvedRows,
    events: events.sort((a, b) => {
      if (a.dato !== b.dato) return a.dato < b.dato ? -1 : 1;
      return a.rowId < b.rowId ? -1 : 1;
    }),
  };
};

const resolveAfgoerelseTransition = (
  previous: ResolvedAfgoerelseWithKapitalisering | undefined,
  current: ResolvedAfgoerelseWithKapitalisering
): AfgoerelseTransition => {
  // Afgørelser fra samme dag er én samlet afgørelseshandling. De afløser derfor altid
  // hinanden på virkningsdatoerne, også når disse ligger før afgørelsesdatoen.
  if (
    !previous ||
    previous.afgoerelsesdato === current.afgoerelsesdato ||
    !hasOverlapPeriod(current.virkningsdato, current.afgoerelsesdato)
  ) {
    return {
      useOverlap: false,
      calculateOverlap: false,
      cutoverDate: current.virkningsdato,
      skaeringsDato: null,
    };
  }

  const skaeringsDato = firstOfMonthAfter(current.afgoerelsesdato);
  if (previous.fsTilbageholdtEet === 'Ja') {
    return {
      // Visningen må fortsat vise, at den umiddelbare forgænger er tilbageholdt.
      // Beregningen skal dog undersøge ældre, faktisk udbetalte afgørelser i samme periode.
      useOverlap: false,
      calculateOverlap: true,
      cutoverDate: skaeringsDato,
      skaeringsDato: null,
    };
  }
  return {
    useOverlap: true,
    calculateOverlap: true,
    cutoverDate: skaeringsDato,
    skaeringsDato,
  };
};

const resolvePaidPredecessorPct = (
  predecessors: readonly ResolvedAfgoerelseTiming[],
  dato: ISODateString
): number => {
  // En mellemliggende nedsættelse kan have givet nul ekstra, mens en ældre ydelse
  // fortsatte. Derfor fratrækkes de faktiske bidrag, aldrig en nominelt valgt forgænger.
  return predecessors.reduce((sum, predecessor) => {
    if (predecessor.afgoerelse.fsTilbageholdtEet === 'Ja') return sum;
    const periode = predecessor.perioder.find((row) => row.fra <= dato && dato <= row.til);
    return sum + (periode?.eetPct ?? 0);
  }, 0);
};

const hasNonWithheldPredecessorInterval = (
  predecessors: readonly ResolvedAfgoerelseTiming[],
  current: ResolvedAfgoerelseWithKapitalisering
): boolean => {
  const overlapEnd = getDayBeforeIso(firstOfMonthAfter(current.afgoerelsesdato));
  if (!overlapEnd) return false;
  return predecessors.some(({ afgoerelse, ophoerDato }) =>
    afgoerelse.fsTilbageholdtEet === 'Nej' &&
    afgoerelse.virkningsdato <= overlapEnd &&
    ophoerDato >= current.virkningsdato
  );
};

const buildComputedSectionRows = (
  args: Readonly<{
    current: ResolvedAfgoerelseWithKapitalisering;
    predecessors: readonly ResolvedAfgoerelseTiming[];
    finalStop: ISODateString;
    useOverlap: boolean;
    events: readonly KapitaliseringEvent[];
  }>
): PeriodSectionRow[] => {
  const { current, predecessors, finalStop, useOverlap, events } = args;
  const rows: PeriodSectionRow[] = [];
  const skaeringsDato = firstOfMonthAfter(current.afgoerelsesdato);
  const overlapEnd = useOverlap ? getDayBeforeIso(skaeringsDato) : undefined;
  const overlapSplitBoundaries = [
    ...events.map((event) => event.dato),
    ...predecessors.flatMap(({ perioder }) => perioder.flatMap(({ fra, til }) => [fra, getDayAfterIso(til)])),
  ];

  if (useOverlap && overlapEnd) {
    const boundedOverlapEnd = minISO(overlapEnd, finalStop);
    const overlapBasePeriods = buildCalendarYearSectionPeriods({
      startdato: current.virkningsdato,
      slutdato: boundedOverlapEnd,
    });

    for (const period of overlapBasePeriods) {
      const splitRows = splitPeriodByBoundaries(period, overlapSplitBoundaries);
      for (const splitRow of splitRows) {
        const currentRest = restEetPctAt(current, events, splitRow.fra);
        const previousRest = resolvePaidPredecessorPct(predecessors, splitRow.fra);
        rows.push({
          ...splitRow,
          eetPct: Math.max(0, currentRest - previousRest),
          restEetPct: currentRest,
          tidligereYdelsePct: previousRest,
          kapitaliseretPct: activeKapitaliseringPctAt(events, splitRow.fra),
          overlap: true,
        });
      }
    }
  }

  const fullStart = useOverlap ? skaeringsDato : current.virkningsdato;
  if (fullStart <= finalStop) {
    const fullBasePeriods = buildFullSectionPeriods({
      virkningsdato: fullStart,
      afgoerelsesdato: current.afgoerelsesdato,
      slutdato: finalStop,
    });
    for (const period of fullBasePeriods) {
      const splitRows = splitPeriodByBoundaries(period, events.map((event) => event.dato));
      for (const splitRow of splitRows) {
        rows.push({
          ...splitRow,
          eetPct: restEetPctAt(current, events, splitRow.fra),
          restEetPct: restEetPctAt(current, events, splitRow.fra),
          tidligereYdelsePct: 0,
          kapitaliseretPct: activeKapitaliseringPctAt(events, splitRow.fra),
          overlap: false,
        });
      }
    }
  }

  return assertValidPeriodSectionRows(rows);
};


export const eetLoebendeOphoerAarsagSchema = z.enum(['beregningsdato', 'senere-afgoerelse', 'kapitalisering', 'folkepensionsdato']);
type LoebendeOphoerAarsag = z.infer<typeof eetLoebendeOphoerAarsagSchema>;
type LoebendeOphoer = Readonly<{ date: ISODateString; cause: LoebendeOphoerAarsag }>;
type LoebendePeriodeplanEntry = Readonly<{
  current: ResolvedAfgoerelseWithKapitalisering;
  transition: AfgoerelseTransition;
  ophoer: LoebendeOphoer;
  perioder: readonly PeriodSectionRow[];
}>;

/**
 * Beregner dagen før folkepensionsdatoen for én afgørelse.
 * Returnerer undefined hvis folkepensionsalderen ikke kan slås op centralt.
 */
const resolveFolkepensionsDagFoer = (
  fodselsdato: ISODateString,
  controlDate: ISODateString
): ISODateString | undefined => {
  return getDagenFoerFolkepensionsdato(fodselsdato, controlDate);
};

const OPHOER_AARSAG_PRIORITY: Readonly<Record<LoebendeOphoerAarsag, number>> = {
  'senere-afgoerelse': 1,
  kapitalisering: 2,
  folkepensionsdato: 3,
  beregningsdato: 4,
};

/** Én afgrænsning og bidragstidslinje til beregning, overlap, ophør og alle aftagere. */
export const buildLoebendePeriodeplan = (
  resolvedAfgoerelserWithKapitalisering: readonly ResolvedAfgoerelseWithKapitalisering[],
  kapitaliseringEvents: readonly KapitaliseringEvent[],
  fodselsdato: ISODateString,
  loebendeYdelserSlutdato: ISODateString,
): LoebendePeriodeplanEntry[] => {
  const afgoerelseTimings = resolvedAfgoerelserWithKapitalisering.map((current, index) => {
    const previous = resolvedAfgoerelserWithKapitalisering[index - 1];
    const next = resolvedAfgoerelserWithKapitalisering[index + 1];
    // Samtidige afgørelser afløser hinanden på virkningsdatoerne, men hver del
    // skal stadig modregne ydelser fra afgørelser truffet FØR den fælles afgørelsesdag.
    const previousDecision = previous?.afgoerelsesdato === current.afgoerelsesdato
      ? resolvedAfgoerelserWithKapitalisering.slice(0, index).reverse().find((row) => row.afgoerelsesdato < current.afgoerelsesdato)
      : previous;
    const transition = resolveAfgoerelseTransition(previousDecision, current);
    const nextTransition = next ? resolveAfgoerelseTransition(current, next) : undefined;
    const nextStopDate = nextTransition ? getDayBeforeIso(nextTransition.cutoverDate) : undefined;
    const folkepensionsDagFoer = resolveFolkepensionsDagFoer(fodselsdato, current.afgoerelsesdato);
    const dayBeforeKapitalisering = current.effectiveKapDato ? getDayBeforeIso(current.effectiveKapDato) : undefined;
    const hasRestSection = current.effectiveKapDato !== undefined &&
      restEetPctAt(current, kapitaliseringEvents, current.effectiveKapDato) > 0;

    const finalCandidates: Array<Readonly<{ date: ISODateString; cause: LoebendeOphoerAarsag }>> = [
      { date: loebendeYdelserSlutdato, cause: 'beregningsdato' },
    ];
    if (nextStopDate) finalCandidates.push({ date: nextStopDate, cause: 'senere-afgoerelse' });
    if (folkepensionsDagFoer) finalCandidates.push({ date: folkepensionsDagFoer, cause: 'folkepensionsdato' });
    if (!hasRestSection && dayBeforeKapitalisering) {
      finalCandidates.push({ date: dayBeforeKapitalisering, cause: 'kapitalisering' });
    }

    if (current.fsTilbageholdtEet === 'Ja') {
      for (const laterAfgoerelse of resolvedAfgoerelserWithKapitalisering.slice(index + 1)) {
        // Tilbageholdelse angår kun den del af den gamle afgørelse, der overlapper en senere.
        // En alene liggende periode må aldrig forsvinde, blot fordi feltet er sat til Ja.
        if (
          laterAfgoerelse.afgoerelsesdato > current.afgoerelsesdato &&
          hasOverlapPeriod(laterAfgoerelse.virkningsdato, laterAfgoerelse.afgoerelsesdato)
        ) {
          const dayBeforeLaterVirkningsdato = getDayBeforeIso(laterAfgoerelse.virkningsdato);
          if (dayBeforeLaterVirkningsdato) {
            finalCandidates.push({ date: dayBeforeLaterVirkningsdato, cause: 'senere-afgoerelse' });
          }
        }
      }
    }

    const finalStop = finalCandidates.reduce((earliest, currentCandidate) => {
      if (currentCandidate.date < earliest.date) return currentCandidate;
      if (currentCandidate.date > earliest.date) return earliest;
      // Prioritet bruges kun som deterministisk tie-break ved identiske ophørsdatoer.
      return OPHOER_AARSAG_PRIORITY[currentCandidate.cause] < OPHOER_AARSAG_PRIORITY[earliest.cause]
        ? currentCandidate
        : earliest;
    });

    return { current, transition, finalStop };
  });

  const plan: LoebendePeriodeplanEntry[] = [];
  const predecessors: ResolvedAfgoerelseTiming[] = [];
  for (const { current, transition, finalStop } of afgoerelseTimings) {
    const perioder = buildComputedSectionRows({
      current, predecessors, finalStop: finalStop.date,
      useOverlap: transition.calculateOverlap && hasNonWithheldPredecessorInterval(predecessors, current),
      events: kapitaliseringEvents,
    });
    // Den nominelle afløsningsgrænse bestemmer overlap/satsår. Kapitalisering kan
    // afslutte selve ydelsen tidligere; nuldelene bevares i tidslinjen, men ikke i pengetabellen.
    const kapitaliseringsOphoer = resolveKapitaliseringsOphoer(current, kapitaliseringEvents);
    const ophoer: LoebendeOphoer = kapitaliseringsOphoer && kapitaliseringsOphoer < finalStop.date
      ? { date: kapitaliseringsOphoer, cause: 'kapitalisering' }
      : finalStop;
    plan.push({ current, transition, ophoer, perioder });
    predecessors.push({ afgoerelse: current, ophoerDato: finalStop.date, perioder });
  }
  return plan;
};
