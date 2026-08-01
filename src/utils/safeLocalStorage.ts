export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const createMemoryStorage = (): StorageLike => {
  const store = new Map<string, string>();
  return {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => {
      store.set(key, value);
    },
    removeItem: (key) => {
      store.delete(key);
    },
  };
};

/**
 * Returnerer kun browserens vedvarende localStorage.
 *
 * Auth-gaten må ikke forveksle den almindelige in-memory fallback med et gemt loginflag. Derfor
 * eksponeres den vedvarende capability særskilt, mens øvrige best-effort consumers fortsat kan
 * bruge `getSafeLocalStorage`.
 */
export const getPersistentLocalStorage = (): StorageLike | null => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
  } catch {
    // En blokeret getter betyder, at vedvarende storage ikke er tilgængelig.
  }

  return null;
};

export const getSafeLocalStorage = (): StorageLike => {
  const isNodeRuntime = typeof process !== 'undefined' && Boolean(process.versions?.node);
  if (isNodeRuntime) {
    return createMemoryStorage();
  }

  return getPersistentLocalStorage() ?? createMemoryStorage();
};
