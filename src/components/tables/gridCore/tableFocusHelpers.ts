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
