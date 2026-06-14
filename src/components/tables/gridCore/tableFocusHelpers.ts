/**
 * Fælles focus-/query-hjælpefunktioner brugt af tabellens keyboard-navigation og row-focus-recovery.
 */

// VIGTIGT: hold denne selector på linje med focus-semantikken på Container-niveau for tabelfelter.
export const TABLE_FOCUSABLE_SELECTOR =
  'input[role="combobox"]:not([disabled]):not([tabindex="-1"]):not([type="hidden"]),' +
  'input:not([disabled]):not([tabindex="-1"]):not([type="hidden"]),' +
  'select:not([disabled]):not([tabindex="-1"]),' +
  'textarea:not([disabled]):not([tabindex="-1"]),' +
  'button:not([disabled]):not([tabindex="-1"]),' +
  '[role="combobox"][tabindex]:not([tabindex="-1"]):not([aria-disabled="true"]),' +
  '[aria-haspopup][tabindex]:not([tabindex="-1"]):not([aria-disabled="true"]),' +
  '[aria-controls][tabindex]:not([tabindex="-1"]):not([aria-disabled="true"])';

// Eneste sandhedskilde for "fokuserbart felt på Container-niveau".
// Bruges både af Container'ens egen pil-/Tab-navigation og af tabellens
// `moveFocusOutsideTable`, når kant-piletaster skal flytte fokus til felter UDEN for tabellen.
// Adskiller sig bevidst fra TABLE_FOCUSABLE_SELECTOR ved at udelade [type="button"] og
// kun medtage knapper markeret med data-mineo-focusable-button.
export const CONTAINER_FOCUSABLE_SELECTOR =
  'input[role="combobox"]:not([disabled]):not([tabindex="-1"]):not([type="hidden"]):not([type="button"]),' +
  'input:not([disabled]):not([tabindex="-1"]):not([type="hidden"]):not([type="button"]),' +
  'select:not([disabled]):not([tabindex="-1"]),' +
  'textarea:not([disabled]):not([tabindex="-1"]),' +
  'button[data-mineo-focusable-button="true"]:not([tabindex="-1"]),' +
  '[role="combobox"][tabindex]:not([tabindex="-1"]):not([aria-disabled="true"]),' +
  '[aria-haspopup][tabindex]:not([tabindex="-1"]):not([aria-disabled="true"]),' +
  '[aria-controls][tabindex]:not([tabindex="-1"]):not([aria-disabled="true"])';

// Række-container-selector på Container-niveau. Bruges til at gruppere fokuserbare
// felter i visuelle rækker, både af Container'ens pil-navigation og af tabellens
// `moveFocusOutsideTable`. Eneste sandhedskilde — hold de to konsumenter på linje.
export const CONTAINER_ROW_SELECTOR =
  '.row--label-right-hover,.row--label-right,.row--label-offset,.row,[class*="row--label-right"],[class*="row--label-offset"],[class*="hover-row"]';

type IsTableElementVisibleOptions = Readonly<{
  /**
   * Brug `true` når kaldere skal afvise detached noder (fx row-focus-recovery efter commit).
   * Lad være `false/undefined` til keyboard-traversering inde i tabellen, hvor kandidater forespørges fra live DOM.
   */
  requireConnected?: boolean;
}>;

export const isTableElementVisible = (el: HTMLElement, options?: IsTableElementVisibleOptions): boolean => {
  if (options?.requireConnected === true && !el.isConnected) return false;
  const style = window.getComputedStyle(el);
  if (style.display === 'none') return false;
  if (style.visibility === 'hidden') return false;
  // JSDOM implementerer ikke layout; behandl elementer uden rect som synlige med mindre de er eksplicit skjult.
  // Vi håndhæver bevidst ikke width/height-tjek i browser-layout her.
  return true;
};

export const focusTableElement = (el: HTMLElement): void => {
  try {
    el.focus({ preventScroll: true });
  } catch {
    el.focus();
  }
};

/**
 * Augmenteret native keyboard-event-flag: sættes af tabel-navigationen ved en vertikal kant-exit
 * (top/bund) og læses af `Container`, så Container overtager fortsat navigation uden for tabellen.
 *
 * Producent og konsument SKAL dele denne ene definition (i stedet for hver sin inline-`as`-cast),
 * så et navneskift fanges af typecheck i begge ender.
 */
type TableBoundaryExitFlag = { mineoTableBoundaryExit?: boolean };

export const markTableBoundaryExit = (nativeEvent: Event): void => {
  (nativeEvent as Event & TableBoundaryExitFlag).mineoTableBoundaryExit = true;
};

export const hasTableBoundaryExit = (nativeEvent: Event): boolean =>
  (nativeEvent as Event & TableBoundaryExitFlag).mineoTableBoundaryExit === true;
