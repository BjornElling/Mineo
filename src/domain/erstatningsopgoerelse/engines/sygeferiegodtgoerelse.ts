import { getDayBeforeIso, sortIsoDates } from '../../../utils/isoDateHelpers';
import type {
  ErstatningsopgoerelseValues,
  LoenindkomstAnsaettelsesforhold,
  StamdataValues,
  StandardLoenTableRow,
  SygeferiegodtgoerelseAnsaettelsesforholdRow,
} from '../../../schemas/formSchemas';
import { TODAY } from '../../../config/dateRanges';
import { amountValueToNumber } from '../../../utils/expressionAmount';
import { addMonths } from '../../../utils/dateUtils';
import { roundByMethod } from '../../../utils/rounding';
import { calculateStandardLoenRowDerived } from '../../aarsloen/standardLoenRowCalculations';
import { parseAarsloenRowInterval } from '../helpers/indtaegtPerioder';
import { buildLoenArbejdsdageSet, optaelArbejdsdage, optaelArbejdsdageBreakdown, resolveIncomeAllocationDays } from './periodiseringsMotor';
import { buildDatoSetInclusiveFromDates, buildFerieDageSet } from './tafDaySets';
import {
  buildDateSetFromRanges,
  buildSingleDateRange,
  clipRangesToInclusiveUpperBound,
  mergeIsoDateRanges,
  splitRangesAtBoundaryStarts,
  subtractIsoDateRanges,
} from './isoRangeAlgebra';
import { rangesOverlap } from './beregningsperiodeTafOverlap';
import { computeTafBeregningsenhed, TAF_BEREGNES_SOM, type TafBeregningsenhed } from '../helpers/tafBeregningsenhed';
import {
  getSfggKildeSpec,
  resolveSfggDayBasis,
  resolveSfggSource,
  sfggKildeUsesReferenceperiode,
  type SfggDayBasis,
  type SfggSourceKind,
} from './sygeferiegodtgoerelseKilde';
import type { IsoRange } from '../validation/tafPeriodConstraints';
import { danishToISO, dateToISO, parseISODate, type ISODateString } from '../../../types/branded';
import { isoToDanish, toDanishDateString } from '../../../types/branded';
import {
  addMoneyOre,
  clampMoneyOreToZero,
  fromKroner,
  moneyOre,
  roundKroner,
  subtractMoneyOre,
  sumMoneyOre,
  toKroner,
  zeroMoneyOre,
} from '../../money/money';
import { formatDanishDate } from '../../../utils/dateFormatting';
import type { LoenudviklingSegment } from '../shared/eoTypes';
import type { MoneyOre } from '../../money/money';
import { resolvePctDecimalFromSatsOrInput } from '../helpers/eoSharedUtils';
import {
  getEffektiveSatserForDato,
  getEffektiveSatserForPeriode,
  getOffentligTillaegsSatserForPeriode,
  getOffentligOverenskomstTypeById,
  getOverenskomstSfggPolicy,
  resolveOverenskomstRef,
} from '../../../data/overenskomstRates';
import { erDetteFoersteErstatningsopgoerelse } from '../validation/eoNummerValidering';
import { countInclusiveUtcDays } from '../../../utils/utcDayMath';
import {
  buildSfggAfterEmployerSickPayText,
  buildSfggLovbestemtFeriepengeNote,
  buildSfggNoEligibleDaysReason,
  SFGG_FIRST_TAF_DAY_EXCLUDED_TEXT,
  buildSfggIntroText,
  resolveSfggFoerstEfterSygeloen,
  resolveSfggDifferentieretSatsLabel,
  resolveSfggReferenceperiodeAuthorityText,
  resolveSfggReferenceperiodeLabel,
} from '../helpers/sygeferiegodtgoerelseTexts';

/**
 * Beregningsteknisk princip for sygeferiegodtgørelse (SFGG):
 *
 * Når SFGG ikke udgør en overenskomstbestemt eller manuelt angivet sats, men i stedet
 * beregnes som en procentdel af den ferieberettigede løn (ferielov-sporet og
 * overenskomst-efter-ferielov-sporet), anvendes ALTID den lovbestemte feriepengesats
 * på 12,5 %.
 *
 * Den feriepengesats, brugeren har indtastet for lønindkomsten i ansættelsesforholdet
 * (`employment.feriePct`), bruges derfor aldrig til SFGG — hverken til selve
 * referencesatsen eller til fradraget for feriepenge modtaget i perioden. Den indtastede
 * sats er typisk overenskomstforhøjet (fx 14,5 %) og dækker tillæg, der ikke indgår i
 * SFGG; SFGG hviler på ferielovens almindelige feriepengeprocent.
 */
export const SFGG_LOVBESTEMT_FERIEPENGE_PCT = 12.5;
export const SFGG_LOVBESTEMT_FERIEPENGE_DECIMAL = SFGG_LOVBESTEMT_FERIEPENGE_PCT / 100;

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
  loenPlusLoen2PlusIkkePensLoenKroner: number;
  feriepengeAfSygeloenOre: MoneyOre;
  alleredeBetaltOre: MoneyOre;
}>;

/**
 * Struktureret afkortning af SFGG-perioden. Motoren emitterer årsag + verbum + dato som data;
 * læse-siden (kontrol og PDF/Word) formatterer dette til prosa. Repræsentationen er bevidst
 * struktureret frem for fri tekst, så "vist = beregnet" holder ved konstruktion — ingen konsument
 * parser motorens egen prosa tilbage til struktur.
 */
export type SfggAfkortningsAarsag = 'cap4mdr' | 'ansaettelsesophoer';

export type SfggAfkortning = Readonly<{
  aarsag: SfggAfkortningsAarsag;
  verbum: 'bortfaldt' | 'bortfalder';
  dato: ISODateString;
}>;

export type SfggReferencesatsFormula = Readonly<{
  loenPlusLoen2PlusIkkePensLoenKroner: number;
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
  totalOre: MoneyOre;
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
  sfggLovbestemtFeriepengeNote: string | null;
  foerstEfterSygeloen: boolean;
  sfggAfkortninger: readonly SfggAfkortning[];
  segments: readonly SygeferiegodtgoerelseSegment[];
  perYear: readonly Readonly<{
    year: number;
    amountOre: MoneyOre;
  }>[];
  feriepengekravTotalOre: MoneyOre;
  totalOre: MoneyOre;
  alleredeBetaltOre: MoneyOre;
  sfggVisningsperiode: readonly IsoRange[];
  sfggReferenceperiode: Readonly<{ fra: ISODateString; til: ISODateString }> | null;
  sfggReferencesats: SfggReferencesatsCalculable;
  sfggReferencesatsFormula: SfggReferencesatsFormula | null;
  feriepengeModtagetFormula: SfggFeriepengeModtagetFormula | null;
  capReachedDate: ISODateString | null;
}>;

export type SygeferiegodtgoerelseResult = Readonly<{
  totalOre: MoneyOre;
  perAnsaettelsesforhold: readonly SygeferiegodtgoerelseAnsaettelsesforholdResult[];
  perYear: readonly Readonly<{ year: number; amountOre: MoneyOre }>[];
  firstExcludedDate: ISODateString | null;
}>;

export const EMPTY_RESULT: SygeferiegodtgoerelseResult = {
  totalOre: zeroMoneyOre(),
  perAnsaettelsesforhold: [],
  perYear: [],
  firstExcludedDate: null,
};

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
  return getDayBeforeIso(getFirstIndtastedeTafFraDato(values));
};

const FOUR_MONTHS_EPSILON = 1e-12;

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
  const monthStart = dateToISO(new Date(Date.UTC(year, month, 1)));
  const monthEnd = dateToISO(new Date(Date.UTC(year, month + 1, 0)));
  if (!monthStart || !monthEnd) return 0;
  const arbejdsdageIMaaneden = optaelArbejdsdage({
    fra: monthStart,
    til: monthEnd,
    ferieperioder: [],
    loseFeriedage: 0,
    context: { kind: 'taf' },
  }) ?? 0;
  return arbejdsdageIMaaneden > 0 ? 1 / arbejdsdageIMaaneden : 0;
};

// Finder den dato, hvor de akkumulerede sygemåneder når 4-måneders-loftet (skader før 1.1.2015),
// eller null hvis loftet ikke nås inden for de talte dage. Månedsbrøken pr. dag afhænger af TAF-enheden.
const resolveSfggCapCutoffDate = (
  sortedCountedDates: readonly ISODateString[],
  mode: TafBeregningsenhed
): ISODateString | null => {
  const monthFractionByDate = new Map<ISODateString, number>();
  let totalMonths = 0;
  for (const iso of sortedCountedDates) {
    let fraction = monthFractionByDate.get(iso);
    if (fraction === undefined) {
      fraction = dateInMonthFraction(iso, mode);
      monthFractionByDate.set(iso, fraction);
    }
    totalMonths += fraction;
    if (totalMonths + FOUR_MONTHS_EPSILON >= 4) {
      return iso;
    }
  }
  return null;
};

const getSfggRowForEmployment = (
  values: ErstatningsopgoerelseValues,
  ansaettelsesforholdId: string
): SygeferiegodtgoerelseAnsaettelsesforholdRow | undefined =>
  values.sfggAnsaettelsesforhold.find((row) => row.ansaettelsesforholdId === ansaettelsesforholdId);

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

const assertNever = (value: never): never => {
  throw new Error(`Uventet SFGG-kildeværdi: ${String(value)}`);
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
  const { afterSickPayModel } = getSfggKildeSpec(args.sfggSourceKind);
  switch (afterSickPayModel) {
    case 'ingen':
      return { hasExplanation: false, text: null };
    case 'manuel':
      return args.excludedAny && args.manualFoerstEfterSygeloen
        ? { hasExplanation: true, text: buildSfggAfterEmployerSickPayText({ kind: 'manual' }) }
        : { hasExplanation: false, text: null };
    case 'overenskomst':
      return args.overenskomstPolicy?.bortfalderUnderArbejdsgiverbetaltSygeloen === true
        ? { hasExplanation: true, text: buildSfggAfterEmployerSickPayText({ kind: 'overenskomst' }) }
        : { hasExplanation: false, text: null };
    default:
      return assertNever(afterSickPayModel);
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

export const sumLoenPlusLoen2PlusIkkePensLoenInRangesKroner = (
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
    if (!Number.isFinite(derived.loenPlusLoen2PlusIkkePensLoen) || derived.loenPlusLoen2PlusIkkePensLoen <= 0) continue;
    const intervalFra = dateToISO(interval.start);
    const intervalTil = dateToISO(interval.end);
    if (!intervalFra || !intervalTil) continue;
    // Fald-tilbage (jf. periodisering-contract.md §3A): en lønrække uden arbejdsdage (fx hel ferie)
    // skal stadig indgå i SFGG-referencelønnen, så "løn før skaden" er ens overalt. Fald-tilbage-
    // dagene tæller kun til fordelingsbrøken — SFGG's dag-divisor er uændret (feriedage forbliver
    // feriedage), så per-dag-satsen stiger uden at dagtallet gør det.
    const { days: rowArbejdsdageSet } = resolveIncomeAllocationDays(
      { fra: intervalFra, til: intervalTil },
      buildLoenArbejdsdageSet({ fra: intervalFra, til: intervalTil }, ferieperioder ?? [])
    );
    const totalArbejdsdage = rowArbejdsdageSet.size;
    const overlapArbejdsdage = Array.from(rowArbejdsdageSet).filter((iso) => includedDateSet.has(iso)).length;
    if (totalArbejdsdage > 0 && overlapArbejdsdage > 0) {
      sum += derived.loenPlusLoen2PlusIkkePensLoen * (overlapArbejdsdage / totalArbejdsdage);
    }
  }
  return sum;
};

type EmploymentSfggCalculator = Readonly<{
  sumLoenInRangesKroner: (ranges: readonly IsoRange[]) => number;
  sumLoenForDatesKroner: (dates: readonly ISODateString[]) => number;
  buildFeriepengeOreForDates: (dates: readonly ISODateString[]) => MoneyOre;
  buildFeriepengeOreByYear: (dates: readonly ISODateString[]) => ReadonlyMap<number, MoneyOre>;
}>;

const calculateSfggFeriepengeMedPensionOreFromLoenKroner = (
  loenPlusLoen2PlusIkkePensLoenKroner: number,
  employment: LoenindkomstAnsaettelsesforhold,
  iso: ISODateString
): MoneyOre => {
  if (loenPlusLoen2PlusIkkePensLoenKroner <= 0) return zeroMoneyOre();
  // SFGG bruger altid den lovbestemte feriepengesats (12,5 %), aldrig employment.feriePct.
  const feriepengeKroner = loenPlusLoen2PlusIkkePensLoenKroner * SFGG_LOVBESTEMT_FERIEPENGE_DECIMAL;
  const pensionMultiplier = 1 + resolveSfggAgPensionPctDecimalForDate(employment, iso);
  return fromKroner(roundKroner(feriepengeKroner * pensionMultiplier));
};

const buildEmploymentSfggCalculator = (
  employment: LoenindkomstAnsaettelsesforhold,
  ferieperioder: ErstatningsopgoerelseValues['ferieperioder']
): EmploymentSfggCalculator => {
  const feriepengeOreByDate = new Map<ISODateString, MoneyOre>();
  const precomputedRows: Array<Readonly<{
    loenPlusLoen2PlusIkkePensLoen: number;
    arbejdsdageSet: ReadonlySet<ISODateString>;
    totalArbejdsdage: number;
  }>> = [];
  const satser = {
    feriePct: employment.feriePct,
    fritvalgPct: employment.fritvalgPct,
    shSoPct: employment.shSoPct,
    storeBededagPct: employment.storeBededagPct,
    pensionPct: employment.pensionPct,
  };

  for (const row of employment.indtaegtsoplysningerTableData ?? []) {
    const interval = parseAarsloenRowInterval(row, employment.loenperiode);
    if (!interval) continue;
    const derived = calculateStandardLoenRowDerived(row, satser);
    if (!Number.isFinite(derived.loenPlusLoen2PlusIkkePensLoen) || derived.loenPlusLoen2PlusIkkePensLoen <= 0) continue;
    const intervalFra = dateToISO(interval.start);
    const intervalTil = dateToISO(interval.end);
    if (!intervalFra || !intervalTil) continue;
    // Fald-tilbage (jf. periodisering-contract.md §3A): se sumLoenPlusLoen2PlusIkkePensLoenInRangesKroner.
    // Bemærk: fald-tilbage-dagene er feriedage og indgår derfor aldrig i SFGG's dag-baserede
    // feriepenge-udbetaling (buildFeriepengeOreForDate slår kun op på ferie-EKSKLUDEREDE dage);
    // de bidrager kun til reference-lønnen via sumRanges.
    const { days: rowArbejdsdageSet } = resolveIncomeAllocationDays(
      { fra: intervalFra, til: intervalTil },
      buildLoenArbejdsdageSet({ fra: intervalFra, til: intervalTil }, ferieperioder ?? [])
    );
    const totalArbejdsdage = rowArbejdsdageSet.size;
    if (totalArbejdsdage <= 0) continue;
    precomputedRows.push({
      loenPlusLoen2PlusIkkePensLoen: derived.loenPlusLoen2PlusIkkePensLoen,
      arbejdsdageSet: rowArbejdsdageSet,
      totalArbejdsdage,
    });
  }

  const sumSingleDate = (iso: ISODateString): number => {
    let sum = 0;
    for (const row of precomputedRows) {
      if (!row.arbejdsdageSet.has(iso)) continue;
      sum += row.loenPlusLoen2PlusIkkePensLoen * (1 / row.totalArbejdsdage);
    }
    return sum;
  };

  const sumDates = (dates: Iterable<ISODateString>): number => {
    const includedDates = new Set<ISODateString>(dates);
    if (includedDates.size === 0) return 0;
    let sum = 0;
    for (const row of precomputedRows) {
      let overlapArbejdsdage = 0;
      for (const iso of includedDates) {
        if (row.arbejdsdageSet.has(iso)) {
          overlapArbejdsdage += 1;
        }
      }
      if (overlapArbejdsdage <= 0) continue;
      sum += row.loenPlusLoen2PlusIkkePensLoen * (overlapArbejdsdage / row.totalArbejdsdage);
    }
    return sum;
  };

  const sumRanges = (ranges: readonly IsoRange[]): number => {
    const validRanges = ranges.filter((range) => range.fra <= range.til);
    if (validRanges.length === 0) return 0;
    let sum = 0;
    for (const row of precomputedRows) {
      let overlapArbejdsdage = 0;
      for (const iso of row.arbejdsdageSet) {
        if (validRanges.some((range) => iso >= range.fra && iso <= range.til)) {
          overlapArbejdsdage += 1;
        }
      }
      if (overlapArbejdsdage <= 0) continue;
      sum += row.loenPlusLoen2PlusIkkePensLoen * (overlapArbejdsdage / row.totalArbejdsdage);
    }
    return sum;
  };

  const buildFeriepengeOreForDate = (iso: ISODateString): MoneyOre => {
    const cached = feriepengeOreByDate.get(iso);
    if (cached !== undefined) return cached;

    const result = calculateSfggFeriepengeMedPensionOreFromLoenKroner(sumSingleDate(iso), employment, iso);
    feriepengeOreByDate.set(iso, result);
    return result;
  };

  return {
    sumLoenInRangesKroner: (ranges) => {
      if (ranges.length === 0) return 0;
      return sumRanges(ranges);
    },
    sumLoenForDatesKroner: (dates) => {
      if (dates.length === 0) return 0;
      return sumDates(dates);
    },
    buildFeriepengeOreForDates: (dates) => sumMoneyOre(
      dates.map((iso) => buildFeriepengeOreForDate(iso))
    ),
    buildFeriepengeOreByYear: (dates) => {
      const byYear = new Map<number, MoneyOre>();
      for (const iso of dates) {
        const year = Number.parseInt(iso.slice(0, 4), 10);
        byYear.set(
          year,
          addMoneyOre(byYear.get(year) ?? zeroMoneyOre(), buildFeriepengeOreForDate(iso))
        );
      }
      return byYear;
    },
  };
};

const resolveSfggDirectSatsValue = (
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
    dato: toDanishDateString(formatDanishDate(date)),
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
    ? fromKroner(roundKroner(value))
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
    dato: toDanishDateString(formatDanishDate(date)),
    applyAlmindeligLoenPaaShDageRegel: employment.loenPaaHelligdage === 'Almindelig løn',
  });
  return resolvePctDecimalFromSatsOrInput(satser?.agPension, employment.pensionPct);
};

const buildSfggGrossOre = (
  satsOre: MoneyOre,
  agPensionPct: number,
  antalDage: number
): MoneyOre =>
  fromKroner(roundKroner(toKroner(satsOre) * ((100 + agPensionPct) / 100) * antalDage));

const sumLoenPlusLoen2PlusIkkePensLoenForEligibleDatesKroner = (
  employment: LoenindkomstAnsaettelsesforhold,
  dates: readonly ISODateString[],
  ferieperioder: ErstatningsopgoerelseValues['ferieperioder'],
  calculator?: EmploymentSfggCalculator
): number =>
  calculator
    ? calculator.sumLoenForDatesKroner(dates)
    : sumLoenPlusLoen2PlusIkkePensLoenInRangesKroner(
      employment,
      dates.map((iso) => ({ fra: iso, til: iso })),
      ferieperioder
    );

const buildIncomeExcludedRanges = (employment: LoenindkomstAnsaettelsesforhold): IsoRange[] => {
  const ranges: IsoRange[] = [];
  for (const row of employment.indtaegtsoplysningerTableData ?? []) {
    if (!rowHasPositiveIncome(row)) continue;
    const interval = parseAarsloenRowInterval(row, employment.loenperiode);
    if (!interval) continue;
    const fra = dateToISO(interval.start);
    const til = dateToISO(interval.end);
    if (fra && til && fra <= til) ranges.push({ fra, til });
  }
  return mergeIsoDateRanges(ranges, { mergeAdjacent: true });
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
    const rounded = moneyOre(roundByMethod(allocation.raw, 0, 'floor'));
    result.set(allocation.key, rounded);
    allocated += rounded;
  });
  let remainder = totalOre - allocated;
  for (const allocation of allocations) {
    if (remainder <= 0) break;
    result.set(
      allocation.key,
      addMoneyOre(result.get(allocation.key) ?? zeroMoneyOre(), moneyOre(1))
    );
    remainder -= 1;
  }
  return result;
};

const buildYearAllocationsForGroupedSegment = (args: Readonly<{
  yearDates: ReadonlyMap<number, readonly ISODateString[]>;
  satsOre: MoneyOre;
  agPensionPct: number;
  alreadyPaidSegmentOre: MoneyOre;
  segmentTotalOre: MoneyOre;
  feriepengeOreByYear: ReadonlyMap<number, MoneyOre>;
}>): ReadonlyMap<number, MoneyOre> => {
  const { yearDates, satsOre, agPensionPct, alreadyPaidSegmentOre, segmentTotalOre, feriepengeOreByYear } = args;
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
    const grossOre = buildSfggGrossOre(satsOre, agPensionPct, dates.length);
    const feriepengeOre = feriepengeOreByYear.get(year) ?? zeroMoneyOre();
    const alreadyPaidYearOre = alreadyPaidByYear.get(String(year)) ?? zeroMoneyOre();
    const remainingOre = clampMoneyOreToZero(subtractMoneyOre(
      subtractMoneyOre(grossOre, feriepengeOre),
      alreadyPaidYearOre
    ));
    const weight = remainingOre;
    return { year, weight: weight > 0 ? weight : dates.length };
  });

  const allocated = allocateOreByWeights(
    segmentTotalOre,
    weightedYears.map((entry) => ({ key: String(entry.year), weight: entry.weight }))
  );

  return new Map<number, MoneyOre>(
    entries.map(([year]) => [year, allocated.get(String(year)) ?? zeroMoneyOre()] as const)
  );
};

const resolveSfggBaseRate = (
  values: ErstatningsopgoerelseValues,
  employment: LoenindkomstAnsaettelsesforhold,
  sfggRow: SygeferiegodtgoerelseAnsaettelsesforholdRow | undefined,
  sfggSource: Readonly<{ kind: SfggSourceKind }>,
  calculator?: EmploymentSfggCalculator
): Readonly<{
  sfggReferenceperiode: { fra: ISODateString; til: ISODateString } | null;
  sfggReferencesatsOre: SfggReferencesatsCalculable;
  sfggReferencesatsFormula: SfggReferencesatsFormula | null;
}> => {
  const { rateModel } = getSfggKildeSpec(sfggSource.kind);
  if (rateModel === 'manuel') {
    const manual = amountValueToNumber(sfggRow?.sfggManuelDagssats);
    return {
      sfggReferenceperiode: null,
      sfggReferencesatsOre: manual !== undefined ? calculableSfggReferencesats(fromKroner(roundKroner(manual))) : notCalculableSfggReferencesats('missing_rate'),
      sfggReferencesatsFormula: null,
    };
  }
  if (rateModel === 'per_periode_overenskomst') {
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
  const loenPlusLoen2PlusIkkePensLoenKronerRaw = calculator
    ? calculator.sumLoenInRangesKroner([{ fra: sfggRow.sfggReferenceperiodeFra, til: sfggRow.sfggReferenceperiodeTil }])
    : sumLoenPlusLoen2PlusIkkePensLoenInRangesKroner(
      employment,
      [{ fra: sfggRow.sfggReferenceperiodeFra, til: sfggRow.sfggReferenceperiodeTil }],
      values.ferieperioder ?? []
    );
  // Referencesatsen beregnes af den AFRUNDEDE løn (2 decimaler) — samme værdi som vises i bilaget
  // ("Lønnen i referenceperioden udgør X kr."), så brugeren kan efterregne
  // "referencesats = round(X × 12,5 % / N dage)" fra det viste tal.
  const loenPlusLoen2PlusIkkePensLoenKroner = roundKroner(loenPlusLoen2PlusIkkePensLoenKronerRaw);
  // SFGG-referencesatsen beregnes altid med den lovbestemte feriepengesats (12,5 %),
  // aldrig med den feriepengesats brugeren har indtastet for lønindkomsten.
  const feriePctDecimal = SFGG_LOVBESTEMT_FERIEPENGE_DECIMAL;
  const feriepengeKroner = loenPlusLoen2PlusIkkePensLoenKroner * feriePctDecimal;
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
    sfggReferencesatsOre: calculableSfggReferencesats(fromKroner(roundKroner(feriepengeKroner / arbejdsdage))),
    sfggReferencesatsFormula: {
      loenPlusLoen2PlusIkkePensLoenKroner,
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

const assertKlSegmentDeltaMatchesReguleretLoen = (segment: LoenudviklingSegment): void => {
  if (segment.reguleretLoenOre === undefined) return;
  const baseLoenOre = segment.kind === 'maaneder' ? segment.maanedsloenOre : segment.dagsloenOre;
  if (baseLoenOre <= 0) {
    throw new Error('SFGG kan ikke beregnes: KL-lønaftaler-segment mangler positiv basisløn');
  }
  const reproducedOre = fromKroner(roundKroner((baseLoenOre / 100) * (1 + segment.deltaPct / 100)));
  if (Math.abs(reproducedOre - segment.reguleretLoenOre) > 0) {
    throw new Error('SFGG kan ikke beregnes: KL-lønaftaler-segmentets interne regulering matcher ikke den regulerede løn');
  }
};

const resolveAdjustedRate = (
  iso: ISODateString,
  baseRateOre: MoneyOre,
  source: Readonly<{ kind: SfggSourceKind }>,
  loenudvikling: PerEmploymentLoenudvikling
): Readonly<{ satsOre: MoneyOre; reguleringsindeks: number | null }> => {
  if (!sfggKildeUsesReferenceperiode(source.kind)) {
    return { satsOre: baseRateOre, reguleringsindeks: null };
  }
  const segment = resolveLoenudviklingSegment(iso, loenudvikling);
  if (!segment) {
    return { satsOre: baseRateOre, reguleringsindeks: null };
  }
  assertKlSegmentDeltaMatchesReguleretLoen(segment);
  // I referenceperiode-sporet skal SFGG følge samme procentuelle udvikling
  // og samme reguleringsdatoer som lønnen.
  return {
    satsOre: fromKroner(roundKroner((baseRateOre / 100) * (1 + segment.deltaPct / 100))),
    reguleringsindeks: roundByMethod(100 + segment.deltaPct, 2, 'halfAwayFromZero'),
  };
};

const resolveSfggOverenskomstBoundaryStarts = (
  employment: LoenindkomstAnsaettelsesforhold,
  fra: ISODateString,
  til: ISODateString
): readonly ISODateString[] => {
  const overenskomstId = employment.overenskomstId?.trim();
  if (!overenskomstId) return [];

  const fraDa = isoToDanish(fra);
  const tilDa = isoToDanish(til);
  if (!fraDa || !tilDa) return [];

  const applyShRegel = employment.loenPaaHelligdage === 'Almindelig løn';
  const offentligType = getOffentligOverenskomstTypeById(overenskomstId);
  const periodSatser = offentligType
    ? getOffentligTillaegsSatserForPeriode(overenskomstId, fraDa, tilDa, applyShRegel)
    : (() => {
      const ref = resolveOverenskomstRef(overenskomstId);
      if (!ref) return [];
      return getEffektiveSatserForPeriode({
        overenskomstId: ref.baseId,
        fraDato: fraDa,
        tilDato: tilDa,
        applyAlmindeligLoenPaaShDageRegel: applyShRegel,
      });
    })();

  return periodSatser
    .map((sats) => danishToISO(sats.fraDato))
    .filter((start): start is ISODateString => start !== undefined)
    .filter((start) => start >= fra && start <= til);
};

const resolveSfggSegmentBoundaryStarts = (args: Readonly<{
  ranges: readonly IsoRange[];
  employment: LoenindkomstAnsaettelsesforhold;
  sfggSource: Readonly<{ kind: SfggSourceKind }>;
  loenudvikling: PerEmploymentLoenudvikling;
}>): readonly ISODateString[] => {
  const starts = new Set<ISODateString>();

  for (const range of args.ranges) {
    resolveSfggOverenskomstBoundaryStarts(args.employment, range.fra, range.til)
      .forEach((start) => starts.add(start));
  }

  if (sfggKildeUsesReferenceperiode(args.sfggSource.kind)) {
    args.loenudvikling?.beregnedeSegmenter.forEach((segment) => {
      starts.add(segment.fra);
    });
  }

  return [...starts].sort();
};

const buildEligibleDatesForSfggRange = (args: Readonly<{
  range: IsoRange;
  sfggDayBasis: SfggDayBasis;
  ferieperioder: ErstatningsopgoerelseValues['ferieperioder'];
}>): readonly ISODateString[] => {
  if (args.sfggDayBasis === 'kalenderdage') {
    const start = parseISODate(args.range.fra);
    const end = parseISODate(args.range.til);
    if (!start || !end || start > end) return [];
    return sortIsoDates(buildDatoSetInclusiveFromDates(start, end));
  }

  return sortIsoDates(buildLoenArbejdsdageSet(args.range, args.ferieperioder ?? []));
};

const getValidFerieRanges = (
  ferieperioder: ErstatningsopgoerelseValues['ferieperioder']
): IsoRange[] =>
  (ferieperioder ?? [])
    .filter((row): row is (typeof row & { fra: ISODateString; til: ISODateString }) => Boolean(row.fra && row.til))
    .map((row) => ({ fra: row.fra, til: row.til }))
    .filter((range) => range.fra <= range.til);

/**
 * Struktureret afkortning af SFGG-perioden, som den faktisk blev anvendt af {@link buildSfggPeriode}.
 * Dette er den ene sandhed for "hvad klippede perioden og hvorfor"; læse-siden formatterer den —
 * den genudleder den ikke. `cap4mdr`/`ansaettelsesophoer` bærer en dato; `foersteSygedag`/`sygeloen`
 * er datoløse (deres visningstekst er fast).
 */
export type SfggPeriodeAfkortning =
  | Readonly<{ aarsag: 'foersteSygedag' }>
  | Readonly<{ aarsag: 'cap4mdr'; dato: ISODateString }>
  | Readonly<{ aarsag: 'ansaettelsesophoer'; dato: ISODateString }>
  | Readonly<{ aarsag: 'sygeloen' }>;

export type SfggPeriodeComputation = Readonly<{
  /** Perioden der vises i bilaget (efter første-dag/loft/ophør/sygeløn, før ferie-fradrag). */
  visningsperiode: readonly IsoRange[];
  /** De optjeningsberettigede dage: visningsperioden minus ferie. */
  eligibleRanges: readonly IsoRange[];
  /** Alle afkortninger der faktisk ramte perioden, i anvendt rækkefølge. */
  afkortninger: readonly SfggPeriodeAfkortning[];
}>;

/**
 * Bygger SFGG-perioden ved én fast, betydningsbærende sekvens af range-operationer. Rækkefølgen
 * bærer domæneregler og må ikke ombyttes:
 *  1. Første sygedag i hele forløbet udgår (skader fra 1.1.2015) — G3.
 *  2. 4-måneders-loftet (skader før 1.1.2015) klipper perioden — G3.
 *  3. Ansættelsesophør klipper perioden — G5. Loft og ophør er gensidigt udelukkende i
 *     afkortnings-listen: er loftet nået før eller samtidig med ophør, angives kun loftet.
 *  4. Arbejdsgiverbetalt sygeløn fratrækkes kravet (men indgår stadig i loftet, jf. at loftet
 *     allerede er beregnet på hele forløbet) — G4.
 *  5. Ferie fratrækkes til sidst; resultatet er de optjeningsberettigede dage.
 *
 * Loft/ophør-clip'ene anvendes altid begge (rækkefølge 2-3), uafhængigt af hvilken der angives i
 * afkortnings-listen — det er den viste årsag, ikke selve klipningen, der er gensidigt udelukkende.
 */
export const buildSfggPeriode = (args: Readonly<{
  tafRanges: readonly IsoRange[];
  firstExcludedDate: ISODateString | null;
  employmentHadFirstExcludedDate: boolean;
  capReachedDate: ISODateString | null;
  ansaettelsesophorDate: ISODateString | null;
  foerstEfterSygeloen: boolean;
  employment: LoenindkomstAnsaettelsesforhold;
  ferieperioder: ErstatningsopgoerelseValues['ferieperioder'];
}>): SfggPeriodeComputation => {
  const afkortninger: SfggPeriodeAfkortning[] = [];
  let ranges: readonly IsoRange[] = [...args.tafRanges];

  if (args.firstExcludedDate && args.employmentHadFirstExcludedDate) {
    ranges = subtractIsoDateRanges(ranges, [buildSingleDateRange(args.firstExcludedDate)]);
    afkortninger.push({ aarsag: 'foersteSygedag' });
  }

  ranges = clipRangesToInclusiveUpperBound(ranges, args.capReachedDate);
  ranges = clipRangesToInclusiveUpperBound(ranges, args.ansaettelsesophorDate);

  if (args.capReachedDate && (!args.ansaettelsesophorDate || args.capReachedDate <= args.ansaettelsesophorDate)) {
    afkortninger.push({ aarsag: 'cap4mdr', dato: args.capReachedDate });
  } else if (args.ansaettelsesophorDate) {
    afkortninger.push({ aarsag: 'ansaettelsesophoer', dato: args.ansaettelsesophorDate });
  }

  if (args.foerstEfterSygeloen) {
    const excludedRanges = buildIncomeExcludedRanges(args.employment);
    const overlaps = excludedRanges.some((excludedRange) =>
      ranges.some((range) => rangesOverlap(range, excludedRange))
    );
    ranges = subtractIsoDateRanges(ranges, excludedRanges);
    if (overlaps) afkortninger.push({ aarsag: 'sygeloen' });
  }

  const visningsperiode = ranges;
  const ferieRanges = mergeIsoDateRanges(getValidFerieRanges(args.ferieperioder), { mergeAdjacent: true });
  const eligibleRanges = subtractIsoDateRanges(visningsperiode, ferieRanges);

  return { visningsperiode, eligibleRanges, afkortninger };
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

  if (getSfggKildeSpec(sfggSource.kind).rateModel === 'per_periode_overenskomst') {
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
  const skadedato = stamdata.skadedato;
  const tafDateSetIncludingFirstExcluded = buildDateSetFromRanges(tafRanges);
  const firstExcludedDate =
    skadedato !== undefined && skadedato >= '2015-01-01' && erDetteFoersteErstatningsopgoerelse(values.eoNummer)
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
  const capReachedDate =
    skadedato !== undefined && skadedato < '2015-01-01'
      ? resolveSfggCapCutoffDate(
        tafBeregningsenhed === TAF_BEREGNES_SOM.MAANEDER
          ? sortIsoDates(tafDateSetIncludingFirstExcluded)
          : sortIsoDates(tafArbejdsdageSetIncludingFirstExcluded),
        tafBeregningsenhed
      )
      : null;

  const boundsDates = sortIsoDates(tafDateSet);
  if (boundsDates.length === 0) return { ...EMPTY_RESULT, firstExcludedDate };
  const totalPerEmployment: SygeferiegodtgoerelseAnsaettelsesforholdResult[] = [];
  const totalPerYear = new Map<number, MoneyOre>();

  // Feriepenge modtaget i perioden skal medregne indkomst fra samtlige arbejdsgivere, ikke kun
  // dem skadelidte var ansat hos på stamdatadatoen. Alle kalkulatorer bygges forud for løkken.
  const alleAnsaettelserKalkulatorer = (values.loenindkomstAnsaettelsesforhold ?? []).map(
    (emp) => buildEmploymentSfggCalculator(emp, values.ferieperioder ?? [])
  );
  const buildAlleFeriepengeOreForDates = (dates: readonly ISODateString[]): MoneyOre =>
    sumMoneyOre(alleAnsaettelserKalkulatorer.map((kalk) => kalk.buildFeriepengeOreForDates(dates)));

  for (const employment of (values.loenindkomstAnsaettelsesforhold ?? []).filter((entry) => entry.ansatPaaSkadestidspunktet)) {
    const employmentCalculator = buildEmploymentSfggCalculator(employment, values.ferieperioder ?? []);
    const sfggRow = getSfggRowForEmployment(values, employment.id);
    const sfggSource = resolveSfggSource(sfggRow, employment);
    if (sfggSource.kind === 'ingen') continue;

    const sfggDayBasis = resolveSfggDayBasis(sfggSource, tafBeregningsenhed);
    const ansaettelsesophorDate =
      employment.ansaettelsesforholdOphoert && employment.sidsteArbejdsdag
        ? employment.sidsteArbejdsdag
        : null;
    const employmentHadFirstExcludedDate =
      firstExcludedDate !== null
      && (
        sfggDayBasis === 'kalenderdage'
          ? tafDateSetIncludingFirstExcluded.has(firstExcludedDate)
          : tafArbejdsdageSetIncludingFirstExcluded.has(firstExcludedDate)
      );

    const overenskomstPolicy = employment.overenskomstId ? getOverenskomstSfggPolicy(employment.overenskomstId) : undefined;
    const manualFoerstEfterSygeloen = sfggSource.kind === 'manuel' && sfggRow?.sfggManuelFoerstEfterSygeloen === 'Ja';
    const foerstEfterSygeloen = resolveSfggFoerstEfterSygeloen({
      sfggSourceKind: sfggSource.kind,
      manualFoerstEfterSygeloen,
      overenskomstBortfalderUnderArbejdsgiverbetaltSygeloen:
        overenskomstPolicy?.bortfalderUnderArbejdsgiverbetaltSygeloen === true,
    });

    // Perioden bygges af én navngiven pipeline med fast, betydningsbærende rækkefølge (G3-G5);
    // se buildSfggPeriode. Læse-siden formatterer de strukturerede afkortninger — den genudleder dem ikke.
    const periode = buildSfggPeriode({
      tafRanges,
      firstExcludedDate,
      employmentHadFirstExcludedDate,
      capReachedDate,
      ansaettelsesophorDate,
      foerstEfterSygeloen,
      employment,
      ferieperioder: values.ferieperioder ?? [],
    });
    const sfggVisningsperiode = periode.visningsperiode;
    const eligibleRanges = periode.eligibleRanges;
    const segmentableRanges = eligibleRanges;
    const afterEmployerSickPayExcludedAny = periode.afkortninger.some((afkortning) => afkortning.aarsag === 'sygeloen');
    // Præsentations-afkortningerne (kun loft/ophør bæres med verbum + dato i bilaget) udledes af
    // pipelinens strukturerede liste — der er højst én, jf. gensidig udelukkelse i buildSfggPeriode.
    const sfggAfkortninger: SfggAfkortning[] = periode.afkortninger.flatMap((afkortning) =>
      afkortning.aarsag === 'cap4mdr' || afkortning.aarsag === 'ansaettelsesophoer'
        ? [{
          aarsag: afkortning.aarsag,
          verbum: resolveSfggOphoerVerb(afkortning.dato, opgoerelsesdato),
          dato: afkortning.dato,
        }]
        : []
    );

    const sfggIntroText = buildSfggIntroText(sfggRow, employment, sfggSource);
    const sfggReferenceperiodeAuthorityText = resolveSfggReferenceperiodeAuthorityText(sfggSource.kind);
    const sfggReferenceperiodeLabel = resolveSfggReferenceperiodeLabel(employment);
    const sfggDirectRateLabel = getSfggKildeSpec(sfggSource.kind).rateModel === 'per_periode_overenskomst'
      ? resolveSfggDifferentieretSatsLabel(sfggRow?.sfggSatsvalg)
      : null;
    // Afledt af pipelinens strukturerede afkortninger — samme mønster som sygeløn (sygeloen) og
    // loft/ophør (cap4mdr/ansaettelsesophoer): læse-siden formatterer det, motoren genudleder det ikke.
    // (foersteSygedag pushes præcis når employmentHadFirstExcludedDate er sand, jf. buildSfggPeriode.)
    const sfggFirstTafDayExcludedText = periode.afkortninger.some((afkortning) => afkortning.aarsag === 'foersteSygedag')
      ? SFGG_FIRST_TAF_DAY_EXCLUDED_TEXT
      : null;
    const sfggAfterEmployerSickPayProjection = resolveSfggAfterEmployerSickPayProjection({
      excludedAny: afterEmployerSickPayExcludedAny,
      sfggSourceKind: sfggSource.kind,
      manualFoerstEfterSygeloen,
      overenskomstPolicy,
    });
    const sfggAfterEmployerSickPayText = sfggAfterEmployerSickPayProjection.text;

    // Note til beregningsdokumentet: når SFGG beregnes som en procentdel af lønnen
    // (ferielov-/overenskomst-efter-ferielov-sporet), og brugeren har indtastet en
    // feriepengesats for lønindkomsten, der afviger fra de lovbestemte 12,5 %, oplyses
    // det udtrykkeligt, at SFGG uanset den indtastede sats beregnes med 12,5 %.
    const sfggBeregnesSomProcentAfLoen = sfggKildeUsesReferenceperiode(sfggSource.kind);
    const harAfvigendeFeriepengesats =
      employment.feriePct !== undefined
      && Math.abs(employment.feriePct - SFGG_LOVBESTEMT_FERIEPENGE_PCT) > 1e-9;
    const sfggLovbestemtFeriepengeNote =
      sfggBeregnesSomProcentAfLoen && harAfvigendeFeriepengesats
        ? buildSfggLovbestemtFeriepengeNote()
        : null;

    const hasEligibleDays = eligibleRanges.some((range) => {
      if (sfggDayBasis === 'kalenderdage') {
        const start = parseISODate(range.fra);
        const end = parseISODate(range.til);
        return Boolean(start && end && start <= end && (countInclusiveUtcDays(start, end) ?? 0) > 0);
      }
      return (optaelArbejdsdage({
        fra: range.fra,
        til: range.til,
        ferieperioder: values.ferieperioder ?? [],
        loseFeriedage: 0,
        context: { kind: 'taf' },
      }) ?? 0) > 0;
    });

    if (!hasEligibleDays) {
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
        sfggLovbestemtFeriepengeNote,
        foerstEfterSygeloen,
        sfggAfkortninger,
        segments: [],
        perYear: [],
        feriepengekravTotalOre: zeroMoneyOre(),
        totalOre: zeroMoneyOre(),
        alleredeBetaltOre: zeroMoneyOre(),
        sfggVisningsperiode,
        sfggReferenceperiode: null,
        sfggReferencesats: notCalculableSfggReferencesats(
          sfggDayBasis === 'kalenderdage' ? 'no_calendar_days' : 'no_workdays'
        ),
        sfggReferencesatsFormula: null,
        feriepengeModtagetFormula: null,
        capReachedDate,
      });
      continue;
    }

    const sfggBaseRate = resolveSfggBaseRate(values, employment, sfggRow, sfggSource, employmentCalculator);
    const segmentationBaseRanges = segmentableRanges;
    const groupedWithEligibleDays = splitRangesAtBoundaryStarts(
      segmentationBaseRanges,
      resolveSfggSegmentBoundaryStarts({
        ranges: segmentationBaseRanges,
        employment,
        sfggSource,
        loenudvikling: args.loenudviklingPerAnsaettelse?.get(employment.id),
      })
    ).flatMap((range) => {
      const rate = resolveSfggSegmentRateForDate({
        iso: range.fra,
        employment,
        sfggRow,
        sfggSource,
        sfggBaseRate,
        loenudvikling: args.loenudviklingPerAnsaettelse?.get(employment.id),
      });
      if (rate === null) return [];

      const dates = buildEligibleDatesForSfggRange({
        range,
        sfggDayBasis,
        ferieperioder: values.ferieperioder ?? [],
      });
      if (dates.length === 0) return [];

      return [{
        ...range,
        reguleringsindeks: rate.reguleringsindeks,
        satsOre: rate.satsOre,
        agPensionPct: rate.agPensionPct,
        dates,
      }];
    });

    const loenPlusLoen2PlusIkkePensLoenBySegment = new Map<string, number>();
    const feriepengeBySegment = new Map<string, MoneyOre>();
    groupedWithEligibleDays.forEach((group, index) => {
      const loenPlusLoen2PlusIkkePensLoenKroner = sumLoenPlusLoen2PlusIkkePensLoenForEligibleDatesKroner(
        employment,
        group.dates,
        values.ferieperioder ?? [],
        employmentCalculator
      );
      loenPlusLoen2PlusIkkePensLoenBySegment.set(`${group.fra}:${index}`, loenPlusLoen2PlusIkkePensLoenKroner);
      feriepengeBySegment.set(
        `${group.fra}:${index}`,
        buildAlleFeriepengeOreForDates(group.dates)
      );
    });

    const alreadyPaidOre = fromKroner(
      roundKroner(amountValueToNumber(sfggRow?.sfggAlleredeBetaltBeloeb) ?? 0)
    );
    const grossWeights = groupedWithEligibleDays.map((group, index) => ({
      key: `${group.fra}:${index}`,
      weight: buildSfggGrossOre(group.satsOre, group.agPensionPct, group.dates.length),
    }));
    const allocatedAlreadyPaid = allocateOreByWeights(alreadyPaidOre, grossWeights);
    const employmentPerYear = new Map<number, MoneyOre>();

    const segments: SygeferiegodtgoerelseSegment[] = groupedWithEligibleDays.map((group, index) => {
      const key = `${group.fra}:${index}`;
      const grossOre = buildSfggGrossOre(group.satsOre, group.agPensionPct, group.dates.length);
      const loenPlusLoen2PlusIkkePensLoenKroner = loenPlusLoen2PlusIkkePensLoenBySegment.get(key) ?? 0;
      const feriepengeOreAlle = feriepengeBySegment.get(key) ?? zeroMoneyOre();
      const alreadyPaidSegmentOre = allocatedAlreadyPaid.get(key) ?? zeroMoneyOre();
      // feriepengeAfSygeloenOre vises som "Feriepenge modtaget i perioden" og indgår i ligningen:
      // gross - feriepengeAfSygeloen - alleredeBetalt = beregnetSfggoere
      // Fradraget kan ikke overstige gross (minus allerede betalt) — cap sikrer at
      // sum(feriepengeAfSygeloenOre) + sum(beregnetSfggoereOre) = sum(grossOre) holder præcist.
      const availableAfterAlreadyPaidOre = clampMoneyOreToZero(
        subtractMoneyOre(grossOre, alreadyPaidSegmentOre)
      );
      const feriepengeOre = feriepengeOreAlle < availableAfterAlreadyPaidOre
        ? feriepengeOreAlle
        : availableAfterAlreadyPaidOre;
      const segmentTotalOre = clampMoneyOreToZero(subtractMoneyOre(
        subtractMoneyOre(grossOre, feriepengeOre),
        alreadyPaidSegmentOre
      ));

      const yearDates = new Map<number, ISODateString[]>();
      group.dates.forEach((iso) => {
        const year = Number.parseInt(iso.slice(0, 4), 10);
        const dates = yearDates.get(year) ?? [];
        dates.push(iso);
        yearDates.set(year, dates);
      });
      const alleAnsaettelserFeriepengeOreByYear = alleAnsaettelserKalkulatorer.reduce(
        (acc, kalk) => {
          const byYear = kalk.buildFeriepengeOreByYear(group.dates);
          byYear.forEach((ore, year) => {
            acc.set(year, addMoneyOre(acc.get(year) ?? zeroMoneyOre(), ore));
          });
          return acc;
        },
        new Map<number, MoneyOre>()
      );
      const yearAllocations = buildYearAllocationsForGroupedSegment({
        yearDates,
        satsOre: group.satsOre,
        agPensionPct: group.agPensionPct,
        alreadyPaidSegmentOre,
        segmentTotalOre,
        feriepengeOreByYear: alleAnsaettelserFeriepengeOreByYear,
      });
      yearAllocations.forEach((amountOre, year) => {
        totalPerYear.set(year, addMoneyOre(totalPerYear.get(year) ?? zeroMoneyOre(), amountOre));
        employmentPerYear.set(
          year,
          addMoneyOre(employmentPerYear.get(year) ?? zeroMoneyOre(), amountOre)
        );
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
        loenPlusLoen2PlusIkkePensLoenKroner,
        feriepengeAfSygeloenOre: feriepengeOre,
        alleredeBetaltOre: alreadyPaidSegmentOre,
      };
    });

    const feriepengeModtagetOre = sumMoneyOre(
      segments.map((segment) => segment.feriepengeAfSygeloenOre)
    );
    const feriepengeModtagetFormula = feriepengeModtagetOre > 0 || segments.some((segment) => segment.loenPlusLoen2PlusIkkePensLoenKroner > 0)
      ? { totalOre: feriepengeModtagetOre }
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
      sfggLovbestemtFeriepengeNote,
      foerstEfterSygeloen,
      sfggAfkortninger,
      segments,
      perYear: [...employmentPerYear.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([year, amountOre]) => ({ year, amountOre })),
      feriepengekravTotalOre: sumMoneyOre(segments.map((segment) => segment.feriepengekravOre)),
      totalOre: sumMoneyOre(segments.map((segment) => segment.beregnetSfggoereOre)),
      alleredeBetaltOre: alreadyPaidOre,
      sfggVisningsperiode,
      sfggReferenceperiode: sfggBaseRate.sfggReferenceperiode,
      sfggReferencesats: sfggBaseRate.sfggReferencesatsOre,
      sfggReferencesatsFormula: sfggBaseRate.sfggReferencesatsFormula,
      feriepengeModtagetFormula,
      capReachedDate,
    });
  }

  return {
    totalOre: sumMoneyOre(totalPerEmployment.map((entry) => entry.totalOre)),
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
