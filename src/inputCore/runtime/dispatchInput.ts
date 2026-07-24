import { deepEqual } from '../../utils/deepEqual';
import { getCurrentInputEnvelopeStorageKey } from '../../config/storageManifest';
import {
  readSessionStorageValue,
  writeSessionStorageValue,
  removeSessionStorageValue,
} from '../../utils/safeSessionStorage';
import type { InputCatalog } from '../fieldCatalog';
import { reduceInputCommand, type InputMutationCommand } from '../inputReducer';
import {
  createInputHistory,
  pushInputHistory,
  redoInputHistory,
  undoInputHistory,
  type HistoryOrigin,
  type InputHistory,
} from '../inputHistory';
import type { InputRevision } from '../evaluationSource';
import type { SettledInput } from '../settledInput';
import { parseCurrentEnvelope, serializeCurrentEnvelope } from './currentSessionEnvelope';
import type { SlimInputStore, SlimInputStoreState } from './slimInputStore';

// Greenfield-runtime (§3.6): den ENE autoritative write-grænse. Alle inputændringer — felt, række, system og
// history — går gennem `dispatchInput`. Den bygger kandidaten med den rene reducer/history, serialiserer den ene
// current-only envelope, skriver med byte-verificeret read-back, opdaterer store + revision + history i ét
// store-write og ruller BÅDE storage og store tilbage til før-snapshot ved enhver fejl. Der er ingen anden vej ind.

export type RuntimeInputCommand<TField = unknown, TEntity = unknown> =
  | InputMutationCommand<TField, TEntity>
  | Readonly<{ kind: 'undo' }>
  | Readonly<{ kind: 'redo' }>;

export type DispatchInputOptions = Readonly<{
  /** Struktur-origin for history-/fejlnavigation (§3.7). Ikke relevant for undo/redo. */
  origin?: HistoryOrigin;
  /** Deterministisk tidsstempel til test; ellers `Date.now()`. */
  now?: number;
}>;

export type DispatchInputResult = Readonly<{
  changed: boolean;
  revision: InputRevision;
  /**
   * Kun sat efter en SUCCESFULD undo/redo (§3.7): origin for det gendannede history-frame, så shellen kan navigere
   * til den rette route/fane og fokusere det felt, ændringen kom fra. Fraværende for alle andre commands, for en
   * no-op undo/redo og hvis det gendannede frame ingen origin havde — så en mislykket/tom restore aldrig navigerer.
   */
  restoredOrigin?: HistoryOrigin;
}>;

// Tjekker kun diskriminatoren; en løs parametertype undgår den contravariant generiske variansfælde.
const isAuthoritativeReplacement = (command: Readonly<{ kind: string }>): boolean =>
  command.kind === 'replaceCase' || command.kind === 'clearCase';

/**
 * Serialiserer kandidaten, genlæser den byte-for-byte og opdaterer store atomisk. Runtime-sandheden er den
 * round-trippede/katalog-validerede form — nøjagtig det, F5 ville genindlæse — så no-op-detektion og persistens
 * aldrig kan drifte fra hinanden (JSON dropper fx `undefined`-nøgler). Ruller storage OG store tilbage ved fejl.
 */
const commitCandidate = (
  store: SlimInputStore,
  catalog: InputCatalog,
  before: SlimInputStoreState,
  candidateInput: SettledInput,
  nextHistory: InputHistory,
  committedAt: number,
  /**
   * Autoritativ hel-sags-replacement (replaceCase/clearCase) skriver ALTID og skaber en ny revision (§3.7),
   * også når indholdet er identisk. Det er nødvendigt, for at `Slet alt` kan rydde en bevaret korrupt kilde og
   * ophæve `writesBlocked` (§1.12), selv når runtime-input allerede er tomt.
   */
  force: boolean
): DispatchInputResult => {
  const serialized = serializeCurrentEnvelope(candidateInput);
  const persisted = catalog.validateSettledInput(parseCurrentEnvelope(serialized));

  // §3.6 pkt. 4: afvis semantisk no-op uden et write, en revision eller et history-trin.
  if (!force && deepEqual(persisted, before.input)) {
    return Object.freeze({ changed: false, revision: before.revision });
  }

  const key = getCurrentInputEnvelopeStorageKey();
  const backup = readSessionStorageValue(key);

  try {
    writeSessionStorageValue(key, serialized);
    if (readSessionStorageValue(key) !== serialized) {
      throw new Error('Inputenvelopen kunne ikke genlæses byte-for-byte efter skrivning.');
    }
    store.getState().applyCommit({
      input: persisted,
      history: nextHistory,
      committedAt,
      authoritativeReplacement: force,
    });
  } catch (error) {
    const rollbackErrors: Error[] = [];
    let storageRollbackVerified = false;
    try {
      if (backup === null) removeSessionStorageValue(key);
      else writeSessionStorageValue(key, backup);
      const restored = readSessionStorageValue(key);
      storageRollbackVerified = restored === backup;
      if (!storageRollbackVerified) {
        throw new Error('Inputenvelopens rollback kunne ikke genlæses byte-for-byte.');
      }
    } catch (rollbackError) {
      rollbackErrors.push(rollbackError instanceof Error ? rollbackError : new Error(String(rollbackError)));
    }
    const restoredStoreState = storageRollbackVerified
      ? before
      : {
          ...before,
          meta: { ...before.meta, inputWritesBlocked: true },
        };
    if (store.getState() !== restoredStoreState) {
      try {
        // applyCommit kan have gennemført sit set, før en subscriber kastede. Gendan hele før-snapshot'et, så
        // storage og runtime aldrig efterlades ude af sync. Kan storage-rollback ikke bevises, blokeres alle
        // efterfølgende writes fail-closed, indtil brugeren vælger den autoritative "Slet alt"-handling.
        store.setState(restoredStoreState, true);
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError instanceof Error ? rollbackError : new Error(String(rollbackError)));
      }
    }
    if (rollbackErrors.length > 0) {
      throw new Error(
        `Inputtransaktionen fejlede, og rollback fejlede: ${rollbackErrors.map((item) => item.message).join(' | ')}`
      );
    }
    throw error;
  }

  return Object.freeze({ changed: true, revision: store.getState().revision });
};

/**
 * Udsteder én autoritativ inputkommando mod den givne store + katalog. Ukendte/slettede feltreferencer og
 * XOR-brud afvises af reduceren FØR nogen observerbar mutation (§7.4). Én brugerhandling giver højst ét
 * history-trin og præcis én ny revision ved reel ændring (§3.6).
 */
export const dispatchInput = <TField, TEntity>(
  store: SlimInputStore,
  catalog: InputCatalog,
  command: RuntimeInputCommand<TField, TEntity>,
  options: DispatchInputOptions = {}
): DispatchInputResult => {
  const before = store.getState();

  // §1.12: efter en hydrationsfejl er kun `Slet alt` (clearCase) tilladt; alt andet er fail-closed.
  if (before.meta.inputWritesBlocked === true && command.kind !== 'clearCase') {
    throw new Error('Inputændringer er blokeret, fordi gemte browserdata ikke kunne indlæses sikkert.');
  }

  const committedAt = options.now ?? Date.now();

  if (command.kind === 'undo' || command.kind === 'redo') {
    const transition = command.kind === 'undo'
      ? undoInputHistory(before.history, before.input)
      : redoInputHistory(before.history, before.input);
    if (!transition.changed) return Object.freeze({ changed: false, revision: before.revision });
    const result = commitCandidate(
      store, catalog, before, transition.target.input, transition.history, committedAt, false
    );
    // Surface KUN origin efter en gennemført commit (§3.7): en fejlende commit rammer aldrig hertil (den kaster/
    // ruller tilbage i commitCandidate), og et frame uden origin giver ingen restore. Shellen navigerer derfor
    // aldrig efter en mislykket eller tom restore.
    if (result.changed && transition.target.origin !== undefined) {
      return Object.freeze({ ...result, restoredOrigin: transition.target.origin });
    }
    return result;
  }

  // Ren, validerende reducer: bygger kandidaten og afviser ukendte refs/XOR-brud før mutation.
  const reduced = reduceInputCommand(before.input, command, catalog);
  const authoritative = isAuthoritativeReplacement(command);
  const nextHistory = authoritative
    ? createInputHistory() // §3.7: hel-sags-replacement rydder history.
    : pushInputHistory(before.history, before.input, options.origin);

  return commitCandidate(store, catalog, before, reduced.input, nextHistory, committedAt, authoritative);
};
