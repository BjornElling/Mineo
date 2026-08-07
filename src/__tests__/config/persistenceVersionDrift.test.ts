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
// Opdateret 2026-07-01: loenudviklingBeregningsgrundlagEnum udvidet med 'Manuel procentsats'
// og nyt felt loenudviklingManuelProcentsatsTableData på lønudviklingsgruppen.
// PERSISTED_DATA_VERSION bumpet til 3.7 (reel persisted schema-ændring; enum + nye inputrækker).
// Opdateret 2026-07-11: varigemen-sektionens øvre méngradsgrænse udvidet fra 100 til 120.
// PERSISTED_DATA_VERSION bumpet til 3.8 (reel, bagudkompatibel parse-semantikændring).
// Opdateret 2026-07-14: alle persisted række-id’er kræver nu ikke-tom, trimmet identitet, numeriske værdier skal
// kunne repræsenteres præcist, og parsebare range-/domæneværdier bevares canonical til den afledte issue-model.
// PERSISTED_DATA_VERSION bumpet til 3.9 (parse-semantikændringer; Zod-refinements ændrer ikke fingerprintet).
// Opdateret 2026-07-16: tre ubrugte schemafelter uden editor eller consumer er fjernet fra
// erstatningsopgørelsen. PERSISTED_DATA_VERSION bumpet til 3.10 (reel persisted schema-ændring).
// Opdateret 2026-07-30: den rent afledte Store Bededagssats er fjernet fra det aktuelle persisted
// EO-schema; ældre `.eo` får slottet fjernet af sektionsmigratoren. PERSISTED_DATA_VERSION bumpet til 3.11.
// Slottet blev først fjernet med en `.transform()` på ansættelsesschemaet. Det gav et FALSKT stabilt
// fingerprint: `z.toJSONSchema` udsender en tom `items: {}` for et transformeret array, så hele det nestede
// løntræ forsvandt ud af både fingerprintet og ledgerens felt-/collection-udledninger. Fjernelsen sker
// derfor i migratoren, og fingerprintet dækker igen hvert persisteret felt.
// Opdateret 2026-08-07 (BF-025): `eoAngivetLoenLoenudvikling.loenPaaHelligdage` var valgfri, mens
// ansættelsesforholdets tvilling var påkrævet — samme logiske felt med to forskellige kontrakter. Feltet er
// nu required-with-default ('Almindelig løn') for BEGGE ejere, præcis som årslønssektionen fik det i 3.4.
// Load-tolerancen består (ældre `.eo` uden feltet får defaulten), men `undefined` kan ikke længere
// repræsenteres — og dermed heller ikke nå motorens fail-closed-sti.
// PERSISTED_DATA_VERSION bumpet til 3.12 (reel persisted schema-/parse-semantikændring).
const SCHEMA_FINGERPRINT_SNAPSHOT = 'fnv1a-c1dbceee';

describe('persistenceVersionDrift', () => {
  it('schema fingerprint matcher snapshot — ved ændring: bump PERSISTED_DATA_VERSION og opdater SCHEMA_FINGERPRINT_SNAPSHOT', () => {
    const current = computeSchemaFingerprint(persistenceSchemas);
    expect(current).toBe(SCHEMA_FINGERPRINT_SNAPSHOT);
  });
});
