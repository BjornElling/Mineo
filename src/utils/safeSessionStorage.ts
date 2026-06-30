export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'>;

const getSessionStorageInstance = (): StorageLike => {
  if (typeof window !== 'undefined' && window.sessionStorage) {
    return window.sessionStorage;
  }

  throw new Error('sessionStorage er ikke tilgængelig');
};

const withOptionalSessionStorage = <T>(fallbackValue: T, action: (storage: StorageLike) => T): T => {
  try {
    return action(getSessionStorageInstance());
  } catch {
    return fallbackValue;
  }
};

export const normalizeStorageWriteError = (error: unknown): Error => {
  if (error instanceof DOMException && error.name === 'QuotaExceededError') {
    return new Error('Browserens midlertidige lager er fyldt. Data kunne ikke gemmes sikkert.');
  }
  if (error instanceof Error) {
    return error;
  }
  return new Error('Browserens midlertidige lager kunne ikke opdateres.');
};

export const readSessionStorageValue = (key: string): string | null => {
  // Streng variant til trust-kritiske kaldssteder: utilgængelig sessionStorage eller
  // read-exceptions skal boble op, så kaldere ikke kan fortsætte, som om persistence lykkedes.
  return getSessionStorageInstance().getItem(key);
};

export const writeSessionStorageValue = (key: string, value: string): void => {
  try {
    getSessionStorageInstance().setItem(key, value);
  } catch (error) {
    throw normalizeStorageWriteError(error);
  }
};

export const removeSessionStorageValue = (key: string): void => {
  try {
    getSessionStorageInstance().removeItem(key);
  } catch (error) {
    throw normalizeStorageWriteError(error);
  }
};

export const listSessionStorageKeys = (): string[] => {
  const storage = getSessionStorageInstance();
  const keys: string[] = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key !== null) {
      keys.push(key);
    }
  }
  return keys;
};

export const readOptionalSessionStorageValue = (key: string): string | null => {
  return withOptionalSessionStorage(null, (storage) => storage.getItem(key));
};

export const writeOptionalSessionStorageValue = (key: string, value: string): boolean => {
  return withOptionalSessionStorage(false, (storage) => {
    storage.setItem(key, value);
    return true;
  });
};

export const removeOptionalSessionStorageValue = (key: string): boolean => {
  return withOptionalSessionStorage(false, (storage) => {
    storage.removeItem(key);
    return true;
  });
};
