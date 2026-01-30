import React from 'react';
import { type StorageKey, getStorageKey } from '../config/storageManifest';

type LegacyPersistedActiveTabSource = {
  /**
   * Legacy: tidligere blev activeTab gemt inde i en persisted form-sektion.
   * Vi læser den kun som engangs-migrering hvis UI-nøglen endnu ikke findes.
   */
  readonly persistedPageKey: StorageKey;
  readonly fieldName: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return !!value && typeof value === 'object' && !Array.isArray(value);
};

const readSessionStorage = (key: string): string | undefined => {
  try {
    const value = sessionStorage.getItem(key);
    return value ?? undefined;
  } catch {
    return undefined;
  }
};

const writeSessionStorage = (key: string, value: string): void => {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    // Fail-safe: hvis sessionStorage fejler, falder vi tilbage til in-memory state.
  }
};

const readLegacyActiveTab = <T extends string>(
  source: LegacyPersistedActiveTabSource,
  allowed: ReadonlySet<T>
): T | undefined => {
  const storageKey = getStorageKey(source.persistedPageKey);
  const raw = readSessionStorage(storageKey);
  if (!raw) return undefined;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return undefined;
  }

  if (!isRecord(parsed)) return undefined;
  const data = parsed.data;
  if (!isRecord(data)) return undefined;

  const value = data[source.fieldName];
  if (typeof value !== 'string') return undefined;
  return allowed.has(value as T) ? (value as T) : undefined;
};

export type UsePersistedActiveTabOptions<T extends string> = {
  /**
   * Unik nøgle pr. side (ikke del af .eo / persisted sections).
   * Brug fx route/page id: 'renteberegning', 'varigemen', 'erstatningsopgoerelse'.
   */
  readonly pageId: string;
  readonly allowedTabs: readonly T[];
  readonly defaultTab: T;
  readonly legacySource?: LegacyPersistedActiveTabSource;
};

export type UsePersistedActiveTabReturn<T extends string> = {
  readonly activeTab: T;
  readonly setActiveTab: (next: T) => void;
  readonly isAllowedTab: (value: unknown) => value is T;
};

export const usePersistedActiveTab = <T extends string>(
  options: UsePersistedActiveTabOptions<T>
): UsePersistedActiveTabReturn<T> => {
  const { pageId, allowedTabs, defaultTab, legacySource } = options;
  const allowedSet = React.useMemo(() => new Set<T>(allowedTabs), [allowedTabs]);
  const uiKey = React.useMemo(() => `mineo_ui_activeTab_${pageId}`, [pageId]);

  const isAllowedTab = React.useCallback(
    (value: unknown): value is T => typeof value === 'string' && allowedSet.has(value as T),
    [allowedSet]
  );

  const [activeTab, setActiveTabState] = React.useState<T>(() => {
    const persisted = readSessionStorage(uiKey);
    if (persisted && isAllowedTab(persisted)) {
      return persisted;
    }

    if (legacySource) {
      const legacy = readLegacyActiveTab(legacySource, allowedSet);
      if (legacy) {
        return legacy;
      }
    }

    return defaultTab;
  });

  React.useEffect(() => {
    // Persist altid seneste valg til UI-nøglen (session scoped).
    writeSessionStorage(uiKey, activeTab);
  }, [uiKey, activeTab]);

  const setActiveTab = React.useCallback(
    (next: T) => {
      if (!allowedSet.has(next)) {
        return;
      }
      setActiveTabState(next);
    },
    [allowedSet]
  );

  return { activeTab, setActiveTab, isAllowedTab };
};

