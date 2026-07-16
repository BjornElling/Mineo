import {
  applyLegacyRejectedInputChanges,
  createLegacyFieldAddress,
  legacyInvalidDraftsToRejectedInputs,
  readLegacyFieldPath,
  rejectedInputsToLegacyInvalidDrafts,
  resolveRejectedInputAddress,
} from '../../input/legacyInputCompatibility';
import { deserializeFieldAddress, serializeFieldAddress } from '../../input/fieldAddress';
import { satserAargangBinding } from '../../input/catalog/satserInputBindings';
import { createEmptyInvalidDraftsCache } from '../../stores/inputRuntimeStore';

describe('legacy rejected-input-adressering', () => {
  const TOP_LEVEL_SECTION = 'satser' as const;
  const TOP_LEVEL_FIELD = 'aargang';
  const CELL_FIELD_PATH = 'oevrigeKravPerioder::row-1:2';

  it('bruger sentinel-adressen entydigt for både top-level felter og celler', () => {
    for (const [section, fieldPath] of [
      [TOP_LEVEL_SECTION, TOP_LEVEL_FIELD],
      ['erstatningsopgoerelse', CELL_FIELD_PATH],
    ] as const) {
      const address = resolveRejectedInputAddress(section, fieldPath);
      expect(readLegacyFieldPath(address)).toEqual({ section, fieldPath });
      expect(serializeFieldAddress(address)).toBe(
        serializeFieldAddress(createLegacyFieldAddress(section, fieldPath))
      );
    }
  });

  it('skriver og rydder samme sentinel-nøgle uden twins', () => {
    const written = applyLegacyRejectedInputChanges({}, [
      { pageKey: TOP_LEVEL_SECTION, fieldPath: TOP_LEVEL_FIELD, draft: '20x' },
    ]);
    expect(Object.keys(written)).toHaveLength(1);
    expect(readLegacyFieldPath(deserializeFieldAddress(Object.keys(written)[0]!)!)).toEqual({
      section: TOP_LEVEL_SECTION,
      fieldPath: TOP_LEVEL_FIELD,
    });

    const cleared = applyLegacyRejectedInputChanges(written, [
      { pageKey: TOP_LEVEL_SECTION, fieldPath: TOP_LEVEL_FIELD, draft: null },
    ]);
    expect(cleared).toEqual({});
  });

  it('flytter en eksisterende strukturel top-level entry tabsfrit til sentinel ved write', () => {
    const structuralKey = serializeFieldAddress(satserAargangBinding.createRef().address);
    const migrated = applyLegacyRejectedInputChanges({ [structuralKey]: { raw: '20x' } }, [
      { pageKey: TOP_LEVEL_SECTION, fieldPath: TOP_LEVEL_FIELD, draft: '20y', expectedRaw: '20x' },
    ]);

    expect(migrated).toEqual({
      [serializeFieldAddress(createLegacyFieldAddress(TOP_LEVEL_SECTION, TOP_LEVEL_FIELD))]: { raw: '20y' },
    });
  });

  it('rydder en eksisterende strukturel top-level entry med expectedRaw-beskyttelse', () => {
    const structuralKey = serializeFieldAddress(satserAargangBinding.createRef().address);
    const existing = { [structuralKey]: { raw: '20x' } };

    expect(applyLegacyRejectedInputChanges(existing, [
      { pageKey: TOP_LEVEL_SECTION, fieldPath: TOP_LEVEL_FIELD, draft: null, expectedRaw: 'stale' },
    ])).toEqual(existing);
    expect(applyLegacyRejectedInputChanges(existing, [
      { pageKey: TOP_LEVEL_SECTION, fieldPath: TOP_LEVEL_FIELD, draft: null, expectedRaw: '20x' },
    ])).toEqual({});
  });

  it('afviser modstridende twins frem for at vælge en værdi i stilhed', () => {
    const legacyKey = serializeFieldAddress(createLegacyFieldAddress(TOP_LEVEL_SECTION, TOP_LEVEL_FIELD));
    const structuralKey = serializeFieldAddress(satserAargangBinding.createRef().address);
    const twins = {
      [legacyKey]: { raw: '20x' },
      [structuralKey]: { raw: '20y' },
    };

    expect(() => applyLegacyRejectedInputChanges(twins, [
      { pageKey: TOP_LEVEL_SECTION, fieldPath: TOP_LEVEL_FIELD, draft: null },
    ])).toThrow('modstridende rejected input');
    expect(() => rejectedInputsToLegacyInvalidDrafts(twins, createEmptyInvalidDraftsCache))
      .toThrow('modstridende rejected input');
  });

  it('migrerer legacy-cache til sentinel og round-tripper byte-identisk', () => {
    const legacyCache = createEmptyInvalidDraftsCache();
    legacyCache[TOP_LEVEL_SECTION][TOP_LEVEL_FIELD] = '20x';
    legacyCache.erstatningsopgoerelse[CELL_FIELD_PATH] = '..';

    const rejected = legacyInvalidDraftsToRejectedInputs(legacyCache);
    expect(Object.keys(rejected).every((key) => readLegacyFieldPath(deserializeFieldAddress(key)!) !== null)).toBe(true);

    const view = rejectedInputsToLegacyInvalidDrafts(rejected, createEmptyInvalidDraftsCache);
    expect(view[TOP_LEVEL_SECTION][TOP_LEVEL_FIELD]).toBe('20x');
    expect(view.erstatningsopgoerelse[CELL_FIELD_PATH]).toBe('..');
  });
});
