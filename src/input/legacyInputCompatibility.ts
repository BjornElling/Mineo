import type { StorageKey } from '../config/storageManifest';
import type { InvalidDraftsCache } from '../stores/inputRuntimeStore';
import {
  createFieldAddress,
  deserializeFieldAddress,
  serializeFieldAddress,
  type FieldAddress,
} from './fieldAddress';
import { resolveTopLevelFieldRef } from './catalog/productionInputCatalog';
import type { RejectedInputs } from './inputState';

/**
 * Midlertidig fase-3-adapter for de endnu ikke migrerede felt-callsites.
 * Sentinel-leddet gør adresserne entydigt genkendelige og dermed migrerbare i fase 4; ingen consumer
 * må fortolke dem som rigtige FieldRefs eller bruge dem uden for kompatibilitetsfacaden.
 */
const LEGACY_FIELD_PATH_SENTINEL = 'legacy-field-path';

export const createLegacyFieldAddress = (section: StorageKey, fieldPath: string): FieldAddress => {
  if (fieldPath === '' || fieldPath.trim() !== fieldPath) {
    throw new Error('Legacy-feltstien skal være ikke-tom og uden ydre mellemrum.');
  }
  return createFieldAddress({
    section,
    path: [{ kind: 'property', name: LEGACY_FIELD_PATH_SENTINEL }],
    field: fieldPath,
  });
};

/**
 * ÉT sandt sted for "hvor bor en rejected input for (section, fieldPath)". Et migreret top-level felt
 * (fieldPath === feltnavnet, ingen entity-sti) lagres nu på sin katalogvaliderede STRUKTURELLE adresse;
 * alt andet — tabelceller (`tableId:rowScope:rowId:colIndex`) og endnu ikke migrerede nested felter —
 * bruger fortsat sentinel-bro-adressen. Migration, skrivning og rydning deler denne resolver, så samme
 * felt aldrig kan optræde under to rejected-input-nøgler, og det legacy `invalidDrafts`-view forbliver
 * byte-identisk (den strukturelle top-level-adresse projiceres tilbage til `${section}.${feltnavn}`).
 *
 * Sentinel-grenen (og hele denne bro) fjernes, når celle-/nested-feltmotorerne selv adresserer strukturelt.
 */
export const resolveRejectedInputAddress = (section: StorageKey, fieldPath: string): FieldAddress => {
  const topLevel = resolveTopLevelFieldRef(section, fieldPath);
  return topLevel === null ? createLegacyFieldAddress(section, fieldPath) : topLevel.address;
};

export const readLegacyFieldPath = (address: FieldAddress): Readonly<{
  section: StorageKey;
  fieldPath: string;
}> | null => {
  if (
    address.path.length !== 1
    || address.path[0]?.kind !== 'property'
    || address.path[0].name !== LEGACY_FIELD_PATH_SENTINEL
  ) {
    return null;
  }
  return { section: address.section, fieldPath: address.field };
};

export const legacyInvalidDraftsToRejectedInputs = (cache: InvalidDraftsCache): RejectedInputs => {
  const entries: Array<readonly [string, { raw: string }]> = [];
  for (const [section, drafts] of Object.entries(cache) as Array<[StorageKey, Record<string, string>]>) {
    for (const [fieldPath, raw] of Object.entries(drafts)) {
      entries.push([serializeFieldAddress(resolveRejectedInputAddress(section, fieldPath)), { raw }]);
    }
  }
  return Object.fromEntries(entries);
};

export const rejectedInputsToLegacyInvalidDrafts = (
  rejectedInputs: RejectedInputs,
  createEmptyCache: () => InvalidDraftsCache
): InvalidDraftsCache => {
  const cache = createEmptyCache();
  for (const [serializedAddress, rejected] of Object.entries(rejectedInputs)) {
    const address = deserializeFieldAddress(serializedAddress);
    if (address === null) continue;
    const legacy = readLegacyFieldPath(address);
    if (legacy !== null) {
      // Endnu ikke migrerede felter/celler: legacy-bro-adressens fieldPath ER cache-nøglen.
      cache[legacy.section][legacy.fieldPath] = rejected.raw;
      continue;
    }
    // TRANSITIONEL BRO (sletteliste, fase 7): en migreret top-level scalar bruger nu sin strukturelle
    // adresse. For et top-level felt (tom path) ER feltnavnet identisk med det gamle fieldPath, så det
    // legacy invalidDrafts-view forbliver byte-identisk for alle endnu ikke migrerede read-consumers.
    // Strukturelle celle-adresser (path med entities) projiceres først, når celle-læsesiden er migreret.
    if (address.path.length === 0) {
      cache[address.section][address.field] = rejected.raw;
    }
  }
  return cache;
};

export type LegacyRejectedInputChange = Readonly<{
  pageKey: StorageKey;
  fieldPath: string;
  draft: string | null;
  expectedRaw?: string;
}>;

export const applyLegacyRejectedInputChanges = (
  rejectedInputs: RejectedInputs,
  changes: readonly LegacyRejectedInputChange[]
): RejectedInputs => {
  const next: Record<string, { raw: string }> = { ...rejectedInputs };
  for (const { pageKey, fieldPath, draft, expectedRaw } of changes) {
    const key = serializeFieldAddress(resolveRejectedInputAddress(pageKey, fieldPath));
    if (expectedRaw !== undefined && next[key]?.raw !== expectedRaw) continue;
    if (draft === null || draft === '') delete next[key];
    else next[key] = { raw: draft };
  }
  return next;
};
