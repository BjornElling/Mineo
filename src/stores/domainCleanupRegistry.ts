/**
 * Domain Cleanup Registry
 *
 * Generisk registry der tillader domæner at registrere cleanup- og rollback-hooks,
 * så generisk persistence-kode (FormPersistenceContext) ikke behøver kende til
 * domæne-specifikke stores.
 *
 * Bruges af FormPersistenceContext til at rydde transient domæne-fejl ved clearAllData,
 * clearPageData, clearAllFieldErrors og replaceAllPersistedData.
 */

type CleanupFn = () => void;

type RollbackHooks = {
  /** Gem nuværende domæne-state og returnér den som et uigennemsigtigt snapshot. */
  save: () => unknown;
  /** Gendan domæne-state fra et tidligere snapshot. */
  restore: (snapshot: unknown) => void;
};

const cleanupHooks = new Map<string, CleanupFn>();
const rollbackHooks = new Map<string, RollbackHooks>();

/**
 * Registrér en cleanup-funktion der køres ved clearAllData, clearPageData og clearAllFieldErrors.
 *
 * @param id - Unikt id for dette domæne (fx 'eo-loenindkomst-input-errors')
 * @param fn - Funktion der rydder domænets transiente state
 */
export const registerDomainCleanup = (id: string, fn: CleanupFn): void => {
  cleanupHooks.set(id, fn);
};

/**
 * Registrér save/restore-hooks der bruges til atomisk rollback i replaceAllPersistedData.
 *
 * @param id - Unikt id for dette domæne (skal matche id brugt i registerDomainCleanup)
 * @param hooks - { save, restore } — save returnerer snapshot, restore anvender det
 */
export const registerDomainRollbackHooks = (id: string, hooks: RollbackHooks): void => {
  rollbackHooks.set(id, hooks);
};

/** Kør alle registrerede cleanup-hooks. Bruges ved clearAllData, clearAllFieldErrors og clearPageData. */
export const runAllDomainCleanups = (): void => {
  if (import.meta.env.DEV && cleanupHooks.size === 0) {
    console.warn('[domainCleanupRegistry] runAllDomainCleanups kaldt men ingen hooks er registreret. Er side-effect importen i App.tsx kørt?');
  }
  for (const fn of cleanupHooks.values()) {
    fn();
  }
};

/** Gem snapshot af al registreret domæne-state. Bruges inden replaceAllPersistedData. */
export const saveDomainSnapshots = (): Map<string, unknown> => {
  const snapshots = new Map<string, unknown>();
  for (const [id, hooks] of rollbackHooks.entries()) {
    snapshots.set(id, hooks.save());
  }
  return snapshots;
};

/** Gendan domæne-state fra snapshots. Bruges ved rollback i replaceAllPersistedData. */
export const restoreDomainSnapshots = (snapshots: Map<string, unknown>): void => {
  for (const [id, hooks] of rollbackHooks.entries()) {
    if (snapshots.has(id)) {
      hooks.restore(snapshots.get(id));
    }
  }
};
