import { PERSISTED_SECTION_KEYS } from '../config/persistenceRegistry';
import { getInvalidDraftsStorageKey, type StorageKey } from '../config/storageManifest';
import {
  INVALID_DRAFTS_ENVELOPE_VERSION,
  isLegacyInvalidDraftsEnvelopeVersion,
} from '../config/invalidDraftsVersion';
import { invalidDraftsCacheSchema } from '../schemas/invalidDraftsSchema';
import { createEmptyInvalidDraftsCache, type InvalidDraftsCache } from '../stores/inputRuntimeStore';
import { readSessionStorageValue } from './safeSessionStorage';

/**
 * Legacy-reader for `invalidDrafts`-recovery-kanalen under fase-3-startupmigrationen.
 *
 * Envelopen har sin egen version, fordi feltadresser og canonical sektionsschemas udvikler sig
 * uafhængigt. Legacy-enveloper, der bar en numerisk `PERSISTED_DATA_VERSION`, accepteres kun gennem
 * den eksplicitte, tabsfri migration i `readInvalidDraftsFromStorage`.
 */
type InvalidDraftsEnvelope = {
  version: string;
  data: Record<string, Record<string, string>>;
};

// Deler fase-3-runtimekernens konstruktor, så startupmigrationen ikke har en parallel tom-cache-kopi.
// Navnet bevares som det storage-lokale indgangspunkt, indtil legacy-readeren slettes i fase 7.
export const createEmptyInvalidDraftsCacheForStorage = (): InvalidDraftsCache => createEmptyInvalidDraftsCache();

const isEnvelope = (value: unknown): value is InvalidDraftsEnvelope => {
  if (!value || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;
  return typeof obj.version === 'string'
    && typeof obj.data === 'object'
    && obj.data !== null
    && !Array.isArray(obj.data);
};

/**
 * Læs + valider legacy-cachen. Current runtime må aldrig skrive denne nøgle.
 * Ved manglende nøgle, korrupt JSON, ukendt form eller versions-mismatch returneres en tom cache,
 * og `shouldRemove` markerer at den ugyldige nøgle bør ryddes som efterfølgende cleanup.
 */
export const parseInvalidDraftsStorageValue = (
  stored: string | null
): { cache: InvalidDraftsCache; shouldRemove: boolean } => {
  const empty = createEmptyInvalidDraftsCacheForStorage();
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

export const readInvalidDraftsFromStorage = (): { cache: InvalidDraftsCache; shouldRemove: boolean } =>
  parseInvalidDraftsStorageValue(readSessionStorageValue(getInvalidDraftsStorageKey()));
