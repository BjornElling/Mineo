import type { ISODateString } from '../../../types/branded';
import { klLoenaftalerRaekker } from '../../../data/klLoenaftaler';
import { parseDanishToIso } from '../helpers/eoSharedUtils';

// R2 — det autoritative KL-lønaftaler-visnings-forløb: kildens periodeserie af
// reguleringsprocenter, keyet på periodens ISO-startdato. Motorens klLoenaftalerForm.byggSegmenter
// bruger listen til at placere brudpunkter, og præsentationens reguleringsværdi-tabel viste den
// samme serie ved at bygge den uafhængigt (parse + sort af klLoenaftalerRaekker). Ved at motoren
// emitterer listen og præsentationen læser den, er den viste reguleringssats samme kilde som de
// brudpunkter beløbet bygger på (jf. greenfield-reviewets kandidat #23).
//
// BEMÆRK: KL-lønaftaler viser bevidst periode-satsen (ikke akkumuleret) og kæder den trinvist på
// lønnen (reguleretLoenOre på segmentet er beregningssandheden for beløbet) — forløbet her er
// kildens satsserie, ikke et indeksforhold (jf. docs/domain/taf/kl-loenaftaler-regulering.md).
export type KlLoenaftalerIndexEntry = Readonly<{
  startIso: ISODateString;
  reguleringsPct: number;
}>;

/**
 * Bygger KL-lønaftaler-seriens periode-reguleringssatser som en stigende ISO-sorteret entry-liste.
 * Deler ét sted den parse + sortering motor og præsentation tidligere gentog; den stigende
 * sortering matcher `findLatestByDateInSortedList`s carry-forward-invariant. Returnerer tom liste
 * hvis ingen datoer kan parses (kaldstedet afgør fallback/null).
 */
export const buildKlLoenaftalerIndexEntries = (): readonly KlLoenaftalerIndexEntry[] => {
  return klLoenaftalerRaekker
    .map((row) => {
      const startIso = parseDanishToIso(row.fraDato);
      if (!startIso) return null;
      return { startIso, reguleringsPct: row.reguleringPct };
    })
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
    .sort((a, b) => a.startIso.localeCompare(b.startIso));
};
