/**
 * Trust-critical contract:
 * - All calendar day counts MUST go through these helpers.
 * - Do NOT use ms-diff (getTime / 86400000) for day counts.
 */
export const diffUtcDays = (start: Date, end: Date): number => {
  const msPerDay = 24 * 60 * 60 * 1000;
  const startUtc = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const endUtc = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
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
