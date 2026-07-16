const danishNumberFormatter = new Intl.NumberFormat('da-DK', {
  maximumFractionDigits: 20,
  useGrouping: true,
});

/** Kanonisk dansk visning af et endeligt tal uden at ændre værdien. */
export const formatDanishNumber = (value: number): string => danishNumberFormatter.format(value);
