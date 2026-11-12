import { awaitRequest, isIndexedDbAvailable, runTransaction, type IndexedDbSchema } from '../utils/indexedDbStore';

/**
 * Den autoritative kopi af programindstillingerne til skrivninger fra flere faner.
 *
 * **Fejlen, dette lukker.** Indstillingerne lå kun i `localStorage`, og to fanes samtidige valg blev
 * serialiseret af en Web Lock: hver fane læste lageret inde i låsen og skrev sit valg oven på det. Det er
 * ikke nok. Chromium synkroniserer `localStorage` ASYNKRONT mellem renderer-processer, så fanen, der fik
 * låsen som nummer to, kunne stadig læse værdien fra før den første skrivning – og overskrev den. I e2e
 * (UI-009) tabte op til hver anden kørsel under belastning det ene valg.
 *
 * IndexedDB er transaktionel på tværs af processer: én `readwrite`-transaction læser den seneste værdi og
 * skriver den nye atomisk. `localStorage` beholdes som spejl, fordi temaet skal kunne læses synkront før
 * første render (`themeBootstrap.ts`), og fordi `storage`-eventen er den, andre faner opdateres af.
 */

const DATABASE: IndexedDbSchema = {
  databaseName: 'mineo_app_settings',
  version: 1,
  upgrade: (db) => {
    if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings');
  },
};

const STORE = 'settings';
const CURRENT_KEY = 'current';

export const isAppSettingsCommitStoreAvailable = (): boolean => isIndexedDbAvailable();

/**
 * Læser den seneste committede værdi og skriver `next(base)` i samme transaktion.
 *
 * `fallbackRaw` bruges som grundlag, når IndexedDB endnu ikke har en værdi (første skrivning efter
 * opdatering til denne version), så eksisterende indstillinger fra `localStorage` bevares.
 * Returnerer den skrevne råtekst, eller `null` hvis IndexedDB ikke kunne bruges – så skriver kalderen
 * på den hidtidige måde.
 */
export const commitAppSettingsRaw = async (
  fallbackRaw: string | undefined,
  next: (baseRaw: string | undefined) => string,
): Promise<string | null> => {
  const result = await runTransaction(DATABASE, [STORE], 'readwrite', async (transaction) => {
    const store = transaction.objectStore(STORE);
    const stored: unknown = await awaitRequest(store.get(CURRENT_KEY));
    const serialized = next(typeof stored === 'string' ? stored : fallbackRaw);
    await awaitRequest(store.put(serialized, CURRENT_KEY));
    return serialized;
  }, 'appSettings.commit');
  return result.status === 'ok' ? result.value : null;
};

/**
 * Fjerner den autoritative kopi, når en skrivning måtte gå uden om IndexedDB. Ellers kunne en senere
 * commit bygge på en ældre værdi end den, `localStorage` har fået.
 */
export const discardCommittedAppSettings = async (): Promise<void> => {
  await runTransaction(DATABASE, [STORE], 'readwrite', async (transaction) => {
    await awaitRequest(transaction.objectStore(STORE).delete(CURRENT_KEY));
  }, 'appSettings.discard', { silent: true });
};
