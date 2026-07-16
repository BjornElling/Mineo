import type { StorageKey } from '../config/storageManifest';
import type { InvalidDraftsCache } from '../stores/inputRuntimeStore';
import {
  createFieldAddress,
  deserializeFieldAddress,
  serializeFieldAddress,
  type FieldAddress,
} from './fieldAddress';
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

/** Legacy-overfladen har én adresseform, indtil alle callsites kan udstede konkrete `FieldRef`s. */
export const resolveRejectedInputAddress = (section: StorageKey, fieldPath: string): FieldAddress =>
  createLegacyFieldAddress(section, fieldPath);

const createStructuralTopLevelAddress = (section: StorageKey, fieldPath: string): FieldAddress =>
  createFieldAddress({ section, path: [], field: fieldPath });

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
    const target = legacy ?? (address.path.length === 0
      ? { section: address.section, fieldPath: address.field }
      : null);
    if (target === null) continue;

    const existing = cache[target.section][target.fieldPath];
    if (existing !== undefined && existing !== rejected.raw) {
      throw new Error('Legacy input compatibility: samme felt findes med modstridende rejected input');
    }
    cache[target.section][target.fieldPath] = rejected.raw;
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
    const legacyKey = serializeFieldAddress(resolveRejectedInputAddress(pageKey, fieldPath));
    const structuralKey = serializeFieldAddress(createStructuralTopLevelAddress(pageKey, fieldPath));
    const legacyRaw = next[legacyKey]?.raw;
    const structuralRaw = next[structuralKey]?.raw;
    if (legacyRaw !== undefined && structuralRaw !== undefined && legacyRaw !== structuralRaw) {
      throw new Error('Legacy input compatibility: samme felt findes med modstridende rejected input');
    }
    const currentRaw = legacyRaw ?? structuralRaw;
    if (expectedRaw !== undefined && currentRaw !== expectedRaw) continue;

    // En tidligere fase-4-build kan have skrevet top-level input strukturelt. En eksplicit legacy-write
    // eller -clear samler begge repræsentationer atomisk på sentinel-nøglen, så der aldrig opstår twins.
    delete next[legacyKey];
    delete next[structuralKey];
    if (draft !== null && draft !== '') next[legacyKey] = { raw: draft };
  }
  return next;
};
