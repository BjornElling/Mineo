import type { AslAfgoerelseRow, ErhvervsevnetabComposedValues, JaNej } from '../../schemas/formSchemas';
import type { Skadestype } from '../../schemas/formSchemas/enumSchemas';
import type { EetIssue } from './eetTypes';
import { EET_UNDER_15_WARNING } from './eetFieldWarnings';
import { MISSING_BEREGNINGSDATO_ISSUE } from './eetIssueCatalog';
import type { ISODateString } from '../../types/branded';
import { coerceToISODateString } from '../../types/branded';
import { getDagenFoerFolkepensionsdato } from '../../data/folkepensionAlderRates';
import {
  endOfYearIso,
  firstOfMonthAfterIso,
  getDayAfterIso,
  getDayBeforeIso,
  isoYear,
  minISO,
} from '../../utils/isoDateHelpers';
import {
  ASL_MAX_AARSLOEN_2003,
  ASL_MAX_AARSLOEN_2024,
  reguleringsprocentErhvervsevnetabFoer2024,
} from '../../data/lovbestemteRates';
import {
  formatAslAarsloensmaksimumMissing,
  resolveAslAarsloensmaksimumForAar,
} from '../satser/aslAarsloensmaksimum';
import { validateAslAarsloenBySkadesaarMax } from '../aslEalAarsloen/aarsloenValidators';
import { amountValueToNumber } from '../../utils/expressionAmount';
import { formatAsAmountTrimmed } from '../../utils/formatUtils';
import { dedupeIssuesByIdentity } from '../../utils/issueUtils';
import { ceilNearest12, round0, round2, round4, roundNearest1000 } from '../../utils/roundingShortcuts';
import { SKAERING_2011_01_01, SKAERING_2024_01_01, SKAERING_2024_07_01 } from './eetSkaeringsdatoer';
import { resolveAslReguleringRateForSatsAar } from './eetReguleringRater';
import { sumMaanedsbroekForInterval } from '../dates/maanedsbroek';
import {
  ASL_IDENTICAL_AFGOERELSER_ID,
  collectIncompleteRowIssues,
  hasIdenticalAfgoerelser,
  hasTextValue,
  isAslAfgoerelseRowEmpty,
  isKnownAfgoerelseType,
  parseCommittedPercent,
} from './eetAslAfgoerelser';
import { isUnderOrEqualTwoYearsToFpByBekendtgoerelse } from './eetKapitaliseringOpslag';
import {
  fromKroner,
  moneyOreSchema,
  sumMoneyOre,
  toKroner,
} from '../money/money';
import { z } from 'zod';
import { isoDateString } from '../../schemas/formSchemas/baseSchemas';
import { eetIssueSchema } from './eetTypes';
import { resolveStamdataDatoReference } from '../policies/stamdataCalculations';

export const eetLoebendePeriodeRowSchema = z.object({
  fra: isoDateString,
  til: isoDateString,
  satsAar: z.number().int(),
  maanederPraecis: z.number().finite(),
  grundydelseAfrundetOre: moneyOreSchema,
  reguleringPct: z.number().finite(),
  maanedligYdelseOre: moneyOreSchema,
  beregnetEetOre: moneyOreSchema,
}).strict().readonly();
export type EetLoebendePeriodeRow = z.infer<typeof eetLoebendePeriodeRowSchema>;

export const eetLoebendeAfgoerelseComputationSchema = z.object({
  rowId: z.string(),
  afgoerelsesdato: isoDateString,
  virkningsdato: isoDateString,
  kapitaliseringsdato: isoDateString.nullable(),
  skaeringsDato: isoDateString.nullable(),
  harOverlap: z.boolean(),
  afgoerelseType: z.enum(['Midlertidig', 'Delvist endelig', 'Endelig']),
  eetPct: z.number().finite(),
  priorKapPct: z.number().finite(),
  eetPctFoerAktuelKap: z.number().finite(),
  kapPctAktuel: z.number().finite(),
  kapPctKumulativ: z.number().finite(),
  restEetPct: z.number().finite(),
  harKapitalisering: z.boolean(),
  harRestSektion: z.boolean(),
  tilbagevirkendeKraft: z.boolean(),
  ophoerDato: isoDateString,
  ophoerAarsag: z.enum(['beregningsdato', 'senere-afgoerelse', 'kapitalisering', 'folkepensionsdato']),
  grundydelseFuldOre: moneyOreSchema,
  grundydelseRestOre: moneyOreSchema.nullable(),
  grundydelse2024FuldOre: moneyOreSchema,
  grundydelse2024RestOre: moneyOreSchema.nullable(),
  // Visningsrækker for faktiske krav. Perioder med 0 kr. udelades bevidst.
  perioder: z.array(eetLoebendePeriodeRowSchema).readonly(),
  iAltBeregnetEetOre: moneyOreSchema,
}).strict().readonly();
export type EetLoebendeAfgoerelseComputation = z.infer<typeof eetLoebendeAfgoerelseComputationSchema>;

export const eetLoebendeAarsydelseReguleringStepSchema = z.object({
  satsAar: z.number().int(),
  reguleringPct: z.number().finite(),
  reguleringsfaktor: z.number().finite(),
  aarsydelseFuldFoerAfrundingOre: moneyOreSchema,
  aarsydelseRestFoerAfrundingOre: moneyOreSchema.nullable(),
}).strict().readonly();
export type EetLoebendeAarsydelseReguleringStep = z.infer<typeof eetLoebendeAarsydelseReguleringStepSchema>;

export const eetLoebendeComputationSchema = z.object({
  beregningsdato: isoDateString,
  skadedato: isoDateString,
  fodselsdato: isoDateString,
  skadesaar: z.number().int(),
  aslAarsloenAfrundet1000Ore: moneyOreSchema,
  maxAarsloenISkadesaarOre: moneyOreSchema,
  benyttetAarsloenOre: moneyOreSchema,
  grundloenNiveau: z.enum(['2003', '2024']),
  grundloenOre: moneyOreSchema,
  erstatningsniveauPct: z.union([z.literal(80), z.literal(83)]),
  amBidragPct: z.union([z.literal(0), z.literal(8)]),
  reguleringFoer2024Pct: z.number().finite(),
  afgoerelser: z.array(eetLoebendeAfgoerelseComputationSchema).readonly(),
}).strict().readonly();
export type EetLoebendeComputation = z.infer<typeof eetLoebendeComputationSchema>;

export const eetLoebendeCalculationResultSchema = z.object({
  issues: z.array(eetIssueSchema).readonly(),
  computation: eetLoebendeComputationSchema.nullable(),
}).strict().readonly();
export type EetLoebendeCalculationResult = z.infer<typeof eetLoebendeCalculationResultSchema>;

type Input = Readonly<{
  erhvervsevnetab: ErhvervsevnetabComposedValues;
  skadedato: ISODateString | undefined;
  skadestype?: Skadestype;
  skadelidteFodselsdato: ISODateString | undefined;
  context: Readonly<
    | { kind: 'eet_page' }
    | { kind: 'eo_import'; slutdato: ISODateString }
  >;
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
  calculateOverlap: boolean;
  cutoverDate: ISODateString;
  skaeringsDato: ISODateString | null;
}>;

type ResolvedAfgoerelseTiming = Readonly<{
  afgoerelse: ResolvedAfgoerelseWithKapitalisering;
  ophoerDato: ISODateString;
}>;

const toIssue = (id: string, message: string): EetIssue => ({ id, severity: 'error', message });
const toWarning = (id: string, message: string): EetIssue => ({ id, severity: 'warning', message });

const parsePct = (raw: number | undefined): number | undefined => {
  const parsed = parseCommittedPercent(raw);
  // 0 % giver ingen løbende ydelse og behandles derfor som ikke-deltagende række.
  if (parsed === undefined || parsed === 0) return undefined;
  return parsed;
};
const formatPctForWarning = (value: number): string =>
  formatAsAmountTrimmed(value, 2);

const formatNonEndeligAfterEndeligWarning = (
  hasMidlertidig: boolean,
  hasDelvistEndelig: boolean
): string => {
  const afgoerelsestype = hasMidlertidig && hasDelvistEndelig
    ? 'midlertidig og delvist endelig'
    : hasMidlertidig
      ? 'midlertidig'
      : 'delvist endelig';
  return `Der er angivet en ${afgoerelsestype} afgørelse efter en endelig afgørelse.`;
};

export const firstOfMonthAfter = firstOfMonthAfterIso;

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

/**
 * EET-løbende-ydelser-advarsler der sammenligner en afgørelses datoer mod beregningsdatoen.
 *
 * De er kun meningsfulde på erhvervsevnetab-siden, hvor beregningsdatoen er den dato, brugeren
 * bevidst beregner EET *til*. I erstatningsopgørelsens midlertidigt EET-import er "beregningsdatoen"
 * blot TAF-slutdatoen, og en EET-afgørelse med virkning efter erstatningsperiodens udløb er helt
 * normal (fx en opgørelse lavet – evt. revideret – før EET-afgørelsen er truffet). Derfor
 * undertrykkes netop disse advarsler i EO-import-konteksten. Filtreringen sker ved EO-import-grænsen
 * (`buildMidlertidigtEetSourceResult`), så erhvervsevnetab-sidens egen visning er upåvirket.
 * Se `eo-snapshot-contract.md` §13.
 */
export const EET_LOEBENDE_BEREGNINGSDATO_RELATIVE_WARNING_IDS: ReadonlySet<string> = new Set([
  'warn-afgoerelsesdato-after-beregningsdato',
  'warn-virkningsdato-after-beregningsdato',
  'warn-kap-dato-after-beregningsdato',
]);

const collectWarnings = (
  skadedato: ISODateString,
  beregningsdato: ISODateString,
  afgoerelser: readonly ResolvedAfgoerelse[],
  issues: EetIssue[]
): void => {
  if (afgoerelser.some((row) => row.eetPct < 15)) {
    issues.push(toWarning('warn-asl-eet-under-15', EET_UNDER_15_WARNING));
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

  const endeligeAfgoerelser = afgoerelser.filter((row) => row.afgoerelseType === 'Endelig');

  const nonEndeligeAfterEndelig = afgoerelser.filter((row) =>
    (row.afgoerelseType === 'Midlertidig' || row.afgoerelseType === 'Delvist endelig') &&
    endeligeAfgoerelser.some((endelig) =>
      row.afgoerelsesdato > endelig.afgoerelsesdato ||
      (
        row.afgoerelsesdato === endelig.afgoerelsesdato &&
        row.virkningsdato > endelig.virkningsdato
      )
    )
  );
  if (nonEndeligeAfterEndelig.length > 0) {
    issues.push(
      toWarning(
        'warn-non-endelig-after-endelig',
        formatNonEndeligAfterEndeligWarning(
          nonEndeligeAfterEndelig.some((row) => row.afgoerelseType === 'Midlertidig'),
          nonEndeligeAfterEndelig.some((row) => row.afgoerelseType === 'Delvist endelig')
        )
      )
    );
  }

  if (afgoerelser.some((row) => row.afgoerelsesdato > beregningsdato)) {
    issues.push(toWarning('warn-afgoerelsesdato-after-beregningsdato', 'Der er angivet en afgørelsesdato efter beregningsdatoen'));
  }

  if (afgoerelser.some((row) => row.virkningsdato > beregningsdato)) {
    issues.push(toWarning('warn-virkningsdato-after-beregningsdato', 'Der er angivet en virkningsdato efter beregningsdatoen'));
  }

  if (afgoerelser.some((row) => row.kapDato !== undefined && row.kapDato > beregningsdato)) {
    issues.push(toWarning('warn-kap-dato-after-beregningsdato', 'Der er angivet en kapitaliseringsdato efter beregningsdatoen'));
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
        'Der er angivet en delvist endelig afgørelse uden kapitalisering'
      )
    );
  }

  if (hasIdenticalAfgoerelser(rows)) {
    issues.push(toIssue(
      ASL_IDENTICAL_AFGOERELSER_ID,
      'Der er angivet to identiske afgørelser med samme afgørelsesdato og virkningsdato'
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

const resolveActivePaidPredecessor = (
  predecessors: readonly ResolvedAfgoerelseTiming[],
  dato: ISODateString
): ResolvedAfgoerelseWithKapitalisering | undefined => {
  for (let index = predecessors.length - 1; index >= 0; index -= 1) {
    const predecessor = predecessors[index];
    const afgoerelse = predecessor.afgoerelse;
    if (afgoerelse.fsTilbageholdtEet === 'Ja') continue;
    if (afgoerelse.virkningsdato <= dato && dato <= predecessor.ophoerDato) {
      return afgoerelse;
    }
  }
  return undefined;
};

const hasPaidPredecessorInOverlapPeriod = (
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
    ...predecessors.flatMap(({ afgoerelse, ophoerDato }) => {
      const dayAfterOphoer = getDayAfterIso(ophoerDato);
      return dayAfterOphoer === undefined
        ? [afgoerelse.virkningsdato]
        : [afgoerelse.virkningsdato, dayAfterOphoer];
    }),
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
        const predecessor = resolveActivePaidPredecessor(predecessors, splitRow.fra);
        const previousRest = predecessor
          ? restEetPctAt(predecessor, events, splitRow.fra)
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
      const splitRows = splitPeriodByBoundaries(period, events.map((event) => event.dato));
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
 * Returnerer undefined hvis folkepensionsalderen ikke kan slås op centralt.
 */
const resolveFolkepensionsDagFoer = (
  fodselsdato: ISODateString,
  controlDate: ISODateString
): ISODateString | undefined => {
  return getDagenFoerFolkepensionsdato(fodselsdato, controlDate);
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

const computeEetLoebendeYdelserForContext = (input: Input): EetLoebendeCalculationResult => {
  const issues: EetIssue[] = [];

  const beregningsdatoInput = coerceToISODateString(input.erhvervsevnetab.beregningsdato);
  // EO-importen har sin egen eksplicitte port, så TAF-slutdatoen ikke kan sive ind i
  // EET-sidens beregning som en skjult optional override.
  const beregningsdato = beregningsdatoInput
    ?? (input.context.kind === 'eo_import' ? input.context.slutdato : undefined);
  const skadedato = input.skadedato;
  const stamdataDatoReference = resolveStamdataDatoReference(input.skadestype);
  const fodselsdato = input.skadelidteFodselsdato;

  const aslAarsloenRaw = amountValueToNumber(input.erhvervsevnetab.aslAarsloen);

  if (aslAarsloenRaw === undefined || !Number.isFinite(aslAarsloenRaw)) {
    issues.push(toIssue('aarsloen-missing', 'Årsløn er ikke udfyldt'));
  } else if (aslAarsloenRaw <= 0) {
    // Fortegn valideres her som et afledt domæneissue, så også canonical
    // negative værdier fra persistence blokerer beregningen.
    issues.push(toIssue('aarsloen-zero', 'Årsløn skal være større end 0 kr'));
  }
  if (!fodselsdato) {
    issues.push(toIssue('skadelidte-fodselsdato-missing', 'Fødselsdato er ikke udfyldt'));
  }
  if (!beregningsdato) {
    issues.push(MISSING_BEREGNINGSDATO_ISSUE);
  }
  if (!skadedato) {
    issues.push(toIssue('skadedato-missing', `${stamdataDatoReference.label} er ikke udfyldt`));
  }

  collectBlockingInputIssues(input.erhvervsevnetab.aslAfgoerelser, issues);

  const hasUnknownAfgoerelseType = input.erhvervsevnetab.aslAfgoerelser.some(
    (row) => row.afgoerelseType !== undefined && !isKnownAfgoerelseType(row.afgoerelseType)
  );
  if (hasUnknownAfgoerelseType) {
    // Schemavalideringen afviser normalt ukendte enumværdier. Domæne-entrypointet kan dog også
    // kaldes direkte fra runtime-kode; et ukendt typefelt må ikke glide videre som en delvist
    // fortolket afgørelse og derefter producere et output, som ikke passer til output-schemaet.
    issues.push(toIssue(
      'invalid-afgoerelse-type',
      'En afgørelse har en ukendt afgørelsestype og kan derfor ikke beregnes sikkert.'
    ));
  }

  const resolvedAfgoerelser = collectResolvedAfgoerelser(input.erhvervsevnetab.aslAfgoerelser);
  const allRowsEmpty = input.erhvervsevnetab.aslAfgoerelser.every((row) => isAslAfgoerelseRowEmpty(row));
  if (allRowsEmpty) {
    issues.push(toIssue('asl-afgoerelser-empty', 'Ingen ASL-afgørelser er indtastet'));
  }

  if (
    issues.some((issue) => issue.severity === 'error') ||
    !Number.isFinite(aslAarsloenRaw) ||
    !beregningsdato ||
    !skadedato ||
    !fodselsdato
  ) {
    return { issues: dedupeIssuesByIdentity(issues), computation: null };
  }

  const skadesaar = isoYear(skadedato);
  const maxAarsloenISkadesaar = resolveAslAarsloensmaksimumForAar(skadesaar);
  if (maxAarsloenISkadesaar === undefined) {
    issues.push(toIssue('aarsloen-max-missing', formatAslAarsloensmaksimumMissing(skadesaar)));
    return { issues: dedupeIssuesByIdentity(issues), computation: null };
  }

  const aslAarsloen = aslAarsloenRaw as number;
  const aslAarsloenMaxIssue = validateAslAarsloenBySkadesaarMax(aslAarsloen, skadedato);
  if (aslAarsloenMaxIssue !== undefined) {
    // En direkte motorbruger kan komme uden om readerens felt-gate. Værdien må
    // derfor stoppes her; en defensiv min()-afskæring ville ellers give et
    // resultat for en inputværdi, som domænet har afvist.
    issues.push(toIssue('aarsloen-over-max', aslAarsloenMaxIssue));
    return { issues: dedupeIssuesByIdentity(issues), computation: null };
  }
  const aslAarsloenAfrundet1000 = roundNearest1000(aslAarsloen);
  const benyttetAarsloen = aslAarsloenAfrundet1000;

  collectWarnings(skadedato, beregningsdato, resolvedAfgoerelser, issues);

  const before2024Skade = skadedato < SKAERING_2024_07_01;
  const from2011 = skadedato >= SKAERING_2011_01_01;
  const reguleringFoer2024 = reguleringsprocentErhvervsevnetabFoer2024[2024];
  if (before2024Skade && !Number.isFinite(reguleringFoer2024)) {
    issues.push(toIssue('reguleringssats-missing-2024', 'Reguleringssats mangler for år 2024'));
    return { issues: dedupeIssuesByIdentity(issues), computation: null };
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

  const loebendeYdelserSlutdato = input.context.kind === 'eo_import'
    ? input.context.slutdato
    : beregningsdato;

  const afgoerelseTimings = resolvedAfgoerelserWithKapitalisering.map((current, index) => {
    const previous = resolvedAfgoerelserWithKapitalisering[index - 1];
    const next = resolvedAfgoerelserWithKapitalisering[index + 1];
    const transition = resolveAfgoerelseTransition(previous, current);
    const nextTransition = next ? resolveAfgoerelseTransition(current, next) : undefined;
    const nextStopDate = nextTransition ? getDayBeforeIso(nextTransition.cutoverDate) : undefined;
    const folkepensionsDagFoer = resolveFolkepensionsDagFoer(fodselsdato, current.afgoerelsesdato);
    const dayBeforeKapitalisering = current.effectiveKapDato ? getDayBeforeIso(current.effectiveKapDato) : undefined;
    const hasRestSection = current.effectiveKapDato !== undefined &&
      restEetPctAt(current, kapitaliseringEvents, current.effectiveKapDato) > 0;

    const finalCandidates: Array<Readonly<{ date: ISODateString; cause: EetLoebendeAfgoerelseComputation['ophoerAarsag'] }>> = [
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

  const computations: EetLoebendeAfgoerelseComputation[] = [];

  for (let i = 0; i < afgoerelseTimings.length; i += 1) {
    const { current, transition: currentTransition, finalStop } = afgoerelseTimings[i];
    const priorKapPct = activeKapitaliseringPctAtExcluding(kapitaliseringEvents, current.virkningsdato, current.rowId);
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

    const fullPctFactor = eetPctFoerAktuelKap / 100;
    const restPctFactor = restEetPct / 100;
    const grundydelseFuldKroner = round2(grundloen * fullPctFactor * erstatningsniveau * amFaktor);
    const grundydelseRestKroner = hasRestSection
      ? round2(grundloen * restPctFactor * erstatningsniveau * amFaktor)
      : null;

    const grundydelse2024FuldKroner = before2024Skade
      ? round2(grundydelseFuldKroner * (1 + reguleringFoer2024 / 100))
      : grundydelseFuldKroner;
    const grundydelse2024RestKroner =
      before2024Skade && grundydelseRestKroner !== null
        ? round2(grundydelseRestKroner * (1 + reguleringFoer2024 / 100))
        : grundydelseRestKroner;

    const predecessors = afgoerelseTimings.slice(0, i).map(({ current: afgoerelse, finalStop: predecessorFinalStop }) => ({
      afgoerelse,
      ophoerDato: predecessorFinalStop.date,
    }));
    const allPeriods = buildComputedSectionRows({
      current,
      predecessors,
      finalStop: finalStop.date,
      useOverlap: currentTransition.calculateOverlap && hasPaidPredecessorInOverlapPeriod(predecessors, current),
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

      const grundydelseAfrundetKroner = effektivGrundydelseBase;
      const aarsydelseKroner = ceilNearest12(effektivGrundydelseBase * rateInfo.factor);
      const maanedligYdelseKroner = aarsydelseKroner / 12;
      const maanederPraecis = sumMaanedsbroekForInterval(sectionRow.fra, sectionRow.til);
      const beregnetEetKroner = round0(maanederPraecis * maanedligYdelseKroner);
      // Tabellerne på siden og i PDF'en viser kun perioder med et faktisk krav.
      if (beregnetEetKroner === 0) continue;

      computedRows.push({
        fra: sectionRow.fra,
        til: sectionRow.til,
        satsAar: sectionRow.satsAar,
        maanederPraecis,
        grundydelseAfrundetOre: fromKroner(grundydelseAfrundetKroner),
        reguleringPct: rateInfo.reguleringPct,
        maanedligYdelseOre: fromKroner(maanedligYdelseKroner),
        beregnetEetOre: fromKroner(beregnetEetKroner),
      });
    }

    const iAltBeregnetEetOre = sumMoneyOre(computedRows.map((row) => row.beregnetEetOre));

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
      grundydelseFuldOre: fromKroner(grundydelseFuldKroner),
      grundydelseRestOre: grundydelseRestKroner === null ? null : fromKroner(grundydelseRestKroner),
      grundydelse2024FuldOre: fromKroner(grundydelse2024FuldKroner),
      grundydelse2024RestOre: grundydelse2024RestKroner === null ? null : fromKroner(grundydelse2024RestKroner),
      perioder: computedRows,
      iAltBeregnetEetOre,
    });
  }

  if (issues.some((issue) => issue.severity === 'error')) {
    return { issues: dedupeIssuesByIdentity(issues), computation: null };
  }

  const computation: EetLoebendeComputation = {
    beregningsdato,
    skadedato,
    fodselsdato,
    skadesaar,
    aslAarsloenAfrundet1000Ore: fromKroner(aslAarsloenAfrundet1000),
    maxAarsloenISkadesaarOre: fromKroner(maxAarsloenISkadesaar),
    benyttetAarsloenOre: fromKroner(benyttetAarsloen),
    grundloenNiveau: before2024Skade ? '2003' : '2024',
    grundloenOre: fromKroner(grundloen),
    erstatningsniveauPct,
    amBidragPct,
    reguleringFoer2024Pct: before2024Skade ? (reguleringFoer2024 ?? 0) : 0,
    afgoerelser: computations,
  };

  return {
    issues: dedupeIssuesByIdentity(issues),
    computation,
  };
};

type EetLoebendeInput = Omit<Input, 'context'>;

export const computeEetLoebendeYdelser = (
  input: EetLoebendeInput
): EetLoebendeCalculationResult => computeEetLoebendeYdelserForContext({
  ...input,
  context: { kind: 'eet_page' },
});

export const computeEetLoebendeYdelserForEoImport = (
  input: EetLoebendeInput & Readonly<{ slutdato: ISODateString }>
): EetLoebendeCalculationResult => {
  const { slutdato, ...baseInput } = input;
  return computeEetLoebendeYdelserForContext({
    ...baseInput,
    context: { kind: 'eo_import', slutdato },
  });
};

export const buildLoebendeAarsydelseReguleringSteps = (
  afgoerelse: EetLoebendeAfgoerelseComputation
): readonly EetLoebendeAarsydelseReguleringStep[] => {
  const periodYears = [...new Set(afgoerelse.perioder
    .filter((row) => row.satsAar > 2024)
    .map((row) => row.satsAar))]
    .sort((a, b) => a - b);
  const fallbackYear = isoYear(afgoerelse.afgoerelsesdato);
  const uniqueYears = periodYears.length > 0
    ? periodYears
    : fallbackYear > 2024
      ? [fallbackYear]
      : [];

  const restGrundydelse2024Ore = afgoerelse.grundydelse2024RestOre;

  return uniqueYears.map((satsAar) => {
    const reguleringPct = afgoerelse.perioder.find((row) => row.satsAar === satsAar)?.reguleringPct ?? 0;
    const reguleringsfaktor = round4(1 + reguleringPct / 100);
    return {
      satsAar,
      reguleringPct,
      reguleringsfaktor,
      aarsydelseFuldFoerAfrundingOre: fromKroner(
        round2(toKroner(afgoerelse.grundydelse2024FuldOre) * reguleringsfaktor)
      ),
      aarsydelseRestFoerAfrundingOre: restGrundydelse2024Ore === null
        ? null
        : fromKroner(round2(toKroner(restGrundydelse2024Ore) * reguleringsfaktor)),
    };
  }).filter((step) => step.reguleringPct !== 0);
};

export const shouldShowLoebende2024ConversionBlock = (
  afgoerelse: EetLoebendeAfgoerelseComputation
): boolean => {
  return afgoerelse.perioder.some((row) => row.satsAar >= 2024);
};

/**
 * Afledte visningsflag for én løbende-ydelse-afgørelses rest-/2024-sektioner.
 *
 * Kanonisk kilde for hvilke under-afsnit der vises (2003-niveau vs. 2024-niveau, rest-sektion),
 * så UI-fanen (`EetLoebendeYdelserTab`) og PDF/Word-generatoren (`loebendeYdelserDocument`) ikke
 * kan drive fra hinanden – samme visningssemantik ét sted, jf. konvergens-/periodiseringsreglerne.
 */
export type LoebendeAfgoerelseRestVisning = Readonly<{
  show2024ConversionBlock: boolean;
  hasRestSection: boolean;
  kapitaliseringFra2024: boolean;
  hasRestAfterKapBefore2024: boolean;
  showRest2003: boolean;
  showRest2024: boolean;
}>;

export const resolveLoebendeAfgoerelseRestVisning = (
  afgoerelse: EetLoebendeAfgoerelseComputation,
  grundloenNiveau: EetLoebendeComputation['grundloenNiveau']
): LoebendeAfgoerelseRestVisning => {
  const show2024ConversionBlock =
    grundloenNiveau === '2003' && shouldShowLoebende2024ConversionBlock(afgoerelse);
  const hasKapitaliseringsdato = afgoerelse.kapitaliseringsdato !== null;
  const hasRestSection = afgoerelse.harRestSektion && hasKapitaliseringsdato;
  const kapitaliseringFra2024 =
    afgoerelse.kapitaliseringsdato !== null &&
    afgoerelse.kapitaliseringsdato >= SKAERING_2024_01_01;
  const hasRestAfterKapBefore2024 = Boolean(
    hasRestSection &&
    afgoerelse.kapitaliseringsdato &&
    afgoerelse.kapitaliseringsdato < SKAERING_2024_01_01
  );
  const showRest2003 = hasRestSection && (!show2024ConversionBlock || !kapitaliseringFra2024);
  const showRest2024 = show2024ConversionBlock && hasRestSection && kapitaliseringFra2024;
  return {
    show2024ConversionBlock,
    hasRestSection,
    kapitaliseringFra2024,
    hasRestAfterKapBefore2024,
    showRest2003,
    showRest2024,
  };
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

/**
 * Visnings-semantik delt af UI-fanen (EetLoebendeYdelserTab) og dokument-generatoren
 * (loebendeYdelserDocument): grundydelsen skifter fra 2003- til 2024-niveau midt i en
 * afgørelse, når grundløns-niveauet er 2003 OG afgørelsen har perioder på begge sider af
 * 1. januar 2024. Ejes af domænelaget, så fane og generator ikke holder hver sin kopi.
 */
export const visGrundydelseNiveauSkift = (
  afgoerelse: Pick<EetLoebendeAfgoerelseComputation, 'perioder'>,
  grundloenNiveau: EetLoebendeComputation['grundloenNiveau']
): boolean => {
  const hasRowsBefore2024 = afgoerelse.perioder.some((row) => row.satsAar <= 2023);
  const hasRowsFrom2024 = afgoerelse.perioder.some((row) => row.satsAar >= 2024);
  return grundloenNiveau === '2003' && hasRowsBefore2024 && hasRowsFrom2024;
};

export const formatSkadedatoCompact = (iso: ISODateString): string => {
  const [year, month, day] = iso.split('-');
  const d = Number.parseInt(day, 10);
  const m = Number.parseInt(month, 10);
  return `${d}/${m}-${year}`;
};
