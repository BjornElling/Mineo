import { createHash } from 'node:crypto';
import { beregningsdataCatalog } from '../../data/catalog/beregningsdataCatalog';
import { defineCalculationData, defineCalculationDataCatalog } from '../../data/catalog/calculationDataCatalog';
import { kapitaliseringsTabelDataById } from '../../data/kapitalisering/kapitaliseringsTabeller';
import { overenskomstBeregningsdata } from '../../data/overenskomstRates';

const fingerprint = (value: unknown): string =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');

describe('calculationDataCatalog', () => {
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
      // (brugerbeslutning; `indskudte-loentillaeg-contract.md` §6). Payload'et er nu Store Bededag alene.
      'indskudte-loentillaeg': 'b253ea22c6f700fd78f0ac1f58fb931f5ec009bcbcf47bb049ca08505fb06acf',
      kapitaliseringsbekendtgoerelser: '9e5d18bdaf8b554717ce3ee22c73bc409bff2ac4c45fc28f840bb59e831d615b',
      kapitaliseringstabeller: 'c850fb5803f6bb7dc77e545c5d6fdd17ff6a87b5facdd9c7f34e4424ff29a7c9',
      'kl-loenaftaler': 'c75de1dc16462569b7fcfe4bab5860b4c978d50d0fdb68fe4d4580c66cda9780',
      'krl-satstabeller': '080e201d0300a4354e50ad939a698412cdc4d7af1764192cd79b19c0403e53d6',
      'lovbestemte-satser': '64fc2cb0626d361cd3260d2f904ffe489bc36b5d86c7f6ae64d6abe92bf96005',
      'offentlig-loen-kl': 'd6b006a41c0a896094f95ae6668d48f808010eb8ed135d769006362400643610',
      'offentlig-loen-rltn': '459d6e3bf7963bfda6c7f94b5a400c4a53c1c71598013649ae8ff59e04994305',
      overenskomster: 'd8aff9f4219b5f30496225fb57d1d9aaa76316515797f2fdbf678a15a58042f2',
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
      Object.entries(kapitaliseringsTabelDataById).map(([id, entry]) => [id, {
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

    expect(fingerprint(legacyShape)).toBe('64424efcf9193c0f4a35a95759e8a14c8c015129810011c25858f6c452c6ffab');
  });
});
