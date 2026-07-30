import type {
  LoenindkomstAnsaettelsesforhold,
  SygeferiegodtgoerelseAnsaettelsesforholdRow,
} from '../../../schemas/formSchemas';
import type { TafCalculationValues } from './tafCalculationInput';
import { amountValueToNumber } from '../../../utils/expressionAmount';
import { parseISODate, type ISODateString } from '../../../types/branded';
import { countInclusiveUtcDays } from '../../../utils/utcDayMath';
import {
  addMoneyOre,
  clampMoneyOreToZero,
  fromKroner,
  roundKroner,
  subtractMoneyOre,
  sumMoneyOre,
  zeroMoneyOre,
  type MoneyOre,
} from '../../money/money';
import type { IsoRange } from '../validation/tafPeriodConstraints';
import type { TafBeregningsenhed } from '../helpers/tafBeregningsenhed';
import { optaelArbejdsdage } from './periodiseringsMotor';
import { splitRangesAtBoundaryStarts } from './isoRangeAlgebra';
import {
  getSfggKildeSpec,
  resolveSfggDayBasis,
  resolveSfggSource,
  sfggKildeUsesReferenceperiode,
  type SfggSourceKind,
} from './sfggKilde';
import { getOverenskomstSfggPolicy } from '../../../data/overenskomstRates';
import {
  SFGG_LOVBESTEMT_FERIEPENGE_PCT,
  notCalculableSfggReferencesats,
  resolveSfggBaseRate,
} from './sfggReferencesats';
import { buildSfggPeriode, type SfggAfkortning } from './sfggPeriodisering';
import {
  allocateOreByWeights,
  buildEligibleDatesForSfggRange,
  buildSfggGrossOre,
  buildYearAllocationsForGroupedSegment,
  resolveSfggSegmentBoundaryStarts,
  resolveSfggSegmentRateForDate,
  sumLoenPlusLoen2PlusIkkePensLoenForEligibleDatesKroner,
  type EmploymentSfggCalculator,
  type PerEmploymentLoenudvikling,
} from './sfggSegmentering';
import type {
  SygeferiegodtgoerelseAnsaettelsesforholdResult,
  SygeferiegodtgoerelseSegment,
} from './sfggResult';
import {
  buildSfggAfterEmployerSickPayText,
  buildSfggLovbestemtFeriepengeNote,
  SFGG_FIRST_TAF_DAY_EXCLUDED_TEXT,
  buildSfggIntroText,
  resolveSfggFoerstEfterSygeloen,
  resolveSfggDifferentieretSatsLabel,
  resolveSfggReferenceperiodeAuthorityText,
  resolveSfggReferenceperiodeLabel,
} from '../helpers/sygeferiegodtgoerelseTexts';

const resolveSfggOphoerVerb = (
  ophoersdato: ISODateString,
  opgoerelsesdato: ISODateString
): 'bortfaldt' | 'bortfalder' => (
  ophoersdato <= opgoerelsesdato ? 'bortfaldt' : 'bortfalder'
);
const getSfggRowForEmployment = (
  values: TafCalculationValues,
  ansaettelsesforholdId: string
): SygeferiegodtgoerelseAnsaettelsesforholdRow | undefined =>
  values.sfggAnsaettelsesforhold.find((row) => row.ansaettelsesforholdId === ansaettelsesforholdId);

const getEmploymentName = (employment: LoenindkomstAnsaettelsesforhold): string =>
  (employment.navnPaaArbejdssted ?? '').trim() || 'Arbejdssted';

const assertNever = (value: never): never => {
  throw new Error(`Uventet SFGG-kildeværdi: ${String(value)}`);
};

const resolveSfggAfterEmployerSickPayText = (args: Readonly<{
  excludedAny: boolean;
  sfggSourceKind: SfggSourceKind;
  manualFoerstEfterSygeloen: boolean;
  overenskomstPolicy: ReturnType<typeof getOverenskomstSfggPolicy> | undefined;
}>): string | null => {
  const { afterSickPayModel } = getSfggKildeSpec(args.sfggSourceKind);
  switch (afterSickPayModel) {
    case 'ingen':
      return null;
    case 'manuel':
      return args.excludedAny && args.manualFoerstEfterSygeloen
        ? buildSfggAfterEmployerSickPayText({ kind: 'manual' })
        : null;
    case 'overenskomst':
      return args.overenskomstPolicy?.bortfalderUnderArbejdsgiverbetaltSygeloen === true
        ? buildSfggAfterEmployerSickPayText({ kind: 'overenskomst' })
        : null;
    default:
      return assertNever(afterSickPayModel);
  }
};

export type SfggAnsaettelsesforholdContext = Readonly<{
  values: TafCalculationValues;
  employment: LoenindkomstAnsaettelsesforhold;
  tafRanges: readonly IsoRange[];
  opgoerelsesdato: ISODateString;
  tafBeregningsenhed: TafBeregningsenhed;
  firstExcludedDate: ISODateString | null;
  capReachedDate: ISODateString | null;
  tafDateSetIncludingFirstExcluded: ReadonlySet<ISODateString>;
  tafArbejdsdageSetIncludingFirstExcluded: ReadonlySet<ISODateString>;
  employmentCalculator: EmploymentSfggCalculator;
  alleAnsaettelserKalkulatorer: readonly EmploymentSfggCalculator[];
  loenudvikling: PerEmploymentLoenudvikling;
}>;

export type SfggAnsaettelsesforholdComputation =
  | Readonly<{ status: 'skipped' }>
  | Readonly<{ status: 'computed'; result: SygeferiegodtgoerelseAnsaettelsesforholdResult }>;

const computedResult = (
  result: SygeferiegodtgoerelseAnsaettelsesforholdResult
): SfggAnsaettelsesforholdComputation => ({ status: 'computed', result });

export const computeSfggForAnsaettelsesforhold = (
  context: SfggAnsaettelsesforholdContext
): SfggAnsaettelsesforholdComputation => {
  const {
    values,
    employment,
    tafRanges,
    opgoerelsesdato,
    tafBeregningsenhed,
    firstExcludedDate,
    capReachedDate,
    tafDateSetIncludingFirstExcluded,
    tafArbejdsdageSetIncludingFirstExcluded,
    employmentCalculator,
    alleAnsaettelserKalkulatorer,
    loenudvikling,
  } = context;
  const buildAlleFeriepengeOreForDates = (dates: readonly ISODateString[]): MoneyOre =>
    sumMoneyOre(alleAnsaettelserKalkulatorer.map((calculator) => calculator.buildFeriepengeOreForDates(dates)));

  const sfggRow = getSfggRowForEmployment(values, employment.id);
  const sfggSource = resolveSfggSource(sfggRow, employment);
  if (sfggSource.kind === 'ingen') return { status: 'skipped' };

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
  const sfggAfterEmployerSickPayText = resolveSfggAfterEmployerSickPayText({
    excludedAny: afterEmployerSickPayExcludedAny,
    sfggSourceKind: sfggSource.kind,
    manualFoerstEfterSygeloen,
    overenskomstPolicy,
  });
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
    return computedResult({
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
  }

  const sfggBaseRate = resolveSfggBaseRate(values, employment, sfggRow, sfggSource, employmentCalculator);
  const groupedWithEligibleDays = splitRangesAtBoundaryStarts(
    eligibleRanges,
    resolveSfggSegmentBoundaryStarts({
      ranges: eligibleRanges,
      employment,
      sfggSource,
      loenudvikling,
    })
  ).flatMap((range) => {
    const rate = resolveSfggSegmentRateForDate({
      iso: range.fra,
      employment,
      sfggRow,
      sfggSource,
      sfggBaseRate,
      loenudvikling,
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
    const loenPlusLoen2PlusIkkePensLoenKroner =
      sumLoenPlusLoen2PlusIkkePensLoenForEligibleDatesKroner(group.dates, employmentCalculator);
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

  return computedResult({
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
};
