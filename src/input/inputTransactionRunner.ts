import { persistenceSchemas, PERSISTED_SECTION_KEYS } from '../config/persistenceRegistry';
import { getInputEnvelopeStorageKey, type StorageKey } from '../config/storageManifest';
import {
  parseInputEnvelope,
  serializeInputEnvelope,
  type RuntimePersistedInputState,
} from './inputEnvelope';
import {
  applyLegacyRejectedInputChanges,
  type LegacyRejectedInputChange,
} from './legacyInputCompatibility';
import { deserializeFieldAddress } from './fieldAddress';
import { getProductionInputCatalog } from './catalog/productionInputCatalog';
import { buildInputCommandCandidate } from './inputCommands';
import type {
  CommitImmediateFieldCommand,
  DeleteRowCommand,
  InsertRowCommand,
  ReorderRowsCommand,
  SettleFieldCommand,
  SettleFieldInNewRowCommand,
} from './inputCommands';
import { deepEqual } from '../utils/deepEqual';
import {
  readSessionStorageValue,
  removeSessionStorageValue,
  writeSessionStorageValue,
} from '../utils/safeSessionStorage';
import {
  INPUT_HISTORY_LIMIT,
  createEmptyInputHistory,
  inputRuntimeStore,
  type HistoryFrame,
  type HistoryFrameOrigin,
  type InputHistoryState,
} from '../stores/inputRuntimeStore';

export type CompatibilityInputCommand =
  | Readonly<{
      kind: 'replaceSection';
      section: StorageKey;
      value: unknown;
      rejectedChanges?: readonly LegacyRejectedInputChange[];
    }>
  | Readonly<{ kind: 'changeRejectedInputs'; changes: readonly LegacyRejectedInputChange[] }>
  | Readonly<{ kind: 'pruneRejectedInputs'; section: StorageKey; fieldPaths: readonly string[] }>
  | Readonly<{ kind: 'resetSection'; section: StorageKey }>
  | Readonly<{ kind: 'replaceCase'; sections: Readonly<Record<StorageKey, unknown | undefined>> }>
  | Readonly<{ kind: 'clearCase' }>
  | Readonly<{ kind: 'undo' }>
  | Readonly<{ kind: 'redo' }>;

export type InputTransactionOptions = Readonly<{
  origin?: HistoryFrameOrigin;
  history?: 'capture' | 'preserve' | 'clear';
  additionalStorageKeysToRemove?: readonly string[];
  now?: number;
}>;

export type InputTransactionResult = Readonly<{
  changed: boolean;
  revision: number;
  restoredFrame: HistoryFrame | null;
}>;

const appendHistoryFrame = (
  frames: readonly HistoryFrame[],
  frame: HistoryFrame
): readonly HistoryFrame[] => {
  const next = [...frames, frame];
  return next.length > INPUT_HISTORY_LIMIT ? next.slice(-INPUT_HISTORY_LIMIT) : next;
};

const createHistoryFrame = (
  input: RuntimePersistedInputState,
  origin: HistoryFrameOrigin,
  sequence: number,
  timestamp: number,
  compatibility?: Readonly<{
    fieldErrors: HistoryFrame['compatibilityFieldErrors'];
    fieldErrorRevisions: HistoryFrame['compatibilityFieldErrorRevisions'];
  }>
): HistoryFrame => ({
  id: `history-${sequence}`,
  timestamp,
  input,
  origin,
  ...(compatibility?.fieldErrors === undefined ? {} : {
    compatibilityFieldErrors: compatibility.fieldErrors,
    compatibilityFieldErrorRevisions: compatibility.fieldErrorRevisions,
  }),
});

const changedRejectedSections = (
  before: RuntimePersistedInputState,
  after: RuntimePersistedInputState
): ReadonlySet<StorageKey> => {
  const sections = new Set<StorageKey>();
  const keys = new Set([
    ...Object.keys(before.rejectedInputs),
    ...Object.keys(after.rejectedInputs),
  ]);
  for (const key of keys) {
    const beforeRecord = before.rejectedInputs as Readonly<Record<string, unknown>>;
    const afterRecord = after.rejectedInputs as Readonly<Record<string, unknown>>;
    if (deepEqual(beforeRecord[key], afterRecord[key])) continue;
    const address = deserializeFieldAddress(key);
    if (address !== null) sections.add(address.section);
  }
  return sections;
};

const changedCanonicalSections = (
  before: RuntimePersistedInputState,
  after: RuntimePersistedInputState
): ReadonlySet<StorageKey> => new Set(PERSISTED_SECTION_KEYS.filter(
  (section) => !deepEqual(before.sections[section], after.sections[section])
));

const removeRejectedForSection = (
  input: RuntimePersistedInputState,
  section: StorageKey
): RuntimePersistedInputState['rejectedInputs'] => Object.fromEntries(
  Object.entries(input.rejectedInputs).filter(([key]) => deserializeFieldAddress(key)?.section !== section)
);

const buildCandidate = (
  input: RuntimePersistedInputState,
  command: Exclude<CompatibilityInputCommand, { kind: 'undo' | 'redo' }>
): RuntimePersistedInputState => {
  switch (command.kind) {
    case 'replaceSection': {
      const value = command.value === null ? null : persistenceSchemas[command.section].parse(command.value);
      return {
        sections: { ...input.sections, [command.section]: value },
        rejectedInputs: command.rejectedChanges === undefined
          ? input.rejectedInputs
          : applyLegacyRejectedInputChanges(input.rejectedInputs, command.rejectedChanges),
      };
    }
    case 'changeRejectedInputs':
      return {
        sections: input.sections,
        rejectedInputs: applyLegacyRejectedInputChanges(input.rejectedInputs, command.changes),
      };
    case 'pruneRejectedInputs': {
      const changes = command.fieldPaths.map((fieldPath) => ({
        pageKey: command.section,
        fieldPath,
        draft: null,
      }));
      return {
        sections: input.sections,
        rejectedInputs: applyLegacyRejectedInputChanges(input.rejectedInputs, changes),
      };
    }
    case 'resetSection':
      return {
        sections: { ...input.sections, [command.section]: null },
        rejectedInputs: removeRejectedForSection(input, command.section),
      };
    case 'replaceCase': {
      const sections = Object.fromEntries(PERSISTED_SECTION_KEYS.map((section) => {
        const value = command.sections[section];
        return [section, value === undefined ? null : persistenceSchemas[section].parse(value)];
      })) as RuntimePersistedInputState['sections'];
      return { sections, rejectedInputs: {} };
    }
    case 'clearCase':
      return {
        sections: Object.fromEntries(
          PERSISTED_SECTION_KEYS.map((section) => [section, null])
        ) as RuntimePersistedInputState['sections'],
        rejectedInputs: {},
      };
  }
};

const createHistoryAfterMutation = (
  current: InputHistoryState,
  before: RuntimePersistedInputState,
  compatibility: Readonly<{
    fieldErrors: HistoryFrame['compatibilityFieldErrors'];
    fieldErrorRevisions: HistoryFrame['compatibilityFieldErrorRevisions'];
  }>,
  options: InputTransactionOptions,
  timestamp: number
): InputHistoryState => {
  const policy = options.history ?? (options.origin === undefined ? 'preserve' : 'capture');
  if (policy === 'clear') return createEmptyInputHistory();
  if (policy === 'preserve' || options.origin === undefined) {
    // Enhver ny inputgren invaliderer redo, også når housekeeping bevidst ikke fanger et undo-trin.
    return current.future.length === 0
      ? current
      : { past: current.past, future: [], sequence: current.sequence + 1 };
  }
  const sequence = current.sequence + 1;
  return {
    past: appendHistoryFrame(current.past, createHistoryFrame(
      before,
      options.origin,
      sequence,
      timestamp,
      compatibility
    )),
    future: [],
    sequence,
  };
};

const planHistoryRestore = (
  command: Extract<CompatibilityInputCommand, { kind: 'undo' | 'redo' }>,
  input: RuntimePersistedInputState,
  history: InputHistoryState,
  compatibility: Readonly<{
    fieldErrors: HistoryFrame['compatibilityFieldErrors'];
    fieldErrorRevisions: HistoryFrame['compatibilityFieldErrorRevisions'];
  }>,
  timestamp: number
): Readonly<{ input: RuntimePersistedInputState; history: InputHistoryState; frame: HistoryFrame }> | null => {
  if (command.kind === 'undo') {
    const frame = history.past.at(-1);
    if (frame === undefined) return null;
    const sequence = history.sequence + 1;
    const current = createHistoryFrame(input, frame.origin, sequence, timestamp, compatibility);
    return {
      input: frame.input,
      history: {
        past: history.past.slice(0, -1),
        future: [current, ...history.future].slice(0, INPUT_HISTORY_LIMIT),
        sequence,
      },
      frame,
    };
  }
  const frame = history.future[0];
  if (frame === undefined) return null;
  const sequence = history.sequence + 1;
  const current = createHistoryFrame(input, frame.origin, sequence, timestamp, compatibility);
  return {
    input: frame.input,
    history: {
      past: appendHistoryFrame(history.past, current),
      future: history.future.slice(1),
      sequence,
    },
    frame,
  };
};

const restoreStorageValue = (key: string, value: string | null): void => {
  if (value === null) removeSessionStorageValue(key);
  else writeSessionStorageValue(key, value);
};

type InputRuntimeState = ReturnType<typeof inputRuntimeStore.getState>;

type CommitPlan = Readonly<{
  candidate: RuntimePersistedInputState;
  authoritativeReplacement: boolean;
  clearFieldErrorsFor: ReadonlySet<StorageKey>;
  history: InputHistoryState;
  /** clearCase fjerner nøglen helt i stedet for at skrive en tom envelope. */
  removeEnvelope: boolean;
  restoredFrame: HistoryFrame | null;
  restoredFieldErrors?: Readonly<{
    cache: NonNullable<HistoryFrame['compatibilityFieldErrors']>;
    revisions: NonNullable<HistoryFrame['compatibilityFieldErrorRevisions']>;
  }>;
}>;

/**
 * Delt, uafhængig commit-kerne for alle write-veje (kompatibilitets- og typed-kommandoer): den
 * serialiserer og genvaliderer envelopen, skriver den ene sessionsnøgle med byte-verificeret read-back,
 * opdaterer runtime + history atomisk og ruller storage OG runtime tilbage til før-snapshot ved enhver fejl.
 */
const commitValidatedCandidate = (
  beforeState: InputRuntimeState,
  plan: CommitPlan,
  timestamp: number,
  additionalStorageKeysToRemove: readonly string[]
): InputTransactionResult => {
  const serialized = serializeInputEnvelope(plan.candidate);
  const validatedInput = parseInputEnvelope(serialized).input;
  const inputKey = getInputEnvelopeStorageKey();
  const extraKeys = [...new Set(additionalStorageKeysToRemove)].filter((key) => key !== inputKey);
  const backup = new Map<string, string | null>();
  for (const key of [inputKey, ...extraKeys]) backup.set(key, readSessionStorageValue(key));

  try {
    for (const key of extraKeys) removeSessionStorageValue(key);
    if (plan.removeEnvelope) {
      removeSessionStorageValue(inputKey);
      if (readSessionStorageValue(inputKey) !== null) {
        throw new Error('Inputenvelopen kunne ikke verificeres som slettet.');
      }
    } else {
      writeSessionStorageValue(inputKey, serialized);
      if (readSessionStorageValue(inputKey) !== serialized) {
        throw new Error('Inputenvelopen kunne ikke genlæses byte-for-byte efter skrivning.');
      }
    }

    inputRuntimeStore.getState().applyInputRuntimeCommit({
      input: validatedInput,
      history: plan.history,
      committedAt: timestamp,
      changedSections: changedCanonicalSections(beforeState.input, validatedInput),
      changedRejectedSections: changedRejectedSections(beforeState.input, validatedInput),
      authoritativeReplacement: plan.authoritativeReplacement,
      clearFieldErrorsFor: plan.clearFieldErrorsFor,
      ...(plan.restoredFieldErrors === undefined ? {} : { restoredFieldErrors: plan.restoredFieldErrors }),
    });
  } catch (error) {
    const rollbackErrors: Error[] = [];
    for (const [key, value] of backup) {
      try {
        restoreStorageValue(key, value);
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError instanceof Error ? rollbackError : new Error(String(rollbackError)));
      }
    }
    if (inputRuntimeStore.getState() !== beforeState) {
      try {
        // Store-apply kan have gennemført sit Zustand-write, før en observer kaster. Gendan derfor
        // hele før-snapshot'et direkte; runneren må aldrig efterlade storage og runtime ude af sync.
        inputRuntimeStore.setState(beforeState, true);
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError instanceof Error ? rollbackError : new Error(String(rollbackError)));
      }
    }
    if (rollbackErrors.length > 0) {
      throw new Error(`Inputtransaktionen fejlede, og rollback fejlede: ${rollbackErrors.map((item) => item.message).join(' | ')}`);
    }
    throw error;
  }

  return {
    changed: true,
    revision: inputRuntimeStore.getState().revision,
    restoredFrame: plan.restoredFrame,
  };
};

const assertWritesNotBlocked = (beforeState: InputRuntimeState, isClearCase: boolean): void => {
  if (beforeState.meta.inputWritesBlocked === true && !isClearCase) {
    throw new Error('Inputændringer er blokeret, fordi gemte browserdata ikke kunne indlæses sikkert.');
  }
};

/** Eneste write-grænse for afsluttet input, replacements og history-restore. */
export const executeInputTransaction = (
  command: CompatibilityInputCommand,
  options: InputTransactionOptions = {}
): InputTransactionResult => {
  const beforeState = inputRuntimeStore.getState();
  assertWritesNotBlocked(beforeState, command.kind === 'clearCase');
  const timestamp = options.now ?? Date.now();
  const restore = command.kind === 'undo' || command.kind === 'redo'
    ? planHistoryRestore(command, beforeState.input, beforeState.history, {
        fieldErrors: beforeState.fieldErrors,
        fieldErrorRevisions: beforeState.fieldErrorRevisions,
      }, timestamp)
    : null;

  if ((command.kind === 'undo' || command.kind === 'redo') && restore === null) {
    return { changed: false, revision: beforeState.revision, restoredFrame: null };
  }

  const candidate = restore?.input ?? buildCandidate(
    beforeState.input,
    command as Exclude<CompatibilityInputCommand, { kind: 'undo' | 'redo' }>
  );
  const forceReplacement = command.kind === 'replaceCase' || command.kind === 'clearCase';
  if (!forceReplacement && restore === null && deepEqual(candidate, beforeState.input)) {
    return { changed: false, revision: beforeState.revision, restoredFrame: null };
  }

  const authoritativeReplacement = restore !== null || forceReplacement;
  const clearFieldErrorsFor = authoritativeReplacement
    ? new Set(PERSISTED_SECTION_KEYS)
    : command.kind === 'resetSection'
      ? new Set<StorageKey>([command.section])
      : new Set<StorageKey>();

  return commitValidatedCandidate(beforeState, {
    candidate,
    authoritativeReplacement,
    clearFieldErrorsFor,
    history: restore?.history ?? createHistoryAfterMutation(
      beforeState.history,
      beforeState.input,
      { fieldErrors: beforeState.fieldErrors, fieldErrorRevisions: beforeState.fieldErrorRevisions },
      options,
      timestamp
    ),
    removeEnvelope: command.kind === 'clearCase',
    restoredFrame: restore?.frame ?? null,
    ...(restore?.frame.compatibilityFieldErrors === undefined ? {} : {
      restoredFieldErrors: {
        cache: restore.frame.compatibilityFieldErrors,
        revisions: restore.frame.compatibilityFieldErrorRevisions ?? beforeState.fieldErrorRevisions,
      },
    }),
  }, timestamp, options.additionalStorageKeysToRemove ?? []);
};

/**
 * Typed inputkommandoer fra de migrerede overflader (fase 4). Kommandoen bærer en katalogvalideret
 * `FieldRef`; runneren bygger kandidaten via den ÉNE fælles reducer ({@link buildInputCommandCandidate})
 * og deler commit-kernen med kompatibilitetsvejen.
 *
 * Rejected input adresseres nu strukturelt (feltets rigtige `FieldAddress`), ikke via en sentinel — så
 * celle-/rækkefelter er understøttet, og sletning fjerner descendant-rejections atomisk. De endnu ikke
 * migrerede read-consumers ser fortsat identisk `invalidDrafts`-view: den strukturelle top-level-adresse
 * projiceres i ét choke-point tilbage til feltnavnet (= det gamle fieldPath). Den transitionelle
 * projektion + envelope-accept af legacy-bro-celleadresser slettes, når sidste overflade er migreret.
 */
export type TypedRuntimeInputCommand<TField = unknown, TEntity = unknown> =
  | CommitImmediateFieldCommand<TField>
  | SettleFieldCommand<TField>
  | InsertRowCommand<TEntity>
  | DeleteRowCommand<TEntity>
  | ReorderRowsCommand<TEntity>
  | SettleFieldInNewRowCommand<TEntity, TField>;

const buildTypedCandidate = <TField, TEntity>(
  input: RuntimePersistedInputState,
  command: TypedRuntimeInputCommand<TField, TEntity>
): RuntimePersistedInputState =>
  buildInputCommandCandidate(input, command, getProductionInputCatalog()) as RuntimePersistedInputState;

export const executeTypedInputTransaction = <TField, TEntity>(
  command: TypedRuntimeInputCommand<TField, TEntity>,
  options: InputTransactionOptions = {}
): InputTransactionResult => {
  const beforeState = inputRuntimeStore.getState();
  assertWritesNotBlocked(beforeState, false);
  const timestamp = options.now ?? Date.now();
  const candidate = buildTypedCandidate(beforeState.input, command);
  if (deepEqual(candidate, beforeState.input)) {
    return { changed: false, revision: beforeState.revision, restoredFrame: null };
  }

  return commitValidatedCandidate(beforeState, {
    candidate,
    authoritativeReplacement: false,
    clearFieldErrorsFor: new Set<StorageKey>(),
    history: createHistoryAfterMutation(
      beforeState.history,
      beforeState.input,
      { fieldErrors: beforeState.fieldErrors, fieldErrorRevisions: beforeState.fieldErrorRevisions },
      options,
      timestamp
    ),
    removeEnvelope: false,
    restoredFrame: null,
  }, timestamp, options.additionalStorageKeysToRemove ?? []);
};
