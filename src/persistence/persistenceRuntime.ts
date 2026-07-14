import { inputRuntimeStore } from '../stores/inputRuntimeStore';
import { loadOrMigrateInputSession } from './inputSessionMigration';

export type PersistenceStartupNotice = Readonly<{
  message: string;
  type: 'warning' | 'error';
}>;

export type PersistenceRuntime = Readonly<{
  notice: PersistenceStartupNotice | null;
  /** Bevares kun for provider-signaturens fase-3-kompatibilitet; startup rydder nu atomisk selv. */
  keysToRemove: readonly string[];
}>;

/** Hydrerer én gang før React-render fra current envelope eller en atomisk legacy-migration. */
export const initializePersistenceRuntime = (): PersistenceRuntime => {
  const result = loadOrMigrateInputSession();
  inputRuntimeStore.getState().hydrateInputRuntime(result.input, { writesBlocked: result.writesBlocked });
  return Object.freeze({ notice: result.notice, keysToRemove: Object.freeze([]) });
};
