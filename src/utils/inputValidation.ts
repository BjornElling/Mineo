/**
 * Centraliserede valideringsregler for input-felter
 *
 * Denne fil indeholder fælles valideringslogik der bruges på tværs af
 * alle input-komponenter (både Styled-felter og Table-felter).
 */

/**
 * Tjek om et felt skal tømmes baseret på dets værdi
 *
 * REGEL:
 * - Bevar hvis indeholder MINDST ÉT af: bogstaver (A-Å) eller ciffer (1-9)
 * - Tøm hvis kun indeholder: tomhed, 0'er, specialtegn (.,/- osv.)
 *
 * EKSEMPLER:
 * - "10" → BEVAR (indeholder "1")
 * - "0" → TØM (kun nul)
 * - "00" → TØM (kun nuller)
 * - "0.0" → TØM (nuller + specialtegn)
 * - "abc" → BEVAR (bogstaver)
 * - "  " → TØM (kun mellemrum)
 */
export const shouldClearField = (value: string | number): boolean => {
  // Konverter til streng hvis det er et tal (brug ?? så 0 ikke bliver behandlet som tom)
  const strValue = String(value ?? '');

  // Trim mellemrum i start og slut
  const trimmed = strValue.trim();

  // Tøm hvis tomt efter trim
  if (!trimmed || trimmed === '') {
    return true;
  }

  // Bevar hvis der findes MINDST ÉT gyldigt ciffer (1-9) eller bogstav (A-Å)
  // Dette betyder at "10", "20", "100" osv. BEVARES, da de indeholder 1-9
  const hasValidContent = /[A-Za-zÆØÅæøå1-9]/.test(trimmed);

  // Tøm hvis der IKKE er gyldigt indhold
  return !hasValidContent;
};

/**
 * Rens en værdi for mellemrum i start og slut
 */
export const trimValue = (value: string | number): string => {
  return String(value ?? '').trim();
};
