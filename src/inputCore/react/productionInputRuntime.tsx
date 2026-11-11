import { getProductionInputCatalog } from '../catalog/productionCatalog';
import type { InputEvaluation } from '../inputReader';
import type { InputRuntimeStartup } from '../runtime/initializeInputRuntime';
import { createProductionNewCaseSeed } from '../../domain/newCaseSeed';
import type { InputRuntimeBinding } from './inputRuntimeContext';
import { loadInitialSettings } from '../../settings/appSettingsParse';
import type { SourceSettings } from '../../settings/sourceSettings';
import {
  bootstrapInputRuntime,
  captureInputRuntimeHostEvaluationSource,
  configureInputRuntimeHost,
  createInputRuntimeHostBinding,
  getInputRuntimeHostEvaluation,
  getInputRuntimeStartup,
  type InputRuntimeBootstrap,
} from './inputRuntimeHost';

// Mineos wiring af den fælles inputruntime (§3.10): det fulde produktionskatalog og domænets ny-sags-seed.
// Selve runtimen – hydrering, evalueringscache, settingsbro – ejes af `inputRuntimeHost.ts`, som ikke kender
// noget katalog. MinProcesrente må derfor aldrig importere DETTE modul: det trækker alle descriptors og deres
// satstabeller med ind (`scripts/verify-build-artifacts.mjs` håndhæver budgettet).

export {
  readPublishedSourceSettings,
  useSettingsRevisionBridge,
} from './inputRuntimeHost';

/**
 * Binder værten til produktionskataloget, hvis intet er bundet endnu. Mineos entry gør det gennem bootstrap;
 * tests og diagnostik, der bygger en binding uden at hydrere, får samme katalog.
 */
const ensureProductionCatalog = (): void => configureInputRuntimeHost(getProductionInputCatalog());

/** Bygger produktions-bindingen mod applikations-singletonerne (uden at hydrere). */
export const createProductionInputRuntimeBinding = (): InputRuntimeBinding => {
  ensureProductionCatalog();
  return createInputRuntimeHostBinding();
};

/** Den aktuelle tokenbundne `InputEvaluation`; se `getInputRuntimeHostEvaluation`. */
export const getProductionInputEvaluation = (): InputEvaluation => {
  ensureProductionCatalog();
  return getInputRuntimeHostEvaluation();
};

/** Optager et produktionssnapshot til test og bootstrapdiagnostik; se `captureInputRuntimeHostEvaluationSource`. */
export const captureProductionEvaluationSource = (): Readonly<{
  evaluation: InputEvaluation;
  settings: SourceSettings;
}> => {
  ensureProductionCatalog();
  return captureInputRuntimeHostEvaluationSource();
};

/**
 * Hydrerer Mineos runtime én gang før render. En frisk sag seedes med domænets ny-sags-defaults (§1.12) – kun
 * når der ikke findes en aktiv session. Indstillingerne læses fra samme kilde, `AppSettingsProvider` selv
 * monterer på; bootstrap sker før render, så der er endnu ingen context at læse fra, og de to kan ikke nå at
 * være uenige.
 */
export const bootstrapProductionInputRuntime = (): InputRuntimeBootstrap => bootstrapInputRuntime({
  catalog: getProductionInputCatalog(),
  seedNewCase: createProductionNewCaseSeed(loadInitialSettings()),
});

/** Læser entrypointets allerede afgjorte startup-status uden at starte eller hydrere runtime. */
export const getProductionInputRuntimeStartup = (): InputRuntimeStartup | null => getInputRuntimeStartup();
