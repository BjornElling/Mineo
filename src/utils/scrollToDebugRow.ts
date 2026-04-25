/**
 * Best-effort scroll to concrete debug row via `data-mineo-row-id`.
 *
 * DebugRowId patterns with row-id are supported directly, and new rows in the
 * same patterns work without extra configuration.
 */
import { scrollWithRetry } from './scrollWithRetry';

const resolveAnchorIdFromDebugRowId = (debugRowId: string): string | null => {
  const loenindkomstMatch = debugRowId.match(/^loenindkomst\.([^.]+)(?:\.|$)/);
  if (loenindkomstMatch) return loenindkomstMatch[1];
  const sfggPostTableMatch = debugRowId.match(/^sfgg\.eftertabel\.[^.]+\.([^.]+)$/);
  if (sfggPostTableMatch) return sfggPostTableMatch[1];
  const sfggMatch = debugRowId.match(/^sfgg\.[^.]+\.([^.]+)(?:\.|$)/);
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
    const match = debugRowId.match(pattern);
    if (match) return match[1];
  }

  return null;
};

const findElementByMinEORowId = (rowId: string): HTMLElement | null => {
  if (typeof document === 'undefined') return null;

  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    const escaped = CSS.escape(rowId);
    const bySelector = document.querySelector<HTMLElement>(`[data-mineo-row-id="${escaped}"]`);
    if (bySelector) return bySelector;
  }

  const all = Array.from(document.querySelectorAll<HTMLElement>('[data-mineo-row-id]'));
  return all.find((el) => el.getAttribute('data-mineo-row-id') === rowId) ?? null;
};

export const scrollToDebugRow = (
  debugRowId: string,
  options: {
    maxRetries?: number;
    onSuccess?: () => void;
    onFailure?: (reason: string) => void;
  } = {}
): void => {
  const anchorId = resolveAnchorIdFromDebugRowId(debugRowId);
  if (!anchorId) {
    options.onFailure?.(`No row anchor could be resolved from debugRowId="${debugRowId}"`);
    return;
  }

  const { maxRetries = 150, onSuccess, onFailure } = options;
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const behavior: ScrollBehavior = prefersReducedMotion ? 'auto' : 'smooth';

  scrollWithRetry({
    maxRetries,
    findTarget: () => findElementByMinEORowId(anchorId),
    behavior,
    onSuccess,
    onFailure,
    failureMessage: `Could not find data-mineo-row-id="${anchorId}" for debugRowId="${debugRowId}"`,
  });
};
