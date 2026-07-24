import { clearCase } from '../inputCore/inputReducer';
import type { CriticalActionCoordinator } from '../inputCore/runtime/criticalActionCoordinator';
import type { DispatchInputResult } from '../inputCore/runtime/dispatchInput';

// Greenfield-runtime (§3.10/§1.4/§7): `CaseResetOperations`-porten ejer `Slet alt` (og fremtidig sektions-
// reset). Den routes gennem den samme replacement-grænse som load og gennem `CriticalActionCoordinator`, så
// den åbne draft ALDRIG blokerer handlingen og først kasseres efter en vellykket apply. `clearCase` er tillige
// den ENE command, `dispatchInput` tillader, når runtime er `writesBlocked` efter en korrupt current-session
// (§1.12) — porten er derfor også recovery-vejen ud af en blokeret session.

export type ClearAllResult = Readonly<{ status: 'cleared'; revision: DispatchInputResult['revision'] }>;

/**
 * Den minimale runtime-grænse. Injiceres (ikke den fulde binding), så porten er framework-fri og testbar:
 * `dispatchClearCase` udsteder `dispatchInput(clearCase())` mod den levende store, og `coordinator` sikrer
 * no-settle + kassér-draft-kun-ved-succes-invarianten (contract §7).
 */
export type CaseResetRuntimeAccess = Readonly<{
  coordinator: CriticalActionCoordinator;
  /** Udsteder den autoritative `clearCase`-command; tilladt selv når runtime er `writesBlocked` (§1.12). */
  dispatchClearCase: () => DispatchInputResult;
}>;

export type CaseResetOperations = Readonly<{
  /**
   * `Slet alt`: rydder hele sagen atomisk gennem replacement-grænsen. Klargøres UDEN settle
   * (`applyReplacement` kasserer først en eventuel åben draft efter succes). En apply, der ikke flytter
   * `replacementGeneration`, kastes af coordinatoren — så en tavs no-op aldrig kan optræde som en clear.
   */
  clearAll: () => Promise<ClearAllResult>;
}>;

export const createCaseResetOperations = (runtime: CaseResetRuntimeAccess): CaseResetOperations => Object.freeze({
  clearAll: async (): Promise<ClearAllResult> => {
    const result = await runtime.coordinator.applyReplacement(() => runtime.dispatchClearCase());
    return Object.freeze({ status: 'cleared', revision: result.revision });
  },
});

/** Command-konstruktør genudstillet til use-casen, så den ikke selv importerer reducer-interne detaljer. */
export const clearCaseCommand = clearCase;
