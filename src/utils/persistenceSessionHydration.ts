import { PERSISTED_DATA_VERSION } from '../config/persistenceVersion';
import {
  getStorageKey,
  type StorageKey,
} from '../config/storageManifest';
import { PERSISTED_SECTION_KEYS, persistenceSchemas, type PersistedSectionMap } from '../config/persistenceRegistry';
import type { PersistedData } from '../types/persistence';
import { sanitizePersistedValueForSchema } from './persistenceLoadSanitization';
import { readSessionStorageValue } from './safeSessionStorage';
import { migratePersistedSectionValue } from './persistenceMigrations';

export type SessionHydrationNotice = { message: string; type: 'warning' | 'error' };
export type PersistedSectionsSnapshot = { [K in StorageKey]: PersistedSectionMap[K] | null };

type SessionHydrationPlan = {
  sections: PersistedSectionsSnapshot;
  keysToRemove: string[];
  notice: SessionHydrationNotice | null;
};

type HydrationSummary = {
  corruptedSections: StorageKey[];
  versionMismatchedSections: StorageKey[];
  incompatibleSections: StorageKey[];
  strippedUnknownFieldCount: number;
};

const isPersistedData = (value: unknown): value is PersistedData => {
  if (!value || typeof value !== 'object') return false;

  const obj = value as Record<string, unknown>;
  return typeof obj.version === 'string'
    && typeof obj.timestamp === 'number'
    && 'data' in obj
    && typeof obj.data === 'object'
    && obj.data !== null;
};

const createEmptySectionsSnapshot = (): PersistedSectionsSnapshot => {
  return PERSISTED_SECTION_KEYS.reduce((acc, key) => {
    acc[key as StorageKey] = null;
    return acc;
  }, {} as PersistedSectionsSnapshot);
};

const assignSection = <K extends StorageKey>(
  target: PersistedSectionsSnapshot,
  key: K,
  value: PersistedSectionMap[K] | null
): void => {
  (target as Record<StorageKey, unknown | null>)[key] = value;
};

const formatCount = (count: number, singular: string, plural: string): string => {
  return `${count} ${count === 1 ? singular : plural}`;
};

const createHydrationNotice = (summary: HydrationSummary): SessionHydrationNotice | null => {
  const parts: string[] = [];

  if (summary.versionMismatchedSections.length > 0) {
    parts.push(
      `${formatCount(summary.versionMismatchedSections.length, 'sektion', 'sektioner')} fra en anden dataversion blev valideret med den aktuelle struktur`
    );
  }

  if (summary.strippedUnknownFieldCount > 0) {
    parts.push(`${formatCount(summary.strippedUnknownFieldCount, 'forældet felt', 'forældede felter')} blev fjernet`);
  }

  if (summary.incompatibleSections.length > 0) {
    parts.push(
      `${formatCount(summary.incompatibleSections.length, 'sektion', 'sektioner')} kunne ikke overføres sikkert og blev ryddet`
    );
  }

  if (summary.corruptedSections.length > 0) {
    parts.push(`${formatCount(summary.corruptedSections.length, 'korrupt sektion', 'korrupte sektioner')} blev ryddet`);
  }

  if (parts.length === 0) {
    return null;
  }

  const type: SessionHydrationNotice['type'] =
    summary.incompatibleSections.length > 0 || summary.corruptedSections.length > 0 ? 'error' : 'warning';

  return {
    type,
    message: `Gemte data blev gennemgået ved opstart. ${parts.join('. ')}.`,
  };
};

const createStorageReadFailedNotice = (): SessionHydrationNotice => ({
  type: 'error',
  message: 'Gemte browserdata kunne ikke gennemgås ved opstart. Den aktive sag blev derfor startet uden sessiondata.',
});

export const buildSessionStorageHydrationPlan = (): SessionHydrationPlan => {
  const sections = createEmptySectionsSnapshot();
  const keysToRemove: string[] = [];
  const summary: HydrationSummary = {
    corruptedSections: [],
    versionMismatchedSections: [],
    incompatibleSections: [],
    strippedUnknownFieldCount: 0,
  };

  for (const pageKey of PERSISTED_SECTION_KEYS) {
    const storageKey = getStorageKey(pageKey);
    let stored: string | null;
    try {
      stored = readSessionStorageValue(storageKey);
    } catch {
      return {
        sections,
        keysToRemove: [],
        notice: createStorageReadFailedNotice(),
      };
    }
    if (!stored) continue;

    let parsed: unknown;
    try {
      parsed = JSON.parse(stored);
    } catch {
      keysToRemove.push(storageKey);
      summary.corruptedSections.push(pageKey);
      continue;
    }

    if (!isPersistedData(parsed)) {
      keysToRemove.push(storageKey);
      summary.corruptedSections.push(pageKey);
      continue;
    }

    const schema = persistenceSchemas[pageKey];
    const migrated = migratePersistedSectionValue(pageKey, parsed.data);
    const stripped = sanitizePersistedValueForSchema(schema, migrated.value);
    const validated = schema.safeParse(stripped.sanitized);

    if (!validated.success) {
      keysToRemove.push(storageKey);
      summary.incompatibleSections.push(pageKey);
      continue;
    }

    assignSection(sections, pageKey, validated.data);

    // Future structurally incompatible versions must add an explicit migrator step here
    // before validation. A version mismatch alone only means the section was preserved as-is
    // after sanitization + current-schema validation; it does not imply that a migration ran.
    if (parsed.version !== PERSISTED_DATA_VERSION) {
      summary.versionMismatchedSections.push(pageKey);
    }
    summary.strippedUnknownFieldCount += stripped.unknownPaths.length;
  }

  return {
    sections,
    keysToRemove,
    notice: createHydrationNotice(summary),
  };
};
