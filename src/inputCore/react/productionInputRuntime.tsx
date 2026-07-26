import * as React from 'react';
import { getProductionInputCatalog } from '../catalog/productionCatalog';
import type { EvaluationSourceToken } from '../evaluationSource';
import { sourceTokensEqual } from '../evaluationSource';
import { createInputEvaluation, type InputEvaluation } from '../inputReader';
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
import { DEFAULT_APP_SETTINGS, type AppSettings } from '../../settings/appSettingsSchema';
import { SOURCE_SETTINGS_KEYS } from '../../settings/sourceSettings';

// Greenfield-produktions-wiring (§3.10, Fase 2.4/3-cutover): den ene binding, produktions-app'en monterer. Den
// hydrerer runtime FØR render (`initializeInputRuntime`) mod applikations-singletonerne og distribuerer den
// færdige binding til React-træet gennem `InputRuntimeProvider`. Provideren hydrerer aldrig igen (§3.10);
// en remount genbruger den samme runtime uden at overskrive input.
//
// **Feltvalidering (Fase 3, slicevis):** `getIssues` optager nu et STABILT kildesnapshot (§3.4) og udleder det
// faktiske tokenbundne feltissue-snapshot via `captureStableInputEvaluation`. Rejected råtekst (format) og
// canonical-validatorer på de migrerede sektioner giver derfor ægte røde feltfejl. Sektioner uden migrerede
// validatorer bidrager ikke med issues endnu — Satser-årets min/maxYear-bounds er efter kravændringen 2026-07-18
// en canonical bounds-feltvalidator på descriptoren (ikke længere codec-`range`), så et out-of-bounds-satsår
// committes canonical med et rødt bounds-issue og kan gemmes i `.eo`. Snapshottet caches pr.
// `EvaluationSourceToken`, så `getIssues` er billig at kalde under render (én gang pr. revision/settingsrevision).

let publishedSettings: AppSettings = DEFAULT_APP_SETTINGS;

/**
 * Fingerprintet udledes af `SOURCE_SETTINGS_KEYS` frem for at gentage nøglerne her.
 * Nøglelisten er erklæret i settings-laget og completeness-checket ved
 * compile-tid, så en ny source-relevant indstilling ikke kan tilføjes til typen uden også at komme
 * med i fingerprintet. Tidligere var de to lister uafhængige, og en manglende nøgle ville betyde, at
 * et regelskift IKKE gjorde et optaget token stale — altså at en download godkendt under den gamle
 * regel kunne overleve skiftet.
 *
 * Nøglerne sorteres, så fingerprintet er uafhængigt af listens rækkefølge.
 */
const evaluationSettingsFingerprint = (settings: AppSettings): string => JSON.stringify(
  Object.fromEntries(
    [...SOURCE_SETTINGS_KEYS]
      .sort()
      .map((key) => [key, settings[key]])
  )
);

/** Sammen med settingsrevisionen giver snapshotreferencen den samlede input-/settings-friskhed. */
const buildProductionEvaluation = (): InputEvaluation =>
  captureStableInputEvaluation(slimInputStore, getProductionInputCatalog(), publishedSettings);

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
  return createInputRuntimeBinding(
    slimInputStore,
    catalog,
    activeEditorRegistry,
    readProductionEvaluation
  );
};

/**
 * Optager den aktuelle tokenbundne `InputEvaluation` (issues + offentlig reader) fra produktions-runtime.
 * Consumer-siden (projektioner, sidevisning, download-preflight) læser HER, aldrig gennem rå sektioner (§3.4).
 * Delt cache med `getIssues`, så reader og editor-issues aldrig kan drifte fra hinanden.
 */
export const getProductionInputEvaluation = (): InputEvaluation => readProductionEvaluation();

/**
 * Optager et produktionssnapshot til test og bootstrapdiagnostik. Kritiske consumers bruger den
 * monterede `InputRuntimeBinding` i stedet, så de aldrig kan læse en anden runtime end React-træet.
 */
export const captureProductionEvaluationSource = (): Readonly<{
  evaluation: InputEvaluation;
  settings: AppSettings;
}> => {
  const { token, input } = captureStableInput(slimInputStore);
  const settings = publishedSettings;
  const evaluation = createInputEvaluation({
    input,
    catalog: getProductionInputCatalog(),
    sourceToken: token,
    settings,
  });
  return Object.freeze({
    evaluation,
    settings,
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
  if (bootstrappedProductionRuntime !== null) return bootstrappedProductionRuntime;
  const catalog = getProductionInputCatalog();
  // En frisk sag seedes med Satsers default-år (§1.12, brugerbeslutning) — kun når der ikke findes en aktiv session.
  const startup = initializeInputRuntime(slimInputStore, catalog, { seedNewCase: seedSatserNewCase });
  bootstrappedProductionRuntime = Object.freeze({
    binding: createProductionInputRuntimeBinding(),
    startup,
  });
  return bootstrappedProductionRuntime;
};

let bootstrappedProductionRuntime: Readonly<{
  binding: InputRuntimeBinding;
  startup: InputRuntimeStartup;
}> | null = null;

/**
 * Publicerer settingssnapshot og revision i samme layoutfase, så kritiske handlinger aldrig kombinerer et nyt
 * inputtoken med et settingsobjekt fra en ældre React-commit. Første mount flytter kun revisionen, hvis de
 * indlæste dokument-/valideringssettings afviger fra runtime-defaulten.
 */
export const useSettingsRevisionBridge = (settings: AppSettings): void => {
  const previousFingerprintRef = React.useRef(evaluationSettingsFingerprint(publishedSettings));
  React.useLayoutEffect(() => {
    const committedFingerprint = evaluationSettingsFingerprint(settings);
    const changed = previousFingerprintRef.current !== committedFingerprint;
    previousFingerprintRef.current = committedFingerprint;
    publishedSettings = settings;
    if (!changed) return;
    cachedEvaluation = null;
    slimInputStore.getState().bumpSettingsRevision();
  }, [settings]);
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
