import type { StandardLoenTableRow, Loenperiode } from '../../schemas/formSchemas';
import { dateToISO } from '../../types/branded';
import { parseAarsloenRowInterval } from '../aarsloen/aarsloenRowInterval';

/**
 * Løntabellens rækker i kronologisk orden – efter periodens start, dernæst dens slutning.
 *
 * Bruges af dokumenterne, som altid trykker rækkerne kronologisk, uanset hvordan brugeren har sorteret
 * tabellen på skærmen (udviklerafgørelse 2026-10-19, BB-294). Skærmens sortering er en ren visningsdetalje: et
 * klik på «Måned» sorterer efter månedsnummeret alene, og en glemt måned, der tilføjes nederst, står nederst.
 *
 * Sorteringen er stabil: rækker med samme periode (to lønsedler for samme måned) beholder tabellens indbyrdes
 * rækkefølge, og rækker uden en gyldig periode står sidst i tabellens rækkefølge.
 */
export const sortStandardLoenRowsChronologically = <TRow extends StandardLoenTableRow>(
  rows: readonly TRow[],
  loenperiode: Loenperiode
): TRow[] => rows
  .map((row, index) => {
    const interval = parseAarsloenRowInterval(row, loenperiode);
    return {
      row,
      index,
      start: interval === null ? undefined : dateToISO(interval.start),
      end: interval === null ? undefined : dateToISO(interval.end),
    };
  })
  .sort((left, right) => {
    if (left.start === undefined || right.start === undefined) {
      if (left.start === right.start) return left.index - right.index;
      return left.start === undefined ? 1 : -1;
    }
    if (left.start !== right.start) return left.start < right.start ? -1 : 1;
    const leftEnd = left.end ?? left.start;
    const rightEnd = right.end ?? right.start;
    if (leftEnd !== rightEnd) return leftEnd < rightEnd ? -1 : 1;
    return left.index - right.index;
  })
  .map((entry) => entry.row);
