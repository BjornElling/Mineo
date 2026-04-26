import type { AslAfgoerelseRow, ErhvervsevnetabComposedValues, JaNej } from '../../schemas/formSchemas';
import type { EetIssue } from './eetTypes';
import type { ISODateString } from '../../types/branded';
import { coerceToISODateString, createDate, dateToISO, minIso, parseISODate } from '../../types/branded';
import {
  ASL_MAX_AARSLOEN_2003,
  ASL_MAX_AARSLOEN_2024,
  aarsloenAslMax,
  reguleringsprocentErhvervsevnetabFoer2024,
} from '../../data/lovbestemteRates';
import { amountValueToNumber } from '../../utils/expressionAmount';
import { formatAsAmountTrimmed } from '../../utils/formatUtils';
import { addDays, addMonths } from '../../utils/dateUtils';
import { dedupeIssuesBySeverityAndMessage } from '../../utils/issueUtils';
import { ceilNearest12, round0, round2, round4, roundNearest1000 } from '../../utils/roundingShortcuts';
import { SKAERING_2011_01_01, SKAERING_2024_07_01 } from './eetSkaeringsdatoer';
import { resolveAslReguleringRateForSatsAar } from './eetReguleringRater';
import { optaelMaanederPraecis } from '../erstatningsopgoerelse/engines/periodiseringsMotor';
import { ASL_IDENTICAL_AFGOERELSER_ID, collectIncompleteRowIssues, hasIdenticalAfgoerelser, hasTextValue, isAslAfgoerelseRowEmpty, parsePercentDraft } from './eetAslAfgoerelser';
import { isUnderOrEqualTwoYearsToFpByBekendtgoerelse, resolveKapitaliseringTabelvalgForControlDate } from './eetKapitaliseringOpslag';

export type EetLoebendePeriodeRow = Readonly<{
  fra: ISODateString;
  til: ISODateString;
  satsAar: number;
  maanederPraecis: number;
  grundydelseAfrundet: number;
  reguleringPct: number;
  maanedligYdelse: number;
  beregnetEet: number;
}>;

export type EetLoebendeAfgoerelseComputation = Readonly<{
  rowId: string;
  afgoerelsesdato: ISODateString;
  virkningsdato: ISODateString;
  kapitaliseringsdato: ISODateString | null;
  skaeringsDato: ISODateString | null;
  harOverlap: boolean;
  afgoerelseType: 'Midlertidig' | 'Delvist endelig' | 'Endelig';
  eetPct: number;
  priorKapPct: number;
  eetPctFoerAktuelKap: number;
  kapPctAktuel: number;
  kapPctKumulativ: number;
  restEetPct: number;
  harKapitalisering: boolean;
  harRestSektion: boolean;
  tilbagevirkendeKraft: boolean;
  ophoerDato: ISODateString;
  ophoerAarsag: 'beregningsdato' | 'senere-afgoerelse' | 'kapitalisering' | 'folkepensionsdato';
  grundydelseFuld: number;
  grundydelseRest: number | null;
  grundydelse2024Fuld: number;
  grundydelse2024Rest: number | null;
  // Visningsrækker for faktiske krav. Perioder med 0 kr. udelades bevidst og perioder er derfor ikke en komplet periodisering.
  perioder: readonly EetLoebendePeriodeRow[];
  iAltBeregnetEet: number;
}>;

export type EetLoebendeAarsydelseReguleringStep = Readonly<{
  satsAar: number;
  reguleringPct: number;
  reguleringsfaktor: number;
  aarsydelseFuldFoerAfrunding: number;
  aarsydelseRestFoerAfrunding: number | null;
}>;

export type EetLoebendeComputation = Readonly<{
  beregningsdato: ISODateString;
  skadedato: ISODateString;
  fodselsdato: ISODateString;
  skadesaar: number;
  aslAarsloenAfrundet1000: number;
  maxAarsloenISkadesaar: number;
  benyttetAarsloen: number;
  grundloenNiveau: '2003' | '2024';
  grundloen: number;
  erstatningsniveauPct: 80 | 83;
  amBidragPct: 0 | 8;
  // Kumuleret regulering fra 2003-niveau til 2024-niveau. Kun relevant for grundloenNiveau === '2003'.
  reguleringFoer2024Pct: number;
  afgoerelser: readonly EetLoebendeAfgoerelseComputation[];
}>;

export type EetLoebendeCalculationResult = Readonly<{
  issues: readonly EetIssue[];
  computation: EetLoebendeComputation | null;
}>;

type Input = Readonly<{
  erhvervsevnetab: ErhvervsevnetabComposedValues;
  skadedato: ISODateString | undefined;
  skadelidteFodselsdato: ISODateString | undefined;
}>;

type ResolvedAfgoerelse = Readonly<{
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

type PeriodSectionRow = Readonly<{
  fra: ISODateString;
  til: ISODateString;
  satsAar: number;
  eetPct: number;
}>;

type AfgoerelseTransition = Readonly<{
  useOverlap: boolean;
  cutoverDate: ISODateString;
  skaeringsDato: ISODateString | null;
}>;

const toIssue = (id: string, message: string): EetIssue => ({ id, severity: 'error', message });
const toWarning = (id: string, message: string): EetIssue => ({ id, severity: 'warning', message });

const parsePct = (raw: string | undefined): number | undefined => {
  const parsed = parsePercentDraft(raw);
  // 0 % giver ingen løbende ydelse og behandles derfor som ikke-deltagende række.
  if (parsed === undefined || parsed === 0) return undefined;
  return parsed;
};
const formatPctForWarning = (value: number): string =>
  Number.isInteger(value) ? `${value}` : `${value}`.replace('.', ',');

const toYear = (iso: ISODateString): number => Number.parseInt(iso.slice(0, 4), 10);

const endOfYearIso = (year: number): ISODateString => `${year}-12-31` as ISODateString;

const isoDayBefore = (iso: ISODateString): ISODateString | undefined => {
  const parsed = parseISODate(iso);
  if (!parsed) return undefined;
  return dateToISO(addDays(parsed, -1));
};

const isoDayAfter = (iso: ISODateString): ISODateString | undefined => {
  const parsed = parseISODate(iso);
  if (!parsed) return undefined;
  return dateToISO(addDays(parsed, 1));
};

export const firstOfMonthAfter = (iso: ISODateString): ISODateString => {
  const parsed = parseISODate(iso);
  if (!parsed) {
    throw new Error(`Invalid ISODateString invariant in firstOfMonthAfter: ${iso}`);
  }
  const monthIndex = parsed.getUTCMonth();
  const nextMonthYear = monthIndex === 11 ? parsed.getUTCFullYear() + 1 : parsed.getUTCFullYear();
  const nextMonthIndex = monthIndex === 11 ? 0 : monthIndex + 1;
  const nextMonthFirst = dateToISO(createDate(nextMonthYear, nextMonthIndex, 1));
  if (!nextMonthFirst) {
    throw new Error(`Could not construct first day of next month for ISODateString: ${iso}`);
  }
  return nextMonthFirst;
};

export const hasOverlapPeriod = (
  virkningsdato: ISODateString,
  afgoerelsesdato: ISODateString
): boolean => virkningsdato < firstOfMonthAfter(afgoerelsesdato);

const sortResolvedAfgoerelser = (rows: readonly ResolvedAfgoerelse[]): ResolvedAfgoerelse[] => {
  return [...rows].sort((a, b) => {
    if (a.afgoerelsesdato !== b.afgoerelsesdato) return a.afgoerelsesdato < b.afgoerelsesdato ? -1 : 1;
    if (a.virkningsdato !== b.virkningsdato) return a.virkningsdato < b.virkningsdato ? -1 : 1;
    return a.sortKey < b.sortKey ? -1 : 1;
  });
};

const collectResolvedAfgoerelser = (
  rows: readonly AslAfgoerelseRow[]
): ResolvedAfgoerelse[] => {
  const resolved: ResolvedAfgoerelse[] = [];

  for (const row of rows) {
    const eetPct = parsePct(row.eetPct);
    if (eetPct === undefined) continue;
    const afgoerelsesdato = coerceToISODateString(row.afgoerelsesDato);
    const virkningsdato = coerceToISODateString(row.virkningsDato);
    if (!afgoerelsesdato || !virkningsdato || !row.afgoerelseType) continue;

    resolved.push({
      rowId: row.id,
      afgoerelsesdato,
      virkningsdato,
      afgoerelseType: row.afgoerelseType,
      eetPct,
      kapDato: coerceToISODateString(row.kapDato),
      kapPct: parsePct(row.kapPct) ?? 0,
      fsTilbageholdtEet: row.fsTilbageholdtEet ?? 'Nej',
      sortKey: row.id,
    });
  }

  return sortResolvedAfgoerelser(resolved);
};

const collectWarnings = (
  skadedato: ISODateString,
  beregningsdato: ISODateString,
  afgoerelser: readonly ResolvedAfgoerelse[],
  issues: EetIssue[]
): void => {
  if (afgoerelser.some((row) => row.eetPct < 15)) {
    issues.push(toWarning('warn-asl-eet-under-15', 'Der er indtastet en afgørelse med < 15 % erhvervsevnetab.'));
  }

  const firstInvalidPctAfter2024 = skadedato >= SKAERING_2024_07_01
    ? afgoerelser.find((row) => row.eetPct > 15 && row.eetPct % 10 !== 0)
    : undefined;
  if (firstInvalidPctAfter2024) {
    issues.push(
      toWarning(
        'warn-invalid-eet-pct-after-2024-07-01',
        `Der er indtastet en ugyldig EET-procent (${formatPctForWarning(firstInvalidPctAfter2024.eetPct)} %) for skader fra 1. juli 2024.`
      )
    );
  }

  const endeligDates = afgoerelser
    .filter((row) => row.afgoerelseType === 'Endelig')
    .map((row) => row.afgoerelsesdato);

  if (endeligDates.length > 0) {
    const earliestEndelig = endeligDates.reduce((earliest, current) => (current < earliest ? current : earliest));
    if (
      afgoerelser.some(
        (row) =>
          (row.afgoerelseType === 'Midlertidig' || row.afgoerelseType === 'Delvist endelig') &&
          row.afgoerelsesdato > earliestEndelig
      )
    ) {
      issues.push(
        toWarning(
          'warn-non-endelig-after-endelig',
          'Der er angivet en midlertidig eller delvist endelig afgørelse efter en endelig afgørelse.'
        )
      );
    }
  }

  if (afgoerelser.some((row) => row.afgoerelsesdato > beregningsdato)) {
    issues.push(toWarning('warn-afgoerelsesdato-after-beregningsdato', 'Der er angivet en afgørelsesdato efter beregningsdatoen.'));
  }

  if (afgoerelser.some((row) => row.virkningsdato > beregningsdato)) {
    issues.push(toWarning('warn-virkningsdato-after-beregningsdato', 'Der er angivet en virkningsdato efter beregningsdatoen.'));
  }

  if (afgoerelser.some((row) => row.kapDato !== undefined && row.kapDato > beregningsdato)) {
    issues.push(toWarning('warn-kap-dato-after-beregningsdato', 'Der er angivet en kapitaliseringsdato efter beregningsdatoen.'));
  }
};

const collectBlockingInputIssues = (rows: readonly AslAfgoerelseRow[], issues: EetIssue[]): void => {
  for (const issue of collectIncompleteRowIssues(rows)) {
    if (issue.id === 'endelig-under-50-missing-kapitalisering') continue;
    issues.push(toIssue(issue.id, issue.message));
  }

  const hasDelvistEndeligWithoutKapInfo = rows.some((row) => {
    if (row.afgoerelseType !== 'Delvist endelig') return false;
    return !hasTextValue(row.kapDato) && !hasTextValue(row.kapPct);
  });
  if (hasDelvistEndeligWithoutKapInfo) {
    issues.push(
      toIssue(
        'delvist-endelig-missing-kapitalisering',
        'Der er angivet en delvist endelig afgørelse uden kapitalisering.'
      )
    );
  }

  if (hasIdenticalAfgoerelser(rows)) {
    issues.push(toIssue(
      ASL_IDENTICAL_AFGOERELSER_ID,
      'Der er angivet to identiske afgørelser med samme afgørelsesdato og virkningsdato.'
    ));
  }
};

const buildFullSectionPeriods = (
  args: Readonly<{
    virkningsdato: ISODateString;
    afgoerelsesdato: ISODateString;
    slutdato: ISODateString;
  }>
): Array<Readonly<{ fra: ISODateString; til: ISODateString; satsAar: number }>> => {
  if (args.virkningsdato > args.slutdato) return [];
  const result: Array<Readonly<{ fra: ISODateString; til: ISODateString; satsAar: number }>> = [];
  const virkningsaar = toYear(args.virkningsdato);
  const afgoerelsesaar = toYear(args.afgoerelsesdato);

  if (virkningsaar < afgoerelsesaar) {
    // Første periode bruger afgørelsesårets sats, når virkning starter i et tidligere år.
    // Derefter skifter satsår normalt ved hvert årsskifte frem til slutdatoen.
    const firstEnd = minIso(args.slutdato, endOfYearIso(afgoerelsesaar));
    result.push({ fra: args.virkningsdato, til: firstEnd, satsAar: afgoerelsesaar });
    const nextStart = isoDayAfter(firstEnd);
    if (!nextStart || nextStart > args.slutdato) return result;

    let cursor = nextStart;
    while (cursor <= args.slutdato) {
      const year = toYear(cursor);
      const rowEnd = minIso(args.slutdato, endOfYearIso(year));
      result.push({ fra: cursor, til: rowEnd, satsAar: year });
      const after = isoDayAfter(rowEnd);
      if (!after || after > args.slutdato) break;
      cursor = after;
    }
    return result;
  }

  // Når virkning og afgørelse ligger i samme år, bliver satsåret dette år uanset datoorden.
  // Hvis virkning først indtræder efter afgørelsesdatoen i et senere år, følger første satsår virkningsåret.
  const firstSatsAar = args.virkningsdato <= args.afgoerelsesdato ? afgoerelsesaar : virkningsaar;
  const firstEnd = minIso(args.slutdato, endOfYearIso(virkningsaar));
  result.push({ fra: args.virkningsdato, til: firstEnd, satsAar: firstSatsAar });

  const nextStart = isoDayAfter(firstEnd);
  if (!nextStart || nextStart > args.slutdato) return result;

  let cursor = nextStart;
  while (cursor <= args.slutdato) {
    const year = toYear(cursor);
    const rowEnd = minIso(args.slutdato, endOfYearIso(year));
    result.push({ fra: cursor, til: rowEnd, satsAar: year });
    const after = isoDayAfter(rowEnd);
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
    const year = toYear(cursor);
    const rowEnd = minIso(args.slutdato, endOfYearIso(year));
    result.push({ fra: cursor, til: rowEnd, satsAar: year });
    const after = isoDayAfter(rowEnd);
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
    const dayBeforeBoundary = isoDayBefore(boundary);
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
  const invalidRow = rows.find((row) => row.fra > row.til);
  if (invalidRow) {
    throw new Error(`Invalid EET period invariant: ${invalidRow.fra} is after ${invalidRow.til}`);
  }
  return [...rows];
};

const activeKapitaliseringPctAt = (
  events: readonly KapitaliseringEvent[],
  dato: ISODateString
): number => events.reduce((sum, event) => (event.dato <= dato ? sum + event.pct : sum), 0);

const activeKapitaliseringPctAtExcluding = (
  events: readonly KapitaliseringEvent[],
  dato: ISODateString,
  rowId: string
): number => events.reduce((sum, event) => (event.dato <= dato && event.rowId !== rowId ? sum + event.pct : sum), 0);

const restEetPctAt = (
  afgoerelse: Pick<ResolvedAfgoerelse, 'eetPct'>,
  events: readonly KapitaliseringEvent[],
  dato: ISODateString
): number => Math.max(0, afgoerelse.eetPct - activeKapitaliseringPctAt(events, dato));

const buildKapitaliseringEvents = (
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
  // FS tilbageholdt EET på forgængeren er en overgangsregel: næste afgørelse afløser på sin faktiske virkningsdato.
  if (!previous || previous.fsTilbageholdtEet === 'Ja' || !hasOverlapPeriod(current.virkningsdato, current.afgoerelsesdato)) {
    return {
      useOverlap: false,
      cutoverDate: current.virkningsdato,
      skaeringsDato: null,
    };
  }

  const skaeringsDato = firstOfMonthAfter(current.afgoerelsesdato);
  return {
    useOverlap: true,
    cutoverDate: skaeringsDato,
    skaeringsDato,
  };
};

const buildComputedSectionRows = (
  args: Readonly<{
    current: ResolvedAfgoerelseWithKapitalisering;
    previous: ResolvedAfgoerelseWithKapitalisering | undefined;
    finalStop: ISODateString;
    useOverlap: boolean;
    events: readonly KapitaliseringEvent[];
  }>
): PeriodSectionRow[] => {
  const { current, previous, finalStop, useOverlap, events } = args;
  const rows: PeriodSectionRow[] = [];
  const skaeringsDato = firstOfMonthAfter(current.afgoerelsesdato);
  const overlapEnd = useOverlap ? isoDayBefore(skaeringsDato) : undefined;
  const splitBoundaries = events.map((event) => event.dato);

  if (useOverlap && previous && overlapEnd) {
    const boundedOverlapEnd = minIso(overlapEnd, finalStop);
    const overlapBasePeriods = buildCalendarYearSectionPeriods({
      startdato: current.virkningsdato,
      slutdato: boundedOverlapEnd,
    });

    for (const period of overlapBasePeriods) {
      const splitRows = splitPeriodByBoundaries(period, [
        ...splitBoundaries,
        previous.virkningsdato,
      ]);
      for (const splitRow of splitRows) {
        const currentRest = restEetPctAt(current, events, splitRow.fra);
        const previousRest = previous.virkningsdato <= splitRow.fra
          ? restEetPctAt(previous, events, splitRow.fra)
          : 0;
        rows.push({
          ...splitRow,
          eetPct: Math.max(0, currentRest - previousRest),
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
      const splitRows = splitPeriodByBoundaries(period, splitBoundaries);
      for (const splitRow of splitRows) {
        rows.push({
          ...splitRow,
          eetPct: restEetPctAt(current, events, splitRow.fra),
        });
      }
    }
  }

  return assertValidPeriodSectionRows(rows);
};

/**
 * Beregner dagen før folkepensionsdatoen for én afgørelse.
 * Returnerer undefined hvis tabelvalget ikke kan slås op.
 */
const resolveFolkepensionsDagFoer = (
  skadedato: ISODateString,
  fodselsdato: ISODateString,
  controlDate: ISODateString
): ISODateString | undefined => {
  const tabelvalg = resolveKapitaliseringTabelvalgForControlDate(skadedato, fodselsdato, controlDate);
  if (!tabelvalg) return undefined;
  const parsedBirth = parseISODate(fodselsdato);
  if (!parsedBirth) return undefined;
  const folkepensionsdato = addMonths(parsedBirth, tabelvalg.folkepensionsalderMaaneder);
  const folkepensionsdatoIso = dateToISO(folkepensionsdato);
  if (!folkepensionsdatoIso) return undefined;
  return isoDayBefore(folkepensionsdatoIso);
};

const OPHOER_AARSAG_PRIORITY: Readonly<Record<EetLoebendeAfgoerelseComputation['ophoerAarsag'], number>> = {
  'senere-afgoerelse': 1,
  kapitalisering: 2,
  folkepensionsdato: 3,
  beregningsdato: 4,
};

const toAfgoerelseLabel = (
  afgoerelseType: ResolvedAfgoerelse['afgoerelseType'],
  hasRestSektion: boolean,
  hasKapitalisering: boolean
): string => {
  if (afgoerelseType === 'Midlertidig') return 'Midlertidig afgørelse';
  if (afgoerelseType === 'Delvist endelig') return 'Delvist endelig afgørelse';
  if (hasRestSektion) return 'Endelig afgørelse (delvist kap.)';
  if (hasKapitalisering) return 'Endelig afgørelse (kapitaliseret)';
  return 'Endelig afgørelse';
};

export const computeEetLoebendeYdelser = (input: Input): EetLoebendeCalculationResult => {
  const issues: EetIssue[] = [];

  const beregningsdato = coerceToISODateString(input.erhvervsevnetab.beregningsdato);
  const skadedato = input.skadedato;
  const fodselsdato = input.skadelidteFodselsdato;

  const aslAarsloenRaw = amountValueToNumber(input.erhvervsevnetab.aslAarsloen);

  if (!Number.isFinite(aslAarsloenRaw)) {
    issues.push(toIssue('aarsloen-missing', 'Årsløn er ikke udfyldt.'));
  } else if (aslAarsloenRaw === 0) {
    issues.push(toIssue('aarsloen-zero', 'Årsløn må ikke være 0 kr.'));
  }
  if (!fodselsdato) {
    issues.push(toIssue('skadelidte-fodselsdato-missing', 'Fødselsdato er ikke udfyldt.'));
  }
  if (!beregningsdato) {
    issues.push(toIssue('beregningsdato-missing', 'Beregningsdato er ikke udfyldt.'));
  }
  if (!skadedato) {
    issues.push(toIssue('skadedato-missing', 'Skadedato er ikke udfyldt.'));
  }

  collectBlockingInputIssues(input.erhvervsevnetab.aslAfgoerelser, issues);

  const resolvedAfgoerelser = collectResolvedAfgoerelser(input.erhvervsevnetab.aslAfgoerelser);
  const allRowsEmpty = input.erhvervsevnetab.aslAfgoerelser.every((row) => isAslAfgoerelseRowEmpty(row));
  if (allRowsEmpty) {
    issues.push(toIssue('asl-afgoerelser-empty', 'Ingen ASL-afgørelser er indtastet.'));
  }

  if (
    issues.some((issue) => issue.severity === 'error') ||
    !Number.isFinite(aslAarsloenRaw) ||
    !beregningsdato ||
    !skadedato ||
    !fodselsdato
  ) {
    return { issues: dedupeIssuesBySeverityAndMessage(issues), computation: null };
  }

  const skadesaar = toYear(skadedato);
  const maxAarsloenISkadesaar = aarsloenAslMax[skadesaar];
  if (!Number.isFinite(maxAarsloenISkadesaar)) {
    issues.push(toIssue('aarsloen-max-missing', `Maksimum årsløn mangler for år ${skadesaar}`));
    return { issues: dedupeIssuesBySeverityAndMessage(issues), computation: null };
  }

  const aslAarsloen = aslAarsloenRaw as number;
  const aslAarsloenAfrundet1000 = roundNearest1000(aslAarsloen);
  const benyttetAarsloen = Math.min(aslAarsloenAfrundet1000, maxAarsloenISkadesaar);

  collectWarnings(skadedato, beregningsdato, resolvedAfgoerelser, issues);

  const ealAarsloenInput = amountValueToNumber(input.erhvervsevnetab.ealAarsloen);
  if ((ealAarsloenInput === undefined || !Number.isFinite(ealAarsloenInput)) && aslAarsloen === maxAarsloenISkadesaar) {
    issues.push(toWarning('warn-asl-aarsloen-is-max', 'Skadelidtes fulde årsløn skal indtastes for EAL — ikke maks. årslønnen efter ASL.'));
  }

  const before2024Skade = skadedato < SKAERING_2024_07_01;
  const from2011 = skadedato >= SKAERING_2011_01_01;
  const reguleringFoer2024 = reguleringsprocentErhvervsevnetabFoer2024[2024];
  if (before2024Skade && !Number.isFinite(reguleringFoer2024)) {
    issues.push(toIssue('reguleringssats-missing-2024', 'Reguleringssats mangler for år 2024'));
    return { issues: dedupeIssuesBySeverityAndMessage(issues), computation: null };
  }

  const grundloen = before2024Skade
    ? round0(benyttetAarsloen * (ASL_MAX_AARSLOEN_2003 / maxAarsloenISkadesaar))
    : round0(benyttetAarsloen * (ASL_MAX_AARSLOEN_2024 / maxAarsloenISkadesaar));

  const erstatningsniveau = from2011 ? 0.83 : 0.8;
  const amFaktor = from2011 ? 0.92 : 1;
  const erstatningsniveauPct = from2011 ? 83 : 80;
  const amBidragPct = from2011 ? 8 : 0;

  const { resolvedRows: resolvedAfgoerelserWithKapitalisering, events: kapitaliseringEvents } =
    buildKapitaliseringEvents(resolvedAfgoerelser, skadedato, fodselsdato);

  const computations: EetLoebendeAfgoerelseComputation[] = [];

  for (let i = 0; i < resolvedAfgoerelserWithKapitalisering.length; i += 1) {
    const current = resolvedAfgoerelserWithKapitalisering[i];
    const previous = resolvedAfgoerelserWithKapitalisering[i - 1];
    const next = resolvedAfgoerelserWithKapitalisering[i + 1];
    const priorKapPct = activeKapitaliseringPctAtExcluding(kapitaliseringEvents, current.virkningsdato, current.rowId);
    const currentTransition = resolveAfgoerelseTransition(previous, current);
    const hasKapitalisering = !!current.effectiveKapDato && current.effectiveKapPct > 0;
    const kapPctKumulativ = current.effectiveKapDato
      ? activeKapitaliseringPctAt(kapitaliseringEvents, current.effectiveKapDato)
      : priorKapPct;
    const kapPctFoerAktuelKap = current.effectiveKapDato
      ? activeKapitaliseringPctAtExcluding(kapitaliseringEvents, current.effectiveKapDato, current.rowId)
      : priorKapPct;
    const eetPctFoerAktuelKap = Math.max(0, current.eetPct - kapPctFoerAktuelKap);
    const restEetPct = hasKapitalisering && current.effectiveKapDato
      ? restEetPctAt(current, kapitaliseringEvents, current.effectiveKapDato)
      : restEetPctAt(current, kapitaliseringEvents, current.virkningsdato);
    const hasRestSection = hasKapitalisering && restEetPct > 0;

    const nextTransition = next ? resolveAfgoerelseTransition(current, next) : undefined;
    const nextStopDate = nextTransition ? isoDayBefore(nextTransition.cutoverDate) : undefined;
    const folkepensionsDagFoer = resolveFolkepensionsDagFoer(skadedato, fodselsdato, current.afgoerelsesdato);
    const dayBeforeKapitalisering = current.effectiveKapDato ? isoDayBefore(current.effectiveKapDato) : undefined;

    const finalCandidates: Array<Readonly<{ date: ISODateString; cause: EetLoebendeAfgoerelseComputation['ophoerAarsag'] }>> = [
      { date: beregningsdato, cause: 'beregningsdato' },
    ];
    if (nextStopDate) finalCandidates.push({ date: nextStopDate, cause: 'senere-afgoerelse' });
    if (folkepensionsDagFoer) finalCandidates.push({ date: folkepensionsDagFoer, cause: 'folkepensionsdato' });
    if (!hasRestSection && dayBeforeKapitalisering) {
      finalCandidates.push({ date: dayBeforeKapitalisering, cause: 'kapitalisering' });
    }

    const finalStop = finalCandidates.reduce((earliest, currentCandidate) => {
      if (currentCandidate.date < earliest.date) return currentCandidate;
      if (currentCandidate.date > earliest.date) return earliest;
      // Prioritet bruges kun som deterministisk tie-break ved identiske ophørsdatoer.
      return OPHOER_AARSAG_PRIORITY[currentCandidate.cause] < OPHOER_AARSAG_PRIORITY[earliest.cause]
        ? currentCandidate
        : earliest;
    });

    const fullPctFactor = eetPctFoerAktuelKap / 100;
    const restPctFactor = restEetPct / 100;
    const grundydelseFuld = round2(grundloen * fullPctFactor * erstatningsniveau * amFaktor);
    const grundydelseRest = hasRestSection
      ? round2(grundloen * restPctFactor * erstatningsniveau * amFaktor)
      : null;

    const grundydelse2024Fuld = before2024Skade
      ? round2(grundydelseFuld * (1 + reguleringFoer2024 / 100))
      : grundydelseFuld;
    const grundydelse2024Rest =
      before2024Skade && grundydelseRest !== null
        ? round2(grundydelseRest * (1 + reguleringFoer2024 / 100))
        : grundydelseRest;

    const allPeriods = buildComputedSectionRows({
      current,
      previous,
      finalStop: finalStop.date,
      useOverlap: currentTransition.useOverlap,
      events: kapitaliseringEvents,
    });
    const computedRows: EetLoebendePeriodeRow[] = [];

    for (const sectionRow of allPeriods) {
      const rateInfo = resolveAslReguleringRateForSatsAar(sectionRow.satsAar, before2024Skade, issues);
      if (rateInfo === null) continue;

      const sectionGrundydelse = round2(grundloen * (sectionRow.eetPct / 100) * erstatningsniveau * amFaktor);
      const sectionGrundydelse2024 = before2024Skade
        ? round2(sectionGrundydelse * (1 + reguleringFoer2024 / 100))
        : sectionGrundydelse;
      const effektivGrundydelseBase =
        before2024Skade && sectionRow.satsAar >= 2024 ? sectionGrundydelse2024 : sectionGrundydelse;

      const grundydelseAfrundet = effektivGrundydelseBase;
      const aarsydelse = ceilNearest12(effektivGrundydelseBase * rateInfo.factor);
      const maanedligYdelse = aarsydelse / 12;
      const maanederPraecis = optaelMaanederPraecis({
        fra: sectionRow.fra,
        til: sectionRow.til,
        oevrigeFravaersdage: 0,
      });
      if (maanederPraecis === null) continue;
      const beregnetEet = round0(maanederPraecis * maanedligYdelse);
      // Tabellerne på siden og i PDF'en viser kun perioder med et faktisk krav.
      if (beregnetEet === 0) continue;

      computedRows.push({
        fra: sectionRow.fra,
        til: sectionRow.til,
        satsAar: sectionRow.satsAar,
        maanederPraecis,
        grundydelseAfrundet,
        reguleringPct: rateInfo.reguleringPct,
        maanedligYdelse,
        beregnetEet,
      });
    }

    const iAltBeregnetEet = computedRows.reduce((sum, row) => sum + row.beregnetEet, 0);

    computations.push({
      rowId: current.rowId,
      afgoerelsesdato: current.afgoerelsesdato,
      virkningsdato: current.virkningsdato,
      kapitaliseringsdato: hasKapitalisering && current.effectiveKapDato ? current.effectiveKapDato : null,
      skaeringsDato: currentTransition.skaeringsDato,
      harOverlap: currentTransition.useOverlap,
      afgoerelseType: current.afgoerelseType,
      eetPct: current.eetPct,
      priorKapPct,
      eetPctFoerAktuelKap,
      kapPctAktuel: current.effectiveKapPct,
      kapPctKumulativ,
      restEetPct,
      harKapitalisering: hasKapitalisering,
      harRestSektion: hasRestSection,
      tilbagevirkendeKraft: current.virkningsdato < current.afgoerelsesdato,
      ophoerDato: finalStop.date,
      ophoerAarsag: finalStop.cause,
      grundydelseFuld,
      grundydelseRest,
      grundydelse2024Fuld,
      grundydelse2024Rest,
      perioder: computedRows,
      iAltBeregnetEet,
    });
  }

  if (issues.some((issue) => issue.severity === 'error')) {
    return { issues: dedupeIssuesBySeverityAndMessage(issues), computation: null };
  }

  const computation: EetLoebendeComputation = {
    beregningsdato,
    skadedato,
    fodselsdato,
    skadesaar,
    aslAarsloenAfrundet1000,
    maxAarsloenISkadesaar,
    benyttetAarsloen,
    grundloenNiveau: before2024Skade ? '2003' : '2024',
    grundloen,
    erstatningsniveauPct,
    amBidragPct,
    reguleringFoer2024Pct: before2024Skade ? (reguleringFoer2024 ?? 0) : 0,
    afgoerelser: computations,
  };

  return {
    issues: dedupeIssuesBySeverityAndMessage(issues),
    computation,
  };
};

export const formatPercentTrimmedFromRounded4 = (value: number): string => {
  return formatAsAmountTrimmed(round4(value), 4);
};

export const buildLoebendeAarsydelseReguleringSteps = (
  afgoerelse: EetLoebendeAfgoerelseComputation
): readonly EetLoebendeAarsydelseReguleringStep[] => {
  const periodYears = [...new Set(afgoerelse.perioder
    .filter((row) => row.satsAar > 2024)
    .map((row) => row.satsAar))]
    .sort((a, b) => a - b);
  const fallbackYear = toYear(afgoerelse.afgoerelsesdato);
  const uniqueYears = periodYears.length > 0
    ? periodYears
    : fallbackYear > 2024
      ? [fallbackYear]
      : [];

  const restGrundydelse2024 = afgoerelse.grundydelse2024Rest ?? null;

  return uniqueYears.map((satsAar) => {
    const reguleringPct = afgoerelse.perioder.find((row) => row.satsAar === satsAar)?.reguleringPct ?? 0;
    const reguleringsfaktor = round4(1 + reguleringPct / 100);
    return {
      satsAar,
      reguleringPct,
      reguleringsfaktor,
      aarsydelseFuldFoerAfrunding: round2(afgoerelse.grundydelse2024Fuld * reguleringsfaktor),
      aarsydelseRestFoerAfrunding:
        restGrundydelse2024 === null ? null : round2(restGrundydelse2024 * reguleringsfaktor),
    };
  }).filter((step) => step.reguleringPct !== 0);
};

export const shouldShowLoebende2024ConversionBlock = (
  afgoerelse: EetLoebendeAfgoerelseComputation
): boolean => {
  return afgoerelse.perioder.some((row) => row.satsAar >= 2024);
};

export const toAfgoerelseTypeLabel = (
  afgoerelseType: 'Midlertidig' | 'Delvist endelig' | 'Endelig',
  hasRestSektion: boolean,
  hasKapitalisering: boolean
): string => toAfgoerelseLabel(afgoerelseType, hasRestSektion, hasKapitalisering);

export const toOphoerAarsagLabel = (
  cause: EetLoebendeAfgoerelseComputation['ophoerAarsag']
): string => {
  switch (cause) {
    case 'beregningsdato':
      return 'Beregningsdato';
    case 'senere-afgoerelse':
      return 'Senere afgørelse';
    case 'kapitalisering':
      return 'Kapitalisering';
    case 'folkepensionsdato':
      return 'Folkepensionsdato';
    default:
      return cause;
  }
};

export const formatSkadedatoCompact = (iso: ISODateString): string => {
  const [year, month, day] = iso.split('-');
  const d = Number.parseInt(day, 10);
  const m = Number.parseInt(month, 10);
  return `${d}/${m}-${year}`;
};

export const formatPct = (value: number): string => `${formatPercentTrimmedFromRounded4(value)} %`;
