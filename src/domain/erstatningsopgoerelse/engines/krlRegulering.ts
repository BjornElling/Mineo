import type { ISODateString } from '../../../types/branded';
import { getKRLSatstabel, type KRLSatstabelId } from '../../../data/krlRates';
import { parseDanishToIso } from '../helpers/eoSharedUtils';

// Det autoritative KRL-visnings-forløb: kildens periodeserie af reguleringsprocenter,
// keyet på periodens ISO-startdato. Dette er præcis den liste motorens krlForm.byggSegmenter
// afleder deltaPct fra (basisindeks + carry-forward pr. segment), og som præsentationen læser
// (kilde-tabel, base-indeks, periode-indeks) i stedet for at bygge den uafhængigt. Dermed er
// "vist tal = beregnet tal" garanteret ved konstruktion.
export type KrlIndexEntry = Readonly<{
  startIso: ISODateString;
  reguleringsPct: number;
}>;

/**
 * Bygger KRL-satstabellens periodeserie som en stigende ISO-sorteret entry-liste.
 * Ét sted for den parsing + sortering, motor og præsentation begge bruger; den
 * stigende sortering matcher `findLatestByDateInSortedList`s carry-forward-invariant.
 * Returnerer tom liste hvis tabellen mangler eller ingen datoer kan parses (kaldstedet
 * afgør fallback/null – jf. de eksisterende guards i motor og præsentation).
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
