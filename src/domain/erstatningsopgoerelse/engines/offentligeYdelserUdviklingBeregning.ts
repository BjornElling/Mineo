import { reguleringssats } from '../../../data/lovbestemteRates';
import { opregulerMedAkkumuleretReguleringssats } from '../../satser/opreguleringsmotorer';
import type { ISODateString } from '../../../types/branded';
import { toISODateString } from '../../../types/branded';
import { formatISOToDanish } from '../../../utils/dateFormatting';
import { formatPercent } from '../../../utils/formatUtils';
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

export type OffentligeYdelserReguleringTableData = Readonly<{
  columns: readonly string[];
  rows: ReadonlyArray<ReadonlyArray<string>>;
}>;

const splitRangesByCalendarYear = (ranges: readonly IsoRange[]): readonly (IsoRange & { year: number })[] => {
  return ranges.flatMap((range) => [...splitIsoRangeByCalendarYearsInclusive(range.fra, range.til)]);
};

export const resolveOffentligeYdelserAkkumuleretReguleringPct = (
  segmentYear: number,
  baseYear: number
): number => {
  // Akkumuleret reguleringssats ("tilpasningsprocenten plus to procent") via den
  // fælles motor. Bevarer den eksisterende throw-kontrakt ved manglende sats.
  const { deltaPct, manglendeAar } = opregulerMedAkkumuleretReguleringssats(
    { kildeAar: baseYear, maalAar: segmentYear },
    reguleringssats
  );
  if (manglendeAar.length > 0) {
    throw new Error(`Offentlige ydelser kan ikke beregnes: reguleringssats mangler for ${manglendeAar[0]}`);
  }
  return deltaPct;
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
    // Rund den akkumulerede reguleringsprocent til 2 decimaler FØR den både bruges i
    // segmentbeløbet og vises som faktor ("+ X,XX %"). Ellers regnes beløbet med den fulde
    // (typisk >2-decimalers) akkumulerede sats, mens brugeren kun ser 2 decimaler og ikke kan
    // efterregne beløbet. Samme mønster som lønudvikling (loenudviklingBeregning: roundedDeltaPct).
    deltaPct: roundByMethod(resolveOffentligeYdelserAkkumuleretReguleringPct(segment.year, baseYear), 2, 'halfAwayFromZero'),
  }));
};

/**
 * Bygger den rene visningstabel for offentlige ydelsers statslige regulering.
 *
 * Kan kaste ved manglende reguleringssatser. Kald fra render-/kontrollag skal
 * håndtere det defensivt, så et edge-case i tabelvisningen ikke vælter hele
 * PDF- eller kontrol-genereringen.
 */
export const buildOffentligeYdelserReguleringTableData = (
  model: OffentligeYdelserUdviklingModel
): OffentligeYdelserReguleringTableData | null => {
  if (model.reguleringsLabel === 'Ingen') return null;
  if (!model.reguleringsBaseIso) return null;

  const baseYear = Number.parseInt(model.reguleringsBaseIso.slice(0, 4), 10);
  if (!Number.isInteger(baseYear)) return null;

  const sidsteSegmentTil = model.entries
    .flatMap((entry) => entry.beregnedeSegmenter.map((segment) => segment.til))
    .sort((a, b) => b.localeCompare(a))[0];
  if (!sidsteSegmentTil) return null;

  const sidsteYear = Number.parseInt(sidsteSegmentTil.slice(0, 4), 10);
  if (!Number.isInteger(sidsteYear) || sidsteYear <= baseYear) {
    return {
      columns: ['Reguleringsdato', 'Regulering', 'Akkumuleret regulering'],
      rows: [],
    };
  }

  const rows: string[][] = [];
  for (let year = baseYear + 1; year <= sidsteYear; year += 1) {
    const sats = reguleringssats[year];
    if (typeof sats !== 'number' || !Number.isFinite(sats)) {
      throw new Error(`Offentlige ydelser kan ikke beregnes: reguleringssats mangler for ${year}`);
    }
    // Statslig regulering af offentlige ydelser sker årligt per 1. januar.
    const dateIso = toISODateString(`${year}-01-01`);
    rows.push([
      formatISOToDanish(dateIso) ?? dateIso,
      formatPercent(sats),
      formatPercent(resolveOffentligeYdelserAkkumuleretReguleringPct(year, baseYear)),
    ]);
  }

  return {
    columns: ['Reguleringsdato', 'Regulering', 'Akkumuleret regulering'],
    rows,
  };
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
    ensureMoneyOre(entries.reduce((sum, entry) => {
      if (entry.total.status !== 'ok') {
        throw new Error('Offentlige ydelser kan ikke beregnes: ydelsestotal mangler');
      }
      return sum + entry.total.value;
    }, 0))
  );

  return {
    reguleringsLabel: params.reguler ? 'Statslig regulering per 1. januar' : 'Ingen',
    reguleringsBaseIso: params.reguleringsBaseIso,
    beregningsenhed: params.tafBeregningsenhed,
    entries,
    total: asCalculable(totalOre as MoneyOre),
  };
};
