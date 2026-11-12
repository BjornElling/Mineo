import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  beregningsdataCatalog,
  beregningsdataSourceFilesById,
} from '../../data/catalog/beregningsdataCatalog';
import { defineCalculationData, defineCalculationDataCatalog } from '../../data/catalog/calculationDataCatalog';
import { kapitaliseringsTabelDataById } from '../../data/kapitalisering/kapitaliseringsTabeller';
import { overenskomstBeregningsdata } from '../../data/overenskomstRates';

const fingerprint = (value: unknown): string =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');

describe('calculationDataCatalog', () => {
  it('klassificerer hver autoritativ beregningsdatakilde præcis én gang', () => {
    const dataRoot = path.resolve(__dirname, '../../data');
    const infrastructureFiles = new Set([
      'catalog/beregningsdataCatalog.ts',
      'catalog/calculationDataCatalog.ts',
      'offentligLoenLookup.ts',
      'offentligLoenTypes.ts',
      'rateSeriesIntegrity.ts',
      'retsinfoLinks.ts',
      // Fælles forklaringstekst til UI og dokumenter, ingen beregningssatser.
      'statistikNotes.ts',
      'ydelsestyper.ts',
    ]);
    const listTsFiles = (directory: string): string[] => fs.readdirSync(directory, { withFileTypes: true })
      .flatMap((entry) => {
        const absolute = path.join(directory, entry.name);
        return entry.isDirectory() ? listTsFiles(absolute) : [absolute];
      })
      .filter((file) => file.endsWith('.ts'));
    const actualSources = listTsFiles(dataRoot)
      .map((file) => path.relative(dataRoot, file).replaceAll('\\', '/'))
      .filter((file) => !infrastructureFiles.has(file))
      // De enkelte kapitaliseringstabeller ejes samlet af indexet; 1:1-filværnet ligger
      // i kapitaliseringsbekendtgørelser.test.ts og fanger nye/udeladte tabelfiler.
      .filter((file) => !/^kapitalisering\/kapitaliseringsTabeller\/(?!index\.ts$).+\.ts$/.test(file))
      .sort();
    const registeredSources = Object.values(beregningsdataSourceFilesById).flat().sort();

    expect(new Set(registeredSources).size).toBe(registeredSources.length);
    expect(actualSources).toEqual(registeredSources);
    expect(Object.keys(beregningsdataSourceFilesById).sort())
      .toEqual(beregningsdataCatalog.map(({ id }) => id).sort());
  });

  it('fail-closer ved ugyldige metadata og duplikerede id\'er', () => {
    expect(() => defineCalculationData({
      id: '',
      provenance: { sources: ['Kilde'], maintenance: { method: 'manually_transcribed' } },
      coverage: { kind: 'year', from: 2025, through: 2024 },
      payload: [],
      validate: () => undefined,
    })).toThrow('id må ikke være tomt');

    const entry = defineCalculationData({
      id: 'test',
      provenance: { sources: ['Kilde'], maintenance: { method: 'manually_transcribed' } },
      coverage: { kind: 'year', from: 2024, through: 2025 },
      payload: [1],
      validate: () => undefined,
    });
    expect(() => defineCalculationDataCatalog([entry, entry])).toThrow('duplikeret id "test"');
  });

  it('bevarer alle autoritative payloads med konkrete golden-fingerprints', () => {
    beregningsdataCatalog.forEach((entry) => entry.assertIntegrity());
    const fingerprints = Object.fromEntries(
      beregningsdataCatalog.map((entry) => [entry.id, fingerprint(entry.payload)])
    );

    expect(fingerprints).toEqual({
      folkepensionsalder: '455f0c29b4338e14b6223781de8273e95857a76602fa000a8eeb08a45087db5b',
      'forhoejet-pensionsalder-events': 'fbe93439bc6e0fb02378d11e8648712e81dc41d03eaabf35aa1bbb64a86f8e9e',
      // Ændret 2026-07-31: `SAERLIGT_FERIETILLAEG_SATSTRAPPE` fjernet fra payload'et, fordi særligt
      // ferietillæg er et rent fremtidigt udviklingsprojekt og ikke må indregnes nogen steder
      // (udviklerbeslutning; `indskudte-loentillaeg-contract.md` §6). Payload'et er nu Store Bededag alene.
      'indskudte-loentillaeg': 'b253ea22c6f700fd78f0ac1f58fb931f5ec009bcbcf47bb049ca08505fb06acf',
      // Ændret 2026-11-12 (revision): ældste skadesinterval begynder 2004-01-01 (lov om arbejdsskadesikring),
      // og BEK 229/2014 har sin egen post fra 2014-03-15.
      kapitaliseringsbekendtgoerelser: '7d6e6db38e7afa49950fe02914e7157c73e77c83427905e3afe52498483b758e',
      // Ændret 2026-11-12 (revision): alle tabelfiler genereret ensartet fra kilde-PDF'erne. Indlæst: de
      // manglende tabeller for skader 2004-2007 (1221/2010 L-N, 1403/2011 J-N, 198/2015 L, 1700/2015 N) og
      // forsørgertab i 2014 (BEK 1339/2013); tilføjet BEK 229/2014; eksplicitte forsørgertabsvalg og
      // fuldstændige EET-årgange; tabeller for skader før 2004 flyttet til de begrundede udeladelser.
      kapitaliseringstabeller: '7686642a1c0b07e37bc85e3b36439c6eb2db75b9d086f8f1517a83685313295d',
      'kl-loenaftaler': 'c75de1dc16462569b7fcfe4bab5860b4c978d50d0fdb68fe4d4580c66cda9780',
      'krl-satstabeller': '080e201d0300a4354e50ad939a698412cdc4d7af1764192cd79b19c0403e53d6',
      'lovbestemte-satser': 'e30834b2ecd5a082c6a3b2c0be209e3118974914d224e268c05bc8cc2ec8f420',
      'offentlig-loen-kl': 'd6b006a41c0a896094f95ae6668d48f808010eb8ed135d769006362400643610',
      'offentlig-loen-rltn': '459d6e3bf7963bfda6c7f94b5a400c4a53c1c71598013649ae8ff59e04994305',
      // Ændret 2026-10-06: Faglærte-overenskomstens fritvalg er 0 i stedet for null (BB-275).
      overenskomster: '7475b2e049e7b08af92b7ac10b2cea1cca4841ed598aad4b4f151815b0e0898f',
      procesrenter: 'cc7eab66d41839b6996a2cca1eb7866434ad1ca07f3b4e102c71f3c687602150',
      'statistiske-loenindeks': 'df2ee1847d5944a7b601e4ad702f0d108adbf4a355cf9cd424666fe2931fd4af',
      sygedagpenge: '9df1d0da0107b334a33a747f0e1bfcaf99baa474dd6e2a6e62ec9ea697db0e6a',
    });
  });

  it('katalogiserer både private og offentlige overenskomstdata i samme payload', () => {
    const entry = beregningsdataCatalog.find(({ id }) => id === 'overenskomster');

    expect(entry?.payload).toBe(overenskomstBeregningsdata);
    expect(overenskomstBeregningsdata.privateOverenskomster.length).toBeGreaterThan(0);
    expect(overenskomstBeregningsdata.offentligeOverenskomster.length).toBeGreaterThan(0);
    expect(overenskomstBeregningsdata.offentligeOverenskomstSatser.length).toBeGreaterThan(0);
  });

  it('bevarer kapitaliseringsfaktorer og tabelvalg identisk med payloaden før katalogiseringen', () => {
    const legacyShape = Object.fromEntries(
      // Nye vejledninger ændrer ikke dette historiske facit fra før katalogiseringen.
      Object.entries(kapitaliseringsTabelDataById).filter(([id]) => id !== '10253/2026').map(([id, entry]) => [id, {
        kapitaliseringsId: entry.kapitaliseringsId,
        kapitaliseringsType: entry.kapitaliseringsType,
        erhvervsevnetabTabelvalg: entry.erhvervsevnetabTabelvalg,
        erhvervsevnetabTabeller: entry.erhvervsevnetabTabeller,
        erhvervsevnetabKoensopdelteTabeller: entry.erhvervsevnetabKoensopdelteTabeller,
        forsoergertabTabelvalg: entry.forsoergertabTabelvalg,
        forsoergertabTabeller: entry.forsoergertabTabeller,
        forsoergertabTabellerMaend: entry.forsoergertabTabellerMaend,
        forsoergertabTabellerKvinder: entry.forsoergertabTabellerKvinder,
        saerfaktorUnderToAarTilFpPerSkadesinterval: entry.saerfaktorUnderToAarTilFpPerSkadesinterval,
      }])
    );

    // Ændret 2026-11-12 (revision): se `kapitaliseringstabeller` i testen ovenfor.
    expect(fingerprint(legacyShape)).toBe('6f3b53ffe575eab88bad6eb82d4891456b22455ead54d13d4424ec5cf33d79a2');
  });
});
