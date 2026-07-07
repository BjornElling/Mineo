import type { ISODateString } from '../../../types/branded';
import { getKRLSatstabel, type KRLSatstabelId } from '../../../data/krlRates';
import { parseDanishToIso } from '../helpers/eoSharedUtils';

// R2 — det autoritative KRL-visnings-forløb: kildens periodeserie af reguleringsprocenter,
// keyet på periodens ISO-startdato. Dette er præcis den liste motorens krlForm.byggSegmenter
// afleder deltaPct fra (basisindeks + carry-forward pr. segment), og som præsentationen tre
// steder byggede uafhængigt (kilde-tabel, base-indeks, periode-indeks). Ved at motoren emitterer
// listen og præsentationen læser den, er "vist tal = beregnet tal" garanteret ved konstruktion.
export type KrlIndexEntry = Readonly<{
  startIso: ISODateString;
  reguleringsPct: number;
}>;

/**
 * Bygger KRL-satstabellens periodeserie som en stigende ISO-sorteret entry-liste.
 * Deler ét sted den parsing + sortering motor og præsentation tidligere gentog; den
 * stigende sortering matcher `findLatestByDateInSortedList`s carry-forward-invariant.
 * Returnerer tom liste hvis tabellen mangler eller ingen datoer kan parses (kaldstedet
 * afgør fallback/null — jf. de eksisterende guards i motor og præsentation).
 */
export const buildKrlIndexEntries = (krlSatstabelId: KRLSatstabelId): readonly KrlIndexEntry[] => {
  const tabel = getKRLSatstabel(krlSatstabelId);
  if (!tabel || tabel.vaerdier.length === 0) return [];
  return tabel.vaerdier
    .map((v) => {
      const startIso = parseDanishToIso(v.fraDato);
      if (!startIso) return null;
      return { startIso, reguleringsPct: v.reguleringsPct };
    })
    .filter((entry): entry is KrlIndexEntry => Boolean(entry))
    .sort((a, b) => a.startIso.localeCompare(b.startIso));
};
