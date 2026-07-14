// @vitest-environment jsdom
import {
  createEmptyInvalidDraftsCacheForStorage,
  readInvalidDraftsFromStorage,
  serializeInvalidDraftsCache,
  writeInvalidDraftsToStorage,
} from '../../utils/invalidDraftsStorage';
import { invalidDraftsCacheSchema } from '../../schemas/invalidDraftsSchema';
import { getInvalidDraftsStorageKey } from '../../config/storageManifest';
import { INVALID_DRAFTS_ENVELOPE_VERSION } from '../../config/invalidDraftsVersion';

describe('invalidDraftsStorage', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('round-trip: skriv → læs gendanner cachen (overlever F5)', () => {
    const cache = createEmptyInvalidDraftsCacheForStorage();
    cache.stamdata = { skadedato: '12.x.20' };
    cache.satser = { aargang: 'abc' };
    writeInvalidDraftsToStorage(cache);

    const { cache: read, shouldRemove } = readInvalidDraftsFromStorage();
    expect(shouldRemove).toBe(false);
    expect(read.stamdata).toEqual({ skadedato: '12.x.20' });
    expect(read.satser).toEqual({ aargang: 'abc' });
    // Sektioner uden entries forbliver tomme efter round-trip
    expect(read.renteberegning).toEqual({});
  });

  it('tom cache fjerner sessionStorage-nøglen', () => {
    const cache = createEmptyInvalidDraftsCacheForStorage();
    cache.stamdata = { skadedato: 'x' };
    writeInvalidDraftsToStorage(cache);
    expect(sessionStorage.getItem(getInvalidDraftsStorageKey())).not.toBeNull();

    writeInvalidDraftsToStorage(createEmptyInvalidDraftsCacheForStorage());
    expect(sessionStorage.getItem(getInvalidDraftsStorageKey())).toBeNull();
  });

  it('manglende nøgle giver tom cache uden cleanup-flag', () => {
    const { cache, shouldRemove } = readInvalidDraftsFromStorage();
    expect(shouldRemove).toBe(false);
    expect(cache.stamdata).toEqual({});
  });

  it('korrupt JSON droppes fail-closed med cleanup-flag', () => {
    sessionStorage.setItem(getInvalidDraftsStorageKey(), '{ ikke gyldig json');
    const { cache, shouldRemove } = readInvalidDraftsFromStorage();
    expect(shouldRemove).toBe(true);
    expect(cache.stamdata).toEqual({});
  });

  it('ukendt envelope-version droppes fail-closed', () => {
    sessionStorage.setItem(
      getInvalidDraftsStorageKey(),
      JSON.stringify({ version: 'invalid-drafts-v99', data: { stamdata: { skadedato: 'x' } } })
    );
    const { cache, shouldRemove } = readInvalidDraftsFromStorage();
    expect(shouldRemove).toBe(true);
    expect(cache.stamdata).toEqual({});
  });

  it('migrerer den tidligere numeriske PERSISTED_DATA_VERSION-envelope uden datatab', () => {
    sessionStorage.setItem(
      getInvalidDraftsStorageKey(),
      JSON.stringify({ version: '3.8', data: { stamdata: { skadedato: '12.x.20' } } })
    );

    const { cache, shouldRemove } = readInvalidDraftsFromStorage();

    expect(shouldRemove).toBe(false);
    expect(cache.stamdata).toEqual({ skadedato: '12.x.20' });
  });

  it('ugyldig form (tom værdi-streng) droppes af schemaet', () => {
    sessionStorage.setItem(
      getInvalidDraftsStorageKey(),
      JSON.stringify({ version: INVALID_DRAFTS_ENVELOPE_VERSION, data: { stamdata: { skadedato: '' } } })
    );
    const { cache, shouldRemove } = readInvalidDraftsFromStorage();
    expect(shouldRemove).toBe(true);
    expect(cache.stamdata).toEqual({});
  });

  it('serialize stripper tomme sektioner', () => {
    const cache = createEmptyInvalidDraftsCacheForStorage();
    cache.stamdata = { skadedato: 'x' };
    const serialized = JSON.parse(serializeInvalidDraftsCache(cache));
    expect(serialized.version).toBe(INVALID_DRAFTS_ENVELOPE_VERSION);
    expect(serialized.data).toEqual({ stamdata: { skadedato: 'x' } });
    expect('satser' in serialized.data).toBe(false);
  });
});

describe('invalidDraftsCacheSchema', () => {
  it('accepterer Record<fieldPath, ikke-tom streng>', () => {
    const result = invalidDraftsCacheSchema.safeParse({ stamdata: { skadedato: '12.x.20' } });
    expect(result.success).toBe(true);
  });

  it('afviser tom værdi-streng', () => {
    const result = invalidDraftsCacheSchema.safeParse({ stamdata: { skadedato: '' } });
    expect(result.success).toBe(false);
  });

  it('partial: behøver ikke alle sektions-nøgler', () => {
    const result = invalidDraftsCacheSchema.safeParse({});
    expect(result.success).toBe(true);
  });
});
