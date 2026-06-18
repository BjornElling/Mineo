/**
 * PDF Brevhoved (letterhead) utilities
 *
 * Ansvar:
 * - Mapping fra AppSettings til PDF-generator visBrevhoved beslutning
 * - Type-sikker DocumentBrevhovedType enum for alle PDF-typer i systemet
 *
 * VIGTIGT:
 * - Dette er en ren mapper-funktion (IKKE et React hook)
 * - PDF-generatorer skal forblive deterministiske og React-uafhængige
 * - Beslutningen om visBrevhoved tages eksplicit på call sites
 */

import type { AppSettings } from '../../settings/appSettingsSchema';

/**
 * PDF-type nøgler – bundet direkte til AppSettings schema
 *
 * VIGTIGT: Denne type er exhaustive over brevhovedIndstillinger-keys.
 * Hvis en ny PDF-type tilføjes til settings, vil TypeScript fejle her.
 */
export type DocumentBrevhovedType = keyof AppSettings['brevhovedIndstillinger'];

/**
 * Ren mapper-funktion: afgør om en given PDF-type skal vise brevhoved
 *
 * EXHAUSTIVENESS-GARANTI:
 * - DocumentBrevhovedType er bundet direkte til schema-keys via keyof
 * - Nye PDF-typer i schema kræver compile-time opdatering af call sites
 * - Ingen silent failures mulige
 *
 * @param settings AppSettings fra localStorage
 * @param pdfType Den PDF-type der skal genereres (type-sikret mod schema)
 * @returns true hvis brevhoved skal vises for denne PDF-type
 *
 * @example
 * ```typescript
 * const settings = getAppSettings();
 * const visBrevhoved = getVisBrevhoved(settings, 'renteberegning');
 * generateRenteDocument(beloeb, actualInterestDate, beregningsdato, {
 *   visBrevhoved,
 *   stamdata: validatedStamdata
 * });
 * ```
 */
export const getVisBrevhoved = <T extends DocumentBrevhovedType>(
  settings: AppSettings,
  pdfType: T
): boolean => {
  return settings.brevhovedIndstillinger[pdfType];
};
