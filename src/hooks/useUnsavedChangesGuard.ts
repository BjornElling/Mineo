import React from 'react';
type UseUnsavedChangesGuardArgs = {
  combinedSectionRevision: number;
  authoritativeSnapshotEpoch: number;
};

type UseUnsavedChangesGuardResult = {
  hasUnsavedChanges: boolean;
  combinedSectionRevisionRef: React.RefObject<number>;
  markSaved: (revision: number) => void;
  allowExitWithoutWarning: () => void;
};

export const useUnsavedChangesGuard = ({
  combinedSectionRevision,
  authoritativeSnapshotEpoch,
}: UseUnsavedChangesGuardArgs): UseUnsavedChangesGuardResult => {
  const combinedSectionRevisionRef = React.useRef<number>(combinedSectionRevision);
  React.useEffect(() => {
    combinedSectionRevisionRef.current = combinedSectionRevision;
  }, [combinedSectionRevision]);
  const [savedRevisionBaseline, setSavedRevisionBaseline] = React.useState<number>(combinedSectionRevision);
  const hasUnsavedChanges = combinedSectionRevision > savedRevisionBaseline;
  const allowExitWithoutUnsavedWarningRef = React.useRef<boolean>(false);

  React.useEffect(() => {
    // authoritativeSnapshotEpoch er det autoritative "alt er nu erstattet/hydreret"-signal.
    // Vi bruger derfor den senest observerede samlede revision som ny baseline efter load/reset.
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
