import type { ISODateString } from '../../../../../types/branded';
import { dateToISO } from '../../../../../types/branded';
import type { IsoRange } from '../../../helpers/indtaegtPerioder';
import { roundByMethod } from '../../../../../utils/rounding';
import { createDate } from '../../../../../utils/dateUtils';
import { getStatistiskLoenudvikling, getReguleringsDatoIntervalForStatistikModel, type StatistiskLoenudviklingId } from '../../../../../data/statistiskeRates';
import { opregulerMedAslAarsloensmaksimum } from '../../../../satser/opreguleringsmotorer';
import { splitIsoRangeByCalendarYearsInclusive } from '../../periodRangeGroups';
import { isAslStatistikModel, resolveStatistikModelId } from '../../../helpers/eoSharedUtils';
import { findLatestByDateInSortedList } from '../../reguleringSeriesLookup';
import {
  assertUniform,
  buildSegmentsFromStartDates,
  buildZeroDeltaSegment,
  ensurePositiveFiniteNumber,
  resolveEffectiveBaseEntry,
  toKildeReguleringsIntervalIso,
} from '../reguleringFormPrimitives';
import type {
  FormKonsoliderContext,
  KildeReguleringsInterval,
  KonsolideretLoenudvikling,
  LoenreguleringsSegment,
  LoenudviklingAf,
  ReguleringForm,
  ResolvedStrategi,
} from '../reguleringForm';

const resolveStatistikModelIdFromLabel = (label: string): StatistiskLoenudviklingId | undefined =>
  resolveStatistikModelId(label);

// Kalenderårs-opdeling delegeres til den kanoniske periodiserings-helper, så ASL-sporet
// ikke vedligeholder en parallel dag-/års-løkke (jf. periodisering-contract §7 og
// offentligeYdelserUdviklingBeregning.ts, der splitter med samme helper). Helperen er
// fail-closed på omvendt interval/ugyldigt år frem for den tidligere stille break-sti.
const buildAslReguleringsSegments = (ranges: readonly IsoRange[]): ReadonlyArray<IsoRange & { year: number }> =>
  ranges.flatMap((range) => [...splitIsoRangeByCalendarYearsInclusive(range.fra, range.til)]);

// Familie A→B-krydsning: statistik-formen (Familie A, per-segment deltaPct) fodrer ASL-
// årslønsmaksimums-opreguleringen (Familie B, år-til-år) og oversætter dens
// {deltaPct, manglendeAar}-resultat til et afrundet segment-delta. Dette er det eneste sted de
// to familier krydser; hold krydsningen navngivet og fail-closed (kast på manglende ASL-indeks
// mellem basisår og segmentår) frem for et inline motorkald, så familie-grænsen er synlig.
const aslIndeksTilSegmentDelta = (kildeAar: number, maalAar: number): number => {
  const { deltaPct, manglendeAar } = opregulerMedAslAarsloensmaksimum({ kildeAar, maalAar });
  if (manglendeAar.length > 0) {
    throw new Error(`Loenudvikling kan ikke beregnes: mangler ASL indeks for ${manglendeAar.join(', ')}`);
  }
  return roundByMethod(deltaPct, 2, 'halfAwayFromZero');
};

const konsolider = (ctx: FormKonsoliderContext): ResolvedStrategi => {
  const { active, anvendtReguleringsdato, tafRanges } = ctx;
  assertUniform(active, (af) => (af.loenudviklingStatistikModel ?? '').trim(), 'statistikmodel');
  const label = (active[0].loenudviklingStatistikModel ?? '').trim() || '-';
  return {
    strategi: 'statistik',
    label,
    konsolideret: {
      strategi: 'statistik',
      label,
      reguleringsdato: anvendtReguleringsdato,
      statistikModel: active[0].loenudviklingStatistikModel ?? '',
      tafRanges,
    },
  };
};

const byggSegmenter = (
  konsolideret: KonsolideretLoenudvikling
): ReadonlyArray<LoenreguleringsSegment> => {
  if (konsolideret.strategi !== 'statistik') {
    throw new Error('Loenudvikling kan ikke beregnes: statistikstrategi mangler');
  }
  const modelLabel = konsolideret.statistikModel.trim();
  if (modelLabel === '') {
    throw new Error('Loenudvikling kan ikke beregnes: statistikmodel mangler');
  }
  if (!konsolideret.reguleringsdato) {
    throw new Error('Loenudvikling kan ikke beregnes: reguleringsdato mangler');
  }

  if (isAslStatistikModel(modelLabel)) {
    const baseYear = Number(konsolideret.reguleringsdato.slice(0, 4));

    // OPREGULERINGSMETODE: ASL-årslønsmaksimum (idx[segmentår] / idx[basisår]). Selve
    // indeksforholdet OG dæknings-tjekket ligger i den fælles motor, som nu kaldes med den
    // fulde `aarsloenAslMax`-tabel (default) frem for et injiceret to-års-map. Motoren
    // tjekker hvert år i basisår→segmentår for dækning (ensartet med den akkumulerede motor,
    // jf. `opregulerMedAslAarsloensmaksimum`); tal-neutralt via interiort-hul-load-guarden.
    // Det tidligere per-segment-opslag + to-års-injektion var netop den endepunkts-kun-gren,
    // foreningen fjernede — genindfør den ikke.
    const aslSegments = buildAslReguleringsSegments(konsolideret.tafRanges)
      .map<LoenreguleringsSegment>((segment) => {
        if (segment.year < baseYear) {
          return buildZeroDeltaSegment(segment);
        }
        return { fra: segment.fra, til: segment.til, deltaPct: aslIndeksTilSegmentDelta(baseYear, segment.year) };
      });
    return aslSegments;
  }

  const modelId = resolveStatistikModelIdFromLabel(modelLabel);
  const statistikModel = modelId ? getStatistiskLoenudvikling(modelId) : undefined;
  if (!statistikModel) {
    throw new Error('Loenudvikling kan ikke beregnes: ukendt statistikmodel');
  }

  const periodStarts = statistikModel.indeksvaerdier
    .map((entry) => {
      const match = entry.kvartal.match(/^(\d{4})K([1-4])$/);
      if (!match) return null;
      const year = Number.parseInt(match[1], 10);
      const quarter = Number.parseInt(match[2], 10);
      const startIso = dateToISO(createDate(year, (quarter - 1) * 3, 1));
      if (!startIso) return null;
      return { startIso, indeksvaerdi: entry.indeksvaerdi };
    })
    .filter((entry): entry is Readonly<{ startIso: ISODateString; indeksvaerdi: number }> => Boolean(entry))
    .sort((a, b) => a.startIso.localeCompare(b.startIso));

  const effectiveBase = resolveEffectiveBaseEntry(
    periodStarts,
    konsolideret.reguleringsdato,
    'statistik',
    'Loenudvikling kan ikke beregnes: mangler basisindeks'
  );
  ensurePositiveFiniteNumber(effectiveBase.indeksvaerdi, 'Loenudvikling kan ikke beregnes: ugyldigt basisindeks');
  const effectiveBaseStartIso = effectiveBase.startIso;

  const segments: LoenreguleringsSegment[] = [];
  for (const range of konsolideret.tafRanges) {
    const starts = new Set<ISODateString>();
    for (const entry of periodStarts) {
      if (entry.startIso > range.fra && entry.startIso <= range.til) starts.add(entry.startIso);
    }
    for (const segment of buildSegmentsFromStartDates(range, starts)) {
      if (segment.fra < effectiveBaseStartIso) {
        segments.push(buildZeroDeltaSegment(segment));
        continue;
      }
      const idxEntry = findLatestByDateInSortedList(periodStarts, segment.fra, 'statistik:segment');
      if (!idxEntry) {
        throw new Error('Intern fejl: mangler statistikindeks efter effective base');
      }
      ensurePositiveFiniteNumber(idxEntry.indeksvaerdi, 'Loenudvikling kan ikke beregnes: ugyldigt indeks for segment');
      segments.push({
        ...segment,
        deltaPct: roundByMethod((idxEntry.indeksvaerdi / effectiveBase.indeksvaerdi - 1) * 100, 2, 'halfAwayFromZero'),
      });
    }
  }
  if (segments.length === 0) {
    throw new Error('Loenudvikling kan ikke beregnes: ingen statistiksegmenter');
  }
  return segments;
};

const coverageInterval = (af: LoenudviklingAf): KildeReguleringsInterval | undefined =>
  toKildeReguleringsIntervalIso(getReguleringsDatoIntervalForStatistikModel(af.loenudviklingStatistikModel ?? ''));

export const statistikForm: ReguleringForm = {
  id: 'Statistik',
  strategi: 'statistik',
  konsolider,
  byggSegmenter,
  coverageInterval,
};
