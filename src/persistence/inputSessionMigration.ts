import { PERSISTED_SECTION_KEYS } from '../config/persistenceRegistry';
import {
  getInputEnvelopeStorageKey,
  getInvalidDraftsStorageKey,
  getStorageKey,
} from '../config/storageManifest';
import {
  parseInputEnvelope,
  serializeInputEnvelope,
  type RuntimePersistedInputState,
} from '../input/inputEnvelope';
import { legacyInvalidDraftsToRejectedInputs } from '../input/legacyInputCompatibility';
import { buildSessionStorageHydrationPlan } from '../utils/persistenceSessionHydration';
import {
  readSessionStorageValue,
  removeSessionStorageValue,
  writeSessionStorageValue,
} from '../utils/safeSessionStorage';
import { createEmptyRuntimeInput } from '../stores/inputRuntimeStore';

export type InputSessionMigrationResult = Readonly<{
  input: RuntimePersistedInputState;
  notice: Readonly<{ message: string; type: 'warning' | 'error' }> | null;
  writesBlocked: boolean;
}>;

const LEGACY_INPUT_KEYS = [
  ...PERSISTED_SECTION_KEYS.map(getStorageKey),
  getInvalidDraftsStorageKey(),
];

const restore = (key: string, value: string | null): void => {
  if (value === null) removeSessionStorageValue(key);
  else writeSessionStorageValue(key, value);
};

const startupError = (message: string): InputSessionMigrationResult => ({
  input: createEmptyRuntimeInput(),
  notice: { message, type: 'error' },
  writesBlocked: true,
});

/**
 * Current envelopen læses direkte. Legacy-nøgler migreres som én verificeret operation og fjernes
 * først efter vellykket read-back; enhver fejl bevarer samtlige kilder uændret.
 */
export const loadOrMigrateInputSession = (): InputSessionMigrationResult => {
  const inputKey = getInputEnvelopeStorageKey();
  let currentRaw: string | null;
  try {
    currentRaw = readSessionStorageValue(inputKey);
  } catch {
    return startupError('Gemte browserdata kunne ikke aflæses. Den aktive sag blev startet uden sessiondata.');
  }

  if (currentRaw !== null) {
    try {
      return { input: parseInputEnvelope(currentRaw).input, notice: null, writesBlocked: false };
    } catch {
      return startupError(
        'Gemte browserdata har en ukendt eller beskadiget struktur. De blev bevaret uændret, og den aktive sag blev startet uden sessiondata.'
      );
    }
  }

  let legacyBackup: Map<string, string | null>;
  try {
    legacyBackup = new Map(LEGACY_INPUT_KEYS.map((key) => [key, readSessionStorageValue(key)]));
  } catch {
    return startupError('Gemte browserdata kunne ikke gennemgås. Den aktive sag blev startet uden sessiondata.');
  }
  if ([...legacyBackup.values()].every((value) => value === null)) {
    return { input: createEmptyRuntimeInput(), notice: null, writesBlocked: false };
  }

  // Parse præcis det snapshot, der blev sikkerhedskopieret. En ny storage-læsning her kunne ellers
  // miste rejected input ved en transient læsefejl og efterfølgende slette den intakte legacy-kilde.
  const plan = buildSessionStorageHydrationPlan(legacyBackup);
  // Legacy-planens cleanup betyder, at mindst én kilde ikke kunne migreres tabsfrit. Fase-3-cutover
  // må derfor ikke anvende dens delvise snapshot eller fjerne noget.
  if (plan.keysToRemove.length > 0 || plan.notice?.type === 'error') {
    return startupError(
      'Gemte browserdata kunne ikke overføres sikkert til den nye struktur. De blev bevaret uændret, og den aktive sag blev startet uden sessiondata.'
    );
  }

  const candidate: RuntimePersistedInputState = {
    sections: Object.fromEntries(
      PERSISTED_SECTION_KEYS.map((section) => [section, plan.sections[section]])
    ) as RuntimePersistedInputState['sections'],
    rejectedInputs: legacyInvalidDraftsToRejectedInputs(plan.invalidDrafts),
  };
  let serialized: string;
  try {
    serialized = serializeInputEnvelope(candidate);
  } catch {
    return startupError(
      'Gemte browserdata kunne ikke valideres samlet. De blev bevaret uændret, og den aktive sag blev startet uden sessiondata.'
    );
  }

  try {
    writeSessionStorageValue(inputKey, serialized);
    if (readSessionStorageValue(inputKey) !== serialized) {
      throw new Error('Den nye inputenvelope kunne ikke verificeres.');
    }
    for (const key of LEGACY_INPUT_KEYS) removeSessionStorageValue(key);
    return {
      input: parseInputEnvelope(serialized).input,
      notice: plan.notice,
      writesBlocked: false,
    };
  } catch {
    const rollbackErrors: Error[] = [];
    try {
      removeSessionStorageValue(inputKey);
    } catch (error) {
      rollbackErrors.push(error instanceof Error ? error : new Error(String(error)));
    }
    for (const [key, value] of legacyBackup) {
      try {
        restore(key, value);
      } catch (error) {
        rollbackErrors.push(error instanceof Error ? error : new Error(String(error)));
      }
    }
    return startupError(rollbackErrors.length === 0
      ? 'Gemte browserdata kunne ikke overføres. De blev bevaret uændret, og den aktive sag blev startet uden sessiondata.'
      : 'Gemte browserdata kunne ikke overføres, og browserlageret kunne ikke gendannes fuldstændigt. Stop arbejdet og genindlæs siden.');
  }
};
