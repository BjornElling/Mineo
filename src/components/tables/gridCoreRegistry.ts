/**
 * Global registry for GridCore Controllers
 *
 * VIGTIGT: Denne fil indeholder global state (WeakMap).
 * Den er adskilt fra utils for at holde side-effects isoleret.
 *
 * REGISTRY-KONTRAKT (strong ownership):
 * - Ét table-element må kun have én controller i hele sin livstid
 * - attachGridCoreToTable SKAL kaldes nøjagtigt én gang per table
 * - detachGridCoreFromTable SKAL kaldes symmetrisk i unmount
 * - Double attach er ALTID en programmeringsfejl (fail-fast i DEV og PROD)
 * - WeakMap sikrer at controllers ikke forhindrer garbage collection
 */

import type { GridCoreController } from './gridCoreTypes';

/**
 * WeakMap til at koble GridCoreController til DOM-tabeller
 *
 * VIGTIGT: WeakMap betyder at når table-elementet garbage collectes,
 * forsvinder også controller-referencen automatisk.
 */
const controllerByTable = new WeakMap<HTMLTableElement, GridCoreController>();

/**
 * Tilknyt en GridCoreController til en HTML-tabel
 *
 * SKAL kaldes af StandardGridTable i mount-fase.
 *
 * KONTRAKT (strong ownership):
 * - Kaster fejl hvis table allerede har en controller (double attach)
 * - Samme adfærd i DEV og PROD
 * - Registry'et er selvforsvarende og validerer sine egne invariants
 *
 * @param {HTMLTableElement} table - Tabel-element
 * @param {GridCoreController} controller - Controller-instans
 * @returns {void}
 * @throws {Error} Hvis table allerede har en controller
 */
export const attachGridCoreToTable = (table: HTMLTableElement, controller: GridCoreController): void => {
  if (controllerByTable.has(table)) {
    throw new Error(
      'attachGridCoreToTable: table already has a controller. ' +
        'This indicates a lifecycle error (double mount or missing detach). ' +
        'Ensure detachGridCoreFromTable is called in unmount.'
    );
  }
  controllerByTable.set(table, controller);
};

/**
 * Fjern GridCoreController fra en HTML-tabel
 *
 * SKAL kaldes af StandardGridTable i unmount-fase.
 *
 * KONTRAKT (strong ownership):
 * - Kaster fejl hvis table ikke har en controller (detach uden attach)
 * - Dette sikrer symmetrisk lifecycle og fanger programmer-fejl tidligt
 * - Samme adfærd i DEV og PROD
 *
 * @param {HTMLTableElement} table - Tabel-element
 * @returns {void}
 * @throws {Error} Hvis table ikke har en controller
 */
export const detachGridCoreFromTable = (table: HTMLTableElement): void => {
  if (!controllerByTable.has(table)) {
    throw new Error(
      'detachGridCoreFromTable: table does not have a controller. ' +
        'This indicates a lifecycle error (detach without attach or double detach). ' +
        'Ensure attachGridCoreToTable is called in mount.'
    );
  }
  controllerByTable.delete(table);
};

/**
 * Hent GridCoreController for en given HTML-tabel
 *
 * Bruges af keyboard navigation til at finde controller fra DOM-event.
 *
 * @param {HTMLTableElement} table - Tabel-element
 * @returns {GridCoreController | null} Controller-instans eller null
 */
export const getGridCoreForTable = (table: HTMLTableElement): GridCoreController | null => {
  return controllerByTable.get(table) ?? null;
};
