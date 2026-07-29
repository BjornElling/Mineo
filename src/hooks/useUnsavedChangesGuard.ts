import React from 'react';
type UseUnsavedChangesGuardArgs = {
  combinedSectionRevision: number;
  authoritativeSnapshotEpoch: number;
};

type UseUnsavedChangesGuardResult = {
  hasUnsavedChanges: boolean;
  combinedSectionRevisionRef: React.RefObject<number>;
  markSaved: (revision: number) => void;
};

// `allowExitWithoutWarning` er FJERNET sammen med `Slet alt`s fulde sidegenindlæsning (GM-F12): den fandtes
// udelukkende for at undertrykke beforeunload-advarslen under netop den reload. `Slet alt` afsluttes nu inde i
// appen, og baseline nulstilles ad den almindelige vej gennem `authoritativeSnapshotEpoch`
// (`replacementGeneration`), som hel-sags-clear bumper. En ny undtagelse fra advarslen skal begrundes af sin
// egen handling, ikke af en generisk "tillad exit"-omgåelse, ingen anden kalder havde brug for.

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

  React.useEffect(() => {
    // authoritativeSnapshotEpoch er det autoritative "alt er nu erstattet/hydreret"-signal.
    // Vi bruger derfor den senest observerede samlede revision som ny baseline efter load/reset.
    setSavedRevisionBaseline(combinedSectionRevisionRef.current);
  }, [authoritativeSnapshotEpoch]);

  React.useEffect(() => {
    if (!hasUnsavedChanges) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
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

  return {
    hasUnsavedChanges,
    combinedSectionRevisionRef,
    markSaved,
  };
};
