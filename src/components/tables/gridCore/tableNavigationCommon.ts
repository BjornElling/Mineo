/**
 * Fælles hjælpefunktioner til tabel-navigation.
 *
 * Dette modul indeholder rene, side-effect-frie traverserings-regler der genbruges
 * af både grid-table- og loose-table-navigations-implementeringerne.
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

