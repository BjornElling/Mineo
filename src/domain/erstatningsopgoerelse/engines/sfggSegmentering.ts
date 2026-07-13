import type {
  ErstatningsopgoerelseValues,
  LoenindkomstAnsaettelsesforhold,
  SygeferiegodtgoerelseAnsaettelsesforholdRow,
} from '../../../schemas/formSchemas';
import { roundByMethod } from '../../../utils/rounding';
import { formatDanishDate } from '../../../utils/dateFormatting';
import { danishToISO, dateToISO, isoToDanish, parseISODate, toDanishDateString, type ISODateString } from '../../../types/branded';
import { sortIsoDates } from '../../../utils/isoDateHelpers';
import { calculateStandardLoenRowDerived } from '../../aarsloen/standardLoenRowCalculations';
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
  type MoneyOre,
} from '../../money/money';
import { parseAarsloenRowInterval } from '../helpers/indtaegtPerioder';
import { resolvePctDecimalFromSatsOrInput } from '../helpers/eoSharedUtils';
import type { LoenudviklingSegment } from '../shared/eoTypes';
import type { IsoRange } from '../validation/tafPeriodConstraints';
import { buildLoenArbejdsdageSet, resolveIncomeAllocationDays } from './periodiseringsMotor';
import { buildDatoSetInclusiveFromDates } from './tafDaySets';
import {
  getSfggKildeSpec,
  sfggKildeUsesReferenceperiode,
  type SfggDayBasis,
  type SfggSourceKind,
} from './sfggKilde';
import {
  getEffektiveSatserForDato,
  getEffektiveSatserForPeriode,
  getOffentligTillaegsSatserForPeriode,
  getOffentligOverenskomstTypeById,
  getOverenskomstSfggPolicy,
  resolveOverenskomstRef,
} from '../../../data/overenskomstRates';
import {
  SFGG_LOVBESTEMT_FERIEPENGE_DECIMAL,
  type SfggReferencesatsCalculable,
  type SfggReferencesatsFormula,
} from './sfggReferencesats';

export type EmploymentSfggCalculator = Readonly<{
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

export const buildEmploymentSfggCalculator = (
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
    // Fald-tilbage (jf. periodisering-contract.md §3A) sikrer, at indkomst fra en lønrække
    // uden normale arbejdsdage stadig indgår i referencelønnen. Dagene er fortsat feriedage
    // og indgår derfor aldrig i SFGG's dag-baserede
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

export const buildSfggGrossOre = (
  satsOre: MoneyOre,
  agPensionPct: number,
  antalDage: number
): MoneyOre =>
  fromKroner(roundKroner(toKroner(satsOre) * ((100 + agPensionPct) / 100) * antalDage));

export const sumLoenPlusLoen2PlusIkkePensLoenForEligibleDatesKroner = (
  dates: readonly ISODateString[],
  calculator: EmploymentSfggCalculator
): number => calculator.sumLoenForDatesKroner(dates);

export const allocateOreByWeights = (
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

export const buildYearAllocationsForGroupedSegment = (args: Readonly<{
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

export type PerEmploymentLoenudvikling =
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

export const resolveSfggSegmentBoundaryStarts = (args: Readonly<{
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

export const buildEligibleDatesForSfggRange = (args: Readonly<{
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

export const resolveSfggSegmentRateForDate = (args: Readonly<{
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
