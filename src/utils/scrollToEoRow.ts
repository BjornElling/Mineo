/**
 * Best-effort-scroll til konkret EO-række via `data-mineo-row-id`.
 *
 * EoRowId-mønstre med row-id understøttes direkte, og nye rækker i de
 * samme mønstre virker uden ekstra konfiguration.
 */
import { scrollWithRetry } from './scrollWithRetry';
import type { EoIssueFocusTarget } from '../domain/eoRowEvaluation/eoRowTypes';

const resolveAnchorIdFromRowId = (rowId: string): string | null => {
  const loenindkomstMatch = rowId.match(/^loenindkomst\.([^.]+)(?:\.|$)/);
  if (loenindkomstMatch) return loenindkomstMatch[1];
  const sfggPostTableMatch = rowId.match(/^sfgg\.eftertabel\.[^.]+\.([^.]+)$/);
  if (sfggPostTableMatch) return sfggPostTableMatch[1];
  const sfggMatch = rowId.match(/^sfgg\.[^.]+\.([^.]+)(?:\.|$)/);
  if (sfggMatch) return sfggMatch[1];

  const patterns: readonly RegExp[] = [
    /^sviesmerte\.periode\.([^.]+)(?:\.|$)/,
    /^taf\.periode\.([^.]+)(?:\.|$)/,
    /^taf\.ferie\.([^.]+)(?:\.|$)/,
    /^taf\.beregningsgrundlag\.ferie\.([^.]+)(?:\.|$)/,
    /^offentligeYdelser\.([^.]+)(?:\.|$)/,
    /^oevrigekrav\.([^.]+)(?:\.|$)/,
  ];

  for (const pattern of patterns) {
    const match = rowId.match(pattern);
    if (match) return match[1];
  }

  return null;
};

const findElementByMineoRowId = (rowId: string): HTMLElement | null => {
  if (typeof document === 'undefined') return null;

  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    const escaped = CSS.escape(rowId);
    const bySelector = document.querySelector<HTMLElement>(`[data-mineo-row-id="${escaped}"]`);
    if (bySelector) return bySelector;
  }

  const all = Array.from(document.querySelectorAll<HTMLElement>('[data-mineo-row-id]'));
  return all.find((el) => el.getAttribute('data-mineo-row-id') === rowId) ?? null;
};

const isVisible = (element: HTMLElement): boolean => {
  if (element.getClientRects().length === 0) return false;
  const style = window.getComputedStyle(element);
  return style.display !== 'none' && style.visibility !== 'hidden';
};

const findElementByAttribute = (name: string, value: string): HTMLElement | null => {
  if (typeof document === 'undefined') return null;

  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    const escaped = CSS.escape(value);
    const bySelector = document.querySelector<HTMLElement>(`[${name}="${escaped}"]`);
    if (bySelector && isVisible(bySelector)) return bySelector;
  }

  const all = Array.from(document.querySelectorAll<HTMLElement>(`[${name}]`));
  return all.find((el) => el.getAttribute(name) === value && isVisible(el)) ?? null;
};

const findElementByFocusTarget = (target: EoIssueFocusTarget | undefined): HTMLElement | null => {
  if (!target) return null;
  if (target.kind === 'rowId') return findElementByMineoRowId(target.rowId);

  const segments = target.fieldPath.split(':');
  const gridCellKeyFallback = segments.length >= 3
    ? segments.slice(-2).join(':')
    : null;

  // Almindelige tekst-/datofelter og tabelceller har `data-mineo-field-path`.
  // Dropdowns/toggles/radiofelter har historisk kun `data-mineo-undo-field-path`,
  // så den er en nødvendig fallback for at kunne ramme konkrete valgfelter.
  return (
    findElementByAttribute('data-mineo-field-path', target.fieldPath) ??
    findElementByAttribute('data-mineo-undo-field-path', target.fieldPath) ??
    (gridCellKeyFallback ? findElementByAttribute('data-mineo-undo-field-path', gridCellKeyFallback) : null)
  );
};

export const scrollToEoRow = (
  rowId: string,
  options: {
    focusTarget?: EoIssueFocusTarget;
    maxRetries?: number;
    onSuccess?: () => void;
    onFailure?: (reason: string) => void;
  } = {}
): void => {
  const anchorId = resolveAnchorIdFromRowId(rowId);
  if (!anchorId && !options.focusTarget) {
    options.onFailure?.(`No row anchor could be resolved from rowId="${rowId}"`);
    return;
  }

  const { maxRetries = 150, onSuccess, onFailure } = options;

  scrollWithRetry({
    maxRetries,
    findTarget: () => findElementByFocusTarget(options.focusTarget) ?? (anchorId ? findElementByMineoRowId(anchorId) : null),
    // behavior udelades bevidst: scrollTargetIntoView afleder den fra prefers-reduced-motion.
    onSuccess,
    onFailure,
    failureMessage: `Could not find focus target or data-mineo-row-id="${anchorId ?? ''}" for rowId="${rowId}"`,
  });
};
