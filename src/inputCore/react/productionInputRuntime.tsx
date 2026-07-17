import * as React from 'react';
import { getProductionInputCatalog } from '../catalog/productionCatalog';
import {
  bindFieldIssueSnapshot,
  buildFieldIssueSet,
  type FieldIssueSnapshot,
} from '../inputIssue';
import { createEvaluationSourceToken } from '../evaluationSource';
import { slimInputStore } from '../runtime/slimInputStore';
import { activeEditorRegistry } from '../runtime/activeEditorRegistry';
import {
  initializeInputRuntime,
  type InputRuntimeStartup,
} from '../runtime/initializeInputRuntime';
import {
  createInputRuntimeBinding,
  InputRuntimeProvider,
  type InputRuntimeBinding,
} from './inputRuntimeContext';

// Greenfield-produktions-wiring (§3.10, Fase 2.4-cutover): den ene binding, produktions-app'en monterer. Den
// hydrerer runtime FØR render (`initializeInputRuntime`) mod applikations-singletonerne og distribuerer den
// færdige binding til React-træet gennem `InputRuntimeProvider`. Provideren hydrerer aldrig igen (§3.10);
// en remount genbruger den samme runtime uden at overskrive input.
//
// **Fase 3-udestående (bevidst):** feltvalidatorerne findes endnu ikke. `getIssues` returnerer derfor et TOMT
// feltissue-snapshot, bundet til det aktuelle `EvaluationSourceToken`. Tokenet er ægte (input- OG
// settingsrevision), så friskhedskontrakten (§3.4) holder allerede nu; kun issue-INDHOLDET er tomt, indtil
// Fase 3-validatorerne wires ind her. Røde feltfejl er derfor midlertidigt fraværende i den migrerede UI —
// dette er den tilladte ikke-deploybare mellemtilstand (§5.1), ikke en permanent tilstand.

/**
 * Bygger produktions-bindingen mod applikations-singletonerne. `getIssues` optager det aktuelle token og
 * binder et tomt feltissue-set til det, indtil Fase 3-validatorerne leverer det faktiske snapshot.
 */
export const createProductionInputRuntimeBinding = (): InputRuntimeBinding => {
  const catalog = getProductionInputCatalog();
  const getIssues = (): FieldIssueSnapshot => {
    const state = slimInputStore.getState();
    return bindFieldIssueSnapshot(
      buildFieldIssueSet([]),
      createEvaluationSourceToken(state.revision, state.settingsRevision)
    );
  };
  return createInputRuntimeBinding(slimInputStore, catalog, activeEditorRegistry, getIssues);
};

/**
 * Hydrerer produktions-runtime én gang før render og returnerer startup-status (fx korruptions-/utilgængelig-
 * notice, §1.12) samt den færdige binding. Kaldes af hvert app-entrypoint FØR React-render (§3.10).
 */
export const bootstrapProductionInputRuntime = (): Readonly<{
  binding: InputRuntimeBinding;
  startup: InputRuntimeStartup;
}> => {
  const catalog = getProductionInputCatalog();
  const startup = initializeInputRuntime(slimInputStore, catalog);
  return Object.freeze({ binding: createProductionInputRuntimeBinding(), startup });
};

/**
 * Bumper store'ens settingsrevision, når AppSettings ændrer sig, så `EvaluationSourceToken` bevæger sig samlet
 * med input- OG settingsændringer (§3.4). Rendres uden for React-visningen (ingen output), monteret under
 * AppSettings-provideren. `settingsFingerprint` er en billig, stabil identitet for de settings, der påvirker
 * validering/beregning; skifter den, bumpes revisionen. Første render bumper ikke (fingerprint-ref matcher).
 */
export const useSettingsRevisionBridge = (settingsFingerprint: string): void => {
  const previousRef = React.useRef(settingsFingerprint);
  React.useEffect(() => {
    if (previousRef.current === settingsFingerprint) return;
    previousRef.current = settingsFingerprint;
    slimInputStore.getState().bumpSettingsRevision();
  }, [settingsFingerprint]);
};

export type ProductionInputRuntimeProviderProps = Readonly<{
  binding: InputRuntimeBinding;
  children: React.ReactNode;
}>;

/**
 * Tynd produktions-provider. Bindingen bygges/hydreres uden for React (før render) og gives ind, så en
 * remount aldrig re-hydrerer eller overskriver input (§3.10). Adskilt fra `InputRuntimeProvider`, så
 * test-wiring og produktions-wiring ikke deler mount-ansvar.
 */
export const ProductionInputRuntimeProvider = ({
  binding,
  children,
}: ProductionInputRuntimeProviderProps): React.ReactElement => (
  <InputRuntimeProvider binding={binding}>{children}</InputRuntimeProvider>
);
