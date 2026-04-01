import React from 'react';
import { persistenceSchemas } from '../config/persistenceRegistry';
import type { StorageKey } from '../config/storageManifest';

type UseUnsavedChangesGuardArgs = {
  getSectionRevision: (pageKey: StorageKey) => number;
  authoritativeSnapshotEpoch: number;
};

type UseUnsavedChangesGuardResult = {
  hasUnsavedChanges: boolean;
  combinedSectionRevisionRef: React.RefObject<number>;
  markSaved: (revision: number) => void;
  allowExitWithoutWarning: () => void;
};

export const useUnsavedChangesGuard = ({
  getSectionRevision,
  authoritativeSnapshotEpoch,
}: UseUnsavedChangesGuardArgs): UseUnsavedChangesGuardResult => {
  const combinedSectionRevision = React.useMemo(() => {
    return (Object.keys(persistenceSchemas) as StorageKey[]).reduce((sum, pageKey) => {
      return sum + getSectionRevision(pageKey);
    }, 0);
  }, [getSectionRevision]);
  const combinedSectionRevisionRef = React.useRef<number>(combinedSectionRevision);
  React.useEffect(() => {
    combinedSectionRevisionRef.current = combinedSectionRevision;
  }, [combinedSectionRevision]);
  const [savedRevisionBaseline, setSavedRevisionBaseline] = React.useState<number>(combinedSectionRevision);
  const hasUnsavedChanges = combinedSectionRevision > savedRevisionBaseline;
  const allowExitWithoutUnsavedWarningRef = React.useRef<boolean>(false);

  React.useEffect(() => {
    setSavedRevisionBaseline(combinedSectionRevisionRef.current);
  }, [authoritativeSnapshotEpoch]);

  React.useEffect(() => {
    if (!hasUnsavedChanges) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (allowExitWithoutUnsavedWarningRef.current) {
        return;
      }
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [hasUnsavedChanges]);

  const markSaved = React.useCallback((revision: number) => {
    setSavedRevisionBaseline(revision);
  }, []);

  const allowExitWithoutWarning = React.useCallback(() => {
    allowExitWithoutUnsavedWarningRef.current = true;
  }, []);

  return {
    hasUnsavedChanges,
    combinedSectionRevisionRef,
    markSaved,
    allowExitWithoutWarning,
  };
};
