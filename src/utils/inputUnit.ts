/**
 * Kanoniske enheds-etiketter for numeriske indtastningsfelter ("kr." og "%").
 *
 * Disse er rent visuelle: enheden vises efter den committede værdi, når feltet ikke redigeres –
 * men den har ingen parse-, commit- eller beregningsbetydning. I redigerbare felter rendres enheden
 * som et adornment (uden for selve `input.value`), så markør, kopiering og bredde er upåvirkede, og
 * enheden skjules under indtastning. I rene read-only visninger (fx en låst tabelcelle) tilføjes den
 * direkte som tekst via `appendInputUnitSuffix`/`withInputUnitPlaceholderSuffix`.
 *
 * Dette er ENESTE sted enheds-suffikser for input defineres. Tilføj ikke parallelle inline-strenge
 * (" kr." / " %") i felter, adaptere eller callsites – referér disse konstanter og helpers.
 */
export const INPUT_UNIT_SUFFIX = {
  /** Beløbsfelter (kr.). */
  currency: ' kr.',
  /** Procentfelter (%). */
  percent: ' %',
} as const;

const trimmedUnit = (suffix: string): string => suffix.trim();

/**
 * Tilføjer enheds-suffiks til en read-only visningsstreng. Tom streng forbliver tom, så en eventuel
 * placeholder får lov at vise sig. Idempotent: en streng der allerede ender på enheden røres ikke.
 *
 * Bruges til rene tekst-visninger (read-only), hvor enheden er en del af strengen. Redigerbare felter
 * bruger i stedet et adornment (jf. `InputUnitAdornment`).
 */
export const appendInputUnitSuffix = (display: string, suffix: string): string => {
  if (display === '' || suffix === '') return display;
  const unit = trimmedUnit(suffix);
  if (unit !== '' && display.trimEnd().endsWith(unit)) return display;
  return `${display}${suffix}`;
};

/** Tilføjer enheds-suffiks til en ikke-tom placeholder-streng. Idempotent. */
export const withInputUnitPlaceholderSuffix = (placeholder: string, suffix: string): string => {
  const trimmed = placeholder.trim();
  if (trimmed === '' || suffix === '') return placeholder;
  const unit = trimmedUnit(suffix);
  if (unit !== '' && trimmed.endsWith(unit)) return placeholder;
  return `${placeholder}${suffix}`;
};
