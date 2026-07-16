import type { InputCatalog } from '../fieldCatalog';
import {
  captureStableSource,
  createEvaluationSourceToken,
  type EvaluationSourceToken,
} from '../evaluationSource';
import { createInputEvaluation, type InputEvaluation } from '../inputReader';
import type { FieldIssue } from '../inputIssue';
import type { ValidationReader } from '../inputReader';
import type { SettledInput } from '../settledInput';
import type { SlimInputStore } from './slimInputStore';

// Greenfield-runtime (§3.4): binder den framework-frie `captureStableSource` til den levende store. Issues,
// beregninger, `.eo` og dokumenter (Fase 3–5) optager et stabilt kildesnapshot HER, så et resultat bindes til
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
 * `settings` og `deriveSettingsFieldIssues` leveres af consumeren; settingsrevisionen i tokenet skal bumpes,
 * når `settings` ændres, så friskheden dækker begge kilder (§3.4). AppSettings-abonnementet wires ved cutoveren.
 */
export const captureStableInputEvaluation = <TSettings>(
  store: SlimInputStore,
  catalog: InputCatalog,
  settings: TSettings,
  deriveSettingsFieldIssues?: (reader: ValidationReader, settings: TSettings) => readonly FieldIssue[]
): InputEvaluation => {
  const { token, input } = captureStableInput(store);
  return createInputEvaluation({
    input,
    catalog,
    sourceToken: token,
    settings,
    ...(deriveSettingsFieldIssues === undefined ? {} : { deriveSettingsFieldIssues }),
  });
};
