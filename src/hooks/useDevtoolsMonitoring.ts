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
  getPersistedData: <K extends PersistedSectionKey>(pageKey: K) => unknown;
  getFieldErrorsBySource: <K extends PersistedSectionKey>(pageKey: K) => unknown;
  location: Location;
};

type UseDevtoolsMonitoringResult = {
  devtoolsSnapshot: DevtoolsIssueSnapshot | null;
  devtoolsNoticeVisible: boolean;
  dismissDevtools: () => void;
  getExtraSections: () => BugReportExtraSection[];
};

export const useDevtoolsMonitoring = ({
  getPersistedData,
  getFieldErrorsBySource,
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
    const unsubscribe = subscribeDevtoolsIssues((snapshot, issue) => {
      const now = Date.now();
      if (now < suppressDevtoolsNoticeUntilRef.current) {
        queuePendingDevtoolsNotice(snapshot);
        return;
      }
      pendingDevtoolsSnapshotRef.current = null;
      clearPendingDevtoolsNoticeTimer();
      const dismissedId = dismissedDevtoolsIssueIdRef.current;
      if (dismissedId !== null && issue.id <= dismissedId) {
        return;
      }
      setDevtoolsSnapshot(snapshot);
      setDevtoolsNoticeVisible(true);
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
      acc[pageKey] = getPersistedData(pageKey) ?? null;
      return acc;
    }, {} as Record<PersistedSectionKey, unknown>);

    const fieldErrorsSnapshot = Object.keys(persistenceSchemas).reduce((acc, key) => {
      const pageKey = key as PersistedSectionKey;
      acc[pageKey] = getFieldErrorsBySource(pageKey);
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
      { title: 'Field errors (by source)', data: fieldErrorsSnapshot },
    ];
  }, [getFieldErrorsBySource, getPersistedData, location.hash, location.pathname, location.search]);

  return {
    devtoolsSnapshot,
    devtoolsNoticeVisible,
    dismissDevtools,
    getExtraSections,
  };
};
