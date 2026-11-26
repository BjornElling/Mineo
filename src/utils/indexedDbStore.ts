import { logError } from './logger';
import { asError } from './typeGuards';

/**
 * Kanonisk IndexedDB-primitiv: ejer forbindelse, transaction-livscyklus og
 * promisificering af requests.
 *
 * Baggrund: repoet havde TO uafhængige IndexedDB-wrappers – `fileHandleStorage.ts` (10
 * funktioner, der hver åbnede databasen, startede en transaction og hånd-wrappede ét
 * `get`/`put`/`delete` i `new Promise` med gentagne `onsuccess`/`onerror`/`oncomplete`/
 * `close`) og `logStorage.ts` med sin egen `openDatabase`-kopi. Plumbingen var identisk;
 * kun store-formen adskiller sig reelt. Derfor deles plumbingen her, mens hver forbruger
 * beholder sin egen databasedefinition.
 *
 * Bemærk hvad der IKKE er samlet: de to databaser er bevidst adskilte. `mineo_file_handles`
 * er et keyed kv-store til fil-handles; `MineoLogs` er et append-only log-store med
 * `autoIncrement`-keyPath og to indexes, der læses med cursors. At presse dem ind i samme
 * store ville blande to forskellige datamodeller for at spare en DB-definition.
 *
 * Egenskaber, som hånd-wrapping pr. kaldested ikke giver ensartet:
 * - **Én tilgængelighedsguard.** Utilgængelighed er én eksplicit `unavailable`-tilstand, som
 *   kalderen oversætter til sin egen fail-safe værdi – ikke et `typeof indexedDB`-tjek pr.
 *   funktion med hver sin returværdi.
 * - **Transaction som enhed.** Flere writes i samme transaction ventes af
 *   `transaction.oncomplete`, ikke af manuelt koordinerede `done`-flag pr. request. Enten lander
 *   hele transactionen, eller ingen af den.
 * - **Forbindelsen lukkes altid** – også når transactionen fejler eller afbrydes.
 */

export type IndexedDbSchema = Readonly<{
  databaseName: string;
  version: number;
  /** Kaldes ved `onupgradeneeded`; skal oprette/migrere stores idempotent. */
  upgrade: (db: IDBDatabase) => void;
}>;

/**
 * Resultatet af en store-operation. `unavailable` er ikke en fejl: IndexedDB findes
 * legitimt ikke i alle miljøer (private mode, ældre WebView, jsdom under test), og hver
 * kalder afgør selv, hvad den korrekte fail-safe værdi er i netop dens tilfælde.
 */
export type IndexedDbResult<T> =
  | Readonly<{ status: 'ok'; value: T }>
  | Readonly<{ status: 'unavailable' }>
  | Readonly<{ status: 'error'; error: Error }>;

export const isIndexedDbAvailable = (): boolean =>
  typeof indexedDB !== 'undefined' && typeof IDBKeyRange !== 'undefined';

/** Promisificerer én `IDBRequest`. Brug inde i en `runTransaction`-callback. */
export const awaitRequest = <T>(request: IDBRequest<T>): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB-request fejlede'));
  });

const DATABASE_OPEN_TIMEOUT_MS = 2_000;
const TRANSACTION_TIMEOUT_MS = 5_000;

const openDatabase = (schema: IndexedDbSchema): Promise<IDBDatabase> =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(schema.databaseName, schema.version);
    let abandoned = false;
    const fail = (error: Error): void => {
      abandoned = true;
      clearTimeout(timer);
      reject(error);
    };
    const timer = setTimeout(() => fail(new Error('IndexedDB svarede ikke ved åbning')), DATABASE_OPEN_TIMEOUT_MS);
    request.onblocked = () => fail(new Error('IndexedDB-åbningen blev blokeret af en anden forbindelse'));
    request.onerror = () => fail(request.error ?? new Error('IndexedDB kunne ikke åbnes'));
    request.onsuccess = () => {
      clearTimeout(timer);
      if (abandoned) {
        request.result.close();
        return;
      }
      resolve(request.result);
    };
    request.onupgradeneeded = () => {
      // Et forladt opslag må ikke senere ændre databasen eller holde en åben forbindelse.
      if (abandoned) {
        request.transaction?.abort();
        return;
      }
      schema.upgrade(request.result);
    };
  });

/**
 * Kører `work` i én transaction over `storeNames` og lukker forbindelsen bagefter.
 *
 * Resultatet returneres først, når transactionen er **committet** (`oncomplete`) – ikke når
 * den sidste request lykkedes. Det er forskellen på "requesten svarede" og "dataene er
 * gemt", og den skelnen er her eksplicit.
 *
 * `work` må ikke `await` noget uden for transactionen: IndexedDB auto-committer en
 * transaction, så snart microtask-køen tømmes uden aktive requests.
 */
export const runTransaction = async <T>(
  schema: IndexedDbSchema,
  storeNames: readonly string[],
  mode: IDBTransactionMode,
  work: (transaction: IDBTransaction) => Promise<T>,
  context: string,
  options?: Readonly<{ silent?: boolean }>
): Promise<IndexedDbResult<T>> => {
  if (!isIndexedDbAvailable()) {
    return { status: 'unavailable' };
  }

  let db: IDBDatabase | undefined;
  try {
    db = await openDatabase(schema);
    const database = db;

    const transaction = database.transaction([...storeNames], mode);

    /**
     * Transactionens udfald som en selvstændig promise. Den oprettes FØR `work` afvikles, så
     * en `oncomplete`/`onerror`, der fyrer mens `work` stadig er undervejs, ikke går tabt.
     */
    const settled = new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () =>
        reject(transaction.error ?? new Error('IndexedDB-transaction fejlede'));
      transaction.onabort = () =>
        reject(transaction.error ?? new Error('IndexedDB-transaction blev afbrudt'));
    });

    // Observér abort med det samme, også hvis en request aldrig leverer sin egen fejlhændelse.
    void settled.catch(() => undefined);

    let timer: ReturnType<typeof setTimeout> | undefined;
    let abortRequested = false;
    try {
      const operation = work(transaction);
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          if (mode !== 'readonly') {
            // En skrivning må kun opgives, hvis databasen accepterer abort. I
            // committing-tilstand ejer oncomplete/onabort stadig udfaldet.
            try {
              transaction.abort();
              abortRequested = true;
            } catch {
              return;
            }
          }
          reject(new Error('IndexedDB svarede ikke under transaktionen'));
        }, TRANSACTION_TIMEOUT_MS);
      });
      const result = mode === 'readonly' ? operation : Promise.all([operation, settled]).then(([value]) => value);
      const value = await Promise.race([result, settled.then(() => result), timeout]);
      return { status: 'ok', value };
    } catch (workError: unknown) {
      // Rul transactionen tilbage, så en delvis skrivning ikke committes, og lad
      // ARBEJDETS fejl være årsagen – ikke den afledte abort.
      if (!abortRequested) {
        try { transaction.abort(); } catch { /* allerede afsluttet */ }
      }
      throw asError(workError);
    } finally {
      clearTimeout(timer);
    }
  } catch (error: unknown) {
    const wrapped = asError(error);
    if (options?.silent !== true) {
      logError('IndexedDB-operation fejlede', { context, error: wrapped });
    }
    return { status: 'error', error: wrapped };
  } finally {
    // Forbindelsen lukkes ALTID – også når transactionen fejlede eller blev afbrudt.
    // Lukkes der kun i `transaction.oncomplete`, efterlader en fejlende transaction forbindelsen åben.
    try { db?.close(); } catch { /* forbindelsen var allerede lukket */ }
  }
};

/**
 * Som {@link runTransaction}, men uden fejllogning.
 *
 * Kun for **passive observatører**: kald der sker ved mount/re-render for at VISE en
 * eksisterende tilstand, og hvor en manglende eller fejlende læsning er en normal,
 * forventelig tilstand – ikke en hændelse, brugeren eller loggen skal forstyrres af.
 * Brug den ikke for at dæmpe en fejl, der reelt betyder noget.
 */
export const runTransactionSilently = async <T>(
  schema: IndexedDbSchema,
  storeNames: readonly string[],
  mode: IDBTransactionMode,
  work: (transaction: IDBTransaction) => Promise<T>
): Promise<IndexedDbResult<T>> =>
  runTransaction(schema, storeNames, mode, work, 'silent', { silent: true });

/**
 * Bekvemmeligheds-indpakning: kører `work` og oversætter både `unavailable` og `error` til
 * én `fallback`-værdi. Brug den, hvor kalderen behandler "ingen IndexedDB" og "IndexedDB
 * fejlede" ens – fx en device-lokal cache, der blot degraderer til tom.
 */
export const runTransactionOr = async <T>(
  fallback: T,
  schema: IndexedDbSchema,
  storeNames: readonly string[],
  mode: IDBTransactionMode,
  work: (transaction: IDBTransaction) => Promise<T>,
  context: string
): Promise<T> => {
  const result = await runTransaction(schema, storeNames, mode, work, context);
  return result.status === 'ok' ? result.value : fallback;
};
