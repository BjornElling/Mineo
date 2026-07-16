import {
  applyLegacyRejectedInputChanges,
  createLegacyFieldAddress,
  legacyInvalidDraftsToRejectedInputs,
  readLegacyFieldPath,
  rejectedInputsToLegacyInvalidDrafts,
  resolveRejectedInputAddress,
} from '../../input/legacyInputCompatibility';
import { deserializeFieldAddress, serializeFieldAddress } from '../../input/fieldAddress';
import { resolveTopLevelFieldRef } from '../../input/catalog/productionInputCatalog';
import { createEmptyInvalidDraftsCache } from '../../stores/inputRuntimeStore';

/**
 * Fase 4: afsluttet ugyldigt input for et migreret TOP-LEVEL felt lagres nu på feltets katalog-
 * validerede STRUKTURELLE adresse (ikke sentinel-broen), mens celler/nested felter fortsat bruger
 * sentinel-adressen. `resolveRejectedInputAddress` er det ene sande sted for beslutningen, delt af
 * migration, skrivning og rydning — så et felt aldrig kan optræde under to rejected-input-nøgler, og
 * det legacy `invalidDrafts`-view forbliver byte-identisk. Dette låser skiftet og forhindrer regression
 * (fx genindførsel af `stripCoexistingLegacyRejectedTwin`-broen).
 */
describe('resolveRejectedInputAddress (top-level → strukturel, celle/nested → sentinel)', () => {
  const TOP_LEVEL_SECTION = 'satser' as const;
  const TOP_LEVEL_FIELD = 'aargang';
  // Cellenøgle (tableId:rowScope:rowId:colIndex) er aldrig et registreret top-level feltnavn.
  const CELL_FIELD_PATH = 'oevrigeKravPerioder::row-1:2';

  it('routes et migreret top-level felt til dets strukturelle adresse (tom sti, ingen sentinel)', () => {
    const address = resolveRejectedInputAddress(TOP_LEVEL_SECTION, TOP_LEVEL_FIELD);
    expect(address.path).toEqual([]);
    expect(address.field).toBe(TOP_LEVEL_FIELD);
    expect(readLegacyFieldPath(address)).toBeNull();

    const ref = resolveTopLevelFieldRef(TOP_LEVEL_SECTION, TOP_LEVEL_FIELD);
    expect(ref).not.toBeNull();
    expect(serializeFieldAddress(address)).toBe(serializeFieldAddress(ref!.address));
  });

  it('routes en celle/nested-feltsti til sentinel-bro-adressen', () => {
    const address = resolveRejectedInputAddress('erstatningsopgoerelse', CELL_FIELD_PATH);
    const legacy = readLegacyFieldPath(address);
    expect(legacy).toEqual({ section: 'erstatningsopgoerelse', fieldPath: CELL_FIELD_PATH });
    expect(serializeFieldAddress(address)).toBe(
      serializeFieldAddress(createLegacyFieldAddress('erstatningsopgoerelse', CELL_FIELD_PATH))
    );
  });

  it('applyLegacyRejectedInputChanges skriver top-level under den strukturelle adresse med identisk view', () => {
    const rejected = applyLegacyRejectedInputChanges({}, [
      { pageKey: TOP_LEVEL_SECTION, fieldPath: TOP_LEVEL_FIELD, draft: '20x' },
    ]);
    const [key] = Object.keys(rejected);
    expect(deserializeFieldAddress(key)?.path).toEqual([]);
    expect(readLegacyFieldPath(deserializeFieldAddress(key)!)).toBeNull();

    // Det legacy invalidDrafts-view er byte-identisk med den gamle sentinel-repræsentation.
    const view = rejectedInputsToLegacyInvalidDrafts(rejected, createEmptyInvalidDraftsCache);
    expect(view[TOP_LEVEL_SECTION][TOP_LEVEL_FIELD]).toBe('20x');
  });

  it('en write efterfulgt af en clear rammer SAMME nøgle (ingen sentinel-tvilling efterlades)', () => {
    const written = applyLegacyRejectedInputChanges({}, [
      { pageKey: TOP_LEVEL_SECTION, fieldPath: TOP_LEVEL_FIELD, draft: '20x' },
    ]);
    expect(Object.keys(written)).toHaveLength(1);
    const cleared = applyLegacyRejectedInputChanges(written, [
      { pageKey: TOP_LEVEL_SECTION, fieldPath: TOP_LEVEL_FIELD, draft: null },
    ]);
    expect(cleared).toEqual({});
  });

  it('migration (legacyInvalidDraftsToRejectedInputs) routes top-level strukturelt og celler sentinelt med identisk round-trip', () => {
    const legacyCache = createEmptyInvalidDraftsCache();
    legacyCache[TOP_LEVEL_SECTION][TOP_LEVEL_FIELD] = '20x';
    legacyCache.erstatningsopgoerelse[CELL_FIELD_PATH] = '..';

    const rejected = legacyInvalidDraftsToRejectedInputs(legacyCache);

    const topLevelEntry = Object.keys(rejected).find(
      (key) => deserializeFieldAddress(key)?.section === TOP_LEVEL_SECTION
    );
    const cellEntry = Object.keys(rejected).find(
      (key) => readLegacyFieldPath(deserializeFieldAddress(key)!)?.fieldPath === CELL_FIELD_PATH
    );
    expect(deserializeFieldAddress(topLevelEntry!)?.path).toEqual([]);
    expect(readLegacyFieldPath(deserializeFieldAddress(topLevelEntry!)!)).toBeNull();
    expect(cellEntry).toBeDefined();

    const view = rejectedInputsToLegacyInvalidDrafts(rejected, createEmptyInvalidDraftsCache);
    expect(view[TOP_LEVEL_SECTION][TOP_LEVEL_FIELD]).toBe('20x');
    expect(view.erstatningsopgoerelse[CELL_FIELD_PATH]).toBe('..');
  });
});
