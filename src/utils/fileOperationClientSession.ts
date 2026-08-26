import { getFileOperationClientSessionStorageKey } from '../config/storageManifest';
import {
  readOptionalSessionStorageValue,
  writeOptionalSessionStorageValue,
} from './safeSessionStorage';

const CLIENT_SESSION_ID_PATTERN = /^[a-z0-9-]{16,128}$/i;

let clientSessionId: string | null = null;

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

  const key = getFileOperationClientSessionStorageKey();
  const stored = readOptionalSessionStorageValue(key);
  if (stored !== null && CLIENT_SESSION_ID_PATTERN.test(stored)) {
    clientSessionId = stored;
    return clientSessionId;
  }

  const next = createClientSessionId();
  // Kan sessionStorage ikke skrives, beholder den åbne klient stadig sin in-memory-identitet. En
  // PWA-filåbning må ikke miste sin request i den aktuelle session alene af den grund.
  writeOptionalSessionStorageValue(key, next);
  clientSessionId = next;
  return clientSessionId;
};

/** Kun testinfrastruktur må nulstille modulcachen. */
export const __resetFileOperationClientSessionForTests = (): void => {
  clientSessionId = null;
};
