import { useSyncExternalStore } from 'react';
import type { InputEvaluation } from '../inputReader';
import { slimInputStore } from '../runtime/slimInputStore';
import { getProductionInputEvaluation } from './productionInputRuntime';

// Greenfield-React (§3.4/Fase 3): den ENE læse-grænse, en side/consumer bruger til at køre en ren projektion
// mod den offentlige `InputReader`. Consumeren læser ALDRIG rå sektioner (§3.4/§5.4) — kun gennem
// `evaluation.reader`, så en værdi bag en aktiv rød feltfejl er skjult, og projektionen blokerer korrekt.
//
// Abonnementet dækker BÅDE input- OG settingsrevision (§3.4): et settings-bump gør evalueringen stale på samme
// måde som en inputændring. `getProductionInputEvaluation` er cachet pr. `EvaluationSourceToken`, så getSnapshot
// returnerer en stabil reference mellem ændringer (ellers ville `useSyncExternalStore`-identitetstjekket loope).

export const useInputEvaluation = (): InputEvaluation =>
  useSyncExternalStore(
    (listener) => slimInputStore.subscribe(listener),
    getProductionInputEvaluation,
    getProductionInputEvaluation
  );
