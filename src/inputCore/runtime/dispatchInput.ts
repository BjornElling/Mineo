import { deepEqual } from '../../utils/deepEqual';
import { getCurrentInputEnvelopeStorageKey } from '../../config/storageManifest';
import {
  readSessionStorageValue,
  writeSessionStorageValue,
  removeSessionStorageValue,
} from '../../utils/safeSessionStorage';
import type { InputCatalog } from '../fieldCatalog';
import { fieldAddressSchema } from '../fieldAddress';
import {
  isStructuralInputCommand,
  reduceInputCommand,
  type InputMutationCommand,
  type StructuralCommandKind,
} from '../inputReducer';
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

/**
 * Options for en STRUKTUREL rækkecommand (§3.7, WI-004 runde 4, fund S4): origin er PÅKRÆVET.
 *
 * Skaden, fund S4 beskrev, var at origin kunne udelades HELT: history gemte `undefined`, og en undo kunne
 * gendanne en række uden noget sted at navigere til. Kravet er derfor "der SKAL være en origin" — ikke
 * "originen skal være af arten `collection`".
 *
 * ⚠️ Originens ART beskriver handlingens restore-anker og er bevidst fri:
 * - En brugerudløst rækkehandling (tilføj/slet/omarranger) har intet enkelt felt → `CollectionHistoryOrigin`,
 *   hvis route + fane er påkrævede i typen.
 * - En række-PROMOVERING (første settle i en placeholder-celle) er kontraktligt et FELT-settle
 *   (`form-contract.md` §3.8) og bærer et `FieldHistoryOrigin`, så undo fokuserer præcis den celle, brugeren
 *   skrev i. Det er den mest brugbare destination — at kræve en collection-origin dér ville tvinge en
 *   dårligere restore frem.
 */
export type StructuralDispatchInputOptions = Readonly<{
  origin: HistoryOrigin;
  now?: number;
}>;

/**
 * De commandarter, der ændrer en collections rækkestruktur. `transaction` er med, fordi en transaktion KAN
 * indeholde et strukturelt trin — den konservative type kræver derfor origin for enhver transaktion, mens
 * runtime-værnet er præcist og kun kræver det, når et trin faktisk er strukturelt.
 */
export type { StructuralCommandKind };

export type StructuralInputCommand<TField = unknown, TEntity = unknown> = Extract<
  RuntimeInputCommand<TField, TEntity>,
  { kind: StructuralCommandKind }
>;

/**
 * En brugbar anker-streng: ikke-tom OG uden omgivende whitespace — samme standard som `addressPartSchema`
 * i `fieldAddress.ts`, så et anker ikke kan bestå med `' '` (som `!== ''` ville godtage) og efterlade
 * restoren med et locationId/route, der ikke matcher nogen faktisk lokation.
 */
const isUsableAnchorString = (value: unknown): boolean =>
  typeof value === 'string' && value.trim() !== '' && value.trim() === value;

/**
 * Er dette en fuldt brugbar feltadresse? Ankeret gemmes i history og serialiseres senere af restoren, så en
 * halv adresse ville først fejle DÉR — langt fra fejlkilden.
 *
 * Validerer mod `fieldAddressSchema`, som er den KANONISKE adresseform (samme skema `serializeFieldAddress`
 * parser med). En håndrullet tjek-liste ville drifte: en tidligere udgave godtog fx `path: [{}]`, fordi den
 * kun tjekkede at `path` var et array — ikke segmenternes form.
 */
const isUsableFieldAddress = (address: unknown): boolean =>
  fieldAddressSchema.safeParse(address).success;

/**
 * Afviser en strukturel rækkecommand uden brugbart restore-anker — før nogen observerbar mutation.
 *
 * Validerer originens diskriminator OG hvert obligatorisk felts faktiske brugbarhed, så hverken et castet
 * `{}`, et delvist origin, en ukendt `kind` eller et whitespace-anker slipper igennem fra utypet kode.
 */
const assertStructuralOrigin = (
  command: Readonly<{ kind: string }>,
  origin: HistoryOrigin | undefined
): void => {
  if (!isStructuralInputCommand(command)) return;
  // Tjekker TYPEN og BEGGE diskriminatorer eksplicit — ikke blot `!== ''` og en else-gren. Et delvist origin
  // som `{ kind: 'collection' }` har `undefined` i sine felter (og `undefined !== ''` er sandt), og en
  // ukendt `kind` ville falde ned i rækkehandlings-grenen og passere som noget, den ikke er.
  const valid = origin !== undefined
    && isUsableAnchorString(origin.editorLocationId)
    // En destination må UDELADES HELT (standalone er en reelt ikke-navigerbar lokation), men er `route`
    // ANGIVET, skal den være brugbar OG følges af en eksplicit `tabKey` — en `tabKey` uden `route` er
    // lydløst inert, fordi restoren kun aktiverer fanen inde i `route !== undefined`-grenen.
    // `OriginDestination` er en alt-eller-intet-union, så dette værn dækker kun castede kald.
    && (origin.route === undefined
      ? origin.tabKey === undefined
      : isUsableAnchorString(origin.route)
        && (origin.tabKey === null || isUsableAnchorString(origin.tabKey)))
    && (origin.kind === 'field'
      // Et feltanker skal have en fuld adresse at fokusere; route/fane er valgfri (standalone-lokationer).
      ? isUsableFieldAddress(origin.field)
      // En rækkehandling har ingen feltadresse, så collection + route + fane ER dens eneste destination:
      // dér er de PÅKRÆVEDE. `tabKey: null` er den EKSPLICITTE måde at sige "siden har ingen faner".
      : origin.kind === 'collection'
        && isUsableAnchorString(origin.collection)
        && isUsableAnchorString(origin.route)
        && origin.tabKey !== undefined);
  if (valid) return;
  throw new Error(
    `Strukturel inputcommand (${command.kind}) kræver en history-origin, så undo/redo har et `
    + 'restore-anker til den gendannede række (§3.7).'
  );
};

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
 *
 * STRUKTURELLE rækkecommands (insert/delete/reorder/settle-i-ny-række, og en transaktion der indeholder
 * mindst ét sådant trin) kræver en origin, så undo/redo har et restore-anker. Den ENE generiske signatur med
 * betinget options-type håndhæver det på typeniveau — en permissiv overload ved siden af ville gøre origin
 * valgfri igen for samme command. `assertStructuralOrigin` håndhæver det også på runtime, så et cast eller et
 * utypet kald ikke kan omgå det (§3.7, WI-004 runde 4, fund S4).
 */
export function dispatchInput<
  TField,
  TEntity,
  TKind extends RuntimeInputCommand<TField, TEntity>['kind'],
>(
  store: SlimInputStore,
  catalog: InputCatalog,
  command: RuntimeInputCommand<TField, TEntity> & { kind: TKind },
  ...options: TKind extends StructuralCommandKind
    ? [options: StructuralDispatchInputOptions]
    : [options?: DispatchInputOptions]
): DispatchInputResult;
export function dispatchInput<TField, TEntity>(
  store: SlimInputStore,
  catalog: InputCatalog,
  command: RuntimeInputCommand<TField, TEntity>,
  options: DispatchInputOptions = {}
): DispatchInputResult {
  const before = store.getState();

  // §1.12: efter en hydrationsfejl er kun `Slet alt` (clearCase) tilladt; alt andet er fail-closed.
  if (before.meta.inputWritesBlocked === true && command.kind !== 'clearCase') {
    throw new Error('Inputændringer er blokeret, fordi gemte browserdata ikke kunne indlæses sikkert.');
  }

  // Runtime-værnet, FØR reducer, storage, store og history: en strukturel rækkeændring uden navigerbar
  // destination afvises uden nogen observerbar mutation. Overloadene fanger det i compileren; dette fanger
  // et cast, et `as any` eller et kald fra utypet kode.
  assertStructuralOrigin(command, options.origin);

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
}
