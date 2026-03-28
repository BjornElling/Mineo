import type {
  ErstatningsopgoerelseValues,
  LoenindkomstAnsaettelsesforhold,
  StamdataValues,
  StandardLoenTableRow,
  SygeferiegodtgoerelseAnsaettelsesforholdRow,
} from '../../schemas/formSchemas';
import { amountValueToNumber } from '../../utils/expressionAmount';
import { addDays, addMonths } from '../../utils/dateUtils';
import { parsePercentToDecimal } from '../../utils/numberParsing';
import { roundByMethod } from '../../utils/rounding';
import { calculateStandardLoenRowDerived } from '../aarsloen/standardLoenRowCalculations';
import { parseAarsloenRowInterval } from './indtaegtPerioder';
import { buildLoenArbejdsdageSet, optaelArbejdsdageBreakdown } from './periodiseringsMotor';
import { buildDatoSetInclusiveFromDates, isWeekdayUtc } from './tafDaySets';
import { computeTafBeregningsenhed, TAF_BEREGNES_SOM, type TafBeregningsenhed } from './tafBeregningsenhed';
import type { IsoRange } from './tafPeriodConstraints';
import { dateToISO, parseISODate, subtractOneDay, type ISODateString } from '../../types/branded';
import { isoToDanish, toDanishDateString } from '../../types/branded';
import { clampMoneyOreToZero, ensureMoneyOre, roundKroner, toOre } from './eoPdfMoneyUtils';
import type { Calculable, LoenudviklingSegment, MoneyOre } from './eoPdfModelTypes';
import { getEffektiveSatserForDato, getOffentligOverenskomstTypeById, getOverenskomstSfggPolicy } from '../../data/overenskomstRates';
import { erDetteFoersteErstatningsopgoerelse } from './eoNummerValidering';

const asCalculable = <T>(value: T): Calculable<T> => ({ status: 'ok', value });
const notCalculable = <T>(reason: string): Calculable<T> => ({ status: 'not_calculable', reason });

type SfgSourceType = 'ingen' | 'manuel' | 'ferielov' | 'overenskomst_direkte' | 'overenskomst_ferielov';
export type SfggSource = Readonly<{ kind: SfgSourceType; label: string }>;


export type SygeferiegodtgoerelseSegment = Readonly<{
  ansaettelsesforholdId: string;
  ansaettelsesforholdNavn: string;
  fra: ISODateString;
  til: ISODateString;
  reguleringsindeks: number | null;
  satsOre: MoneyOre;
  antalDage: number;
  feriepengekravOre: MoneyOre;
  beregnetSfggoereOre: MoneyOre;
  feriepengeAfSygeloenOre: MoneyOre;
  alleredeBetaltOre: MoneyOre;
  pensionOre: MoneyOre;
}>;

export type SygeferiegodtgoerelseCapRow = Readonly<{
  fra: ISODateString;
  til: ISODateString;
  antalDage: number;
  maanederPraecis: number;
}>;

export type SygeferiegodtgoerelseAnsaettelsesforholdResult = Readonly<{
  ansaettelsesforholdId: string;
  ansaettelsesforholdNavn: string;
  sourceLabel: string;
  segments: readonly SygeferiegodtgoerelseSegment[];
  feriepengekravTotalOre: MoneyOre;
  totalOre: MoneyOre;
  alleredeBetaltOre: MoneyOre;
  referenceperiode: Readonly<{ fra: ISODateString; til: ISODateString }> | null;
  referenceSats: Calculable<MoneyOre>;
  referenceSatsFormula: Readonly<{
    ferieberettigetLoenKroner: number;
    feriePctDecimal: number;
    feriepengeKroner: number;
    divisorDage: number;
    divisorLabel: 'hverdage' | 'arbejdsdage';
    hverdage: number;
    shDage: number;
    feriedage: number;
    oevrigeFravaersdage: number;
  }> | null;
  explanatoryLines: readonly string[];
  capRows: readonly SygeferiegodtgoerelseCapRow[];
  capReachedDate: ISODateString | null;
}>;

export type SygeferiegodtgoerelseResult = Readonly<{
  totalOre: MoneyOre;
  perAnsaettelsesforhold: readonly SygeferiegodtgoerelseAnsaettelsesforholdResult[];
  firstExcludedDate: ISODateString | null;
}>;

export const EMPTY_RESULT: SygeferiegodtgoerelseResult = {
  totalOre: ensureMoneyOre(0),
  perAnsaettelsesforhold: [],
  firstExcludedDate: null,
};

const sortIsoDates = (values: Iterable<ISODateString>): ISODateString[] =>
  Array.from(values).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

export const resolveSfggReferenceperiodeDayCount = (
  values: ErstatningsopgoerelseValues,
  row: Pick<
    SygeferiegodtgoerelseAnsaettelsesforholdRow,
    'referenceperiodeFra' | 'referenceperiodeTil' | 'referenceperiodeFravaersdageUdenLoen'
  > | undefined
): Readonly<{
  divisorDage: number;
  divisorLabel: 'hverdage' | 'arbejdsdage';
  hverdage: number;
  shDage: number;
  feriedage: number;
  oevrigeFravaersdage: number;
}> | null => {
  if (!row?.referenceperiodeFra || !row.referenceperiodeTil || row.referenceperiodeFra > row.referenceperiodeTil) {
    return null;
  }

  const breakdown = optaelArbejdsdageBreakdown({
    fra: row.referenceperiodeFra,
    til: row.referenceperiodeTil,
    ferieperioder: values.ferieperioder ?? [],
    loseFeriedage: 0,
    context: {
      kind: 'beregningsgrundlag',
      oevrigeFravaersdage: row.referenceperiodeFravaersdageUdenLoen ?? 0,
    },
  });
  if (!breakdown) return null;

  const tafBeregnesSom = computeTafBeregningsenhed(values);
  const divisorDage = tafBeregnesSom === TAF_BEREGNES_SOM.MAANEDER
    ? Math.max(0, breakdown.arbejdsdage - breakdown.oevrigeFravaersdage)
    : Math.max(0, breakdown.tafDage);

  return {
    divisorDage,
    divisorLabel: tafBeregnesSom === TAF_BEREGNES_SOM.MAANEDER ? 'hverdage' : 'arbejdsdage',
    hverdage: breakdown.arbejdsdage,
    shDage: breakdown.shDage,
    feriedage: breakdown.feriedage,
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

const FOUR_MONTHS_EPSILON = 1e-9;

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

const dateInMonthFraction = (iso: ISODateString, mode: TafBeregningsenhed): number => {
  const date = parseISODate(iso);
  if (!date) return 0;
  if (mode === TAF_BEREGNES_SOM.MAANEDER) {
    const daysInMonth = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
    return daysInMonth > 0 ? 1 / daysInMonth : 0;
  }
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  let weekdaysInMonth = 0;
  for (let day = 1; day <= lastDay; day += 1) {
    const monthDate = new Date(Date.UTC(year, month, day));
    if (isWeekdayUtc(monthDate)) weekdaysInMonth += 1;
  }
  return weekdaysInMonth > 0 ? 1 / weekdaysInMonth : 0;
};

const buildCapComputation = (
  sourceRanges: readonly IsoRange[],
  mode: TafBeregningsenhed
): Readonly<{ cutoffDate: ISODateString | null; rows: readonly SygeferiegodtgoerelseCapRow[] }> => {
  const dateSet = buildDateSetFromRanges(sourceRanges);
  const dates = sortIsoDates(dateSet).filter((iso) => {
    if (mode === TAF_BEREGNES_SOM.MAANEDER) return true;
    const date = parseISODate(iso);
    return Boolean(date && isWeekdayUtc(date));
  });
  if (dates.length === 0) {
    return { cutoffDate: null, rows: [] };
  }

  let totalMonths = 0;
  let cutoffDate: ISODateString | null = null;
  const rows: SygeferiegodtgoerelseCapRow[] = [];

  for (const range of buildRangesFromSortedDates(dates)) {
    const rangeDates = dates.filter((iso) => iso >= range.fra && iso <= range.til);
    const monthsPrecise = rangeDates.reduce((sum, iso) => sum + dateInMonthFraction(iso, mode), 0);
    totalMonths += monthsPrecise;
    rows.push({
      fra: range.fra,
      til: range.til,
      antalDage: rangeDates.length,
      maanederPraecis: monthsPrecise,
    });
  }

  totalMonths = 0;
  for (const iso of dates) {
    totalMonths += dateInMonthFraction(iso, mode);
    if (totalMonths + FOUR_MONTHS_EPSILON >= 4) {
      cutoffDate = iso;
      break;
    }
  }

  return { cutoffDate, rows };
};

const getSfgRowForEmployment = (
  values: ErstatningsopgoerelseValues,
  ansaettelsesforholdId: string
): SygeferiegodtgoerelseAnsaettelsesforholdRow | undefined =>
  values.sfggAnsaettelsesforhold.find((row) => row.ansaettelsesforholdId === ansaettelsesforholdId);

export const hasSfggSelectedOverenskomst = (
  sfggRow: Pick<SygeferiegodtgoerelseAnsaettelsesforholdRow, 'beregnesUdFra'> | undefined,
  employment: Pick<LoenindkomstAnsaettelsesforhold, 'harOverenskomst' | 'overenskomstId'>
): boolean =>
  Boolean(
    sfggRow?.beregnesUdFra === 'Overenskomst'
    && employment.harOverenskomst
    && employment.overenskomstId?.trim()
  );

export const resolveSfggSource = (
  sfggRow: SygeferiegodtgoerelseAnsaettelsesforholdRow | undefined,
  employment: LoenindkomstAnsaettelsesforhold
): SfggSource => {
  const selected = sfggRow?.beregnesUdFra ?? 'Ingen';
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
    const overlapArbejdsdage = Array.from(rowArbejdsdageSet).filter((iso) =>
      ranges.some((range) => iso >= range.fra && iso <= range.til)
    ).length;
    if (totalArbejdsdage > 0 && overlapArbejdsdage > 0) {
      sum += derived.ferieberet * (overlapArbejdsdage / totalArbejdsdage);
    }
  }
  return sum;
};

const resolveOverenskomstDagssatsOre = (
  employment: LoenindkomstAnsaettelsesforhold,
  iso: ISODateString,
  satsvalg: SygeferiegodtgoerelseAnsaettelsesforholdRow['satsvalg']
): MoneyOre | null => {
  if (!employment.overenskomstId || getOffentligOverenskomstTypeById(employment.overenskomstId)) return null;
  const date = parseISODate(iso);
  if (!date) return null;
  const satser = getEffektiveSatserForDato({
    overenskomstId: employment.overenskomstId as never,
    dato: toDanishDateString(
      `${String(date.getUTCDate()).padStart(2, '0')}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${date.getUTCFullYear()}`
    ),
    applyAlmindeligLoenPaaShDageRegel: employment.loenPaaHelligdage === 'Almindelig løn',
  });
  if (!satser) return null;
  const sfggPolicy = getOverenskomstSfggPolicy(employment.overenskomstId);
  // Ved skift fra en differentieret SFGG-overenskomst til en ikke-differentieret
  // kan et gammelt satsvalg lovligt blive hængende i formstate. Det må ikke gøre
  // en standard direkte SFGG-sats uberegnelig; i det spor er kun den samlede sfgg relevant.
  const value = sfggPolicy?.direkteSatsErDifferentieret
    ? satsvalg === 'Faglaert-Koebenhavn'
      ? satser.sfggFaglKbh
      : satsvalg === 'Faglaert-Provinsen'
        ? satser.sfggFaglProv
        : satsvalg === 'Ufaglaert-Koebenhavn'
          ? satser.sfggUfaglKbh
          : satsvalg === 'Ufaglaert-Provinsen'
            ? satser.sfggUfaglProv
            : satser.sfgg
    : satser.sfgg;
  return typeof value === 'number' && Number.isFinite(value)
    ? toOre(roundKroner(value))
    : null;
};

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

const resolveBaseRate = (
  values: ErstatningsopgoerelseValues,
  employment: LoenindkomstAnsaettelsesforhold,
  sfggRow: SygeferiegodtgoerelseAnsaettelsesforholdRow | undefined,
  source: Readonly<{ kind: SfgSourceType }>
): Readonly<{
  referenceperiode: { fra: ISODateString; til: ISODateString } | null;
  satsOre: Calculable<MoneyOre>;
  formula: Readonly<{
    ferieberettigetLoenKroner: number;
    feriePctDecimal: number;
    feriepengeKroner: number;
    divisorDage: number;
    divisorLabel: 'hverdage' | 'arbejdsdage';
    hverdage: number;
    shDage: number;
    feriedage: number;
    oevrigeFravaersdage: number;
  }> | null;
}> => {
  if (source.kind === 'manuel') {
    const manual = amountValueToNumber(sfggRow?.manuelDagssats);
    return {
      referenceperiode: null,
      satsOre: manual !== undefined ? asCalculable(toOre(roundKroner(manual))) : notCalculable('Dagssats mangler'),
      formula: null,
    };
  }
  if (source.kind === 'overenskomst_direkte') {
    return {
      referenceperiode: null,
      satsOre: notCalculable('Direkte overenskomstsats beregnes pr. periode'),
      formula: null,
    };
  }
  if (!sfggRow?.referenceperiodeFra || !sfggRow.referenceperiodeTil || sfggRow.referenceperiodeFra > sfggRow.referenceperiodeTil) {
    return {
      referenceperiode: null,
      satsOre: notCalculable('Referenceperiode mangler'),
      formula: null,
    };
  }
  const referenceDayCount = resolveSfggReferenceperiodeDayCount(values, sfggRow);
  const arbejdsdage = referenceDayCount?.divisorDage ?? 0;
  const ferieberettigetLoenKroner = sumFerieberettigetLoenInRangesKroner(
    employment,
    [{ fra: sfggRow.referenceperiodeFra, til: sfggRow.referenceperiodeTil }],
    values.ferieperioder ?? []
  );
  const feriePctDecimal = parsePercentToDecimal(employment.feriePct);
  const feriepengeKroner = ferieberettigetLoenKroner * feriePctDecimal;
  if (arbejdsdage <= 0) {
    return {
      referenceperiode: { fra: sfggRow.referenceperiodeFra, til: sfggRow.referenceperiodeTil },
      satsOre: notCalculable('Referenceperioden indeholder ingen arbejdsdage'),
      formula: null,
    };
  }
  return {
    referenceperiode: { fra: sfggRow.referenceperiodeFra, til: sfggRow.referenceperiodeTil },
    satsOre: asCalculable(toOre(roundKroner(feriepengeKroner / arbejdsdage))),
    formula: {
      ferieberettigetLoenKroner,
      feriePctDecimal,
      feriepengeKroner,
      divisorDage: arbejdsdage,
      divisorLabel: referenceDayCount?.divisorLabel ?? 'arbejdsdage',
      hverdage: referenceDayCount?.hverdage ?? 0,
      shDage: referenceDayCount?.shDage ?? 0,
      feriedage: referenceDayCount?.feriedage ?? 0,
      oevrigeFravaersdage: referenceDayCount?.oevrigeFravaersdage ?? 0,
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
  source: Readonly<{ kind: SfgSourceType }>,
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

export const computeSygeferiegodtgoerelse = (args: Readonly<{
  values: ErstatningsopgoerelseValues;
  stamdata: StamdataValues;
  tafRanges: readonly IsoRange[];
  loenudviklingPerAnsaettelse?: ReadonlyMap<string, PerEmploymentLoenudvikling>;
}>): SygeferiegodtgoerelseResult => {
  const { values, stamdata, tafRanges } = args;
  if (tafRanges.length === 0) return EMPTY_RESULT;
  const skadesdato = stamdata.skadesdato;
  const firstExcludedDate =
    skadesdato !== undefined && skadesdato >= '2015-01-01' && erDetteFoersteErstatningsopgoerelse(values.eoNummer)
      ? sortIsoDates(buildDateSetFromRanges(tafRanges))[0] ?? null
      : null;
  const tafDateSet = buildDateSetFromRanges(tafRanges);
  if (firstExcludedDate) {
    tafDateSet.delete(firstExcludedDate);
  }

  const capMode = computeTafBeregningsenhed(values);
  const capComputation =
    skadesdato !== undefined && skadesdato < '2015-01-01'
      ? buildCapComputation(tafRanges, capMode)
      : { cutoffDate: null, rows: [] };

  const boundsDates = sortIsoDates(tafDateSet);
  if (boundsDates.length === 0) return { ...EMPTY_RESULT, firstExcludedDate };
  const bounds: IsoRange = { fra: boundsDates[0], til: boundsDates[boundsDates.length - 1] };
  const tafArbejdsdageSet = buildLoenArbejdsdageSet(bounds, values.ferieperioder ?? []);
  const totalPerEmployment: SygeferiegodtgoerelseAnsaettelsesforholdResult[] = [];

  for (const employment of values.loenindkomstAnsaettelsesforhold ?? []) {
    const sfggRow = getSfgRowForEmployment(values, employment.id);
    const source = resolveSfggSource(sfggRow, employment);
    if (source.kind === 'ingen') continue;

    const explanatoryLines: string[] = [];
    const dateSet = new Set<ISODateString>(tafDateSet);
    if (firstExcludedDate) {
      explanatoryLines.push('Den første TAF-dag er undtaget, fordi skaden er fra 1. januar 2015 eller senere, og dette er første erstatningsopgørelse.');
    }

    if (capComputation.cutoffDate) {
      for (const iso of [...dateSet]) {
        if (iso > capComputation.cutoffDate) {
          dateSet.delete(iso);
        }
      }
      explanatoryLines.push(`Retten til sygeferiegodtgørelse er tidsbegrænset til 4 måneder og bortfaldt den ${isoToDanish(capComputation.cutoffDate) ?? capComputation.cutoffDate}.`);
    }

    if (employment.ansaettelsesforholdOphoert && employment.sidsteArbejdsdag) {
      for (const iso of [...dateSet]) {
        if (iso > employment.sidsteArbejdsdag) {
          dateSet.delete(iso);
        }
      }
      explanatoryLines.push(`Retten til sygeferiegodtgørelse bortfaldt den ${isoToDanish(employment.sidsteArbejdsdag) ?? employment.sidsteArbejdsdag} som følge af ansættelsesforholdets ophør.`);
    }

    const overenskomstPolicy = employment.overenskomstId ? getOverenskomstSfggPolicy(employment.overenskomstId) : undefined;
    const foerstEfterSygeloen =
      (source.kind === 'manuel' && sfggRow?.manuelFoerstEfterSygeloen === 'Ja')
      || (source.kind !== 'manuel' && overenskomstPolicy?.bortfalderUnderArbejdsgiverbetaltSygeloen === true);

    if (foerstEfterSygeloen) {
      const excluded = buildIncomeExcludedDateSet(employment);
      let excludedAny = false;
      for (const iso of [...dateSet]) {
        if (excluded.has(iso)) {
          dateSet.delete(iso);
          excludedAny = true;
        }
      }
      if (excludedAny) {
        explanatoryLines.push('Der beregnes først sygeferiegodtgørelse efter ophør af arbejdsgiverbetalt sygeløn.');
      }
    }

    const eligibleWorkdays = sortIsoDates(dateSet).filter((iso) => tafArbejdsdageSet.has(iso));
    if (eligibleWorkdays.length === 0) {
      totalPerEmployment.push({
        ansaettelsesforholdId: employment.id,
        ansaettelsesforholdNavn: getEmploymentName(employment),
        sourceLabel: source.label,
        segments: [],
        feriepengekravTotalOre: ensureMoneyOre(0),
        totalOre: ensureMoneyOre(0),
        alleredeBetaltOre: ensureMoneyOre(0),
        referenceperiode: null,
        referenceSats: notCalculable('Ingen arbejdsdage i SFGG-perioden'),
        referenceSatsFormula: null,
        explanatoryLines,
        capRows: capComputation.rows,
        capReachedDate: capComputation.cutoffDate,
      });
      continue;
    }

    const baseRate = resolveBaseRate(values, employment, sfggRow, source);
    const grouped: Array<{
      fra: ISODateString;
      til: ISODateString;
      reguleringsindeks: number | null;
      satsOre: MoneyOre;
      dates: ISODateString[];
    }> = [];
    for (const iso of eligibleWorkdays) {
      let satsOre: MoneyOre | null = null;
      let reguleringsindeks: number | null = null;
      if (source.kind === 'overenskomst_direkte') {
        satsOre = resolveOverenskomstDagssatsOre(employment, iso, sfggRow?.satsvalg);
      } else if (baseRate.satsOre.status === 'ok') {
        const adjusted = resolveAdjustedRate(
          iso,
          baseRate.satsOre.value,
          source,
          args.loenudviklingPerAnsaettelse?.get(employment.id)
        );
        satsOre = adjusted.satsOre;
        reguleringsindeks = adjusted.reguleringsindeks;
      }
      if (satsOre === null) continue;
      const previous = grouped[grouped.length - 1];
      if (
        previous &&
        previous.satsOre === satsOre &&
        previous.reguleringsindeks === reguleringsindeks
      ) {
        previous.til = iso;
        previous.dates.push(iso);
      } else {
        grouped.push({ fra: iso, til: iso, reguleringsindeks, satsOre, dates: [iso] });
      }
    }

    const feriepengeBySegment = new Map<string, MoneyOre>();
    grouped.forEach((group, index) => {
      const ferieberettigetLoenKroner = sumFerieberettigetLoenInRangesKroner(
        employment,
        [{ fra: group.fra, til: group.til }],
        values.ferieperioder ?? []
      );
      const feriePctDecimal = parsePercentToDecimal(employment.feriePct);
      feriepengeBySegment.set(`${group.fra}:${index}`, toOre(roundKroner(ferieberettigetLoenKroner * feriePctDecimal)));
    });

    const alreadyPaidOre = ensureMoneyOre(toOre(roundKroner(amountValueToNumber(sfggRow?.alleredeBetaltBeloeb) ?? 0)));
    const grossWeights = grouped.map((group, index) => ({
      key: `${group.fra}:${index}`,
      weight: group.satsOre * group.dates.length,
    }));
    const allocatedAlreadyPaid = allocateOreByWeights(alreadyPaidOre, grossWeights);
    const pensionPct = parsePercentToDecimal(employment.pensionPct);

    const segments: SygeferiegodtgoerelseSegment[] = grouped.map((group, index) => {
      const key = `${group.fra}:${index}`;
      const grossOre = ensureMoneyOre(group.satsOre * group.dates.length);
      const feriepengeOre = feriepengeBySegment.get(key) ?? ensureMoneyOre(0);
      const alreadyPaidSegmentOre = allocatedAlreadyPaid.get(key) ?? ensureMoneyOre(0);
      const remainingOre = clampMoneyOreToZero(ensureMoneyOre(grossOre - feriepengeOre - alreadyPaidSegmentOre));
      const pensionOre = pensionPct > 0 ? toOre(roundKroner((remainingOre / 100) * pensionPct)) : ensureMoneyOre(0);
      return {
        ansaettelsesforholdId: employment.id,
        ansaettelsesforholdNavn: getEmploymentName(employment),
        fra: group.fra,
        til: group.til,
        reguleringsindeks: group.reguleringsindeks,
        satsOre: group.satsOre,
        antalDage: group.dates.length,
        feriepengekravOre: grossOre,
        beregnetSfggoereOre: ensureMoneyOre(remainingOre + pensionOre),
        feriepengeAfSygeloenOre: feriepengeOre,
        alleredeBetaltOre: alreadyPaidSegmentOre,
        pensionOre,
      };
    });

    totalPerEmployment.push({
      ansaettelsesforholdId: employment.id,
      ansaettelsesforholdNavn: getEmploymentName(employment),
      sourceLabel: source.label,
      segments,
      feriepengekravTotalOre: ensureMoneyOre(segments.reduce((sum, segment) => sum + segment.feriepengekravOre, 0)),
      totalOre: ensureMoneyOre(segments.reduce((sum, segment) => sum + segment.beregnetSfggoereOre, 0)),
      alleredeBetaltOre: alreadyPaidOre,
      referenceperiode: baseRate.referenceperiode,
      referenceSats: baseRate.satsOre,
      referenceSatsFormula: baseRate.formula,
      explanatoryLines,
      capRows: capComputation.rows,
      capReachedDate: capComputation.cutoffDate,
    });
  }

  return {
    totalOre: ensureMoneyOre(totalPerEmployment.reduce((sum, entry) => sum + entry.totalOre, 0)),
    perAnsaettelsesforhold: totalPerEmployment,
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
