/**
 * Central konfiguration af faste reguleringsrelaterede konstanter
 *
 * Scope:
 * - Faste procentsatser og faktorer der bruges på tværs af EO/PDF/debug
 * - Ikke årsafhængige satstabeller (de hører hjemme i src/data/regulationRates.ts)
 */

// Tillæg for afskaffelsen af Store Bededag (angivet i procentpoint)
export const STORE_BEDEDAG_PCT = 0.45;

// Standardfaktor til konvertering mellem time- og månedssats
export const TIMER_TIL_MAANED_FAKTOR = 160.33;
