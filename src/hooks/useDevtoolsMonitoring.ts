import React from 'react';
import type { Location } from 'react-router-dom';
import {
  getDevtoolsIssueSnapshot,
  startDevtoolsMonitor,
  subscribeDevtoolsIssues,
  setDevtoolsRoute,
  type DevtoolsIssueSnapshot,
} from '../utils/devtoolsMonitor';
import type { BugReportExtraSection } from '../utils/bugReport';
import { persistenceSchemas, type PersistedSectionKey } from '../config/persistenceRegistry';
import { UI_STORAGE_KEYS } from '../config/storageManifest';
import {
  readOptionalSessionStorageValue,
  writeOptionalSessionStorageValue,
} from '../utils/safeSessionStorage';

const parseSessionJson = (value: string | null): unknown => {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

const parseNonNegativeInteger = (value: string | null): number | null => {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
};

type UseDevtoolsMonitoringArgs = {
  readPersistedSection: <K extends PersistedSectionKey>(pageKey: K) => unknown;
  getSectionFieldIssues: <K extends PersistedSectionKey>(pageKey: K) => unknown;
  location: Location;
};

type UseDevtoolsMonitoringResult = {
  devtoolsSnapshot: DevtoolsIssueSnapshot | null;
  devtoolsNoticeVisible: boolean;
  dismissDevtools: () => void;
  getExtraSections: () => BugReportExtraSection[];
};

export const useDevtoolsMonitoring = ({
  readPersistedSection,
  getSectionFieldIssues,
  location,
}: UseDevtoolsMonitoringArgs): UseDevtoolsMonitoringResult => {
  const [devtoolsSnapshot, setDevtoolsSnapshot] = React.useState<DevtoolsIssueSnapshot | null>(null);
  const [devtoolsNoticeVisible, setDevtoolsNoticeVisible] = React.useState(false);
  const dismissedDevtoolsIssueIdRef = React.useRef<number | null>(null);
  const suppressDevtoolsNoticeUntilRef = React.useRef<number>(0);
  const pendingDevtoolsSnapshotRef = React.useRef<DevtoolsIssueSnapshot | null>(null);
  const pendingDevtoolsNoticeTimerRef = React.useRef<number | null>(null);

  const clearPendingDevtoolsNoticeTimer = React.useCallback(() => {
    if (pendingDevtoolsNoticeTimerRef.current !== null) {
      window.clearTimeout(pendingDevtoolsNoticeTimerRef.current);
      pendingDevtoolsNoticeTimerRef.current = null;
    }
  }, []);

  const flushPendingDevtoolsNotice = React.useCallback(() => {
    clearPendingDevtoolsNoticeTimer();
    const pendingSnapshot = pendingDevtoolsSnapshotRef.current;
    if (!pendingSnapshot) return;

    const dismissedId = dismissedDevtoolsIssueIdRef.current;
    const hasNewIssues = pendingSnapshot.issues.some((issue) => dismissedId === null || issue.id > dismissedId);
    if (!hasNewIssues) {
      pendingDevtoolsSnapshotRef.current = null;
      return;
    }

    pendingDevtoolsSnapshotRef.current = null;
    setDevtoolsSnapshot(pendingSnapshot);
    setDevtoolsNoticeVisible(true);
  }, [clearPendingDevtoolsNoticeTimer]);

  /**
   * ENESTE vej fra en devtools-issue til notifikations-state – altid udskudt, aldrig synkron.
   *
   * En issue kan opstå MENS en anden komponent renderer: `computeEoSnapshot` fail-closer under
   * `Erstatningsopgoerelse`s render og kalder `reportSystemIssue`, som via den patchede
   * `console.error` ender her. Et synkront setState ville da skrive MainLayoutContents state midt i
   * en fremmed render ("Cannot update a component while rendering a different component").
   * Notifikationen er ren UI-feedback uden ordensgaranti, så udskydelsen koster intet.
   *
   * Timeren coalescer også en byge af issues til ét flush, og `flushPendingDevtoolsNotice` ejer
   * dismissal-filteret – derfor må kaldere IKKE forfiltrere eller skrive state selv.
   */
  const queuePendingDevtoolsNotice = React.useCallback((snapshot: DevtoolsIssueSnapshot) => {
    pendingDevtoolsSnapshotRef.current = snapshot;
    if (pendingDevtoolsNoticeTimerRef.current !== null) {
      return;
    }

    const delay = Math.max(0, suppressDevtoolsNoticeUntilRef.current - Date.now());
    pendingDevtoolsNoticeTimerRef.current = window.setTimeout(() => {
      flushPendingDevtoolsNotice();
    }, delay);
  }, [flushPendingDevtoolsNotice]);

  React.useEffect(() => {
    dismissedDevtoolsIssueIdRef.current = parseNonNegativeInteger(
      readOptionalSessionStorageValue(UI_STORAGE_KEYS.devtoolsLastSeenIssueId),
    );

    const stop = startDevtoolsMonitor();
    const unsubscribe = subscribeDevtoolsIssues((snapshot) => {
      queuePendingDevtoolsNotice(snapshot);
    });

    const initial = getDevtoolsIssueSnapshot();
    const dismissedId = dismissedDevtoolsIssueIdRef.current;
    const hasNewIssues = initial.issues.some((issue) => dismissedId === null || issue.id > dismissedId);
    if (hasNewIssues) {
      setDevtoolsSnapshot(initial);
      setDevtoolsNoticeVisible(true);
    }

    return () => {
      clearPendingDevtoolsNoticeTimer();
      pendingDevtoolsSnapshotRef.current = null;
      unsubscribe();
      stop();
    };
  }, [clearPendingDevtoolsNoticeTimer, queuePendingDevtoolsNotice]);

  React.useEffect(() => {
    const route = `${location.pathname}${location.search}${location.hash}`;
    setDevtoolsRoute(route);
  }, [location.hash, location.pathname, location.search]);

  const dismissDevtools = React.useCallback(() => {
    const lastIssueId = devtoolsSnapshot?.lastIssue?.id ?? null;
    dismissedDevtoolsIssueIdRef.current = lastIssueId;
    if (lastIssueId !== null) {
      writeOptionalSessionStorageValue(UI_STORAGE_KEYS.devtoolsLastSeenIssueId, String(lastIssueId));
    }
    suppressDevtoolsNoticeUntilRef.current = Date.now() + 1000;
    pendingDevtoolsSnapshotRef.current = null;
    clearPendingDevtoolsNoticeTimer();
    setDevtoolsNoticeVisible(false);
  }, [clearPendingDevtoolsNoticeTimer, devtoolsSnapshot]);

  const getExtraSections = React.useCallback((): BugReportExtraSection[] => {
    const persistedSnapshot = Object.keys(persistenceSchemas).reduce((acc, key) => {
      const pageKey = key as PersistedSectionKey;
      acc[pageKey] = readPersistedSection(pageKey) ?? null;
      return acc;
    }, {} as Record<PersistedSectionKey, unknown>);

    const fieldErrorsSnapshot = Object.keys(persistenceSchemas).reduce((acc, key) => {
      const pageKey = key as PersistedSectionKey;
      acc[pageKey] = getSectionFieldIssues(pageKey);
      return acc;
    }, {} as Record<PersistedSectionKey, unknown>);

    const uiMeta = {
      lastSavedFilename: readOptionalSessionStorageValue(UI_STORAGE_KEYS.lastSavedFilename),
      lastSavedFilenameBasis: parseSessionJson(readOptionalSessionStorageValue(UI_STORAGE_KEYS.lastSavedFilenameBasis)),
      route: {
        pathname: location.pathname,
        search: location.search,
        hash: location.hash,
      },
    };

    return [
      { title: 'DevTools hændelser', data: getDevtoolsIssueSnapshot() },
      { title: 'UI metadata', data: uiMeta },
      { title: 'Persisted brugerinput (schema-valideret)', data: persistedSnapshot },
      { title: 'Feltissues', data: fieldErrorsSnapshot },
    ];
  }, [getSectionFieldIssues, readPersistedSection, location.hash, location.pathname, location.search]);

  return {
    devtoolsSnapshot,
    devtoolsNoticeVisible,
    dismissDevtools,
    getExtraSections,
  };
};
