/**
 * Shared table-navigation helpers.
 *
 * This module contains pure, side-effect free traversal rules that are reused
 * by both grid-table and loose-table navigation implementations.
 */

export const getWrappedNextColumn = (
  orderedColumns: readonly number[],
  currentColumn: number,
  direction: -1 | 1,
  canSelect?: (column: number) => boolean
): number | null => {
  const total = orderedColumns.length;
  if (total <= 1) return null;

  const startIndex = orderedColumns.indexOf(currentColumn);
  const safeStartIndex = startIndex >= 0 ? startIndex : 0;

  for (let step = 1; step <= total; step += 1) {
    const nextIndex = (safeStartIndex + (direction * step) + total) % total;
    const candidate = orderedColumns[nextIndex];
    if (candidate === currentColumn) continue;
    if (canSelect && !canSelect(candidate)) continue;
    return candidate;
  }

  return null;
};

