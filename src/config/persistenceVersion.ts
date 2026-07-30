/**
 * Version for schema-validerede sagsinput i `persistenceRegistry`.
 *
 * Dette er ikke `.eo`-containerens `FILE_FORMAT_VERSION`.
 * Bump-reglerne ejes af `src/contracts/persistence-contract.md` og
 * `src/contracts/schema-evolution.md`.
 */

export const PERSISTED_DATA_VERSION = '3.11';

/**
 * Kildedataversion for `.eo`-filer fra før filformatet bar `persistedDataVersion`.
 * Baseline er eksplicit, så manglende metadata aldrig skal udledes af payloadens form.
 */
export const LEGACY_PERSISTED_DATA_VERSION = 'legacy-unversioned';
