/**
 * PDF Tekst-hjælpefunktioner
 *
 * Pure string-transformationer til PDF-rendering.
 * Ingen jsPDF-afhængighed — kan importeres frit af sektioner og generatorer.
 */

const NBSP = '\u00A0';

/**
 * Erstatter linjeskift (\r\n eller \n) med ikke-brydende mellemrum mellem
 * tal og "kr." — forhindrer linjeskift midt i beløb i PDF-output.
 */
export const ensureNonBreakingKr = (value: string): string => {
  return value.replace(/(-?\d[\d.,]*)\s+kr\./g, `$1${NBSP}kr.`);
};

/**
 * Normaliserer tekst til PDF-rendering:
 * - Windows-linjeskift (\r\n) → Unix (\n)
 * - Ikke-brydende mellemrum mellem tal og "kr."
 */
export const normalizeTextForPdf = (value: string): string => {
  return ensureNonBreakingKr(value.replace(/\r\n/g, '\n'));
};
