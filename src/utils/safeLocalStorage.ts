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

export const getSafeLocalStorage = (): StorageLike => {
  const isNodeRuntime = typeof process !== 'undefined' && Boolean(process.versions?.node);
  if (isNodeRuntime) {
    return createMemoryStorage();
  }

  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
  } catch {
    // Ignorér og fald tilbage til in-memory storage.
  }

  return createMemoryStorage();
};
