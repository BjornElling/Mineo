/**
 * Schema Fingerprint Drift-detektion
 *
 * Denne test fanger schema-ændringer, der ikke er ledsaget af en PERSISTED_DATA_VERSION bump.
 *
 * Hvis testen fejler, skal du:
 * 1. Klassificer ændringen som reel persisted schema-ændring eller Zod JSON-schema formatdrift.
 * 2. Bump kun PERSISTED_DATA_VERSION ved reel schema-/parse-semantikændring.
 * 3. Opdater SCHEMA_FINGERPRINT_SNAPSHOT herunder til det nye fingerprint.
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
// Opdateret 2026-05-29: nyt felt endeligEetGoerMidlertidigEndeligMedTilbagevirkendeKraft
// på erhvervsevnetab-sektionen (flyttet fra app-settings til sagsdata). PERSISTED_DATA_VERSION
// bumpet til 1.7 (reel persisted schema-ændring).
// Opdateret 2026-05-29: nyt felt indregnMerErstatningVedForhoejetPensionsalder på
// erhvervsevnetab-sektionen. PERSISTED_DATA_VERSION bumpet til 1.8 (reel persisted schema-ændring).
const SCHEMA_FINGERPRINT_SNAPSHOT = 'fnv1a-f35784d9';

describe('persistenceVersionDrift', () => {
  it('schema fingerprint matcher snapshot — ved ændring: bump PERSISTED_DATA_VERSION og opdater SCHEMA_FINGERPRINT_SNAPSHOT', () => {
    const current = computeSchemaFingerprint(persistenceSchemas);
    expect(current).toBe(SCHEMA_FINGERPRINT_SNAPSHOT);
  });
});
