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
// Opdateret 2026-05-30: nyt bilag-felt merErstatningPensionsalder på
// eetDifferencekravBilagSelection. PERSISTED_DATA_VERSION bumpet til 1.9 (reel persisted schema-ændring).
// Opdateret 2026-06-03: fjernet allowReguleringMedOverenskomstDerIkkeDaekkerHelePerioden og
// allowReguleringMedUdloebMedMaaneder fra erstatningsopgoerelse-sektionen (rullet tilbage til
// device-lokale app-settings). PERSISTED_DATA_VERSION bumpet til 2.0 (bevidst breaking schema-ændring).
// Opdateret 2026-06-03: breaking rename af beregnesSvieSmerteGodtgoerelse -> kravPaaSvieSmerteGodtgoerelse og
// beregnesTabtArbejdsfortjeneste -> kravPaaTabtArbejdsfortjeneste, samt udvidet enum til Ja/Nej/Skjul.
// PERSISTED_DATA_VERSION bumpet til 3.0 (bevidst breaking schema-ændring; gamle værdier tabes, default 'Ja').
// Opdateret 2026-06-03: nyt felt kravPaaOevrigeErstatningskrav (Ja/Nej/Skjul) på erstatningsopgoerelse-sektionen,
// magen til de to ovenstående. PERSISTED_DATA_VERSION bumpet til 3.1 (reel persisted schema-ændring).
// Opdateret 2026-06-03: nyt felt offentligeYdelserKommentarer (optionalString) på erstatningsopgoerelse-sektionen
// — kommentarfelt på Offentlige ydelser-siden. PERSISTED_DATA_VERSION bumpet til 3.2 (reel persisted schema-ændring).
// Opdateret 2026-06-03: afsluttesMedEnum udvidet med 'Ingen' (udelader godkendelses-afsnittet fra EO-PDF'en).
// PERSISTED_DATA_VERSION bumpet til 3.3 (reel persisted schema-ændring; enum-værdimængde ændret).
// Opdateret 2026-06-10: defaults tilføjet på aarsloen-sektionens påkrævede felter (loenperiode='maaned',
// tableData=[], omregningTilFuldtAar=false, fuldLoenUnderFerie=true, retTilSjetteFerieuge=true,
// loenPaaHelligdage='Almindelig løn') for forward/backward-tolerant load. Felterne bliver input-optional
// → fingerprint ændret. PERSISTED_DATA_VERSION bumpet til 3.4 (reel persisted schema-/parse-semantikændring).
// Opdateret 2026-06-20: nyt felt tillaegAngivesSom ('procent'|'beloeb', default 'procent') på
// erstatningsopgoerelse-AF og aarsloen-sektionen, samt to nye lønindkomst-rækkefelter
// (fpFvShSoBeloeb, pensionBeloeb) til Beløb-tilstand. PERSISTED_DATA_VERSION bumpet til 3.5
// (reel persisted schema-ændring; nye inputfelter).
// Opdateret 2026-06-23: loenudviklingBeregningsgrundlagEnum udvidet med 'KL-lønaftaler' (ny
// lønudviklings-model). PERSISTED_DATA_VERSION bumpet til 3.6 (reel persisted schema-ændring;
// enum-værdimængde udvidet).
const SCHEMA_FINGERPRINT_SNAPSHOT = 'fnv1a-218e48fa';

describe('persistenceVersionDrift', () => {
  it('schema fingerprint matcher snapshot — ved ændring: bump PERSISTED_DATA_VERSION og opdater SCHEMA_FINGERPRINT_SNAPSHOT', () => {
    const current = computeSchemaFingerprint(persistenceSchemas);
    expect(current).toBe(SCHEMA_FINGERPRINT_SNAPSHOT);
  });
});
