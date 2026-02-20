/**
 * Opretter en Date-objekt med eksplicit år, måned og dag.
 * Date-only kontrakt: datoen behandles som UTC-dag uden klokkeslæt.
 */
export const createDate = (year: number, monthIndex: number, day: number): Date => {
  const date = new Date(Date.UTC(year, monthIndex, day));
  date.setUTCFullYear(year);
  return date;
};
