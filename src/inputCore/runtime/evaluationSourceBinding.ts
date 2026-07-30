import type { InputCatalog } from '../fieldCatalog';
import {
  captureStableSource,
  createEvaluationSourceToken,
  type EvaluationSourceToken,
} from '../evaluationSource';
import { createInputEvaluation, type InputEvaluation } from '../inputReader';
import type { SettledInput } from '../settledInput';
import type { SlimInputStore } from './slimInputStore';

// Input-runtime (§3.4): binder den framework-frie `captureStableSource` til den levende store. Issues,
// beregninger, `.eo` og dokumenter (inputkernen) optager et stabilt kildesnapshot HER, så et resultat bindes til
// ét `EvaluationSourceToken` (input- OG settingsrevision) og genkendes som stale ved enhver async-grænse.

export const readSourceToken = (store: SlimInputStore): EvaluationSourceToken => {
  const state = store.getState();
  return createEvaluationSourceToken(state.revision, state.settingsRevision);
};

/** Optager et stabilt {token, input}-snapshot fra store med dobbeltlæsning; fail-closed ved vedvarende drift. */
export const captureStableInput = (
  store: SlimInputStore
): Readonly<{ token: EvaluationSourceToken; input: SettledInput }> => {
  const { token, data } = captureStableSource(
    () => readSourceToken(store),
    () => store.getState().input
  );
  return Object.freeze({ token, input: data });
};

/**
 * Optager et stabilt kildesnapshot og bygger den tokenbundne `InputEvaluation` (issues + offentlig reader).
 *
 * Tokenet bærer BÅDE input- og settingsrevisionen, så friskheden dækker begge kilder (§3.4).
 * Settingsrevisionen bumpes af `useSettingsRevisionBridge`, når det projekterede
 * `SourceSettings`-snapshot ændrer fingerprint. Selve settingsværdien gives ikke ind her: evalueringen
 * læser ikke settings (se `createInputEvaluation`), og en fri typeparameter ville netop genåbne
 * et hul i friskhedskontrollen.
 */
export const captureStableInputEvaluation = (
  store: SlimInputStore,
  catalog: InputCatalog
): InputEvaluation => {
  const { token, input } = captureStableInput(store);
  return createInputEvaluation({ input, catalog, sourceToken: token });
};
