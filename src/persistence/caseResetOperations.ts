import type { CriticalActionCoordinator } from '../inputCore/runtime/criticalActionCoordinator';
import type { DispatchInputResult } from '../inputCore/runtime/dispatchInput';
import { getCaseScopedSessionStorageKeys } from '../config/storageManifest';
import { removeOptionalSessionStorageValue } from '../utils/safeSessionStorage';
import { deleteFileHandleFromIndexedDB } from '../utils/fileHandleStorage';

// Input-runtime (§3.10/§1.4/§7): `CaseResetOperations`-porten ejer `Slet alt` (og fremtidig sektions-
// reset). Den routes gennem den samme replacement-grænse som load og gennem `CriticalActionCoordinator`, så
// den åbne draft ALDRIG blokerer handlingen og først kasseres efter en vellykket apply. `clearCase` er tillige
// den ENE command, `dispatchInput` tillader, når runtime er `writesBlocked` efter en korrupt current-session
// (§1.12) — porten er derfor også recovery-vejen ud af en blokeret session.
//
// Porten ejer HELE reset-transaktionen (R4-F02): det autoritative input, den sagsnære UI-sessionstate og
// filhåndtaget. Tidligere lå de to sidste som løse kald i shell-use-casen, hvis boolean-resultater ingen læste,
// så en fejlet oprydning blev rapporteret som "Alt data slettet". Rester rapporteres nu i resultatet, så
// kalderen ikke KAN love fuld succes uden at have set dem.

/** En rest efter reset: en oprydning, der ikke kunne verificeres. Bæres i resultatet, aldrig kastet. */
export type ResetResidue = Readonly<{
  /** Hvad der ikke kunne ryddes — `storageKey` er den konkrete manifest-nøgle, `fileHandle` det gemte håndtag. */
  kind: 'sessionStorageKey' | 'fileHandle';
  /** Menneskelæsbar identifikation til fejlbeskeden (nøglenavn eller håndtagets rolle). */
  detail: string;
}>;

export type ClearAllResult = Readonly<{
  /**
   * `cleared`: det autoritative input ER ryddet, og al tilknyttet oprydning blev verificeret.
   * `cleared-with-residue`: inputtet er ryddet — det er den autoritative del og kan ikke rulles tilbage — men
   * mindst én tilknyttet oprydning kunne ikke verificeres. Kalderen SKAL vise resterne frem for "alt slettet".
   */
  status: 'cleared' | 'cleared-with-residue';
  revision: DispatchInputResult['revision'];
  residue: readonly ResetResidue[];
}>;

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
   * `Slet alt`: rydder hele sagen atomisk gennem replacement-grænsen og derefter den sagsnære sidetilstand.
   * Klargøres UDEN settle (`applyReplacement` kasserer først en eventuel åben draft efter succes). En apply,
   * der ikke flytter `replacementGeneration`, kastes af coordinatoren — så en tavs no-op aldrig kan optræde
   * som en clear. Rester i den efterfølgende oprydning rapporteres i resultatet.
   */
  clearAll: () => Promise<ClearAllResult>;
}>;

/**
 * Rydder den sagsnære UI-sessionstate og filhåndtaget EFTER den autoritative input-clear. Rækkefølgen er
 * bevidst: inputtet er det, brugeren beder om at få slettet, og en fejlende storage-oprydning må ikke
 * forhindre den. Hver grænses resultat kontrolleres — `removeOptionalSessionStorageValue` og
 * `deleteFileHandleFromIndexedDB` omsætter selv fejl til `false`, så et ukontrolleret kald er blindt.
 */
const clearCaseScopedSideState = async (): Promise<readonly ResetResidue[]> => {
  const residue: ResetResidue[] = [];

  for (const key of getCaseScopedSessionStorageKeys()) {
    if (!removeOptionalSessionStorageValue(key)) {
      residue.push({ kind: 'sessionStorageKey', detail: key });
    }
  }

  if (!(await deleteFileHandleFromIndexedDB())) {
    residue.push({ kind: 'fileHandle', detail: 'gemt filhåndtag til direkte Gem' });
  }

  return residue;
};

export const createCaseResetOperations = (runtime: CaseResetRuntimeAccess): CaseResetOperations => Object.freeze({
  clearAll: async (): Promise<ClearAllResult> => {
    const result = await runtime.coordinator.applyReplacement(() => runtime.dispatchClearCase());
    const residue = await clearCaseScopedSideState();
    return Object.freeze({
      status: residue.length === 0 ? 'cleared' : 'cleared-with-residue',
      revision: result.revision,
      residue,
    });
  },
});
