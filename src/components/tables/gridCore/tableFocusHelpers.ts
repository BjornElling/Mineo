/**
 * Shared focus/query helpers used by table keyboard navigation and row-focus recovery.
 */

// IMPORTANT: keep this selector aligned with Container-level focus semantics for table fields.
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
   * Use `true` when callers must reject detached nodes (e.g. post-commit row-focus recovery).
   * Leave `false/undefined` for in-table keyboard traversal where candidates are queried from live DOM.
   */
  requireConnected?: boolean;
}>;

export const isTableElementVisible = (el: HTMLElement, options?: IsTableElementVisibleOptions): boolean => {
  if (options?.requireConnected === true && !el.isConnected) return false;
  const style = window.getComputedStyle(el);
  if (style.display === 'none') return false;
  if (style.visibility === 'hidden') return false;
  // JSDOM does not implement layout; treat rect-less elements as visible unless explicitly hidden.
  // We intentionally do not enforce width/height checks in browser layout here.
  return true;
};

export const focusTableElement = (el: HTMLElement): void => {
  try {
    el.focus({ preventScroll: true });
  } catch {
    el.focus();
  }
};
