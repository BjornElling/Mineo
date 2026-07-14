import { PERSISTED_SECTION_KEYS } from '../config/persistenceRegistry';
import { getInvalidDraftsStorageKey, type StorageKey } from '../config/storageManifest';
import {
  INVALID_DRAFTS_ENVELOPE_VERSION,
  isLegacyInvalidDraftsEnvelopeVersion,
} from '../config/invalidDraftsVersion';
import { invalidDraftsCacheSchema } from '../schemas/invalidDraftsSchema';
import { createEmptyInvalidDraftsCache, type InvalidDraftsCache } from '../stores/formPersistenceStore';
import {
  readSessionStorageValue,
  removeSessionStorageValue,
  writeSessionStorageValue,
} from './safeSessionStorage';

/**
 * Serialisering + hydrering af `invalidDrafts`-recovery-kanalen til/fra dens dedikerede
 * sessionStorage-nøgle (jf. persistence-contract.md §11).
 *
 * Envelopen har sin egen version, fordi feltadresser og canonical sektionsschemas udvikler sig
 * uafhængigt. Legacy-enveloper, der bar en numerisk `PERSISTED_DATA_VERSION`, accepteres kun gennem
 * den eksplicitte, tabsfri migration i `readInvalidDraftsFromStorage`.
 */
type InvalidDraftsEnvelope = {
  version: string;
  data: Record<string, Record<string, string>>;
};

// Deler den kanoniske konstruktor fra formPersistenceStore, så der ikke findes en fjerde parallel
// tom-cache-kopi. Navnet bevares som det storage-lokale indgangspunkt.
export const createEmptyInvalidDraftsCacheForStorage = (): InvalidDraftsCache => createEmptyInvalidDraftsCache();

const isEnvelope = (value: unknown): value is InvalidDraftsEnvelope => {
  if (!value || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;
  return typeof obj.version === 'string'
    && typeof obj.data === 'object'
    && obj.data !== null
    && !Array.isArray(obj.data);
};

const hasAnyEntry = (cache: InvalidDraftsCache): boolean => {
  return PERSISTED_SECTION_KEYS.some((key) => Object.keys(cache[key]).length > 0);
};

const stripEmptySections = (cache: InvalidDraftsCache): Record<string, Record<string, string>> => {
  const data: Record<string, Record<string, string>> = {};
  for (const key of PERSISTED_SECTION_KEYS) {
    if (Object.keys(cache[key]).length > 0) {
      data[key] = { ...cache[key] };
    }
  }
  return data;
};

export const serializeInvalidDraftsCache = (cache: InvalidDraftsCache): string => {
  const envelope: InvalidDraftsEnvelope = {
    version: INVALID_DRAFTS_ENVELOPE_VERSION,
    data: stripEmptySections(cache),
  };
  return JSON.stringify(envelope);
};

/**
 * Skriv cachen til sessionStorage. Er cachen tom, fjernes nøglen helt i stedet for at skrive en
 * tom envelope (holder storage rent).
 */
export const writeInvalidDraftsToStorage = (cache: InvalidDraftsCache): void => {
  const storageKey = getInvalidDraftsStorageKey();
  if (!hasAnyEntry(cache)) {
    removeSessionStorageValue(storageKey);
    return;
  }
  writeSessionStorageValue(storageKey, serializeInvalidDraftsCache(cache));
};

export const removeInvalidDraftsFromStorage = (): void => {
  removeSessionStorageValue(getInvalidDraftsStorageKey());
};

/**
 * Læs + valider cachen fra sessionStorage. Returnerer altid en fuld cache (alle sektions-nøgler).
 * Ved manglende nøgle, korrupt JSON, ukendt form eller versions-mismatch returneres en tom cache,
 * og `shouldRemove` markerer at den ugyldige nøgle bør ryddes som efterfølgende cleanup.
 */
export const readInvalidDraftsFromStorage = (): { cache: InvalidDraftsCache; shouldRemove: boolean } => {
  const empty = createEmptyInvalidDraftsCacheForStorage();
  const storageKey = getInvalidDraftsStorageKey();

  let stored: string | null;
  try {
    stored = readSessionStorageValue(storageKey);
  } catch {
    return { cache: empty, shouldRemove: false };
  }
  if (!stored) return { cache: empty, shouldRemove: false };

  let parsed: unknown;
  try {
    parsed = JSON.parse(stored);
  } catch {
    return { cache: empty, shouldRemove: true };
  }

  if (
    !isEnvelope(parsed)
    || (
      parsed.version !== INVALID_DRAFTS_ENVELOPE_VERSION
      && !isLegacyInvalidDraftsEnvelopeVersion(parsed.version)
    )
  ) {
    return { cache: empty, shouldRemove: true };
  }

  const validated = invalidDraftsCacheSchema.safeParse(parsed.data);
  if (!validated.success) {
    return { cache: empty, shouldRemove: true };
  }

  const cache = createEmptyInvalidDraftsCacheForStorage();
  for (const key of PERSISTED_SECTION_KEYS as StorageKey[]) {
    const section = validated.data[key];
    if (section) {
      cache[key] = { ...section };
    }
  }
  return { cache, shouldRemove: false };
};
