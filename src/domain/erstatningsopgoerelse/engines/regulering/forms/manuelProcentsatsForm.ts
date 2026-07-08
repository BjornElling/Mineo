import type { ISODateString } from '../../../../../types/branded';
import { roundReguleringDeltaPct } from '../../reguleringFormulaUtils';
import { buildManuelProcentsatsEntries, findManuelProcentsatsEntryForDate } from '../../manuelProcentsatsRegulering';
import { assertUniform, buildSegmentsFromStartDates } from '../reguleringFormPrimitives';
import type {
  FormKonsoliderContext,
  KildeReguleringsInterval,
  KonsolideretLoenudvikling,
  LoenreguleringsSegment,
  LoenudviklingManualProcentsatsRow,
  ReguleringForm,
  ReguleringResultat,
  ResolvedStrategi,
} from '../reguleringForm';

const normalizeManualProcentsatsRows = (rows: readonly LoenudviklingManualProcentsatsRow[]): string => {
  const normalized = rows.map((row) => ({
    dato: row.dato ?? '',
    procent: row.procent ?? '',
  }));
  return JSON.stringify(normalized);
};

const konsolider = (ctx: FormKonsoliderContext): ResolvedStrategi => {
  const { active, anvendtReguleringsdato, tafRanges } = ctx;
  assertUniform(active, (af) => normalizeManualProcentsatsRows(af.loenudviklingManuelProcentsatsTableData ?? []), 'manuelle procentsatsraekker');
  const label = 'Manuel procentsats';
  return {
    strategi: 'manualProcentsats',
    label,
    konsolideret: {
      strategi: 'manualProcentsats',
      label,
      reguleringsdato: anvendtReguleringsdato,
      manualProcentsatsRows: active[0].loenudviklingManuelProcentsatsTableData ?? [],
      tafRanges,
    },
  };
};

const byggResultat = (
  konsolideret: KonsolideretLoenudvikling
): ReguleringResultat => {
  if (konsolideret.strategi !== 'manualProcentsats') {
    throw new Error('Loenudvikling kan ikke beregnes: manuel procentsats-strategi mangler');
  }
  if (!konsolideret.reguleringsdato) {
    throw new Error('Loenudvikling kan ikke beregnes: reguleringsdato mangler');
  }

  // R2 — samme delte akkumulerings-serie som formen emitterer som forløb og præsentationen læser
  // (buildManuelProcentsatsEntries): bygges ÉN gang her og bæres både som segment-basis og som
  // autoritativt forløb, så det viste indeks = den motoren afleder deltaPct fra.
  const entries = buildManuelProcentsatsEntries({
    anvendtReguleringsdato: konsolideret.reguleringsdato,
    rows: konsolideret.manualProcentsatsRows,
  });
  if (entries.length === 0) {
    throw new Error('Loenudvikling kan ikke beregnes: manuel procentsats mangler basisindeks');
  }

  const segments: LoenreguleringsSegment[] = [];
  for (const range of konsolideret.tafRanges) {
    const starts = new Set<ISODateString>();
    for (const entry of entries) {
      if (entry.startIso > range.fra && entry.startIso <= range.til) starts.add(entry.startIso);
    }
    for (const segment of buildSegmentsFromStartDates(range, starts)) {
      const entry = findManuelProcentsatsEntryForDate(entries, segment.fra);
      if (!entry) {
        throw new Error('Intern fejl: mangler manuel procentsatsindeks for segment');
      }
      segments.push({
        ...segment,
        deltaPct: roundReguleringDeltaPct(entry.akkumuleretPct),
      });
    }
  }
  if (segments.length === 0) {
    throw new Error('Loenudvikling kan ikke beregnes: ingen manuel procentsats-segmenter');
  }
  return { segmenter: segments, forloeb: { kind: 'manuelProcentsats', entries } };
};

// De manuelle modeller har intet kilde-interval — dækningen afhænger af reguleringsdatoen og
// de indtastede rækker (håndteres lokalt af row-gaten).
const coverageInterval = (): KildeReguleringsInterval | undefined => undefined;

export const manuelProcentsatsForm: ReguleringForm = {
  id: 'Manuel procentsats',
  strategi: 'manualProcentsats',
  konsolider,
  byggResultat,
  coverageInterval,
};
