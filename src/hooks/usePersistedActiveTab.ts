import React from 'react';
import { createActiveTabStorageKey } from '../config/storageManifest';
import {
  readOptionalSessionStorageValue,
  writeOptionalSessionStorageValue,
} from '../utils/safeSessionStorage';

export type UsePersistedActiveTabOptions<T extends string> = {
  /**
   * Unik nøgle pr. side (ikke del af .eo / persisted sections).
   * Brug fx route/page id: 'renteberegning', 'varigemen', 'erstatningsopgoerelse'.
   */
  readonly pageId: string;
  readonly allowedTabs: readonly T[];
  readonly defaultTab: T;
};

export type UsePersistedActiveTabReturn<T extends string> = {
  readonly activeTab: T;
  readonly setActiveTab: (next: T) => void;
  readonly isAllowedTab: (value: unknown) => value is T;
};

export const usePersistedActiveTab = <T extends string>(
  options: UsePersistedActiveTabOptions<T>
): UsePersistedActiveTabReturn<T> => {
  const { pageId, allowedTabs, defaultTab } = options;
  const allowedSet = React.useMemo(() => new Set<T>(allowedTabs), [allowedTabs]);
  const uiKey = React.useMemo(() => createActiveTabStorageKey(pageId), [pageId]);

  const isAllowedTab = React.useCallback(
    (value: unknown): value is T => typeof value === 'string' && allowedSet.has(value as T),
    [allowedSet]
  );

  const [activeTab, setActiveTabState] = React.useState<T>(() => {
    const persisted = readOptionalSessionStorageValue(uiKey) ?? undefined;
    if (persisted && isAllowedTab(persisted)) {
      return persisted;
    }

    return defaultTab;
  });

  React.useEffect(() => {
    // Persist altid seneste valg til UI-nøglen (session scoped).
    writeOptionalSessionStorageValue(uiKey, activeTab);
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
