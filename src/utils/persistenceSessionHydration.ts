import { PERSISTED_DATA_VERSION } from '../config/persistenceVersion';
import {
  LEGACY_DOMAIN_STORAGE_KEYS,
  getStorageKey,
  type StorageKey,
} from '../config/storageManifest';
import { persistenceSchemas, type PersistedSectionMap } from '../config/persistenceRegistry';
import type { PersistedData } from '../types/persistence';
import { nullToUndefinedDeep } from './nullToUndefinedDeep';
import { stripUnknownFieldsBySchema } from './persistenceLoadSanitization';
import { readSessionStorageValue } from './safeSessionStorage';

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
  migratedLegacyBirthdate: boolean;
};

const CURRENT_VERSION = PERSISTED_DATA_VERSION;

const isPersistedData = (value: unknown): value is PersistedData => {
  if (!value || typeof value !== 'object') return false;

  const obj = value as Record<string, unknown>;
  return typeof obj.version === 'string' && typeof obj.timestamp === 'number' && 'data' in obj;
};

const createEmptySectionsSnapshot = (): PersistedSectionsSnapshot => {
  return Object.keys(persistenceSchemas).reduce((acc, key) => {
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
      `${formatCount(summary.versionMismatchedSections.length, 'sektion', 'sektioner')} fra en aeldre version blev bevaret`
    );
  }

  if (summary.strippedUnknownFieldCount > 0) {
    parts.push(`${formatCount(summary.strippedUnknownFieldCount, 'foraeldet felt', 'foraeldede felter')} blev fjernet`);
  }

  if (summary.incompatibleSections.length > 0) {
    parts.push(
      `${formatCount(summary.incompatibleSections.length, 'sektion', 'sektioner')} kunne ikke overfoeres sikkert og blev ryddet`
    );
  }

  if (summary.corruptedSections.length > 0) {
    parts.push(`${formatCount(summary.corruptedSections.length, 'korrupt sektion', 'korrupte sektioner')} blev ryddet`);
  }

  if (summary.migratedLegacyBirthdate) {
    parts.push('Legacy-feltet foedselsdato blev flyttet til Stamdata');
  }

  if (parts.length === 0) {
    return null;
  }

  const type: SessionHydrationNotice['type'] =
    summary.incompatibleSections.length > 0 || summary.corruptedSections.length > 0 ? 'error' : 'warning';

  return {
    type,
    message: `Gemte data blev gennemgaaet ved opstart. ${parts.join('. ')}.`,
  };
};

const migrateLegacyFaellesPersondataIntoStamdata = (
  currentStamdata: PersistedSectionMap['stamdata'] | null,
  legacyRaw: unknown
): { stamdata: PersistedSectionMap['stamdata'] | null; didMigrate: boolean } => {
  const legacySchema = persistenceSchemas.stamdata.pick({ skadelidteFodselsdato: true });
  const parsedLegacy = legacySchema.safeParse(nullToUndefinedDeep(legacyRaw));
  if (!parsedLegacy.success || !parsedLegacy.data.skadelidteFodselsdato) {
    return { stamdata: currentStamdata, didMigrate: false };
  }

  const baseStamdata = currentStamdata ?? persistenceSchemas.stamdata.parse({});
  if (baseStamdata.skadelidteFodselsdato) {
    return { stamdata: currentStamdata, didMigrate: false };
  }

  return {
    didMigrate: true,
    stamdata: {
      ...baseStamdata,
      skadelidteFodselsdato: parsedLegacy.data.skadelidteFodselsdato,
    },
  };
};

export const buildSessionStorageHydrationPlan = (): SessionHydrationPlan => {
  const sections = createEmptySectionsSnapshot();
  const keysToRemove: string[] = [];
  const summary: HydrationSummary = {
    corruptedSections: [],
    versionMismatchedSections: [],
    incompatibleSections: [],
    strippedUnknownFieldCount: 0,
    migratedLegacyBirthdate: false,
  };

  for (const pageKey of Object.keys(persistenceSchemas) as StorageKey[]) {
    const storageKey = getStorageKey(pageKey);
    const stored = readSessionStorageValue(storageKey);
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
    const normalized = nullToUndefinedDeep(parsed.data);
    const stripped = stripUnknownFieldsBySchema(schema, normalized);
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
    if (parsed.version !== CURRENT_VERSION) {
      summary.versionMismatchedSections.push(pageKey);
    }
    summary.strippedUnknownFieldCount += stripped.unknownPaths.length;
  }

  const legacyStorageKey = LEGACY_DOMAIN_STORAGE_KEYS.faellesPersondata;
  const legacyRaw = readSessionStorageValue(legacyStorageKey);
  if (legacyRaw) {
    keysToRemove.push(legacyStorageKey);

    try {
      const parsedLegacy = JSON.parse(legacyRaw);
      if (isPersistedData(parsedLegacy)) {
        const migrated = migrateLegacyFaellesPersondataIntoStamdata(sections.stamdata, parsedLegacy.data);
        sections.stamdata = migrated.stamdata;
        summary.migratedLegacyBirthdate = migrated.didMigrate;
      }
    } catch {
      // Korrupt legacy-data ryddes altid; den maa ikke blokere startup.
    }
  }

  return {
    sections,
    keysToRemove,
    notice: createHydrationNotice(summary),
  };
};
