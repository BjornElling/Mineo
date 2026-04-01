/**
 * Detektion af overlappende perioder i tabeller
 *
 * Dette modul detekterer når perioder overlapper hinanden og returnerer
 * row IDs for de rækker der har overlap, så der kan vises fejl i UI.
 */

import type { ISODateString } from '../../../types/branded';
import type { Tilstand } from '../../../schemas/formSchemas';

export type PeriodRow = Readonly<{
  id: string;
  fra?: ISODateString | undefined;
  til?: ISODateString | undefined;
}>;

export type SvieSmertePeriodRow = PeriodRow & Readonly<{
  tilstand?: Tilstand | undefined;
}>;

/**
 * Tjekker om to periode-rækker overlapper
 *
 * To perioder overlapper hvis:
 * - Begge har både fra-dato og til-dato udfyldt
 * - Fra-dato er før eller lig til-dato (gyldig periode)
 * - Der er mindst én dag der findes i begge perioder
 *
 * @param row1 - Første periode-række
 * @param row2 - Anden periode-række
 * @returns true hvis perioderne overlapper, ellers false
 */
const rowsOverlap = (row1: PeriodRow, row2: PeriodRow): boolean => {
  // Begge rækker skal have både fra og til udfyldt
  if (!row1.fra || !row1.til || !row2.fra || !row2.til) {
    return false;
  }

  // Begge rækker skal have gyldig periode (fra <= til)
  if (row1.fra > row1.til || row2.fra > row2.til) {
    return false;
  }

  // Tjek om perioderne overlapper:
  // Periode A overlapper B hvis:
  // - A's start er før eller lig B's slut OG
  // - A's slut er efter eller lig B's start
  return row1.fra <= row2.til && row1.til >= row2.fra;
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

/**
 * Finder svie/smerte-rækker med overlap på tværs af forskellige tilstande.
 *
 * Overlap med samme tilstand er tilladt, da perioderne sammenlægges i beregningen.
 */
export const detectConflictingSvieSmerteOverlaps = (
  rows: readonly SvieSmertePeriodRow[]
): ReadonlySet<string> => {
  const overlappingIds = new Set<string>();

  for (let i = 0; i < rows.length; i += 1) {
    for (let j = i + 1; j < rows.length; j += 1) {
      const rowA = rows[i];
      const rowB = rows[j];
      if (!rowsOverlap(rowA, rowB)) continue;
      if (!rowA.tilstand || !rowB.tilstand) continue;
      if (rowA.tilstand === rowB.tilstand) continue;
      overlappingIds.add(rowA.id);
      overlappingIds.add(rowB.id);
    }
  }

  return overlappingIds;
};
