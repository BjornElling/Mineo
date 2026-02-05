/**
 * Best-effort scroll to concrete debug row via `data-mineo-row-id`.
 *
 * DebugRowId patterns with row-id are supported directly, and new rows in the
 * same patterns work without extra configuration.
 */

const resolveAnchorIdFromDebugRowId = (debugRowId: string): string | null => {
  const loenindkomstMatch = debugRowId.match(/^loenindkomst\.([^.]+)(?:\.|$)/);
  if (loenindkomstMatch) return loenindkomstMatch[1];

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

export const scrollToDebugRow = (
  debugRowId: string,
  options: {
    maxRetries?: number;
    onSuccess?: () => void;
    onFailure?: (reason: string) => void;
  } = {}
): void => {
  if (typeof document === 'undefined') {
    options.onFailure?.('No DOM environment available for scroll');
    return;
  }

  const anchorId = resolveAnchorIdFromDebugRowId(debugRowId);
  if (!anchorId) {
    options.onFailure?.(`No row anchor could be resolved from debugRowId="${debugRowId}"`);
    return;
  }

  const { maxRetries = 150, onSuccess, onFailure } = options;
  let attempts = 0;
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const behavior: ScrollBehavior = prefersReducedMotion ? 'auto' : 'smooth';

  const tryScroll = () => {
    attempts += 1;
    const target = findElementByMineoRowId(anchorId);

    if (target) {
      target.scrollIntoView({ behavior, block: 'start' });
      onSuccess?.();
      return;
    }

    if (attempts >= maxRetries) {
      onFailure?.(`Could not find data-mineo-row-id="${anchorId}" for debugRowId="${debugRowId}"`);
      return;
    }

    requestAnimationFrame(tryScroll);
  };

  requestAnimationFrame(tryScroll);
};
