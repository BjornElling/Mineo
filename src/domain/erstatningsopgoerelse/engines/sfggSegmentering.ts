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
import { resolveAktivOverenskomst } from '../../loen/aktivOverenskomst';
import { isKlNulbasis } from './regulering/reguleringsbevis';
import { kraevReguleringPaaDato, type ReguleringOpslag, type ReguleringsVaerdi } from './regulering/reguleringOpslag';
import { buildKlLoenaftalerReguleretLoenResolver } from './klLoenaftalerReguleretLoen';
import type { SygeferiegodtgoerelseSegment } from './sfggResult';
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
    // En negativ lønseddel (en tilbagebetaling, en efterregulering) modregnes også her, så sygeferiegodtgørelsen
    // bygger på samme løn som den tabte arbejdsfortjeneste (udviklerafgørelse 2026-10-19, BB-290). Før sprang
    // `<= 0` rækken over. Kun en række på 0 kr. bidrager intet. Dagens feriepenge (`buildFeriepengeOreForDate`)
    // forbliver ikke-negative: en dag, hvis rækker samlet er negative, giver 0 kr. i modtagne feriepenge.
    if (!Number.isFinite(derived.loenPlusLoen2PlusIkkePensLoen) || derived.loenPlusLoen2PlusIkkePensLoen === 0) continue;
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
  // Aktiv-prædikatet (toggle OG id), ikke id'et alene: med «Overenskomst» slået fra, men et id stående, regnede
  // sygeferiegodtgørelsen før med overenskomstens pension, mens kortet viste og regnede med brugerens egen.
  const aktiv = resolveAktivOverenskomst(employment);
  if (!aktiv.aktiv || getOffentligOverenskomstTypeById(aktiv.overenskomstId)) {
    return resolvePctDecimalFromSatsOrInput(undefined, employment.pensionPct);
  }
  const overenskomstRef = resolveOverenskomstRef(aktiv.overenskomstId);
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
  // En privat overenskomst låser pensionen. Før dens første satsperiode har programmet ingen sats, og den
  // regnes da som 0 – samme regel som lønrækkerne (BB-275). Før faldt den tilbage til kortets pensionsfelt,
  // som enten var tomt eller satsen på en helt anden dato.
  return resolvePctDecimalFromSatsOrInput(satser?.agPension ?? 0, employment.pensionPct);
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

export type SfggFeriepengeFradrag = Readonly<{
  forDates: (ansaettelsesforholdId: string, dates: readonly ISODateString[]) => MoneyOre;
  byYear: (ansaettelsesforholdId: string, dates: readonly ISODateString[]) => ReadonlyMap<number, MoneyOre>;
}>;

export type SfggFradragKrav = Readonly<{
  ansaettelsesforholdId: string;
  groups: readonly Readonly<{ dates: readonly ISODateString[]; satsOre: MoneyOre; agPensionPct: number }>[];
}>;

// "Feriepenge modtaget i perioden" omfatter alle arbejdsgivere, men hver modtaget krone fratrækkes
// kun én gang på tværs af SFGG-kravene. Pr. dag fratrækker hvert krav sine egne feriepenge; feriepenge
// fra arbejdsgivere uden SFGG-krav den dag fordeles mellem dagens krav efter deres dagsbeløb.
export const buildSfggFeriepengeFradrag = (args: Readonly<{
  kalkulatorer: ReadonlyMap<string, EmploymentSfggCalculator>;
  krav: readonly SfggFradragKrav[];
}>): SfggFeriepengeFradrag => {
  const kravByDate = new Map<ISODateString, Array<Readonly<{ key: string; weight: number }>>>();
  for (const krav of args.krav) {
    for (const group of krav.groups) {
      const weight = buildSfggGrossOre(group.satsOre, group.agPensionPct, 1);
      for (const iso of group.dates) {
        const entries = kravByDate.get(iso) ?? [];
        entries.push({ key: krav.ansaettelsesforholdId, weight });
        kravByDate.set(iso, entries);
      }
    }
  }

  const fradragByDate = new Map<ISODateString, ReadonlyMap<string, MoneyOre>>();
  const resolveDate = (iso: ISODateString): ReadonlyMap<string, MoneyOre> => {
    const cached = fradragByDate.get(iso);
    if (cached) return cached;
    const dagensKrav = kravByDate.get(iso) ?? [];
    const kravIds = new Set(dagensKrav.map((entry) => entry.key));
    let pulje = zeroMoneyOre();
    args.kalkulatorer.forEach((calculator, id) => {
      if (!kravIds.has(id)) pulje = addMoneyOre(pulje, calculator.buildFeriepengeOreForDates([iso]));
    });
    const andele = allocateOreByWeights(pulje, dagensKrav);
    const result = new Map<string, MoneyOre>(dagensKrav.map((entry) => [
      entry.key,
      addMoneyOre(
        args.kalkulatorer.get(entry.key)?.buildFeriepengeOreForDates([iso]) ?? zeroMoneyOre(),
        andele.get(entry.key) ?? zeroMoneyOre()
      ),
    ]));
    fradragByDate.set(iso, result);
    return result;
  };
  const forDate = (id: string, iso: ISODateString): MoneyOre => resolveDate(iso).get(id) ?? zeroMoneyOre();

  return {
    forDates: (id, dates) => sumMoneyOre(dates.map((iso) => forDate(id, iso))),
    byYear: (id, dates) => {
      const byYear = new Map<number, MoneyOre>();
      for (const iso of dates) {
        const year = Number.parseInt(iso.slice(0, 4), 10);
        byYear.set(year, addMoneyOre(byYear.get(year) ?? zeroMoneyOre(), forDate(id, iso)));
      }
      return byYear;
    },
  };
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

const assertKlKaedeloenMatcherRegulering = (vaerdi: ReguleringsVaerdi): void => {
  const kaedeloen = vaerdi.klKaedeloen;
  if (kaedeloen === undefined) return;
  const { regulering } = vaerdi;
  const deltaPct = regulering.appliedDeltaPct;
  // En positiv indtastet løn kan afrundes til nul pr. enhed. Godkendt 2026-10-15: KL-resolverens
  // nulresultat er gyldigt, når de faktiske nulbeløb og den neutrale regulering stemmer overens.
  if (kaedeloen.basisLoenOre === 0 && kaedeloen.reguleretLoenOre === 0 && deltaPct === 0
    && isKlNulbasis(regulering)
    && regulering.rawFactor === 1 && regulering.rawDeltaPct === 0
    && regulering.appliedDeltaPct === 0) return;
  if (kaedeloen.basisLoenOre <= 0) {
    throw new Error('SFGG kan ikke beregnes: KL-lønaftaler-segment mangler positiv basisløn');
  }
  const reproducedOre = fromKroner(roundKroner((kaedeloen.basisLoenOre / 100) * (1 + deltaPct / 100)));
  if (Math.abs(reproducedOre - kaedeloen.reguleretLoenOre) > 0) {
    throw new Error('SFGG kan ikke beregnes: KL-lønaftaler-segmentets interne regulering matcher ikke den regulerede løn');
  }
};

type SfggReguleretSats = Pick<SygeferiegodtgoerelseSegment, 'satsOre' | 'reguleringsindeks' | 'reguleringsgrundlag' | 'klTrin'>;

const resolveAdjustedRate = (
  iso: ISODateString,
  baseRateOre: MoneyOre,
  source: Readonly<{ kind: SfggSourceKind }>,
  reguleringOpslag: ReguleringOpslag | undefined,
  referenceTil: ISODateString | undefined
): SfggReguleretSats => {
  if (!sfggKildeUsesReferenceperiode(source.kind)) {
    return { satsOre: baseRateOre, reguleringsindeks: null };
  }
  // Uden lønmateriale findes intet reguleringsgrundlag. Et udtrykkeligt «Ingen»
  // håndteres derimod af opslagets neutrale værdi.
  if (!reguleringOpslag) return { satsOre: baseRateOre, reguleringsindeks: null };
  if (!referenceTil) throw new Error('SFGG kan ikke beregnes: referenceperiodens slutdato mangler');
  const vaerdi = kraevReguleringPaaDato(reguleringOpslag, iso);
  // Manuelle former har intet historisk niveau. En ældre referenceperiode har
  // eksplicit reguleringsdatoens niveau (afklaringslog 8a).
  const referenceDato = reguleringOpslag.manuelBasisDato && referenceTil < reguleringOpslag.manuelBasisDato
    ? reguleringOpslag.manuelBasisDato : referenceTil;
  const reference = kraevReguleringPaaDato(reguleringOpslag, referenceDato);
  assertKlKaedeloenMatcherRegulering(vaerdi);
  assertKlKaedeloenMatcherRegulering(reference);
  if (vaerdi.klKaedeloen) {
    // Godkendt 2026-10-16: SFGG har sin egen KL-kæde fra referenceperiodens slutdato.
    // Lønnens kædeforhold ville ellers overføre afrundingen af et andet beløb, og
    // gav slet intet reguleringsgrundlag, når jobbet ingen løn havde i beregningsperioden.
    const resolver = buildKlLoenaftalerReguleretLoenResolver(toKroner(baseRateOre), referenceTil);
    return {
      satsOre: fromKroner(resolver.loenAt(iso)),
      reguleringsindeks: null,
      klTrin: resolver.trin.filter((trin) => trin.retning === 'frem'
        ? iso >= referenceTil && trin.dato <= iso
        : iso < referenceTil && trin.dato > iso),
    };
  }
  const referenceValue = reference.regulering.periodValue;
  const periodValue = vaerdi.regulering.periodValue;
  // Forholdet mellem faktiske kildeværdier, aldrig to allerede afrundede TAF-procenter.
  const faktor = periodValue / referenceValue;
  if (!Number.isFinite(faktor) || faktor <= 0) throw new Error('SFGG kan ikke beregnes: ugyldigt reguleringsforhold');
  return {
    satsOre: fromKroner(roundKroner((baseRateOre / 100) * faktor)),
    reguleringsindeks: roundByMethod(faktor * 100, 2, 'halfAwayFromZero'),
    reguleringsgrundlag: { referenceValue, periodValue },
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
  reguleringOpslag: ReguleringOpslag | undefined;
}>): readonly ISODateString[] => {
  const starts = new Set<ISODateString>();

  for (const range of args.ranges) {
    resolveSfggOverenskomstBoundaryStarts(args.employment, range.fra, range.til)
      .forEach((start) => starts.add(start));
  }

  // Reguleringens brudpunkter fra opslaget – alle trin, også trin uden TAF-arbejdsdage (fund A4).
  if (sfggKildeUsesReferenceperiode(args.sfggSource.kind)) {
    args.reguleringOpslag?.segmenter.forEach((segment) => {
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
  reguleringOpslag: ReguleringOpslag | undefined;
}>): SfggReguleretSats & Readonly<{ agPensionPct: number }> | null => {
  const {
    iso,
    employment,
    sfggRow,
    sfggSource,
    sfggBaseRate,
    reguleringOpslag,
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
    reguleringOpslag,
    sfggBaseRate.sfggReferenceperiode?.til
  );
  const agPensionPctDecimal = resolveSfggAgPensionPctDecimalForDate(employment, iso);
  return {
    ...adjusted,
    agPensionPct: roundByMethod(agPensionPctDecimal * 100, 2, 'halfAwayFromZero'),
  };
};
