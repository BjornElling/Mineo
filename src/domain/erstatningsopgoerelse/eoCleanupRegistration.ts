/**
 * EO Domain Cleanup Registration
 *
 * Registrerer eoLoenindkomstInputErrorStore's cleanup- og rollback-hooks
 * i det generiske domain cleanup registry. Dette sikrer at FormPersistenceContext
 * ikke behøver kende til EO-specifikke stores.
 *
 * Denne fil skal importeres som side-effect import fra App.tsx (eller tilsvarende
 * bootstrap-sted) for at sikre at registreringen sker inden persistence-operationer.
 */

import { eoLoenindkomstInputErrorStore } from '../../stores/eoLoenindkomstInputErrorStore';
import { registerDomainCleanup, registerDomainRollbackHooks } from '../../stores/domainCleanupRegistry';

registerDomainCleanup('eo-loenindkomst-input-errors', () => {
  eoLoenindkomstInputErrorStore.getState().clearAll();
});

registerDomainRollbackHooks('eo-loenindkomst-input-errors', {
  save: () => eoLoenindkomstInputErrorStore.getState().errors,
  restore: (snapshot) => {
    eoLoenindkomstInputErrorStore.getState().replaceAll(snapshot as Readonly<Record<string, true>>);
  },
});
