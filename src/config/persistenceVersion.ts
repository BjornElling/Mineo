import { persistenceSchemaFingerprint } from './persistenceRegistry';

/**
 * Version for PersistedData wrapper stored in `sessionStorage`.
 *
 * VIGTIGT:
 * - Skal holdes i sync på tværs af FormPersistenceContext, file save/load og dataCollection.
 */

const PERSISTENCE_BASE_VERSION = '1.0.0';
export const PERSISTED_DATA_VERSION = `${PERSISTENCE_BASE_VERSION}-${persistenceSchemaFingerprint}`;

