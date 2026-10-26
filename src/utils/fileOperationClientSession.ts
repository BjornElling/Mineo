import { getFileOperationClientSessionStorageKey, getPendingPwaSourceSessionStorageKey } from '../config/storageManifest';
import { z } from 'zod';
import {
  readOptionalSessionStorageValue,
  writeOptionalSessionStorageValue,
  removeOptionalSessionStorageValue,
} from './safeSessionStorage';

const CLIENT_SESSION_ID_PATTERN = /^[a-z0-9-]{16,128}$/i;
const legacyClientSessionIdSchema = z.string().regex(CLIENT_SESSION_ID_PATTERN);
const OWNED_CLIENT_PREFIX = 'owned:';

export const readPendingPwaSourceSessionId = (): string | null => {
  const parsed = legacyClientSessionIdSchema.safeParse(readOptionalSessionStorageValue(getPendingPwaSourceSessionStorageKey()));
  return parsed.success ? parsed.data : null;
};

export const clearPendingPwaSourceSessionId = (expected: string): void => {
  if (readPendingPwaSourceSessionId() === expected) {
    removeOptionalSessionStorageValue(getPendingPwaSourceSessionStorageKey());
  }
};

/** Bevarer kun en eksakt pending-reference, aldrig et current handle fra et ubeskyttet scope. */
export const preservePendingPwaSourceSessionId = (id: string): boolean =>
  legacyClientSessionIdSchema.safeParse(id).success
  && writeOptionalSessionStorageValue(getPendingPwaSourceSessionStorageKey(), id);

let clientSessionId: string | null = null;
export type FileOperationClientSession = Readonly<{ id: string; reloadStable: boolean; resumedAfterPageHide: boolean }>;
let ownedSession: FileOperationClientSession | null = null;
let pendingSession: Promise<FileOperationClientSession> | null = null;
let releaseOwnership: (() => void) | null = null;
let lifecycleEpoch = 0;
let hasHidden = false;
let listeningForPageHide = false;
const activeStorageOperations = new Map<string, number>();
const deferredReleases = new Map<string, () => void>();

const onPageHide = (): void => {
  const hiddenSession = ownedSession;
  const release = releaseOwnership;
  lifecycleEpoch += 1;
  hasHidden = true;
  ownedSession = null;
  clientSessionId = null;
  releaseOwnership = null;
  if (release && hiddenSession) {
    // En allerede startet IDB-transaction skal afsluttes før en anden klient må
    // overtage scope. Nye operationer får et nyt ID efter pagehide.
    if ((activeStorageOperations.get(hiddenSession.id) ?? 0) > 0) deferredReleases.set(hiddenSession.id, release);
    else release();
  }
};

const acquireOwnership = (id: string): Promise<(() => void) | null> => new Promise((resolve, reject) => {
  let release: (() => void) | undefined;
  const held = new Promise<void>((done) => { release = done; });
  void navigator.locks.request(`mineo-file-client:${id}`, { mode: 'exclusive', ifAvailable: true }, (lock) => {
    if (!lock) {
      resolve(null);
      return;
    }
    resolve(() => release?.());
    return held;
  }).catch(reject);
});

const createClientSessionId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  // Fallbacken bruges kun i miljøer uden crypto.randomUUID. Den er ikke en sikkerhedstoken, men
  // en isolation mellem browserklienter; tidsstempel og tilfældig suffix gør kollision praktisk
  // udelukket uden at gøre filhåndtering afhængig af en manglende browser-API.
  return `client-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
};

/**
 * Returnerer den fane-ejede identitet for device-lokale filhåndtag og PWA-handoff.
 *
 * IndexedDB er origin-fælles, mens `sessionStorage` følger den konkrete fane/PWA-klient. Uden
 * denne binding kunne to samtidige sager dele handle eller rydde hinandens pending filrequest.
 */
export const getFileOperationClientSessionId = (): string => {
  if (clientSessionId !== null) return clientSessionId;
  // Et PWA-event får straks et unikt request-id. Lagret klientidentitet må først
  // anvendes til IndexedDB, når det asynkrone ejerskab nedenfor er bekræftet.
  clientSessionId = createClientSessionId();
  return clientSessionId;
};

/**
 * sessionStorage kopieres ved åbning af en ny fane. En eksklusiv Web Lock beviser,
 * at netop dette dokument ejer scope, før et lagret filhåndtag eller PWA-request læses.
 */
export const ensureFileOperationClientSession = async (): Promise<FileOperationClientSession> => {
  if (ownedSession) return ownedSession;
  if (pendingSession) return pendingSession;
  if (!listeningForPageHide && typeof window !== 'undefined') {
    window.addEventListener('pagehide', onPageHide);
    listeningForPageHide = true;
  }
  const initialize = async (): Promise<FileOperationClientSession> => {
    const epoch = lifecycleEpoch;
    const key = getFileOperationClientSessionStorageKey();
    const stored = readOptionalSessionStorageValue(key);
    // Kolonet afvises af tidligere versioners ID-regex. En stadig åben gammel
    // klient uden Web Locks kan derfor aldrig dele et nyt ejerskabsscope.
    let id = !hasHidden && stored?.startsWith(OWNED_CLIENT_PREFIX) && CLIENT_SESSION_ID_PATTERN.test(stored.slice(OWNED_CLIENT_PREFIX.length))
      ? stored
      : `${OWNED_CLIENT_PREFIX}${getFileOperationClientSessionId()}`;
    let release: (() => void) | null = null;
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.locks?.request === 'function') {
        release = await acquireOwnership(id);
        if (!release) {
          id = `${OWNED_CLIENT_PREFIX}${createClientSessionId()}`;
          release = await acquireOwnership(id);
        }
      }
    } catch {
      release = null;
    }
    if (!release) {
      // Et runtime-scope må aldrig genbruges efter F5, heller ikke hvis Web Locks
      // bliver tilgængelig igen. Markøren ligger under den eksisterende klientnøgle.
      id = `runtime-${createClientSessionId()}`;
    }
    if (epoch !== lifecycleEpoch) {
      release?.();
      return initialize();
    }
    const legacy = legacyClientSessionIdSchema.safeParse(stored);
    if (legacy.success && !legacy.data.startsWith('runtime-')) {
      // Alias skal være durable FØR ID'et udskiftes; ellers kan F5 miste den
      // sidste reference til en legacy-request ved en efterfølgende IDB-fejl.
      const previousAlias = readPendingPwaSourceSessionId();
      if ((previousAlias !== null && previousAlias !== legacy.data)
        || !preservePendingPwaSourceSessionId(legacy.data)) {
        release?.();
        throw new Error('PWA-filrequest kunne ikke gemmes sikkert.');
      }
    }
    const persisted = writeOptionalSessionStorageValue(key, id);
    if (!persisted && stored !== null && stored !== id) {
      release?.();
      throw new Error('Browserens midlertidige lager kunne ikke opdatere filnavnsoplysninger.');
    }
    clientSessionId = id;
    releaseOwnership = release;
    ownedSession = { id, reloadStable: release !== null && persisted, resumedAfterPageHide: hasHidden };
    return ownedSession;
  };
  const promise = initialize();
  pendingSession = promise;
  try {
    return await promise;
  } finally {
    if (pendingSession === promise) pendingSession = null;
  }
};

/** Holder scope-ejerskabet gennem hele IDB-operationen, også ved navigation under et await. */
export const withFileOperationClientSession = async <T>(
  work: (session: FileOperationClientSession) => Promise<T>,
): Promise<T> => {
  const session = await ensureFileOperationClientSession();
  activeStorageOperations.set(session.id, (activeStorageOperations.get(session.id) ?? 0) + 1);
  try {
    return await work(session);
  } finally {
    const remaining = (activeStorageOperations.get(session.id) ?? 1) - 1;
    if (remaining > 0) activeStorageOperations.set(session.id, remaining);
    else {
      activeStorageOperations.delete(session.id);
      deferredReleases.get(session.id)?.();
      deferredReleases.delete(session.id);
    }
  }
};

/** Kun testinfrastruktur må nulstille modulcachen. */
export const __resetFileOperationClientSessionForTests = (): void => {
  releaseOwnership?.();
  releaseOwnership = null;
  for (const release of deferredReleases.values()) release();
  deferredReleases.clear();
  activeStorageOperations.clear();
  ownedSession = null;
  pendingSession = null;
  lifecycleEpoch += 1;
  hasHidden = false;
  if (listeningForPageHide && typeof window !== 'undefined') window.removeEventListener('pagehide', onPageHide);
  listeningForPageHide = false;
  clientSessionId = null;
};
