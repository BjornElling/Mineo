/**
 * Validerer om et givet erstatningsopgørelses-nummer repræsenterer
 * den første erstatningsopgørelse.
 *
 * Logik:
 * - Tomt input → true (første)
 * - Første alfanumeriske tegn er et tal, men ikke '1' → false (ikke første)
 * - Første alfanumeriske tegn er '1', og næste tegn er også et tal → false (ikke første, fx "12")
 * - Alle andre tilfælde → true (første)
 *
 * @param eoNummer - Erstatningsopgørelses-nummeret (fx "1", "2", "3A", "1A", etc.)
 * @returns true hvis dette er første erstatningsopgørelse, false ellers
 */
export const erDetteFoersteErstatningsopgoerelse = (eoNummer: string | undefined): boolean => {
  if (typeof eoNummer !== 'string' || eoNummer.length === 0) return true;

  const firstMatch = eoNummer.match(/[\p{L}\p{N}]/u);
  if (!firstMatch || typeof firstMatch.index !== 'number') return true;

  const firstIndex = firstMatch.index;
  const firstChar = firstMatch[0];

  // Hvis første tegn er et tal, men ikke 1 → false (ikke første)
  if (/^\d$/.test(firstChar) && firstChar !== '1') return false;

  // Hvis første tegn er 1, tjek næste tegn
  if (firstChar === '1') {
    const nextChar = eoNummer.slice(firstIndex + 1, firstIndex + 2);
    // Hvis der er et tegn efter, og det er et tal → false (ikke første)
    if (nextChar.length > 0 && /^\d$/.test(nextChar)) return false;
  }

  return true;
};
