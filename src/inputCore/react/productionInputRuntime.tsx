import * as React from 'react';
import { getProductionInputCatalog } from '../catalog/productionCatalog';
import type { FieldIssueSnapshot } from '../inputIssue';
import type { EvaluationSourceToken } from '../evaluationSource';
import { sourceTokensEqual } from '../evaluationSource';
import { createInputEvaluation, type InputEvaluation } from '../inputReader';
import type { SettledInput } from '../settledInput';
import { slimInputStore } from '../runtime/slimInputStore';
import { captureStableInput, captureStableInputEvaluation } from '../runtime/evaluationSourceBinding';
import { activeEditorRegistry } from '../runtime/activeEditorRegistry';
import {
  initializeInputRuntime,
  type InputRuntimeStartup,
} from '../runtime/initializeInputRuntime';
import { seedSatserNewCase } from '../../domain/satser/satserNewCaseSeed';
import {
  createInputRuntimeBinding,
  InputRuntimeProvider,
  type InputRuntimeBinding,
} from './inputRuntimeContext';

// Greenfield-produktions-wiring (§3.10, Fase 2.4/3-cutover): den ene binding, produktions-app'en monterer. Den
// hydrerer runtime FØR render (`initializeInputRuntime`) mod applikations-singletonerne og distribuerer den
// færdige binding til React-træet gennem `InputRuntimeProvider`. Provideren hydrerer aldrig igen (§3.10);
// en remount genbruger den samme runtime uden at overskrive input.
//
// **Feltvalidering (Fase 3, slicevis):** `getIssues` optager nu et STABILT kildesnapshot (§3.4) og udleder det
// faktiske tokenbundne feltissue-snapshot via `captureStableInputEvaluation`. Rejected råtekst (format/range) og
// canonical-validatorer på de migrerede sektioner giver derfor ægte røde feltfejl. Sektioner uden migrerede
// validatorer bidrager ikke med issues endnu — men Satser-årets commit-interval er et codec-`range` (rejected
// råtekst), så Satser-slicens bounds-fejl er dækket uden en separat validator. Snapshottet caches pr.
// `EvaluationSourceToken`, så `getIssues` er billig at kalde under render (én gang pr. revision/settingsrevision).

/** Sammen med `settingsFingerprintRef` giver `bumpSettingsRevision` den samlede input-/settings-friskhed. */
const buildProductionEvaluation = (): InputEvaluation =>
  // Settings-issues wires slicevis; friskheden dækker allerede settingsrevisionen via tokenet (§3.4).
  captureStableInputEvaluation(slimInputStore, getProductionInputCatalog(), undefined);

// Cache pr. token: `getIssues`/`getEvaluation` kaldes under render (bl.a. af `useFieldEditor`), så en fuld
// issue-udledning må ikke køre på hver render. Den genberegnes kun, når input- eller settingsrevisionen flytter.
let cachedEvaluation: InputEvaluation | null = null;
const readProductionEvaluation = (): InputEvaluation => {
  const state = slimInputStore.getState();
  const token: EvaluationSourceToken = { inputRevision: state.revision, settingsRevision: state.settingsRevision };
  if (cachedEvaluation === null || !sourceTokensEqual(cachedEvaluation.issues.sourceToken, token)) {
    cachedEvaluation = buildProductionEvaluation();
  }
  return cachedEvaluation;
};

/**
 * Bygger produktions-bindingen mod applikations-singletonerne. `getIssues`/`getEvaluation` deler den
 * token-cachede `InputEvaluation`, så det offentlige reader-lag og editorernes issue-visning ser præcis samme
 * tokenbundne snapshot (§3.4).
 */
export const createProductionInputRuntimeBinding = (): InputRuntimeBinding => {
  const catalog = getProductionInputCatalog();
  const getIssues = (): FieldIssueSnapshot => readProductionEvaluation().issues;
  return createInputRuntimeBinding(slimInputStore, catalog, activeEditorRegistry, getIssues);
};

/**
 * Optager den aktuelle tokenbundne `InputEvaluation` (issues + offentlig reader) fra produktions-runtime.
 * Consumer-siden (projektioner, sidevisning, download-preflight) læser HER, aldrig gennem rå sektioner (§3.4).
 * Delt cache med `getIssues`, så reader og editor-issues aldrig kan drifte fra hinanden.
 */
export const getProductionInputEvaluation = (): InputEvaluation => readProductionEvaluation();

/**
 * Optager et FRISKT, stabilt kildesnapshot til en kritisk handling (§3.4/§3.9): efter en settle bygger en
 * download-preflight sin projektion herfra og får samtidig en `isSourceCurrent`-closure, der fail-closer, hvis
 * input- eller settingsrevisionen flytter under en efterfølgende async-grænse (lazy-load, generatorstart).
 * Adskilt fra render-cachen (`getProductionInputEvaluation`), fordi en kritisk handling altid skal genlæse.
 */
export const captureProductionDownloadSource = (): Readonly<{
  evaluation: InputEvaluation;
  input: SettledInput;
  isSourceCurrent: () => boolean;
}> => {
  const { token, input } = captureStableInput(slimInputStore);
  const evaluation = createInputEvaluation({
    input,
    catalog: getProductionInputCatalog(),
    sourceToken: token,
    settings: undefined,
  });
  return Object.freeze({
    evaluation,
    // Rå sektioner udleveres KUN til brevhoved-stamdata (dokument-context, ikke en gate): `resolvePdfStamdata`
    // parser tolerant og er bevidst ikke en downloadgate. Satser-gaten køres separat gennem reader-projektionen.
    input,
    isSourceCurrent: () => {
      const state = slimInputStore.getState();
      return sourceTokensEqual(token, {
        inputRevision: state.revision,
        settingsRevision: state.settingsRevision,
      });
    },
  });
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
  // En frisk sag seedes med Satsers default-år (§1.12, brugerbeslutning) — kun når der ikke findes en aktiv session.
  const startup = initializeInputRuntime(slimInputStore, catalog, { seedNewCase: seedSatserNewCase });
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
