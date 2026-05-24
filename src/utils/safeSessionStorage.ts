export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

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
  // Strict variant for trust-critical callsites: unavailable sessionStorage or read
  // exceptions must bubble so callers cannot proceed as if persistence succeeded.
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
