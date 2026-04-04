import type {
  ErstatningsopgoerelseValues,
  LoenindkomstAnsaettelsesforhold,
  StamdataValues,
  StandardLoenTableRow,
  SygeferiegodtgoerelseAnsaettelsesforholdRow,
} from '../../../schemas/formSchemas';
import { TODAY } from '../../../config/dateRanges';
import { amountValueToNumber } from '../../../utils/expressionAmount';
import { addDays, addMonths } from '../../../utils/dateUtils';
import { parsePercentToDecimal } from '../../../utils/numberParsing';
import { roundByMethod } from '../../../utils/rounding';
import { calculateStandardLoenRowDerived } from '../../aarsloen/standardLoenRowCalculations';
import { parseAarsloenRowInterval } from '../helpers/indtaegtPerioder';
import { buildLoenArbejdsdageSet, optaelArbejdsdage, optaelArbejdsdageBreakdown } from './periodiseringsMotor';
import { buildDatoSetInclusiveFromDates, buildFerieDageSet } from './tafDaySets';
import { computeTafBeregningsenhed, TAF_BEREGNES_SOM, type TafBeregningsenhed } from '../helpers/tafBeregningsenhed';
import type { IsoRange } from '../validation/tafPeriodConstraints';
import { dateToISO, parseISODate, subtractOneDay, type ISODateString } from '../../../types/branded';
import { isoToDanish, toDanishDateString } from '../../../types/branded';
import { clampMoneyOreToZero, ensureMoneyOre, roundKroner, toOre } from '../shared/eoMoney';
import type { LoenudviklingSegment, MoneyOre } from '../shared/eoTypes';
import { resolvePctDecimalFromSatsOrInput } from '../helpers/eoSharedUtils';
import {
  getEffektiveSatserForDato,
  getOffentligOverenskomstTypeById,
  getOverenskomstSfggPolicy,
  resolveOverenskomstRef,
} from '../../../data/overenskomstRates';
import { erDetteFoersteErstatningsopgoerelse } from '../validation/eoNummerValidering';
import { countInclusiveUtcDays } from '../../../utils/utcDayMath';
import {
  buildSfggAfterEmployerSickPayText,
  buildSfggNoEligibleDaysReason,
  SFGG_FIRST_TAF_DAY_EXCLUDED_TEXT,
  buildSfggIntroText,
  resolveSfggDifferentieretSatsLabel,
  resolveSfggReferenceperiodeAuthorityText,
  resolveSfggReferenceperiodeLabel,
} from '../helpers/sygeferiegodtgoerelseTexts';

export type SfggSourceKind = 'ingen' | 'manuel' | 'ferielov' | 'overenskomst_direkte' | 'overenskomst_ferielov';
export type SfggSource = Readonly<{ kind: SfggSourceKind; label: string }>;
export type SfggDayBasis = 'kalenderdage' | 'arbejdsdage';
export type SfggReferencesatsNotCalculableKind =
  | 'missing_rate'
  | 'per_period_rate'
  | 'missing_referenceperiode'
  | 'unresolvable_referenceperiode'
  | 'no_calendar_days'
  | 'no_workdays';
export type SfggReferencesatsCalculable =
  | Readonly<{ status: 'ok'; value: MoneyOre }>
  | Readonly<{ status: 'not_calculable'; kind: SfggReferencesatsNotCalculableKind; reason: string }>;

const resolveSfggReferencesatsNotCalculableReason = (
  kind: SfggReferencesatsNotCalculableKind
): string => {
  switch (kind) {
    case 'missing_rate':
      return 'Dagssats mangler';
    case 'per_period_rate':
      return 'Direkte overenskomstsats beregnes pr. periode';
    case 'missing_referenceperiode':
      return 'Referenceperiode mangler';
    case 'unresolvable_referenceperiode':
      return 'Referenceperioden kan ikke opgøres';
    case 'no_calendar_days':
      return buildSfggNoEligibleDaysReason('kalenderdage');
    case 'no_workdays':
      return buildSfggNoEligibleDaysReason('arbejdsdage');
  }
};

export const isSfggNoEligibleDaysNotCalculable = (
  value: SfggReferencesatsCalculable
): boolean => value.status === 'not_calculable' && (value.kind === 'no_calendar_days' || value.kind === 'no_workdays');

const SFGG_REFERENCEPERIODE_KILDER_MED_BEREGNINGSPERIODE = new Set<SfggSourceKind>([
  'ferielov',
  'overenskomst_ferielov',
]);

/**
 * Normativ SFGG-regel:
 * - Kun når SFGG beregnes via referenceperiode/ferielov-sporet OG TAF beregnes som måneder,
 *   opgøres SFGG på kalenderdage.
 * - I alle øvrige spor opgøres SFGG på arbejdsdage, uanset om dagssatsen kommer manuelt
 *   eller direkte fra overenskomsten.
 */
export const resolveSfggDayBasis = (
  source: Readonly<{ kind: SfggSourceKind }>,
  tafBeregningsenhed: TafBeregningsenhed
): SfggDayBasis =>
  tafBeregningsenhed === TAF_BEREGNES_SOM.MAANEDER && SFGG_REFERENCEPERIODE_KILDER_MED_BEREGNINGSPERIODE.has(source.kind)
    ? 'kalenderdage'
    : 'arbejdsdage';

export const isSfggReferenceperiodeSource = (
  source: Readonly<{ kind: SfggSourceKind }>
): boolean => SFGG_REFERENCEPERIODE_KILDER_MED_BEREGNINGSPERIODE.has(source.kind);


export type SygeferiegodtgoerelseSegment = Readonly<{
  ansaettelsesforholdId: string;
  ansaettelsesforholdNavn: string;
  fra: ISODateString;
  til: ISODateString;
  reguleringsindeks: number | null;
  satsOre: MoneyOre;
  agPensionPct: number;
  antalDage: number;
  feriepengekravOre: MoneyOre;
  beregnetSfggoereOre: MoneyOre;
  ferieberettigetLoenKroner: number;
  feriepengeAfSygeloenOre: MoneyOre;
  alleredeBetaltOre: MoneyOre;
}>;

export type SygeferiegodtgoerelseCapRow = Readonly<{
  fra: ISODateString;
  til: ISODateString;
  antalDage: number;
  maanederPraecis: number;
}>;

export type SfggReferencesatsFormula = Readonly<{
  ferieberettigetLoenKroner: number;
  feriePctDecimal: number;
  feriepengeKroner: number;
  divisorDage: number;
  divisorLabel: 'kalenderdage' | 'arbejdsdage';
  kalenderdage: number;
  hverdage: number;
  shDage: number;
  feriedage: number;
  oevrigeFravaersdage: number;
}>;

export type SfggFeriepengeModtagetFormula = Readonly<{
  ferieberettigetLoenKroner: number;
  feriePctDecimal: number | undefined;
  feriepengeOre: MoneyOre;
}>;

export type SygeferiegodtgoerelseAnsaettelsesforholdResult = Readonly<{
  ansaettelsesforholdId: string;
  ansaettelsesforholdNavn: string;
  sfggSourceLabel: string;
  sfggSourceKind: SfggSourceKind;
  sfggDayBasis: SfggDayBasis;
  sfggIntroText: string | null;
  sfggReferenceperiodeAuthorityText: string | null;
  sfggReferenceperiodeLabel: string;
  sfggDirectRateLabel: string | null;
  sfggFirstTafDayExcludedText: string | null;
  sfggAfterEmployerSickPayText: string | null;
  pdfExplanatoryLines: readonly string[];
  segments: readonly SygeferiegodtgoerelseSegment[];
  perYear: readonly Readonly<{
    year: number;
    amountOre: MoneyOre;
  }>[];
  feriepengekravTotalOre: MoneyOre;
  totalOre: MoneyOre;
  alleredeBetaltOre: MoneyOre;
  sfggReferenceperiode: Readonly<{ fra: ISODateString; til: ISODateString }> | null;
  sfggReferencesats: SfggReferencesatsCalculable;
  sfggReferencesatsFormula: SfggReferencesatsFormula | null;
  feriepengeModtagetFormula: SfggFeriepengeModtagetFormula | null;
  capRows: readonly SygeferiegodtgoerelseCapRow[];
  capReachedDate: ISODateString | null;
}>;

export type SygeferiegodtgoerelseResult = Readonly<{
  totalOre: MoneyOre;
  perAnsaettelsesforhold: readonly SygeferiegodtgoerelseAnsaettelsesforholdResult[];
  perYear: readonly Readonly<{ year: number; amountOre: MoneyOre }>[];
  firstExcludedDate: ISODateString | null;
}>;

export const EMPTY_RESULT: SygeferiegodtgoerelseResult = {
  totalOre: ensureMoneyOre(0),
  perAnsaettelsesforhold: [],
  perYear: [],
  firstExcludedDate: null,
};

const sortIsoDates = (values: Iterable<ISODateString>): ISODateString[] =>
  Array.from(values).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

export const resolveSfggReferenceperiodeDayCount = (
  values: ErstatningsopgoerelseValues,
  row: Pick<
    SygeferiegodtgoerelseAnsaettelsesforholdRow,
    'sfggReferenceperiodeFra' | 'sfggReferenceperiodeTil' | 'sfggReferenceperiodeFravaersdageUdenLoen'
  > | undefined,
  source: Readonly<{ kind: SfggSourceKind }>
): Readonly<{
  divisorDage: number;
  divisorLabel: 'kalenderdage' | 'arbejdsdage';
  kalenderdage: number;
  hverdage: number;
  shDage: number;
  feriedage: number;
  oevrigeFravaersdage: number;
}> | null => {
  if (!row?.sfggReferenceperiodeFra || !row.sfggReferenceperiodeTil || row.sfggReferenceperiodeFra > row.sfggReferenceperiodeTil) {
    return null;
  }

  const breakdown = optaelArbejdsdageBreakdown({
    fra: row.sfggReferenceperiodeFra,
    til: row.sfggReferenceperiodeTil,
    // Tilladt §11.1a-undtagelse: SFGG-referenceperioden må bruge TAF-forløbets ferieperioder
    // som fradrag i dagoptællingen, men aldrig TAF-beregningsperiodens datoer som fallback eller input.
    ferieperioder: values.ferieperioder ?? [],
    loseFeriedage: 0,
    context: {
      kind: 'beregningsgrundlag',
      oevrigeFravaersdage: row.sfggReferenceperiodeFravaersdageUdenLoen ?? 0,
    },
  });
  if (!breakdown) return null;

  const tafBeregnesSom = computeTafBeregningsenhed(values);
  const dayBasis = resolveSfggDayBasis(source, tafBeregnesSom);
  const fraDate = parseISODate(row.sfggReferenceperiodeFra);
  const tilDate = parseISODate(row.sfggReferenceperiodeTil);
  const kalenderdage = fraDate && tilDate ? countInclusiveUtcDays(fraDate, tilDate) ?? 0 : 0;
  const kalenderFerieDage =
    fraDate && tilDate
      ? buildFerieDageSet(
        values.ferieperioder ?? [],
        buildDatoSetInclusiveFromDates(fraDate, tilDate),
        { includeWeekends: true }
      ).size
      : 0;
  const divisorDage = dayBasis === 'kalenderdage'
    ? Math.max(0, kalenderdage - kalenderFerieDage - breakdown.oevrigeFravaersdage)
    : Math.max(0, breakdown.tafDage);

  return {
    divisorDage,
    divisorLabel: dayBasis,
    kalenderdage,
    hverdage: breakdown.arbejdsdage,
    shDage: breakdown.shDage,
    feriedage: dayBasis === 'kalenderdage' ? kalenderFerieDage : breakdown.feriedage,
    oevrigeFravaersdage: breakdown.oevrigeFravaersdage,
  };
};

export const getFirstIndtastedeTafFraDato = (
  values: ErstatningsopgoerelseValues
): ISODateString | undefined => {
  const fraDatoer = (values.tafPerioder ?? [])
    .map((row) => row.fra)
    .filter((value): value is ISODateString => value !== undefined);

  if (fraDatoer.length === 0) return undefined;
  return fraDatoer.reduce((earliest, current) => (current < earliest ? current : earliest));
};

export const resolveSfggReferenceperiodeMaxDate = (
  values: ErstatningsopgoerelseValues
): ISODateString | undefined => {
  return subtractOneDay(getFirstIndtastedeTafFraDato(values));
};

const FOUR_MONTHS_EPSILON = 1e-12;

const buildDateSetFromRanges = (ranges: readonly IsoRange[]): Set<ISODateString> => {
  const result = new Set<ISODateString>();
  for (const range of ranges) {
    const start = parseISODate(range.fra);
    const end = parseISODate(range.til);
    if (!start || !end || start > end) continue;
    for (const iso of buildDatoSetInclusiveFromDates(start, end)) {
      result.add(iso);
    }
  }
  return result;
};

const buildRangesFromSortedDates = (sortedDates: readonly ISODateString[]): IsoRange[] => {
  if (sortedDates.length === 0) return [];
  const result: IsoRange[] = [];
  let currentFra = sortedDates[0];
  let previous = sortedDates[0];

  for (let index = 1; index < sortedDates.length; index += 1) {
    const iso = sortedDates[index];
    const previousDate = parseISODate(previous);
    if (!previousDate) continue;
    const nextDate = addDays(previousDate, 1);
    const expectedIso = dateToISO(nextDate);
    if (!expectedIso || iso !== expectedIso) {
      result.push({ fra: currentFra, til: previous });
      currentFra = iso;
    }
    previous = iso;
  }

  result.push({ fra: currentFra, til: previous });
  return result;
};

const resolveSfggOphoerVerb = (
  ophoersdato: ISODateString,
  opgoerelsesdato: ISODateString
): 'bortfaldt' | 'bortfalder' => (
  ophoersdato <= opgoerelsesdato ? 'bortfaldt' : 'bortfalder'
);

const dateInMonthFraction = (iso: ISODateString, mode: TafBeregningsenhed): number => {
  const date = parseISODate(iso);
  if (!date) return 0;
  if (mode === TAF_BEREGNES_SOM.MAANEDER) {
    const daysInMonth = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
    return daysInMonth > 0 ? 1 / daysInMonth : 0;
  }
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const monthStart = `${year}-${String(month + 1).padStart(2, '0')}-01` as ISODateString;
  const monthEnd = dateToISO(new Date(Date.UTC(year, month + 1, 0)));
  if (!monthEnd) return 0;
  const arbejdsdageIMaaneden = optaelArbejdsdage({
    fra: monthStart,
    til: monthEnd,
    ferieperioder: [],
    loseFeriedage: 0,
    context: { kind: 'taf' },
  }) ?? 0;
  return arbejdsdageIMaaneden > 0 ? 1 / arbejdsdageIMaaneden : 0;
};

const buildCapComputation = (
  sortedCountedDates: readonly ISODateString[],
  mode: TafBeregningsenhed
): Readonly<{ cutoffDate: ISODateString | null; rows: readonly SygeferiegodtgoerelseCapRow[] }> => {
  const dates = [...sortedCountedDates];
  if (dates.length === 0) {
    return { cutoffDate: null, rows: [] };
  }

  let cutoffDate: ISODateString | null = null;
  const rows: SygeferiegodtgoerelseCapRow[] = [];

  for (const range of buildRangesFromSortedDates(dates)) {
    const rangeDates = dates.filter((iso) => iso >= range.fra && iso <= range.til);
    const monthsPrecise = rangeDates.reduce((sum, iso) => sum + dateInMonthFraction(iso, mode), 0);
    rows.push({
      fra: range.fra,
      til: range.til,
      antalDage: rangeDates.length,
      maanederPraecis: monthsPrecise,
    });
  }

  let totalMonths = 0;
  for (const iso of dates) {
    totalMonths += dateInMonthFraction(iso, mode);
    if (totalMonths + FOUR_MONTHS_EPSILON >= 4) {
      cutoffDate = iso;
      break;
    }
  }

  return { cutoffDate, rows };
};

const getSfggRowForEmployment = (
  values: ErstatningsopgoerelseValues,
  ansaettelsesforholdId: string
): SygeferiegodtgoerelseAnsaettelsesforholdRow | undefined =>
  values.sfggAnsaettelsesforhold.find((row) => row.ansaettelsesforholdId === ansaettelsesforholdId);

export const hasSfggSelectedOverenskomst = (
  sfggRow: Pick<SygeferiegodtgoerelseAnsaettelsesforholdRow, 'sfggBeregningskilde'> | undefined,
  employment: Pick<LoenindkomstAnsaettelsesforhold, 'harOverenskomst' | 'overenskomstId'>
): boolean =>
  Boolean(
    sfggRow?.sfggBeregningskilde === 'Overenskomst'
    && employment.harOverenskomst
    && employment.overenskomstId?.trim()
  );

export const resolveSfggSource = (
  sfggRow: SygeferiegodtgoerelseAnsaettelsesforholdRow | undefined,
  employment: LoenindkomstAnsaettelsesforhold
): SfggSource => {
  const selected = sfggRow?.sfggBeregningskilde ?? 'Ingen';
  if (selected === 'Ingen') return { kind: 'ingen', label: 'Ingen' };
  if (selected === 'Manuelt angivet') return { kind: 'manuel', label: 'Manuelt angivet' };
  if (selected === 'Ferieloven') return { kind: 'ferielov', label: 'Ferieloven' };
  if (!employment.harOverenskomst || !employment.overenskomstId || getOffentligOverenskomstTypeById(employment.overenskomstId)) {
    return { kind: 'overenskomst_ferielov', label: 'Overenskomst (ferielov)' };
  }
  const policy = getOverenskomstSfggPolicy(employment.overenskomstId);
  return policy?.model === 'direkte_sats'
    ? { kind: 'overenskomst_direkte', label: 'Overenskomst' }
    : { kind: 'overenskomst_ferielov', label: 'Overenskomst (ferielov)' };
};

const getEmploymentName = (employment: LoenindkomstAnsaettelsesforhold): string =>
  (employment.navnPaaArbejdssted ?? '').trim() || 'Arbejdssted';

const notCalculableSfggReferencesats = (
  kind: SfggReferencesatsNotCalculableKind
): SfggReferencesatsCalculable => ({
  status: 'not_calculable',
  kind,
  reason: resolveSfggReferencesatsNotCalculableReason(kind),
});

const calculableSfggReferencesats = (value: MoneyOre): SfggReferencesatsCalculable => ({
  status: 'ok',
  value,
});

const assertNeverSfggSourceKind = (value: never): never => {
  throw new Error(`Ukendt SFGG-kildetype: ${String(value)}`);
};

const resolveSfggAfterEmployerSickPayProjection = (args: Readonly<{
  excludedAny: boolean;
  sfggSourceKind: SfggSourceKind;
  manualFoerstEfterSygeloen: boolean;
  overenskomstPolicy: ReturnType<typeof getOverenskomstSfggPolicy> | undefined;
}>): Readonly<{
  hasExplanation: boolean;
  text: string | null;
}> => {
  switch (args.sfggSourceKind) {
    case 'ingen':
      return { hasExplanation: false, text: null };
    case 'manuel':
      return args.excludedAny && args.manualFoerstEfterSygeloen
        ? { hasExplanation: true, text: buildSfggAfterEmployerSickPayText({ kind: 'manual' }) }
        : { hasExplanation: false, text: null };
    case 'ferielov':
      return { hasExplanation: false, text: null };
    case 'overenskomst_direkte':
    case 'overenskomst_ferielov':
      return args.overenskomstPolicy?.bortfalderUnderArbejdsgiverbetaltSygeloen === true
        ? { hasExplanation: true, text: buildSfggAfterEmployerSickPayText({ kind: 'overenskomst' }) }
        : { hasExplanation: false, text: null };
    default:
      return assertNeverSfggSourceKind(args.sfggSourceKind);
  }
};

// Bevidst juridisk/faglig beslutning: enhver positiv lønindkomst — uanset art — betragtes
// som udtryk for, at arbejdsgiver har betalt sygeløn i perioden. Col4 (ikke-pensionsgivende
// tillæg) og col5 (ATP) er bevidst medtaget, fordi selv disse ydelsestyper indikerer en
// løbende lønudbetaling under sygdom. En snævrere afgrænsning (f.eks. kun grundløn) er
// fravalgt: er der overhovedet udbetalt løn, betragtes sygelønskriteriet som opfyldt.
const rowHasPositiveIncome = (row: StandardLoenTableRow): boolean => {
  const values = [row.col2, row.col3, row.col4, row.col5]
    .map((value) => amountValueToNumber(value))
    .filter((value): value is number => value !== undefined);
  return values.some((value) => value > 0);
};

export const sumFerieberettigetLoenInRangesKroner = (
  employment: LoenindkomstAnsaettelsesforhold,
  ranges: readonly IsoRange[],
  ferieperioder: ErstatningsopgoerelseValues['ferieperioder']
): number => {
  if (ranges.length === 0) return 0;
  const includedDateSet = buildDateSetFromRanges(ranges);
  if (includedDateSet.size === 0) return 0;
  const satser = {
    feriePct: employment.feriePct,
    fritvalgPct: employment.fritvalgPct,
    shSoPct: employment.shSoPct,
    storeBededagPct: employment.storeBededagPct,
    pensionPct: employment.pensionPct,
  };
  let sum = 0;
  for (const row of employment.indtaegtsoplysningerTableData ?? []) {
    const interval = parseAarsloenRowInterval(row, employment.loenperiode);
    if (!interval) continue;
    const derived = calculateStandardLoenRowDerived(row, satser);
    if (!Number.isFinite(derived.ferieberet) || derived.ferieberet <= 0) continue;
    const intervalFra = dateToISO(interval.start);
    const intervalTil = dateToISO(interval.end);
    if (!intervalFra || !intervalTil) continue;
    const rowArbejdsdageSet = buildLoenArbejdsdageSet({ fra: intervalFra, til: intervalTil }, ferieperioder ?? []);
    const totalArbejdsdage = rowArbejdsdageSet.size;
    const overlapArbejdsdage = Array.from(rowArbejdsdageSet).filter((iso) => includedDateSet.has(iso)).length;
    if (totalArbejdsdage > 0 && overlapArbejdsdage > 0) {
      sum += derived.ferieberet * (overlapArbejdsdage / totalArbejdsdage);
    }
  }
  return sum;
};

export const resolveSfggDirectSatsValue = (
  sfggSatsvalg: SygeferiegodtgoerelseAnsaettelsesforholdRow['sfggSatsvalg'],
  direkteSatsErDifferentieret: boolean,
  satser: Readonly<{
    sfgg: number | null;
    sfggFaglKbh: number | null;
    sfggFaglProv: number | null;
    sfggUfaglKbh: number | null;
    sfggUfaglProv: number | null;
  }>
): number | null => {
  if (!direkteSatsErDifferentieret) return satser.sfgg;
  switch (sfggSatsvalg) {
    case 'Faglaert-Koebenhavn':
      return satser.sfggFaglKbh;
    case 'Faglaert-Provinsen':
      return satser.sfggFaglProv;
    case 'Ufaglaert-Koebenhavn':
      return satser.sfggUfaglKbh;
    case 'Ufaglaert-Provinsen':
      return satser.sfggUfaglProv;
    default:
      return satser.sfgg;
  }
};

const resolveOverenskomstDagssatsOre = (
  employment: LoenindkomstAnsaettelsesforhold,
  iso: ISODateString,
  sfggSatsvalg: SygeferiegodtgoerelseAnsaettelsesforholdRow['sfggSatsvalg']
): MoneyOre | null => {
  if (!employment.overenskomstId || getOffentligOverenskomstTypeById(employment.overenskomstId)) return null;
  const overenskomstRef = resolveOverenskomstRef(employment.overenskomstId);
  if (!overenskomstRef) return null;
  const date = parseISODate(iso);
  if (!date) return null;
  const satser = getEffektiveSatserForDato({
    overenskomstId: overenskomstRef.baseId,
    dato: toDanishDateString(
      `${String(date.getUTCDate()).padStart(2, '0')}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${date.getUTCFullYear()}`
    ),
    applyAlmindeligLoenPaaShDageRegel: employment.loenPaaHelligdage === 'Almindelig løn',
  });
  if (!satser) return null;
  const sfggPolicy = getOverenskomstSfggPolicy(employment.overenskomstId);
  // Ved skift fra en differentieret SFGG-overenskomst til en ikke-differentieret
  // kan et gammelt sfggSatsvalg lovligt blive hængende i formstate. Det må ikke gøre
  // en standard direkte SFGG-sats uberegnelig; i det spor er kun den samlede sfgg relevant.
  const value = resolveSfggDirectSatsValue(
    sfggSatsvalg,
    sfggPolicy?.direkteSatsErDifferentieret === true,
    satser
  );
  return typeof value === 'number' && Number.isFinite(value)
    ? toOre(roundKroner(value))
    : null;
};

const resolveSfggAgPensionPctDecimalForDate = (
  employment: LoenindkomstAnsaettelsesforhold,
  iso: ISODateString
): number => {
  if (!employment.overenskomstId || getOffentligOverenskomstTypeById(employment.overenskomstId)) {
    return resolvePctDecimalFromSatsOrInput(undefined, employment.pensionPct);
  }
  const overenskomstRef = resolveOverenskomstRef(employment.overenskomstId);
  if (!overenskomstRef) {
    return resolvePctDecimalFromSatsOrInput(undefined, employment.pensionPct);
  }
  const date = parseISODate(iso);
  if (!date) {
    return resolvePctDecimalFromSatsOrInput(undefined, employment.pensionPct);
  }
  const satser = getEffektiveSatserForDato({
    overenskomstId: overenskomstRef.baseId,
    dato: toDanishDateString(
      `${String(date.getUTCDate()).padStart(2, '0')}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${date.getUTCFullYear()}`
    ),
    applyAlmindeligLoenPaaShDageRegel: employment.loenPaaHelligdage === 'Almindelig løn',
  });
  return resolvePctDecimalFromSatsOrInput(satser?.agPension, employment.pensionPct);
};

const buildSfggGrossOre = (
  satsOre: MoneyOre,
  agPensionPct: number,
  antalDage: number
): MoneyOre =>
  ensureMoneyOre(toOre(roundKroner((satsOre / 100) * ((100 + agPensionPct) / 100) * antalDage)));

const buildIncomeExcludedDateSet = (employment: LoenindkomstAnsaettelsesforhold): Set<ISODateString> => {
  const result = new Set<ISODateString>();
  for (const row of employment.indtaegtsoplysningerTableData ?? []) {
    if (!rowHasPositiveIncome(row)) continue;
    const interval = parseAarsloenRowInterval(row, employment.loenperiode);
    if (!interval) continue;
    for (const iso of buildDatoSetInclusiveFromDates(interval.start, interval.end)) {
      result.add(iso);
    }
  }
  return result;
};

const getLastIncomeDate = (employment: LoenindkomstAnsaettelsesforhold): ISODateString | null => {
  let latest: ISODateString | null = null;
  for (const row of employment.indtaegtsoplysningerTableData ?? []) {
    if (!rowHasPositiveIncome(row)) continue;
    const interval = parseAarsloenRowInterval(row, employment.loenperiode);
    if (!interval) continue;
    const iso = dateToISO(interval.end);
    if (!iso) continue;
    if (latest === null || iso > latest) {
      latest = iso;
    }
  }
  return latest;
};

const allocateOreByWeights = (
  totalOre: MoneyOre,
  segments: readonly Readonly<{ key: string; weight: number }>[]
): ReadonlyMap<string, MoneyOre> => {
  if (totalOre <= 0 || segments.length === 0) return new Map<string, MoneyOre>();
  const positive = segments.filter((segment) => segment.weight > 0);
  if (positive.length === 0) {
    // Beslutningsnote: Når alle vægte er 0, findes der intet fagligt grundlag for en proportional
    // segmentfordeling. Vi lægger derfor hele beløbet på første segment for at bevare totalen
    // deterministisk uden at fejle lukket. Revurdér hvis nul-sats-segmenter senere får en
    // særskilt visningsregel eller anden autoritativ fordelingsnøgle.
    return new Map<string, MoneyOre>([[segments[0].key, totalOre]]);
  }
  const totalWeight = positive.reduce((sum, segment) => sum + segment.weight, 0);
  const allocations = positive.map((segment) => ({
    key: segment.key,
    raw: (totalOre * segment.weight) / totalWeight,
  }));
  const result = new Map<string, MoneyOre>();
  let allocated = 0;
  allocations.forEach((allocation) => {
    const rounded = ensureMoneyOre(roundByMethod(allocation.raw, 0, 'floor'));
    result.set(allocation.key, rounded);
    allocated += rounded;
  });
  let remainder = totalOre - allocated;
  for (const allocation of allocations) {
    if (remainder <= 0) break;
    result.set(allocation.key, ensureMoneyOre((result.get(allocation.key) ?? 0) + 1));
    remainder -= 1;
  }
  return result;
};

const buildYearAllocationsForGroupedSegment = (args: Readonly<{
  yearDates: ReadonlyMap<number, readonly ISODateString[]>;
  employment: LoenindkomstAnsaettelsesforhold;
  values: ErstatningsopgoerelseValues;
  satsOre: MoneyOre;
  agPensionPct: number;
  alreadyPaidSegmentOre: MoneyOre;
  segmentTotalOre: MoneyOre;
}>): ReadonlyMap<number, MoneyOre> => {
  const { yearDates, employment, values, satsOre, agPensionPct, alreadyPaidSegmentOre, segmentTotalOre } = args;
  const entries = [...yearDates.entries()].sort((a, b) => a[0] - b[0]);
  if (entries.length === 0) return new Map<number, MoneyOre>();

  const alreadyPaidByYear = allocateOreByWeights(
    alreadyPaidSegmentOre,
    entries.map(([year, dates]) => ({
      key: String(year),
      weight: buildSfggGrossOre(satsOre, agPensionPct, dates.length),
    }))
  );

  const weightedYears = entries.map(([year, dates]) => {
    const ranges = buildRangesFromSortedDates(dates);
    const grossOre = buildSfggGrossOre(satsOre, agPensionPct, dates.length);
    const ferieberettigetLoenKroner = sumFerieberettigetLoenInRangesKroner(
      employment,
      ranges,
      values.ferieperioder ?? []
    );
    const feriepengeOre = toOre(roundKroner(ferieberettigetLoenKroner * parsePercentToDecimal(employment.feriePct)));
    const alreadyPaidYearOre = alreadyPaidByYear.get(String(year)) ?? ensureMoneyOre(0);
    const remainingOre = clampMoneyOreToZero(ensureMoneyOre(grossOre - feriepengeOre - alreadyPaidYearOre));
    const weight = remainingOre;
    return { year, weight: weight > 0 ? weight : dates.length };
  });

  const allocated = allocateOreByWeights(
    segmentTotalOre,
    weightedYears.map((entry) => ({ key: String(entry.year), weight: entry.weight }))
  );

  return new Map<number, MoneyOre>(
    entries.map(([year]) => [year, allocated.get(String(year)) ?? ensureMoneyOre(0)] as const)
  );
};

const resolveSfggBaseRate = (
  values: ErstatningsopgoerelseValues,
  employment: LoenindkomstAnsaettelsesforhold,
  sfggRow: SygeferiegodtgoerelseAnsaettelsesforholdRow | undefined,
  sfggSource: Readonly<{ kind: SfggSourceKind }>
): Readonly<{
  sfggReferenceperiode: { fra: ISODateString; til: ISODateString } | null;
  sfggReferencesatsOre: SfggReferencesatsCalculable;
  sfggReferencesatsFormula: SfggReferencesatsFormula | null;
}> => {
  if (sfggSource.kind === 'manuel') {
    const manual = amountValueToNumber(sfggRow?.sfggManuelDagssats);
    return {
      sfggReferenceperiode: null,
      sfggReferencesatsOre: manual !== undefined ? calculableSfggReferencesats(toOre(roundKroner(manual))) : notCalculableSfggReferencesats('missing_rate'),
      sfggReferencesatsFormula: null,
    };
  }
  if (sfggSource.kind === 'overenskomst_direkte') {
    return {
      sfggReferenceperiode: null,
      sfggReferencesatsOre: notCalculableSfggReferencesats('per_period_rate'),
      sfggReferencesatsFormula: null,
    };
  }
  if (!sfggRow?.sfggReferenceperiodeFra || !sfggRow.sfggReferenceperiodeTil || sfggRow.sfggReferenceperiodeFra > sfggRow.sfggReferenceperiodeTil) {
    return {
      sfggReferenceperiode: null,
      sfggReferencesatsOre: notCalculableSfggReferencesats('missing_referenceperiode'),
      sfggReferencesatsFormula: null,
    };
  }
  const sfggReferenceperiodeDayCount = resolveSfggReferenceperiodeDayCount(values, sfggRow, sfggSource);
  if (!sfggReferenceperiodeDayCount) {
    return {
      sfggReferenceperiode: { fra: sfggRow.sfggReferenceperiodeFra, til: sfggRow.sfggReferenceperiodeTil },
      sfggReferencesatsOre: notCalculableSfggReferencesats('unresolvable_referenceperiode'),
      sfggReferencesatsFormula: null,
    };
  }
  const arbejdsdage = sfggReferenceperiodeDayCount.divisorDage;
  const ferieberettigetLoenKroner = sumFerieberettigetLoenInRangesKroner(
    employment,
    [{ fra: sfggRow.sfggReferenceperiodeFra, til: sfggRow.sfggReferenceperiodeTil }],
    values.ferieperioder ?? []
  );
  const feriePctDecimal = parsePercentToDecimal(employment.feriePct);
  const feriepengeKroner = ferieberettigetLoenKroner * feriePctDecimal;
  if (arbejdsdage <= 0) {
    return {
      sfggReferenceperiode: { fra: sfggRow.sfggReferenceperiodeFra, til: sfggRow.sfggReferenceperiodeTil },
      sfggReferencesatsOre: notCalculableSfggReferencesats(
        sfggReferenceperiodeDayCount.divisorLabel === 'kalenderdage' ? 'no_calendar_days' : 'no_workdays'
      ),
      sfggReferencesatsFormula: null,
    };
  }
  return {
    sfggReferenceperiode: { fra: sfggRow.sfggReferenceperiodeFra, til: sfggRow.sfggReferenceperiodeTil },
    sfggReferencesatsOre: calculableSfggReferencesats(toOre(roundKroner(feriepengeKroner / arbejdsdage))),
    sfggReferencesatsFormula: {
      ferieberettigetLoenKroner,
      feriePctDecimal,
      feriepengeKroner,
      divisorDage: arbejdsdage,
      divisorLabel: sfggReferenceperiodeDayCount.divisorLabel,
      kalenderdage: sfggReferenceperiodeDayCount.kalenderdage,
      hverdage: sfggReferenceperiodeDayCount.hverdage,
      shDage: sfggReferenceperiodeDayCount.shDage,
      feriedage: sfggReferenceperiodeDayCount.feriedage,
      oevrigeFravaersdage: sfggReferenceperiodeDayCount.oevrigeFravaersdage,
    },
  };
};

type PerEmploymentLoenudvikling =
  Readonly<{ beregnedeSegmenter: readonly LoenudviklingSegment[] }>
  | undefined;

const resolveLoenudviklingSegment = (
  iso: ISODateString,
  loenudvikling: PerEmploymentLoenudvikling
): LoenudviklingSegment | undefined =>
  loenudvikling?.beregnedeSegmenter.find((entry) => iso >= entry.fra && iso <= entry.til);

const resolveAdjustedRate = (
  iso: ISODateString,
  baseRateOre: MoneyOre,
  source: Readonly<{ kind: SfggSourceKind }>,
  loenudvikling: PerEmploymentLoenudvikling
): Readonly<{ satsOre: MoneyOre; reguleringsindeks: number | null }> => {
  if (source.kind !== 'overenskomst_ferielov') {
    return { satsOre: baseRateOre, reguleringsindeks: null };
  }
  const segment = resolveLoenudviklingSegment(iso, loenudvikling);
  if (!segment) {
    return { satsOre: baseRateOre, reguleringsindeks: null };
  }
  // Bevidst undtagelse fra no-prerounding-princippet i form-contract.md:
  // Referencesatsen er en dagssats, der udgør et selvstændigt beregningsresultat —
  // ikke et delresultat i en længere beregningskæde. Afrunding pr. dag til øre-niveau
  // er intentionel og afspejler, at den justerede dagssats er den kanoniske størrelse
  // der ganges på antal dage. Ændres dette, opstår der akkumulerede afrundingsfejl.
  return {
    satsOre: toOre(roundKroner((baseRateOre / 100) * (1 + segment.deltaPct / 100))),
    reguleringsindeks: roundByMethod(100 + segment.deltaPct, 2, 'halfAwayFromZero'),
  };
};

const areAdjacentIsoDates = (left: ISODateString, right: ISODateString): boolean => {
  const leftDate = parseISODate(left);
  if (!leftDate) return false;
  return dateToISO(addDays(leftDate, 1)) === right;
};

const resolveSfggSegmentRateForDate = (args: Readonly<{
  iso: ISODateString;
  employment: LoenindkomstAnsaettelsesforhold;
  sfggRow: SygeferiegodtgoerelseAnsaettelsesforholdRow | undefined;
  sfggSource: Readonly<{ kind: SfggSourceKind }>;
  sfggBaseRate: Readonly<{
    sfggReferenceperiode: { fra: ISODateString; til: ISODateString } | null;
    sfggReferencesatsOre: SfggReferencesatsCalculable;
    sfggReferencesatsFormula: SfggReferencesatsFormula | null;
  }>;
  loenudvikling: PerEmploymentLoenudvikling;
}>): Readonly<{ satsOre: MoneyOre; agPensionPct: number; reguleringsindeks: number | null }> | null => {
  const {
    iso,
    employment,
    sfggRow,
    sfggSource,
    sfggBaseRate,
    loenudvikling,
  } = args;

  if (sfggSource.kind === 'overenskomst_direkte') {
    const satsOre = resolveOverenskomstDagssatsOre(employment, iso, sfggRow?.sfggSatsvalg);
    if (satsOre === null) return null;
    const agPensionPctDecimal = resolveSfggAgPensionPctDecimalForDate(employment, iso);
    return {
      satsOre,
      agPensionPct: roundByMethod(agPensionPctDecimal * 100, 2, 'halfAwayFromZero'),
      reguleringsindeks: null,
    };
  }

  if (sfggBaseRate.sfggReferencesatsOre.status !== 'ok') {
    return null;
  }

  const adjusted = resolveAdjustedRate(
    iso,
    sfggBaseRate.sfggReferencesatsOre.value,
    sfggSource,
    loenudvikling
  );
  const agPensionPctDecimal = resolveSfggAgPensionPctDecimalForDate(employment, iso);
  return {
    satsOre: adjusted.satsOre,
    agPensionPct: roundByMethod(agPensionPctDecimal * 100, 2, 'halfAwayFromZero'),
    reguleringsindeks: adjusted.reguleringsindeks,
  };
};

export const computeSygeferiegodtgoerelse = (args: Readonly<{
  values: ErstatningsopgoerelseValues;
  stamdata: StamdataValues;
  tafRanges: readonly IsoRange[];
  loenudviklingPerAnsaettelse?: ReadonlyMap<string, PerEmploymentLoenudvikling>;
}>): SygeferiegodtgoerelseResult => {
  const { values, stamdata, tafRanges } = args;
  const opgoerelsesdato = values.opgørelseLavetDen ?? TODAY;
  if (tafRanges.length === 0) return EMPTY_RESULT;
  const skadesdato = stamdata.skadesdato;
  const tafDateSetIncludingFirstExcluded = buildDateSetFromRanges(tafRanges);
  const firstExcludedDate =
    skadesdato !== undefined && skadesdato >= '2015-01-01' && erDetteFoersteErstatningsopgoerelse(values.eoNummer)
      ? sortIsoDates(tafDateSetIncludingFirstExcluded)[0] ?? null
      : null;
  const tafDateSet = new Set<ISODateString>(tafDateSetIncludingFirstExcluded);
  if (firstExcludedDate) {
    tafDateSet.delete(firstExcludedDate);
  }

  const tafBeregningsenhed = computeTafBeregningsenhed(values);
  const tafArbejdsdageSet = new Set<ISODateString>();
  const tafArbejdsdageSetIncludingFirstExcluded = new Set<ISODateString>();
  for (const range of tafRanges) {
    for (const iso of buildLoenArbejdsdageSet(range, values.ferieperioder ?? [])) {
      if (tafDateSetIncludingFirstExcluded.has(iso)) {
        tafArbejdsdageSetIncludingFirstExcluded.add(iso);
      }
      if (tafDateSet.has(iso)) {
        tafArbejdsdageSet.add(iso);
      }
    }
  }
  const capComputation =
    skadesdato !== undefined && skadesdato < '2015-01-01'
      ? buildCapComputation(
        tafBeregningsenhed === TAF_BEREGNES_SOM.MAANEDER
          ? sortIsoDates(tafDateSetIncludingFirstExcluded)
          : sortIsoDates(tafArbejdsdageSetIncludingFirstExcluded),
        tafBeregningsenhed
      )
      : { cutoffDate: null, rows: [] };

  const boundsDates = sortIsoDates(tafDateSet);
  if (boundsDates.length === 0) return { ...EMPTY_RESULT, firstExcludedDate };
  const totalPerEmployment: SygeferiegodtgoerelseAnsaettelsesforholdResult[] = [];
  const totalPerYear = new Map<number, MoneyOre>();

  for (const employment of (values.loenindkomstAnsaettelsesforhold ?? []).filter((entry) => entry.ansatPaaSkadestidspunktet)) {
    const sfggRow = getSfggRowForEmployment(values, employment.id);
    const sfggSource = resolveSfggSource(sfggRow, employment);
    if (sfggSource.kind === 'ingen') continue;
    const sfggDayBasis = resolveSfggDayBasis(sfggSource, tafBeregningsenhed);
    const pdfExplanatoryLines: string[] = [];
    const capReachedDate = capComputation.cutoffDate;
    const ansaettelsesophorDate =
      employment.ansaettelsesforholdOphoert && employment.sidsteArbejdsdag
        ? employment.sidsteArbejdsdag
        : null;
    const dateSet = new Set<ISODateString>(tafDateSet);
    const employmentHadFirstExcludedDate =
      firstExcludedDate !== null
      && (
        sfggDayBasis === 'kalenderdage'
          ? tafDateSetIncludingFirstExcluded.has(firstExcludedDate)
          : tafArbejdsdageSetIncludingFirstExcluded.has(firstExcludedDate)
      );
    if (capReachedDate) {
      for (const iso of [...dateSet]) {
        if (iso > capReachedDate) {
          dateSet.delete(iso);
        }
      }
    }

    if (ansaettelsesophorDate) {
      for (const iso of [...dateSet]) {
        if (iso > ansaettelsesophorDate) {
          dateSet.delete(iso);
        }
      }
    }

    if (capReachedDate && (!ansaettelsesophorDate || capReachedDate <= ansaettelsesophorDate)) {
      pdfExplanatoryLines.push(`Retten til sygeferiegodtgørelse er tidsbegrænset til 4 måneder og ${resolveSfggOphoerVerb(capReachedDate, opgoerelsesdato)} den ${isoToDanish(capReachedDate) ?? capReachedDate}.`);
    } else if (ansaettelsesophorDate) {
      pdfExplanatoryLines.push(`Retten til sygeferiegodtgørelse ${resolveSfggOphoerVerb(ansaettelsesophorDate, opgoerelsesdato)} den ${isoToDanish(ansaettelsesophorDate) ?? ansaettelsesophorDate} som følge af ansættelsesforholdets ophør.`);
    }

    const overenskomstPolicy = employment.overenskomstId ? getOverenskomstSfggPolicy(employment.overenskomstId) : undefined;
    const manualFoerstEfterSygeloen = sfggSource.kind === 'manuel' && sfggRow?.sfggManuelFoerstEfterSygeloen === 'Ja';
    const foerstEfterSygeloen =
      manualFoerstEfterSygeloen
      || (sfggSource.kind !== 'manuel' && overenskomstPolicy?.bortfalderUnderArbejdsgiverbetaltSygeloen === true);

    let afterEmployerSickPayExcludedAny = false;
    if (foerstEfterSygeloen) {
      const excluded = buildIncomeExcludedDateSet(employment);
      for (const iso of [...dateSet]) {
        if (excluded.has(iso)) {
          dateSet.delete(iso);
          afterEmployerSickPayExcludedAny = true;
        }
      }
    }

    const sfggIntroText = buildSfggIntroText(sfggRow, employment, sfggSource);
    const sfggReferenceperiodeAuthorityText = resolveSfggReferenceperiodeAuthorityText(sfggSource.kind);
    const sfggReferenceperiodeLabel = resolveSfggReferenceperiodeLabel(employment);
    const sfggDirectRateLabel = sfggSource.kind === 'overenskomst_direkte'
      ? resolveSfggDifferentieretSatsLabel(sfggRow?.sfggSatsvalg)
      : null;
    const sfggFirstTafDayExcludedText = employmentHadFirstExcludedDate
      ? SFGG_FIRST_TAF_DAY_EXCLUDED_TEXT
      : null;
    const sfggAfterEmployerSickPayProjection = resolveSfggAfterEmployerSickPayProjection({
      excludedAny: afterEmployerSickPayExcludedAny,
      sfggSourceKind: sfggSource.kind,
      manualFoerstEfterSygeloen,
      overenskomstPolicy,
    });
    const sfggAfterEmployerSickPayText = sfggAfterEmployerSickPayProjection.text;

    const ferieBreakDateSet = buildFerieDageSet(
      values.ferieperioder ?? [],
      dateSet,
      { includeWeekends: sfggDayBasis === 'kalenderdage' }
    );
    const eligibleDates = sfggDayBasis === 'kalenderdage'
      ? sortIsoDates(dateSet).filter((iso) => !ferieBreakDateSet.has(iso))
      : sortIsoDates(dateSet).filter((iso) => tafArbejdsdageSet.has(iso));
    if (eligibleDates.length === 0) {
      totalPerEmployment.push({
        ansaettelsesforholdId: employment.id,
        ansaettelsesforholdNavn: getEmploymentName(employment),
        sfggSourceLabel: sfggSource.label,
        sfggSourceKind: sfggSource.kind,
        sfggDayBasis,
        sfggIntroText,
        sfggReferenceperiodeAuthorityText,
        sfggReferenceperiodeLabel,
        sfggDirectRateLabel,
        sfggFirstTafDayExcludedText,
        sfggAfterEmployerSickPayText,
        pdfExplanatoryLines,
        segments: [],
        perYear: [],
        feriepengekravTotalOre: ensureMoneyOre(0),
        totalOre: ensureMoneyOre(0),
        alleredeBetaltOre: ensureMoneyOre(0),
        sfggReferenceperiode: null,
        sfggReferencesats: notCalculableSfggReferencesats(
          sfggDayBasis === 'kalenderdage' ? 'no_calendar_days' : 'no_workdays'
        ),
        sfggReferencesatsFormula: null,
        feriepengeModtagetFormula: null,
        capRows: capComputation.rows,
        capReachedDate: capComputation.cutoffDate,
      });
      continue;
    }

    const sfggBaseRate = resolveSfggBaseRate(values, employment, sfggRow, sfggSource);
    const eligibleDateSet = new Set<ISODateString>(eligibleDates);
    const grouped: Array<{
      fra: ISODateString;
      til: ISODateString;
      reguleringsindeks: number | null;
      satsOre: MoneyOre;
      agPensionPct: number;
      dates: ISODateString[];
    }> = [];
    const rightDates = sortIsoDates(dateSet);
    for (const iso of rightDates) {
      if (!eligibleDateSet.has(iso) && ferieBreakDateSet.has(iso)) {
        continue;
      }
      const rate = resolveSfggSegmentRateForDate({
        iso,
        employment,
        sfggRow,
        sfggSource,
        sfggBaseRate,
        loenudvikling: args.loenudviklingPerAnsaettelse?.get(employment.id),
      });
      if (rate === null) continue;
      const previous = grouped[grouped.length - 1];
      const canExtendPrevious =
        previous
        && areAdjacentIsoDates(previous.til, iso)
        && previous.satsOre === rate.satsOre
        && previous.agPensionPct === rate.agPensionPct
        && previous.reguleringsindeks === rate.reguleringsindeks;

      if (canExtendPrevious) {
        previous.til = iso;
        if (eligibleDateSet.has(iso)) {
          previous.dates.push(iso);
        }
        continue;
      }

      grouped.push({
        fra: iso,
        til: iso,
        reguleringsindeks: rate.reguleringsindeks,
        satsOre: rate.satsOre,
        agPensionPct: rate.agPensionPct,
        dates: eligibleDateSet.has(iso) ? [iso] : [],
      });
    }
    const groupedWithEligibleDays = grouped.filter((group) => group.dates.length > 0);

    const ferieberettigetLoenBySegment = new Map<string, number>();
    const feriepengeBySegment = new Map<string, MoneyOre>();
    groupedWithEligibleDays.forEach((group, index) => {
      const ferieberettigetLoenKroner = sumFerieberettigetLoenInRangesKroner(
        employment,
        [{ fra: group.fra, til: group.til }],
        values.ferieperioder ?? []
      );
      const feriePctDecimal = parsePercentToDecimal(employment.feriePct);
      ferieberettigetLoenBySegment.set(`${group.fra}:${index}`, ferieberettigetLoenKroner);
      feriepengeBySegment.set(`${group.fra}:${index}`, toOre(roundKroner(ferieberettigetLoenKroner * feriePctDecimal)));
    });

    const alreadyPaidOre = ensureMoneyOre(toOre(roundKroner(amountValueToNumber(sfggRow?.sfggAlleredeBetaltBeloeb) ?? 0)));
    const grossWeights = groupedWithEligibleDays.map((group, index) => ({
      key: `${group.fra}:${index}`,
      weight: buildSfggGrossOre(group.satsOre, group.agPensionPct, group.dates.length),
    }));
    const allocatedAlreadyPaid = allocateOreByWeights(alreadyPaidOre, grossWeights);
    const employmentPerYear = new Map<number, MoneyOre>();

    const segments: SygeferiegodtgoerelseSegment[] = groupedWithEligibleDays.map((group, index) => {
      const key = `${group.fra}:${index}`;
      const grossOre = buildSfggGrossOre(group.satsOre, group.agPensionPct, group.dates.length);
      const ferieberettigetLoenKroner = ferieberettigetLoenBySegment.get(key) ?? 0;
      const feriepengeOre = feriepengeBySegment.get(key) ?? ensureMoneyOre(0);
      const alreadyPaidSegmentOre = allocatedAlreadyPaid.get(key) ?? ensureMoneyOre(0);
      const remainingOre = clampMoneyOreToZero(ensureMoneyOre(grossOre - feriepengeOre - alreadyPaidSegmentOre));
      const segmentTotalOre = remainingOre;

      const yearDates = new Map<number, ISODateString[]>();
      group.dates.forEach((iso) => {
        const year = Number.parseInt(iso.slice(0, 4), 10);
        const dates = yearDates.get(year) ?? [];
        dates.push(iso);
        yearDates.set(year, dates);
      });
      const yearAllocations = buildYearAllocationsForGroupedSegment({
        yearDates,
        employment,
        values,
        satsOre: group.satsOre,
        agPensionPct: group.agPensionPct,
        alreadyPaidSegmentOre,
        segmentTotalOre,
      });
      yearAllocations.forEach((amountOre, year) => {
        totalPerYear.set(year, ensureMoneyOre((totalPerYear.get(year) ?? 0) + amountOre));
        employmentPerYear.set(year, ensureMoneyOre((employmentPerYear.get(year) ?? 0) + amountOre));
      });

      return {
        ansaettelsesforholdId: employment.id,
        ansaettelsesforholdNavn: getEmploymentName(employment),
        fra: group.fra,
        til: group.til,
        reguleringsindeks: group.reguleringsindeks,
        satsOre: group.satsOre,
        agPensionPct: group.agPensionPct,
        antalDage: group.dates.length,
        feriepengekravOre: grossOre,
        beregnetSfggoereOre: segmentTotalOre,
        ferieberettigetLoenKroner,
        feriepengeAfSygeloenOre: feriepengeOre,
        alleredeBetaltOre: alreadyPaidSegmentOre,
      };
    });

    const feriepengeModtagetOre = ensureMoneyOre(
      segments.reduce((sum, segment) => sum + segment.feriepengeAfSygeloenOre, 0)
    );
    const feriepengeModtagetFormula = feriepengeModtagetOre > 0 || segments.some((segment) => segment.ferieberettigetLoenKroner > 0)
      ? {
        ferieberettigetLoenKroner: segments.reduce((sum, segment) => sum + segment.ferieberettigetLoenKroner, 0),
        feriePctDecimal: typeof employment.feriePct === 'number' ? parsePercentToDecimal(employment.feriePct) : undefined,
        feriepengeOre: feriepengeModtagetOre,
      }
      : null;

    totalPerEmployment.push({
      ansaettelsesforholdId: employment.id,
      ansaettelsesforholdNavn: getEmploymentName(employment),
      sfggSourceLabel: sfggSource.label,
      sfggSourceKind: sfggSource.kind,
      sfggDayBasis,
      sfggIntroText,
      sfggReferenceperiodeAuthorityText,
      sfggReferenceperiodeLabel,
      sfggDirectRateLabel,
      sfggFirstTafDayExcludedText,
      sfggAfterEmployerSickPayText,
      pdfExplanatoryLines,
      segments,
      perYear: [...employmentPerYear.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([year, amountOre]) => ({ year, amountOre })),
      feriepengekravTotalOre: ensureMoneyOre(segments.reduce((sum, segment) => sum + segment.feriepengekravOre, 0)),
      totalOre: ensureMoneyOre(segments.reduce((sum, segment) => sum + segment.beregnetSfggoereOre, 0)),
      alleredeBetaltOre: alreadyPaidOre,
      sfggReferenceperiode: sfggBaseRate.sfggReferenceperiode,
      sfggReferencesats: sfggBaseRate.sfggReferencesatsOre,
      sfggReferencesatsFormula: sfggBaseRate.sfggReferencesatsFormula,
      feriepengeModtagetFormula,
      capRows: capComputation.rows,
      capReachedDate: capComputation.cutoffDate,
    });
  }

  return {
    totalOre: ensureMoneyOre(totalPerEmployment.reduce((sum, entry) => sum + entry.totalOre, 0)),
    perAnsaettelsesforhold: totalPerEmployment,
    perYear: [...totalPerYear.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([year, amountOre]) => ({ year, amountOre })),
    firstExcludedDate,
  };
};

export const findSfggSixMonthWarningEmploymentIds = (args: Readonly<{
  values: ErstatningsopgoerelseValues;
  result: SygeferiegodtgoerelseResult;
}>): readonly string[] => {
  const warningIds: string[] = [];

  for (const employment of args.values.loenindkomstAnsaettelsesforhold ?? []) {
    const calculation = args.result.perAnsaettelsesforhold.find((entry) => entry.ansaettelsesforholdId === employment.id);
    if (!calculation || calculation.segments.length === 0) continue;
    const lastIncomeDate = getLastIncomeDate(employment);
    if (!lastIncomeDate) continue;
    const lastIncomeDateObj = parseISODate(lastIncomeDate);
    if (!lastIncomeDateObj) continue;
    const threshold = addMonths(lastIncomeDateObj, 6);
    const thresholdIso = dateToISO(threshold);
    if (!thresholdIso) continue;
    const latestSegmentDate = calculation.segments[calculation.segments.length - 1]?.til;
    if (latestSegmentDate && latestSegmentDate > thresholdIso) {
      warningIds.push(employment.id);
    }
  }

  return warningIds;
};
