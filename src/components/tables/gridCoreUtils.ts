/**
 * Pure utility-funktioner til GridCore system
 *
 * VIGTIGT: Denne fil indeholder KUN rene utility-funktioner uden side-effects.
 * Ingen global state, ingen DOM-interaktion.
 */

import type { GridCellCoord } from './gridCoreTypes';

/**
 * Strict celle-lighed (kun gyldige koordinater)
 *
 * KONTRAKT:
 * - Sammenligner to celle-koordinater strukturelt
 * - null betragtes IKKE som en legitim værdi
 * - Returnerer false hvis én eller begge er null
 *
 * BRUG I:
 * - Algoritmer der arbejder med gyldige celler
 * - Controller-logik hvor null er en fejltilstand
 * - Registry-logik
 *
 * UNDGÅ I:
 * - useEffect dependency arrays (brug areSameGridCellOrBothNull)
 * - State transitions (brug areSameGridCellOrBothNull)
 *
 * @param {GridCellCoord | null} a - Første celle
 * @param {GridCellCoord | null} b - Anden celle
 * @returns {boolean} true kun hvis begge er non-null og strukturelt identiske
 */
export const areSameGridCell = (a: GridCellCoord | null, b: GridCellCoord | null): boolean => {
  if (a === null || b === null) return false;
  return a.rowId === b.rowId && a.colIndex === b.colIndex;
};

/**
 * State-lighed (inklusiv "begge er null")
 *
 * KONTRAKT:
 * - null er en legitim tilstand der betyder "ingen celle"
 * - "Ingen celle" er lig med "ingen celle" → true
 * - Bruges til at sammenligne state-snapshots
 *
 * BRUG I:
 * - useEffect dependency guards
 * - State transition guards (undgå unødvendige updates)
 * - Render guards i komponenter
 * - Context state sammenligninger
 *
 * UNDGÅ I:
 * - Algoritmer der kræver gyldige koordinater
 * - Registry-logik hvor null er ugyldig
 *
 * @param {GridCellCoord | null} a - Første celle-state
 * @param {GridCellCoord | null} b - Anden celle-state
 * @returns {boolean} true hvis begge er null ELLER begge er non-null og strukturelt identiske
 */
export const areSameGridCellOrBothNull = (a: GridCellCoord | null, b: GridCellCoord | null): boolean => {
  if (a === null && b === null) return true;
  if (a === null || b === null) return false;
  return a.rowId === b.rowId && a.colIndex === b.colIndex;
};

/**
 * Genererer unik nøgle for en celle-koordinat
 *
 * @param {GridCellCoord} cell - Celle-koordinat
 * @returns {string} Unik nøgle i format "rowId:colIndex"
 */
export const gridCellKey = (cell: GridCellCoord): string => `${cell.rowId}:${cell.colIndex}`;
