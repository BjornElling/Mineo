/**
 * Schema Fingerprint Drift-detektion
 *
 * Denne test fanger schema-ændringer, der ikke er ledsaget af en PERSISTED_DATA_VERSION bump.
 *
 * Hvis testen fejler, skal du:
 * 1. Bump PERSISTED_DATA_VERSION i src/config/persistenceVersion.ts
 * 2. Opdater SCHEMA_FINGERPRINT_SNAPSHOT herunder til det nye fingerprint
 *
 * For at se det aktuelle fingerprint, kør testen med --reporter=verbose
 * og aflæs værdien i fejlmeddelelsen.
 */

import { computeSchemaFingerprint } from '../../utils/schemaFingerprint';
import { persistenceSchemas } from '../../config/persistenceRegistry';

/**
 * Hardkodet snapshot af schemas' fingerprint.
 * Opdateres manuelt ved intentionelle schema-ændringer (ledsaget af versionsbump).
 */
const SCHEMA_FINGERPRINT_SNAPSHOT = 'fnv1a-e84fa753';

describe('persistenceVersionDrift', () => {
  it('schema fingerprint matcher snapshot — ved ændring: bump PERSISTED_DATA_VERSION og opdater SCHEMA_FINGERPRINT_SNAPSHOT', () => {
    const current = computeSchemaFingerprint(persistenceSchemas);
    expect(current).toBe(SCHEMA_FINGERPRINT_SNAPSHOT);
  });
});
