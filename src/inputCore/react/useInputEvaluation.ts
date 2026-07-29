import { useSyncExternalStore } from 'react';
import type { InputEvaluation } from '../inputReader';
import {
  useCriticalActionCoordinator,
  useInputReadPort,
} from './inputRuntimeContext';
import type { CriticalActionCoordinator } from '../runtime/criticalActionCoordinator';

// React-laget (§3.4/Fase 3): den ENE læse-grænse, en side/consumer bruger til at køre en ren projektion
// mod den offentlige `InputReader`. Consumeren læser ALDRIG rå sektioner (§3.4/§5.4) — kun gennem
// `evaluation.reader`, så en værdi bag en aktiv rød feltfejl er skjult, og projektionen blokerer korrekt.
//
// Abonnementet dækker BÅDE input- OG settingsrevision (§3.4): et settings-bump gør evalueringen stale på samme
// måde som en inputændring. Bindingens `getEvaluation` er cachet pr. `EvaluationSourceToken`, så getSnapshot
// returnerer en stabil reference mellem ændringer (ellers ville `useSyncExternalStore`-identitetstjekket loope).

export const useInputEvaluation = (): InputEvaluation => {
  const read = useInputReadPort();
  return useSyncExternalStore(read.subscribe, read.getEvaluation, read.getEvaluation);
};

/** Den kritiske handlingsbarriere fra præcis samme runtimebinding som readeren og editorerne. */
export const useCriticalInputActions = (): CriticalActionCoordinator =>
  useCriticalActionCoordinator();
