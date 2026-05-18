import { reguleringssats } from '../../../data/lovbestemteRates';
import type { ISODateString } from '../../../types/branded';
import { roundByMethod } from '../../../utils/rounding';
import { beregnArbejdsdageOgMaaneder } from './arbejdsdageMaaneder';
import { countTafArbejdsdageInRange, segmentAmountOre } from './loenudviklingBeregning';
import { roundIncomeBenefitAmountKroner, type IncomePeriodResult, type IsoRange } from '../helpers/indtaegtPerioder';
import { TAF_BEREGNES_SOM, type TafBeregningsenhed } from '../helpers/tafBeregningsenhed';
import type { LoenudviklingSegment, MoneyOre, OffentligeYdelserUdviklingModel } from '../shared/eoTypes';
import { asCalculable, clampMoneyOreToZero, ensureMoneyOre, toOre } from '../shared/eoMoney';
import type { ErstatningsopgoerelseValues } from '../../../schemas/formSchemas';
import { splitIsoRangeByCalendarYearsInclusive } from './periodRangeGroups';

// INVARIANT-NOTE: Alle throw new Error() i denne fil er defensive invarianter.
// Forventelige brugerfejl skal dækkes af validator/preflight. Hvis en throw-sti rammes
// i snapshot, er det fail-closed og skal rapporteres som runtime_exception.

type ReguleringsSegment = Readonly<IsoRange & { deltaPct: number }>;

const splitRangesByCalendarYear = (ranges: readonly IsoRange[]): readonly (IsoRange & { year: number })[] => {
  return ranges.flatMap((range) => [...splitIsoRangeByCalendarYearsInclusive(range.fra, range.til)]);
};

const resolveDeltaPctByYear = (
  segmentYear: number,
  baseYear: number
): number => {
  if (segmentYear <= baseYear) return 0;

  let index = 100;
  for (let year = baseYear + 1; year <= segmentYear; year += 1) {
    const sats = reguleringssats[year];
    if (typeof sats !== 'number' || !Number.isFinite(sats)) {
      throw new Error(`Offentlige ydelser kan ikke beregnes: reguleringssats mangler for ${year}`);
    }
    index *= 1 + sats / 100;
  }

  return (index / 100 - 1) * 100;
};

const buildReguleringsSegments = (
  tafRanges: readonly IsoRange[],
  reguler: boolean,
  reguleringsBaseIso: ISODateString | undefined
): readonly ReguleringsSegment[] => {
  const split = splitRangesByCalendarYear(tafRanges);
  if (!reguler) return split.map((segment) => ({ fra: segment.fra, til: segment.til, deltaPct: 0 }));
  if (!reguleringsBaseIso) {
    throw new Error('Offentlige ydelser kan ikke beregnes: reguleringsdato mangler');
  }
  const baseYear = Number.parseInt(reguleringsBaseIso.slice(0, 4), 10);
  if (!Number.isInteger(baseYear)) {
    throw new Error('Offentlige ydelser kan ikke beregnes: ugyldig reguleringsdato');
  }
  return split.map((segment) => ({
    fra: segment.fra,
    til: segment.til,
    deltaPct: resolveDeltaPctByYear(segment.year, baseYear),
  }));
};

const buildSegmentsForBenefit = (params: Readonly<{
  baseSatsKroner: number;
  tafBeregningsenhed: TafBeregningsenhed;
  reguleringsSegments: readonly ReguleringsSegment[];
  tafArbejdsdageSet: ReadonlySet<ISODateString> | null;
}>): readonly LoenudviklingSegment[] => {
  const baseSatsOre = toOre(params.baseSatsKroner);
  const segments: LoenudviklingSegment[] = [];

  for (const segment of params.reguleringsSegments) {
    if (params.tafBeregningsenhed === TAF_BEREGNES_SOM.MAANEDER) {
      const maanederRaw = beregnArbejdsdageOgMaaneder(
        segment.fra,
        segment.til,
        new Set<ISODateString>(),
        new Set<ISODateString>()
      ).maaneder;
      if (!Number.isFinite(maanederRaw) || maanederRaw <= 0) {
        throw new Error('Offentlige ydelser kan ikke beregnes: ugyldigt månedssegment');
      }
      const maaneder = roundByMethod(maanederRaw, 4, 'halfAwayFromZero');
      segments.push({
        kind: 'maaneder',
        fra: segment.fra,
        til: segment.til,
        maaneder,
        maanedsloenOre: baseSatsOre,
        deltaPct: segment.deltaPct,
        amountOre: segmentAmountOre(params.baseSatsKroner, maaneder, segment.deltaPct),
      });
    } else {
      if (!params.tafArbejdsdageSet) {
        throw new Error('Offentlige ydelser kan ikke beregnes: arbejdsdagegrundlag mangler');
      }
      const arbejdsdage = countTafArbejdsdageInRange(params.tafArbejdsdageSet, segment.fra, segment.til);
      if (!Number.isFinite(arbejdsdage)) {
        throw new Error('Offentlige ydelser kan ikke beregnes: ugyldigt arbejdsdagesegment');
      }
      if (arbejdsdage <= 0) continue;
      segments.push({
        kind: 'arbejdsdage',
        fra: segment.fra,
        til: segment.til,
        arbejdsdage,
        dagsloenOre: baseSatsOre,
        deltaPct: segment.deltaPct,
        amountOre: segmentAmountOre(params.baseSatsKroner, arbejdsdage, segment.deltaPct),
      });
    }
  }

  return segments;
};

export const buildOffentligeYdelserUdviklingModel = (params: Readonly<{
  values: ErstatningsopgoerelseValues;
  incomeForBeregningsperiode: IncomePeriodResult;
  divisor: number | null | undefined;
  tafBeregningsenhed: TafBeregningsenhed;
  tafRanges: readonly IsoRange[];
  tafArbejdsdageSet: ReadonlySet<ISODateString> | null;
  reguler: boolean;
  reguleringsBaseIso: ISODateString | undefined;
}>): OffentligeYdelserUdviklingModel | null => {
  const benefits = params.incomeForBeregningsperiode.benefits;
  if (benefits.length === 0) return null;
  const divisor = params.divisor;
  if (!Number.isFinite(divisor) || !divisor || divisor <= 0) {
    throw new Error('Offentlige ydelser kan ikke beregnes: mangler beregningsgrundlag');
  }
  if (params.tafRanges.length === 0) {
    throw new Error('Offentlige ydelser kan ikke beregnes: TAF-perioder mangler');
  }

  const reguleringsSegments = buildReguleringsSegments(
    params.tafRanges,
    params.reguler,
    params.reguleringsBaseIso
  );

  // Domænebeslutning: transient `midlertidigt_eet` behandles nøjagtigt som øvrige
  // offentlige ydelser i beregningsperioden og fremskrives som del af den hypotetiske
  // indkomst. Filtres dette i fremtiden, skal det ske eksplicit her i motoren.
  const useWholeKronerForMidlertidigtEet = params.values.midlertidigtEetFraEetSiden === 'Ja';
  const entries = benefits.map((benefit) => {
    const baseSatsKroner = roundIncomeBenefitAmountKroner(
      benefit.typeKey,
      benefit.amount / divisor,
      useWholeKronerForMidlertidigtEet
    );
    const beregnedeSegmenter = buildSegmentsForBenefit({
      baseSatsKroner,
      tafBeregningsenhed: params.tafBeregningsenhed,
      reguleringsSegments,
      tafArbejdsdageSet: params.tafArbejdsdageSet,
    });
    const totalOre = clampMoneyOreToZero(
      ensureMoneyOre(beregnedeSegmenter.reduce((sum, segment) => sum + segment.amountOre, 0))
    );
    return {
      typeKey: benefit.typeKey,
      label: benefit.label,
      beregnedeSegmenter,
      total: asCalculable(totalOre),
    };
  });

  const totalOre = clampMoneyOreToZero(
    ensureMoneyOre(entries.reduce((sum, entry) => sum + entry.total.value, 0))
  );

  return {
    reguleringsLabel: params.reguler ? 'Statslig regulering per 1. januar' : 'Ingen',
    reguleringsBaseIso: params.reguleringsBaseIso,
    beregningsenhed: params.tafBeregningsenhed,
    entries,
    total: asCalculable(totalOre as MoneyOre),
  };
};
