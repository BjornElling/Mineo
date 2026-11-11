import React from 'react';
import { UI_STORAGE_KEYS } from '../config/storageManifest';
import {
  readOptionalSessionStorageValue,
  removeOptionalSessionStorageValue,
  writeOptionalSessionStorageValue,
} from '../utils/safeSessionStorage';

type UseUnsavedChangesGuardArgs = {
  combinedSectionRevision: number;
  authoritativeSnapshotEpoch: number;
  /**
   * Om en åben editor bærer en faktisk ændret, endnu ikke afsluttet draft (M-47/BB-396). Læses først i selve
   * `beforeunload`, så den synlige tekst er beskyttet uden et abonnement på hvert tastetryk.
   */
  hasChangedOpenDraft: () => boolean;
};

type UseUnsavedChangesGuardResult = {
  hasUnsavedChanges: boolean;
  combinedSectionRevisionRef: React.RefObject<number>;
  markSaved: (revision: number) => void;
};

// `allowExitWithoutWarning` er FJERNET sammen med `Slet alt`s fulde sidegenindlæsning: den fandtes
// udelukkende for at undertrykke beforeunload-advarslen under netop den reload. `Slet alt` afsluttes nu inde i
// appen, og baseline nulstilles ad den almindelige vej gennem `authoritativeSnapshotEpoch`
// (`replacementGeneration`), som hel-sags-clear bumper. En ny undtagelse fra advarslen skal begrundes af sin
// egen handling, ikke af en generisk "tillad exit"-omgåelse, ingen anden kalder havde brug for.
//
// **Markeringen har samme levetid som input (M-46).** Afsluttet input overlever en genindlæsning i fanens
// sessionStorage. Baseline lever kun i React og starter ved mount på den hydrerede revision; uden en persisteret
// markør blev gendannet, aldrig gemt arbejde derfor behandlet som sikret efter F5. Markøren skrives ved hver
// ændring af `hasUnsavedChanges` og læses én gang ved mount. Kun en ny baseline – vellykket gem/download
// (`markSaved`) eller en autoritativ erstatning efter mount (Hent/Slet alt) – fjerner den.

const readCarriedUnsavedWork = (): boolean =>
  readOptionalSessionStorageValue(UI_STORAGE_KEYS.unsavedWork) === '1';

export const useUnsavedChangesGuard = ({
  combinedSectionRevision,
  authoritativeSnapshotEpoch,
  hasChangedOpenDraft,
}: UseUnsavedChangesGuardArgs): UseUnsavedChangesGuardResult => {
  const combinedSectionRevisionRef = React.useRef<number>(combinedSectionRevision);
  React.useEffect(() => {
    combinedSectionRevisionRef.current = combinedSectionRevision;
  }, [combinedSectionRevision]);
  const [savedRevisionBaseline, setSavedRevisionBaseline] = React.useState<number>(combinedSectionRevision);
  // Ugemt arbejde, der var markeret før genindlæsningen, og som revisionen alene ikke kan se efter hydration.
  const [carriedUnsavedWork, setCarriedUnsavedWork] = React.useState<boolean>(readCarriedUnsavedWork);
  const hasUnsavedChanges = carriedUnsavedWork || combinedSectionRevision > savedRevisionBaseline;

  const observedEpochRef = React.useRef(authoritativeSnapshotEpoch);
  React.useEffect(() => {
    // authoritativeSnapshotEpoch er det autoritative "alt er nu erstattet/hydreret"-signal.
    // Vi bruger derfor den senest observerede samlede revision som ny baseline efter load/reset.
    // Mount-hydrationen er IKKE en sådan erstatning: den gendanner præcis det arbejde, markøren beskytter.
    if (observedEpochRef.current === authoritativeSnapshotEpoch) return;
    observedEpochRef.current = authoritativeSnapshotEpoch;
    setCarriedUnsavedWork(false);
    setSavedRevisionBaseline(combinedSectionRevisionRef.current);
  }, [authoritativeSnapshotEpoch]);

  React.useEffect(() => {
    if (hasUnsavedChanges) {
      writeOptionalSessionStorageValue(UI_STORAGE_KEYS.unsavedWork, '1');
    } else {
      removeOptionalSessionStorageValue(UI_STORAGE_KEYS.unsavedWork);
    }
  }, [hasUnsavedChanges]);

  const hasUnsavedChangesRef = React.useRef(hasUnsavedChanges);
  hasUnsavedChangesRef.current = hasUnsavedChanges;
  const hasChangedOpenDraftRef = React.useRef(hasChangedOpenDraft);
  hasChangedOpenDraftRef.current = hasChangedOpenDraft;

  React.useEffect(() => {
    // Lytteren er altid monteret, fordi en åben draft kan ændres uden en React-render her. Beslutningen
    // træffes først ved selve forsøget på at forlade siden.
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasUnsavedChangesRef.current && !hasChangedOpenDraftRef.current()) return;
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  const markSaved = React.useCallback((revision: number) => {
    setCarriedUnsavedWork(false);
    setSavedRevisionBaseline(revision);
  }, []);

  return {
    hasUnsavedChanges,
    combinedSectionRevisionRef,
    markSaved,
  };
};
