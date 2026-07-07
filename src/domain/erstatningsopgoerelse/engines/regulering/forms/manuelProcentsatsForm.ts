import type { ISODateString } from '../../../../../types/branded';
import { roundByMethod } from '../../../../../utils/rounding';
import { buildManuelProcentsatsEntries, findManuelProcentsatsEntryForDate } from '../../manuelProcentsatsRegulering';
import { assertUniform, buildSegmentsFromStartDates } from '../reguleringFormPrimitives';
import type {
  FormKonsoliderContext,
  KildeReguleringsInterval,
  KonsolideretLoenudvikling,
  LoenreguleringsSegment,
  LoenudviklingManualProcentsatsRow,
  ReguleringForm,
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

const byggSegmenter = (
  konsolideret: KonsolideretLoenudvikling
): ReadonlyArray<LoenreguleringsSegment> => {
  if (konsolideret.strategi !== 'manualProcentsats') {
    throw new Error('Loenudvikling kan ikke beregnes: manuel procentsats-strategi mangler');
  }
  if (!konsolideret.reguleringsdato) {
    throw new Error('Loenudvikling kan ikke beregnes: reguleringsdato mangler');
  }

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
        deltaPct: roundByMethod(entry.akkumuleretPct, 2, 'halfAwayFromZero'),
      });
    }
  }
  if (segments.length === 0) {
    throw new Error('Loenudvikling kan ikke beregnes: ingen manuel procentsats-segmenter');
  }
  return segments;
};

// De manuelle modeller har intet kilde-interval — dækningen afhænger af reguleringsdatoen og
// de indtastede rækker (håndteres lokalt af row-gaten).
const coverageInterval = (): KildeReguleringsInterval | undefined => undefined;

export const manuelProcentsatsForm: ReguleringForm = {
  id: 'Manuel procentsats',
  strategi: 'manualProcentsats',
  konsolider,
  byggSegmenter,
  coverageInterval,
};
