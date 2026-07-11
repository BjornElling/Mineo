import { __createTestStore, createEmptyInvalidDraftsCache } from '../../stores/formPersistenceStore';
import { createEmptyInvalidDraftsCacheForStorage } from '../../utils/invalidDraftsStorage';
import { PERSISTED_SECTION_KEYS } from '../../config/persistenceRegistry';

const SORTED_KEYS = [...PERSISTED_SECTION_KEYS].sort();

const keysOf = (record: Record<string, unknown>): string[] => Object.keys(record).sort();

describe('formPersistenceStore keyed-slice factory', () => {
  it('every slice cache and revision map covers exactly the full section-key set', () => {
    const state = __createTestStore().getState();

    expect(keysOf(state.sections)).toEqual(SORTED_KEYS);
    expect(keysOf(state.fieldErrors)).toEqual(SORTED_KEYS);
    expect(keysOf(state.invalidDrafts)).toEqual(SORTED_KEYS);
    expect(keysOf(state.sectionRevisions)).toEqual(SORTED_KEYS);
    expect(keysOf(state.fieldErrorRevisions)).toEqual(SORTED_KEYS);
    expect(keysOf(state.invalidDraftRevisions)).toEqual(SORTED_KEYS);
  });

  it('all revision maps start at zero for every key', () => {
    const state = __createTestStore().getState();
    for (const key of SORTED_KEYS) {
      expect(state.sectionRevisions[key as keyof typeof state.sectionRevisions]).toBe(0);
      expect(state.fieldErrorRevisions[key as keyof typeof state.fieldErrorRevisions]).toBe(0);
      expect(state.invalidDraftRevisions[key as keyof typeof state.invalidDraftRevisions]).toBe(0);
    }
  });

  it('empty caches use the expected per-slice default value', () => {
    const state = __createTestStore().getState();
    for (const key of SORTED_KEYS) {
      expect(state.sections[key as keyof typeof state.sections]).toBeNull();
      expect(state.fieldErrors[key as keyof typeof state.fieldErrors]).toEqual({});
      expect(state.invalidDrafts[key as keyof typeof state.invalidDrafts]).toEqual({});
    }
  });

  it('each cache key gets a distinct object (no shared reference across keys)', () => {
    const cache = createEmptyInvalidDraftsCache();
    const [first, second] = SORTED_KEYS;
    expect(cache[first as keyof typeof cache]).not.toBe(cache[second as keyof typeof cache]);
  });

  it('two invocations return independent objects (mutation isolation)', () => {
    const a = createEmptyInvalidDraftsCache();
    const b = createEmptyInvalidDraftsCache();
    expect(a).not.toBe(b);
    a.stamdata.someField = 'x';
    expect(b.stamdata).toEqual({});
  });

  it('the storage-facing empty cache is the same canonical constructor', () => {
    // Beviser at den tidligere fjerde parallelle tom-cache-kopi nu deler én kilde.
    expect(createEmptyInvalidDraftsCacheForStorage()).toEqual(createEmptyInvalidDraftsCache());
  });
});
