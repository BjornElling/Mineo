export const buildAldersreduktionFormelTekst = (alderVedSkade: number, _alderVedSkadeCapped: number): string => {
  if (alderVedSkade <= 29) return '0 =';
  if (alderVedSkade > 54) {
    const uncappedPct = (alderVedSkade - 29) + (alderVedSkade - 54) * 2;
    const suffix = uncappedPct > 70 ? ' (max 70 %)' : '';
    return `(${alderVedSkade} - 29) + (${alderVedSkade} - 54) x 2${suffix} =`;
  }
  return `(${alderVedSkade} - 29) =`;
};
