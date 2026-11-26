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
// Ældre versioners felter og omdøbninger dækkes af eksplicitte load-migreringer, ikke af schemaet.
// En ændring, der kun tilføjer Zod-refinements, ændrer ikke fingerprintet, men kan stadig være en
// parse-semantikændring, der kræver versionsbump.
// Fjern aldrig et persisteret felt med `.transform()` på schemaet: `z.toJSONSchema` udsender en tom
// `items: {}` for et transformeret array, så hele det nestede løntræ forsvinder ud af både fingerprintet og
// ledgerens felt-/collection-udledninger, og fingerprintet bliver falsk stabilt. Fjernelser sker i
// sektionsmigratoren, så fingerprintet dækker hvert persisteret felt.
const SCHEMA_FINGERPRINT_SNAPSHOT = 'fnv1a-59d26e3c';

describe('persistenceVersionDrift', () => {
  it('schema fingerprint matcher snapshot – ved ændring: bump PERSISTED_DATA_VERSION og opdater SCHEMA_FINGERPRINT_SNAPSHOT', () => {
    const current = computeSchemaFingerprint(persistenceSchemas);
    expect(current).toBe(SCHEMA_FINGERPRINT_SNAPSHOT);
  });
});
