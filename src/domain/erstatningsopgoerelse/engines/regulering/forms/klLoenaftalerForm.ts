import type { ISODateString } from '../../../../../types/branded';
import { klLoenaftalerRaekker, getReguleringsDatoIntervalForKlLoenaftaler } from '../../../../../data/klLoenaftaler';
import { buildKlLoenaftalerIndexEntries } from '../../klLoenaftalerRegulering';
import {
  buildSegmentsFromStartDates,
  buildZeroDeltaSegment,
  toKildeReguleringsIntervalIso,
} from '../reguleringFormPrimitives';
import type {
  FormKonsoliderContext,
  KildeReguleringsInterval,
  KonsolideretLoenudvikling,
  LoenreguleringsSegment,
  ReguleringForm,
  ReguleringResultat,
  ResolvedStrategi,
} from '../reguleringForm';

const konsolider = (ctx: FormKonsoliderContext): ResolvedStrategi => {
  const label = 'KL-lønaftaler';
  return {
    strategi: 'klLoenaftaler',
    label,
    konsolideret: {
      strategi: 'klLoenaftaler',
      label,
      reguleringsdato: ctx.anvendtReguleringsdato,
      tafRanges: ctx.tafRanges,
    },
  };
};

const byggResultat = (
  konsolideret: KonsolideretLoenudvikling
): ReguleringResultat => {
  if (konsolideret.strategi !== 'klLoenaftaler') {
    throw new Error('Loenudvikling kan ikke beregnes: KL-lønaftaler-strategi mangler');
  }
  if (!konsolideret.reguleringsdato) {
    throw new Error('Loenudvikling kan ikke beregnes: reguleringsdato mangler');
  }
  if (klLoenaftalerRaekker.length === 0) {
    throw new Error('Loenudvikling kan ikke beregnes: KL-lønaftaler mangler');
  }
  // KL-lønaftaler-segmentbyggeren ejer kun brudpunkterne. Selve reguleringen må ikke
  // beregnes som indeksforhold her; den sættes senere fra KL-lønaftaler-kæde-resolveren,
  // så den trinvise afrunding på lønnen er eneste beregningssandhed.

  // R2 – samme delte periodeserie som formen emitterer som forløb og præsentationen læser
  // (buildKlLoenaftalerIndexEntries): bygges ÉN gang her og bæres både som brudpunkt-kilde og
  // som autoritativt forløb. Segment-byggeriet bruger kun startIso til brudpunkter.
  const periodStarts = buildKlLoenaftalerIndexEntries();

  // Byg segmenter for hvert taf-interval
  const segments: LoenreguleringsSegment[] = [];
  for (const range of konsolideret.tafRanges) {
    const starts = new Set<ISODateString>();
    for (const entry of periodStarts) {
      if (entry.startIso > range.fra && entry.startIso <= range.til) starts.add(entry.startIso);
    }
    for (const segment of buildSegmentsFromStartDates(range, starts)) {
      segments.push(buildZeroDeltaSegment(segment));
    }
  }
  if (segments.length === 0) {
    throw new Error('Loenudvikling kan ikke beregnes: ingen KL-lønaftaler-segmenter');
  }
  return { segmenter: segments, forloeb: { kind: 'klLoenaftaler', entries: periodStarts } };
};

const coverageInterval = (): KildeReguleringsInterval | undefined =>
  toKildeReguleringsIntervalIso(getReguleringsDatoIntervalForKlLoenaftaler());

export const klLoenaftalerForm: ReguleringForm = {
  id: 'KL-lønaftaler',
  strategi: 'klLoenaftaler',
  konsolider,
  byggResultat,
  coverageInterval,
};
