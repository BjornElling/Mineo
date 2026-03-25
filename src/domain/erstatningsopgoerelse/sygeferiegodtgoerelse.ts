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
import { countInclusiveUtcDays } from '../../utils/utcDayMath';
import { calculateStandardLoenRowDerived } from '../aarsloen/standardLoenRowCalculations';
import { parseAarsloenRowInterval, buildTafRanges } from './indtaegtPerioder';
import { buildLoenArbejdsdageSet, optaelArbejdsdageBreakdown } from './periodiseringsMotor';
import { buildDatoSetInclusiveFromDates, isWeekdayUtc } from './tafDaySets';
import { computeTafBeregningsenhed, TAF_BEREGNES_SOM, type TafBeregningsenhed } from './tafBeregningsenhed';
import type { IsoRange } from './tafPeriodConstraints';
import { dateToISO, parseISODate, type ISODateString } from '../../types/branded';
import { isoToDanish, toDanishDateString } from '../../types/branded';
import { clampMoneyOreToZero, ensureMoneyOre, roundKroner, toOre } from './eoPdfMoneyUtils';
import type { Calculable, MoneyOre } from './eoPdfModelTypes';
import { getEffektiveSatserForDato, getOffentligOverenskomstTypeById, getOverenskomstSfggPolicy } from '../../data/overenskomstRates';
import { erDetteFoersteErstatningsopgoerelse } from './eoNummerValidering';

const asCalculable = <T>(value: T): Calculable<T> => ({ status: 'ok', value });
const notCalculable = <T>(reason: string): Calculable<T> => ({ status: 'not_calculable', reason });

type SfgSourceType = 'ingen' | 'manuel' | 'ferielov' | 'overenskomst_direkte' | 'overenskomst_ferielov';

const formatIsoDate = (value: ISODateString): string => isoToDanish(value) ?? value;

export type SygeferiegodtgoerelseSegment = Readonly<{
  ansaettelsesforholdId: string;
  ansaettelsesforholdNavn: string;
  fra: ISODateString;
  til: ISODateString;
  satsOre: MoneyOre;
  antalDage: number;
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
  totalOre: MoneyOre;
  alleredeBetaltOre: MoneyOre;
  referenceperiode: Readonly<{ fra: ISODateString; til: ISODateString }> | null;
  referenceSats: Calculable<MoneyOre>;
  explanatoryLines: readonly string[];
  capRows: readonly SygeferiegodtgoerelseCapRow[];
  capReachedDate: ISODateString | null;
}>;

export type SygeferiegodtgoerelseResult = Readonly<{
  totalOre: MoneyOre;
  perAnsaettelsesforhold: readonly SygeferiegodtgoerelseAnsaettelsesforholdResult[];
  firstExcludedDate: ISODateString | null;
}>;

const EMPTY_RESULT: SygeferiegodtgoerelseResult = {
  totalOre: ensureMoneyOre(0),
  perAnsaettelsesforhold: [],
  firstExcludedDate: null,
};

const sortIsoDates = (values: Iterable<ISODateString>): ISODateString[] =>
  Array.from(values).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

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

const resolveSource = (
  sfggRow: SygeferiegodtgoerelseAnsaettelsesforholdRow | undefined,
  employment: LoenindkomstAnsaettelsesforhold
): Readonly<{ kind: SfgSourceType; label: string }> => {
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

const rowHasPositiveIncome = (row: StandardLoenTableRow): boolean => {
  const values = [row.col2, row.col3, row.col4, row.col5]
    .map((value) => amountValueToNumber(value))
    .filter((value): value is number => value !== undefined);
  return values.some((value) => value > 0);
};

const sumFpInRangesKroner = (
  employment: LoenindkomstAnsaettelsesforhold,
  ranges: readonly IsoRange[],
  arbejdsdageSet: ReadonlySet<ISODateString>
): number => {
  if (ranges.length === 0 || arbejdsdageSet.size === 0) return 0;
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
    if (!Number.isFinite(derived.fpFvShSo) || derived.fpFvShSo <= 0) continue;
    let totalArbejdsdage = 0;
    let overlapArbejdsdage = 0;
    const totalDays = countInclusiveUtcDays(interval.start, interval.end) ?? 0;
    for (let index = 0; index < totalDays; index += 1) {
      const date = addDays(interval.start, index);
      const iso = dateToISO(date);
      if (!iso || !arbejdsdageSet.has(iso)) continue;
      totalArbejdsdage += 1;
      if (ranges.some((range) => iso >= range.fra && iso <= range.til)) {
        overlapArbejdsdage += 1;
      }
    }
    if (totalArbejdsdage > 0 && overlapArbejdsdage > 0) {
      sum += derived.fpFvShSo * (overlapArbejdsdage / totalArbejdsdage);
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
  const value = satsvalg === 'Faglaert-Koebenhavn'
    ? satser.sfggFaglKbh
    : satsvalg === 'Faglaert-Provinsen'
      ? satser.sfggFaglProv
      : satsvalg === 'Ufaglaert-Koebenhavn'
        ? satser.sfggUfaglKbh
        : satsvalg === 'Ufaglaert-Provinsen'
          ? satser.sfggUfaglProv
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

const buildReferenceArbejdsdageSet = (
  values: ErstatningsopgoerelseValues,
  row: SygeferiegodtgoerelseAnsaettelsesforholdRow
): ReadonlySet<ISODateString> => {
  if (!row.referenceperiodeFra || !row.referenceperiodeTil || row.referenceperiodeFra > row.referenceperiodeTil) {
    return new Set<ISODateString>();
  }
  return buildLoenArbejdsdageSet(
    { fra: row.referenceperiodeFra, til: row.referenceperiodeTil },
    values.ferieperioder ?? []
  );
};

const resolveBaseRate = (
  values: ErstatningsopgoerelseValues,
  employment: LoenindkomstAnsaettelsesforhold,
  sfggRow: SygeferiegodtgoerelseAnsaettelsesforholdRow | undefined,
  source: Readonly<{ kind: SfgSourceType }>
): Readonly<{ referenceperiode: { fra: ISODateString; til: ISODateString } | null; satsOre: Calculable<MoneyOre> }> => {
  if (source.kind === 'manuel') {
    const manual = amountValueToNumber(sfggRow?.manuelDagssats);
    return {
      referenceperiode: null,
      satsOre: manual !== undefined ? asCalculable(toOre(roundKroner(manual))) : notCalculable('Dagssats mangler'),
    };
  }
  if (source.kind === 'overenskomst_direkte') {
    return {
      referenceperiode: null,
      satsOre: notCalculable('Direkte overenskomstsats beregnes pr. periode'),
    };
  }
  if (!sfggRow?.referenceperiodeFra || !sfggRow.referenceperiodeTil || sfggRow.referenceperiodeFra > sfggRow.referenceperiodeTil) {
    return {
      referenceperiode: null,
      satsOre: notCalculable('Referenceperiode mangler'),
    };
  }
  const breakdown = optaelArbejdsdageBreakdown({
    fra: sfggRow.referenceperiodeFra,
    til: sfggRow.referenceperiodeTil,
    ferieperioder: values.ferieperioder ?? [],
    loseFeriedage: 0,
    context: {
      kind: 'beregningsgrundlag',
      oevrigeFravaersdage: sfggRow.referenceperiodeFravaersdageUdenLoen ?? 0,
    },
  });
  const arbejdsdage = breakdown?.tafDage ?? 0;
  const referenceArbejdsdageSet = buildReferenceArbejdsdageSet(values, sfggRow);
  const fpKroner = sumFpInRangesKroner(
    employment,
    [{ fra: sfggRow.referenceperiodeFra, til: sfggRow.referenceperiodeTil }],
    referenceArbejdsdageSet
  );
  if (arbejdsdage <= 0) {
    return {
      referenceperiode: { fra: sfggRow.referenceperiodeFra, til: sfggRow.referenceperiodeTil },
      satsOre: notCalculable('Referenceperioden indeholder ingen arbejdsdage'),
    };
  }
  return {
    referenceperiode: { fra: sfggRow.referenceperiodeFra, til: sfggRow.referenceperiodeTil },
    satsOre: asCalculable(toOre(roundKroner(fpKroner / arbejdsdage))),
  };
};

type PerEmploymentLoenudvikling =
  Readonly<{ beregnedeSegmenter: readonly Readonly<{ fra: ISODateString; til: ISODateString; deltaPct: number }>[] }>
  | undefined;

const resolveAdjustedRateOre = (
  iso: ISODateString,
  baseRateOre: MoneyOre,
  source: Readonly<{ kind: SfgSourceType }>,
  loenudvikling: PerEmploymentLoenudvikling
): MoneyOre => {
  if (source.kind !== 'overenskomst_ferielov') return baseRateOre;
  const segment = loenudvikling?.beregnedeSegmenter.find((entry) => iso >= entry.fra && iso <= entry.til);
  if (!segment) return baseRateOre;
  return toOre(roundKroner((baseRateOre / 100) * (100 + segment.deltaPct)));
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

  const capSourceRanges =
    skadesdato !== undefined && skadesdato < '2015-01-01' && values.sfggAlleSygeperioderErTafPerioder === false
      ? buildTafRanges({ ...values, tafPerioder: values.sfggSygeperioderFoer2015.map((row) => ({ ...row, loseFeriedage: undefined })) as never }, { skadesdatoISO: stamdata.skadesdato })
      : tafRanges;
  const capMode = computeTafBeregningsenhed(values);
  const capComputation =
    skadesdato !== undefined && skadesdato < '2015-01-01'
      ? buildCapComputation(capSourceRanges, capMode)
      : { cutoffDate: null, rows: [] };

  const boundsDates = sortIsoDates(tafDateSet);
  if (boundsDates.length === 0) return { ...EMPTY_RESULT, firstExcludedDate };
  const bounds: IsoRange = { fra: boundsDates[0], til: boundsDates[boundsDates.length - 1] };
  const tafArbejdsdageSet = buildLoenArbejdsdageSet(bounds, values.ferieperioder ?? []);
  const totalPerEmployment: SygeferiegodtgoerelseAnsaettelsesforholdResult[] = [];

  for (const employment of values.loenindkomstAnsaettelsesforhold ?? []) {
    const sfggRow = getSfgRowForEmployment(values, employment.id);
    const source = resolveSource(sfggRow, employment);
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
      explanatoryLines.push(`Retten til sygeferiegodtgørelse er tidsbegrænset til 4 måneder og bortfaldt den ${formatIsoDate(capComputation.cutoffDate)}.`);
    }

    if (employment.ansaettelsesforholdOphoert && employment.sidsteArbejdsdag) {
      for (const iso of [...dateSet]) {
        if (iso > employment.sidsteArbejdsdag) {
          dateSet.delete(iso);
        }
      }
      explanatoryLines.push(`Retten til sygeferiegodtgørelse bortfaldt den ${formatIsoDate(employment.sidsteArbejdsdag)} som følge af ansættelsesforholdets ophør.`);
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
        totalOre: ensureMoneyOre(0),
        alleredeBetaltOre: ensureMoneyOre(0),
        referenceperiode: null,
        referenceSats: notCalculable('Ingen arbejdsdage i SFGG-perioden'),
        explanatoryLines,
        capRows: capComputation.rows,
        capReachedDate: capComputation.cutoffDate,
      });
      continue;
    }

    const baseRate = resolveBaseRate(values, employment, sfggRow, source);
    const grouped: Array<{ fra: ISODateString; til: ISODateString; satsOre: MoneyOre; dates: ISODateString[] }> = [];
    for (const iso of eligibleWorkdays) {
      let satsOre: MoneyOre | null = null;
      if (source.kind === 'overenskomst_direkte') {
        satsOre = resolveOverenskomstDagssatsOre(employment, iso, sfggRow?.satsvalg);
      } else if (baseRate.satsOre.status === 'ok') {
        satsOre = resolveAdjustedRateOre(
          iso,
          baseRate.satsOre.value,
          source,
          args.loenudviklingPerAnsaettelse?.get(employment.id)
        );
      }
      if (satsOre === null) continue;
      const previous = grouped[grouped.length - 1];
      const prevDate = previous ? parseISODate(previous.til) : null;
      const currentDate = parseISODate(iso);
      const isAdjacent = prevDate && currentDate
        ? dateToISO(addDays(prevDate, 1)) === iso
        : false;
      if (previous && previous.satsOre === satsOre && isAdjacent) {
        previous.til = iso;
        previous.dates.push(iso);
      } else {
        grouped.push({ fra: iso, til: iso, satsOre, dates: [iso] });
      }
    }

    const feriepengeBySegment = new Map<string, MoneyOre>();
    grouped.forEach((group, index) => {
      const segmentSet = buildLoenArbejdsdageSet({ fra: group.fra, til: group.til }, values.ferieperioder ?? []);
      const feriepengeKroner = sumFpInRangesKroner(
        employment,
        [{ fra: group.fra, til: group.til }],
        segmentSet
      );
      feriepengeBySegment.set(`${group.fra}:${index}`, toOre(roundKroner(feriepengeKroner)));
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
        satsOre: group.satsOre,
        antalDage: group.dates.length,
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
      totalOre: ensureMoneyOre(segments.reduce((sum, segment) => sum + segment.beregnetSfggoereOre, 0)),
      alleredeBetaltOre: alreadyPaidOre,
      referenceperiode: baseRate.referenceperiode,
      referenceSats: baseRate.satsOre,
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
  stamdata: StamdataValues;
  tafRanges: readonly IsoRange[];
}>): readonly string[] => {
  const result = computeSygeferiegodtgoerelse(args);
  const warningIds: string[] = [];

  for (const employment of args.values.loenindkomstAnsaettelsesforhold ?? []) {
    const calculation = result.perAnsaettelsesforhold.find((entry) => entry.ansaettelsesforholdId === employment.id);
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
