import { persistenceSchemaFingerprint } from './persistenceRegistry';

/**
 * Version for PersistedData wrapper stored in `sessionStorage`.
 *
 * VIGTIGT:
 * - Skal holdes i sync på tværs af FormPersistenceContext, file save/load og dataCollection.
 */

const PERSISTENCE_BASE_VERSION = '1.0.0';
/**
 * Session-persistensversion skal være stabil på tværs af almindelige refreshes.
 *
 * Schema-ændringer håndteres via per-sektion schema-validering i persistence-laget,
 * mens `.eo`-filer fortsat bruger `schemaHash` (fra `persistenceSchemaFingerprint`)
 * til preflight-diagnostik ved indlæsning.
 */
export const PERSISTED_DATA_VERSION = PERSISTENCE_BASE_VERSION;

/**
 * `.eo`-schemafingerprint (brugt i save/load-preflight).
 *
 * Session-persistens tillader kompatibilitet på tværs af samme base-version,
 * men `.eo`-håndtering bruger fortsat fingerprint til diagnostik.
 */
export const PERSISTENCE_SCHEMA_FINGERPRINT = persistenceSchemaFingerprint;

