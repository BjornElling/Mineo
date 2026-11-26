import type { ISODateString } from '../../../types/branded';
import { dateToISO } from '../../../types/branded';
import { createDate } from '../../../utils/dateUtils';
import { getStatistiskLoenudvikling, type StatistiskLoenudviklingId } from '../../../data/statistiskeRates';
import { detectDecimalPlaces } from '../helpers/eoSharedUtils';

// Det autoritative statistik-visnings-forløb: modellens kvartals-indeksserie, keyet på
// kvartalets ISO-startdato. Dette er præcis den liste motorens statistikForm.byggSegmenter
// afleder deltaPct fra (basisindeks + carry-forward pr. segment), og som præsentationen læser
// (kilde-satstabel, base-indeks, periode-indeks) i stedet for at bygge den uafhængigt. Dermed er
// "vist tal = beregnet tal" garanteret ved konstruktion.
export type StatistikIndexEntry = Readonly<{
  startIso: ISODateString;
  kvartal: string;
  indeksvaerdi: number;
}>;

/**
 * Bygger statistikmodellens kvartals-indeksserie som en stigende ISO-sorteret entry-liste.
 * Ét sted for den kvartal→startdato-parsing + sortering, motor og præsentation begge
 * bruger; den stigende sortering matcher `findLatestByDateInSortedList`s carry-forward-invariant.
 * Returnerer tom liste hvis modellen mangler eller ingen kvartaler kan parses (kaldstedet
 * afgør fallback/null – jf. de eksisterende guards i motor og præsentation).
 */
export const buildStatistikIndexEntries = (modelId: StatistiskLoenudviklingId): readonly StatistikIndexEntry[] => {
  const model = getStatistiskLoenudvikling(modelId);
  if (!model) return [];
  return model.indeksvaerdier
    .map((entry) => {
      const match = entry.kvartal.match(/^(\d{4})K([1-4])$/);
      if (!match) return null;
      const year = Number.parseInt(match[1], 10);
      const quarter = Number.parseInt(match[2], 10);
      const startIso = dateToISO(createDate(year, (quarter - 1) * 3, 1));
      if (!startIso) return null;
      return { startIso, kvartal: entry.kvartal, indeksvaerdi: entry.indeksvaerdi };
    })
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
    .sort((a, b) => a.startIso.localeCompare(b.startIso));
};

/** Bygger både den fulde serie og dens kildebestemte visningspræcision hos producenten. */
export const buildStatistikForloeb = (
  modelId: StatistiskLoenudviklingId
): Readonly<{
  kind: 'statistik';
  entries: readonly StatistikIndexEntry[];
  displayDecimals: number;
}> | undefined => {
  const model = getStatistiskLoenudvikling(modelId);
  if (!model) return undefined;
  return {
    kind: 'statistik',
    entries: buildStatistikIndexEntries(modelId),
    displayDecimals: detectDecimalPlaces(
      model.indeksvaerdier.map((entry) => entry.indeksvaerdi)
    ),
  };
};
