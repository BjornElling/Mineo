import { persistenceSchemaFingerprint } from './persistenceRegistry';

/**
 * Version for PersistedData wrapper stored in `sessionStorage`.
 *
 * VIGTIGT:
 * - Skal holdes i sync på tværs af FormPersistenceContext, file save/load og dataCollection.
 */

export const PERSISTED_DATA_VERSION = '1.0.0';

/**
 * `.eo`-schemafingerprint (brugt i save/load-preflight).
 *
 * `.eo`-håndtering bruger fingerprint til diagnostik ved indlæsning.
 */
export const PERSISTENCE_SCHEMA_FINGERPRINT = persistenceSchemaFingerprint;

