import type { ISODateString } from '../../../../../types/branded';
import { roundByMethod } from '../../../../../utils/rounding';
import {
  getKRLSatstabel,
  getReguleringsDatoIntervalForKRL,
  isKRLSatstabelId,
  type KRLSatstabelId,
} from '../../../../../data/krlRates';
import { findLatestByDateInSortedList } from '../../reguleringSeriesLookup';
import { buildKrlIndexEntries } from '../../krlRegulering';
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
  ReguleringResultat,
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

const byggResultat = (
  konsolideret: KonsolideretLoenudvikling
): ReguleringResultat => {
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

  // R2: samme delte periodeserie som formen emitterer som forløb og præsentationen læser
  // (buildKrlIndexEntries) — bygges ÉN gang her og bæres både som segment-basis og som
  // autoritativt forløb, så vist reguleringsprocent = den motoren afleder deltaPct fra.
  const periodStarts = buildKrlIndexEntries(konsolideret.krlSatstabelId);

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
  return { segmenter: segments, forloeb: { kind: 'krl', entries: periodStarts } };
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
  byggResultat,
  coverageInterval,
};
