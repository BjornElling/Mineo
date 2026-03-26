/**
 * Fælles type guards til brug på tværs af projektet.
 *
 * DESIGN: Denne fil samler primitive type guards der ellers ville duplikeres
 * i filSave, fileLoad, persistenceLoadSanitization, appSettingsParse m.fl.
 */

/**
 * Returnerer true hvis værdien er et non-null, non-array objekt.
 * Svarer til en loose "plain object"-check.
 */
export const isRecord = (value: unknown): value is Record<string, unknown> => {
  return !!value && typeof value === 'object' && !Array.isArray(value);
};

/**
 * Konverterer en ukendt fejlværdi til et Error-objekt.
 * Bruges i catch-blokke for at sikre korrekt Error-type uden usikre casts.
 */
export const asError = (value: unknown): Error => {
  return value instanceof Error ? value : new Error(String(value));
};
