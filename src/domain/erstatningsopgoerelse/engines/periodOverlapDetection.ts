/**
 * Detektion af overlappende perioder i tabeller
 *
 * Dette modul detekterer når perioder overlapper hinanden og returnerer
 * row IDs for de rækker der har overlap, så der kan vises fejl i UI.
 */

import type { ISODateString } from '../../../types/branded';
import { isValidClosedDateRange, rangesOverlap } from '../../../utils/closedDateRange';

export type PeriodRow = Readonly<{
  id: string;
  fra?: ISODateString | undefined;
  til?: ISODateString | undefined;
}>;

/**
 * Tjekker om to periode-rækker overlapper.
 *
 * Prædikatet er IKKE skrevet her. `utils/closedDateRange` er den kanoniske intervalalgebra, og
 * dette modul – som dækker svie/smerte-, TAF- og ferie/fraværsrækkerne, altså flertallet af de
 * perioder brugeren indtaster – havde sin egen inlinede kopi af uligheden. Kopien blev overset, da
 * de fire øvrige kopier blev samlet, og den var dermed præcis den drift-risiko, samlingen skulle
 * fjerne: en senere rettelse ét sted (fx en halvåben grænse) ville have gjort nogle overlap
 * ugyldige og andre ikke, uden at noget blev rødt.
 *
 * Udviklerbeslutning 2026-09-17: **alle overlap er ugyldige**, og programmet må ikke ændre eller
 * fortolke de perioder, brugeren indtaster. To perioder, der blot deler en endedato, overlapper
 * derfor – den lukkede semantik, `rangesOverlap` allerede bærer.
 *
 * En ufuldstændig eller omvendt række giver bevidst «intet overlap»: dens mangel er allerede
 * brugerens fejl et andet sted (komplethed og datoorden), og at kalde den et overlap ville lægge en
 * anden fejl oven i den rigtige.
 */
const rowsOverlap = (row1: PeriodRow, row2: PeriodRow): boolean => {
  const range1 = { fra: row1.fra, til: row1.til };
  const range2 = { fra: row2.fra, til: row2.til };
  if (!isValidClosedDateRange(range1) || !isValidClosedDateRange(range2)) {
    return false;
  }
  return rangesOverlap(range1, range2);
};

/**
 * Finder alle rækker der har overlappende perioder
 *
 * Returnerer et Set med row IDs for alle rækker der overlapper med
 * mindst én anden række.
 *
 * @param rows - Array af periode-rækker
 * @returns Set med row IDs der har overlap
 */
export const detectOverlappingPeriods = (rows: readonly PeriodRow[]): ReadonlySet<string> => {
  const overlappingIds = new Set<string>();

  // Sammenlign alle par af rækker
  for (let i = 0; i < rows.length; i++) {
    for (let j = i + 1; j < rows.length; j++) {
      if (rowsOverlap(rows[i], rows[j])) {
        overlappingIds.add(rows[i].id);
        overlappingIds.add(rows[j].id);
      }
    }
  }

  return overlappingIds;
};
