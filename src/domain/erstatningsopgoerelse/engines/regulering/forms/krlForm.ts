import type { ISODateString } from '../../../../../types/branded';
import { roundByMethod } from '../../../../../utils/rounding';
import {
  getKRLSatstabel,
  getReguleringsDatoIntervalForKRL,
  isKRLSatstabelId,
  type KRLSatstabelId,
} from '../../../../../data/krlRates';
import { parseDanishToIso } from '../../../helpers/eoSharedUtils';
import { findLatestByDateInSortedList } from '../../reguleringSeriesLookup';
import {
  assertUniform,
  buildSegmentsFromStartDates,
  buildZeroDeltaSegment,
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

const konsolider = (ctx: FormKonsoliderContext): ResolvedStrategi => {
  const { active, anvendtReguleringsdato, tafRanges } = ctx;
  assertUniform(active, (af) => af.loenudviklingKRLSatstabel ?? '', 'KRL satstabel');
  const label = active[0].loenudviklingKRLSatstabel ?? '-';
  const krlId = active[0].loenudviklingKRLSatstabel;
  if (!krlId) {
    throw new Error('Loenudvikling kan ikke beregnes: KRL satstabel mangler');
  }
  return {
    strategi: 'krl',
    label,
    konsolideret: {
      strategi: 'krl',
      label,
      reguleringsdato: anvendtReguleringsdato,
      krlSatstabelId: krlId as KRLSatstabelId,
      tafRanges,
    },
  };
};

const byggSegmenter = (
  konsolideret: KonsolideretLoenudvikling
): ReadonlyArray<LoenreguleringsSegment> => {
  if (konsolideret.strategi !== 'krl') {
    throw new Error('Loenudvikling kan ikke beregnes: KRL-strategi mangler');
  }
  if (!konsolideret.reguleringsdato) {
    throw new Error('Loenudvikling kan ikke beregnes: reguleringsdato mangler');
  }
  const tabel = getKRLSatstabel(konsolideret.krlSatstabelId);
  if (!tabel || tabel.vaerdier.length === 0) {
    throw new Error('Loenudvikling kan ikke beregnes: KRL satstabel mangler');
  }
  // Bevidst parity med eoInspektionRegulationCore:
  // KRL strategien modellerer kun selve KRL-indeksserien.
  // Store Bededag indgår derfor ikke som separat breakpoint i denne strategi.

  // Byg sorteret liste af periodestarter med ISO-datoer
  const periodStarts = tabel.vaerdier
    .map((v) => {
      const startIso = parseDanishToIso(v.fraDato);
      if (!startIso) return null;
      return { startIso, reguleringsPct: v.reguleringsPct };
    })
    .filter((entry): entry is Readonly<{ startIso: ISODateString; reguleringsPct: number }> => Boolean(entry))
    .sort((a, b) => a.startIso.localeCompare(b.startIso));

  // Find basisindeks ved reguleringsdato
  const effectiveBase = resolveEffectiveBaseEntry(
    periodStarts,
    konsolideret.reguleringsdato,
    'krl',
    'Loenudvikling kan ikke beregnes: mangler KRL basisindeks'
  );
  const basePct = effectiveBase.reguleringsPct;
  if (!Number.isFinite(basePct) || (100 + basePct) <= 0) {
    throw new Error('Loenudvikling kan ikke beregnes: ugyldigt KRL basisindeks');
  }
  const effectiveBaseStartIso = effectiveBase.startIso;

  // Byg segmenter for hvert taf-interval
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
      const idxEntry = findLatestByDateInSortedList(periodStarts, segment.fra, 'krl:segment');
      if (!idxEntry) {
        throw new Error('Intern fejl: mangler KRL-indeks efter effective base');
      }
      if (!Number.isFinite(idxEntry.reguleringsPct) || (100 + idxEntry.reguleringsPct) <= 0) {
        throw new Error('Loenudvikling kan ikke beregnes: ugyldigt KRL indeks for segment');
      }
      // Indeksforhold: deltaPct = ((100 + periodePct) / (100 + basePct) - 1) * 100
      const deltaPct = roundByMethod(((100 + idxEntry.reguleringsPct) / (100 + basePct) - 1) * 100, 2, 'halfAwayFromZero');
      segments.push({ ...segment, deltaPct });
    }
  }
  if (segments.length === 0) {
    throw new Error('Loenudvikling kan ikke beregnes: ingen KRL segmenter');
  }
  return segments;
};

const coverageInterval = (af: LoenudviklingAf): KildeReguleringsInterval | undefined => {
  const krlId = af.loenudviklingKRLSatstabel;
  if (!isKRLSatstabelId(krlId)) return undefined;
  return toKildeReguleringsIntervalIso(getReguleringsDatoIntervalForKRL(krlId));
};

export const krlForm: ReguleringForm = {
  id: 'KRL satstabel',
  strategi: 'krl',
  konsolider,
  byggSegmenter,
  coverageInterval,
};
