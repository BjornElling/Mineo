/**
 * Version for schema-validerede sagsinput i `persistenceRegistry`.
 *
 * Dette er ikke `.eo`-containerens `FILE_FORMAT_VERSION`.
 * Bump-reglerne ejes af `src/contracts/persistence-contract.md` og
 * `src/contracts/schema-evolution.md`.
 */

export const PERSISTED_DATA_VERSION = '3.12';

/**
 * Kildedataversion for `.eo`-filer fra før filformatet bar `persistedDataVersion`.
 * Baseline er eksplicit, så manglende metadata aldrig skal udledes af payloadens form.
 */
export const LEGACY_PERSISTED_DATA_VERSION = 'legacy-unversioned';

/**
 * Historiske persisted-data-versioner, som en senere Mineo-version skal kunne
 * læse. Listen er et sporbarhedsværn, ikke en versionssortering: migrationer
 * slår altid eksplicit op på den konkrete kildeversion.
 *
 * Listen må kun udvides. Fjernelse af en gammel version ville gøre tidligere
 * gemte `.eo`-filer og aktive sessioner sværere at identificere og migrere.
 */
export const PERSISTED_DATA_VERSION_HISTORY = [
  LEGACY_PERSISTED_DATA_VERSION,
  '1.0.0', '1.0.1', '1.0.2', '1.0.3', '1.0.4', '1.0.5', '1.0.6', '1.0.7', '1.0.8',
  '1.0', '1.1', '1.2', '1.3', '1.4', '1.6', '1.8', '1.9', '2.0',
  '3.0', '3.1', '3.2', '3.3', '3.4', '3.5', '3.6', '3.7', '3.8', '3.9', '3.10', '3.11', '3.12',
] as const;

export type HistoricalPersistedDataVersion = typeof PERSISTED_DATA_VERSION_HISTORY[number];
