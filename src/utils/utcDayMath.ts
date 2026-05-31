/**
 * Trust-kritisk kontrakt:
 * - Alle kalenderdags-optællinger SKAL gå gennem disse hjælpere.
 * - Brug IKKE ms-diff (getTime / 86400000) til dags-optællinger.
 */
export const diffUtcDays = (start: Date, end: Date): number => {
  const msPerDay = 24 * 60 * 60 * 1000;
  const startUtc = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
  const endUtc = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());
  return (endUtc - startUtc) / msPerDay;
};

export const diffUtcDaysAbs = (start: Date, end: Date): number => {
  return Math.abs(diffUtcDays(start, end));
};

export const countInclusiveUtcDays = (start: Date, end: Date): number | null => {
  const diff = diffUtcDays(start, end);
  if (diff < 0) return null;
  return diff + 1;
};

export const countExclusiveUtcDays = (start: Date, end: Date): number | null => {
  const diff = diffUtcDays(start, end);
  if (diff < 0) return null;
  return diff;
};
