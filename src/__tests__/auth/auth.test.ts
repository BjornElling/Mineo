// @vitest-environment jsdom

type StorageMock = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
};

const createStorageMock = (): StorageMock => {
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

let persistentStorageMock: StorageMock | null = createStorageMock();
const TEST_PASSWORD = 'test-password';

vi.mock('../../utils/safeLocalStorage', () => ({
  getPersistentLocalStorage: () => persistentStorageMock,
}));

vi.mock('../../auth/authConfig', () => ({
  AUTH_STORAGE_KEY: 'test:auth:key',
  AUTH_STORAGE_VALUE: 'test:auth:value',
  SHARED_PASSWORD_HASHES: [
    {
      description: 'Test-password',
      hash: 'c638833f69bbfb3c267afa0a74434812436b8f08a81fd263c6be6871de4f1265',
    },
  ],
}));

const restoreCrypto = (() => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  return () => {
    if (descriptor) {
      Object.defineProperty(globalThis, 'crypto', descriptor);
    }
  };
})();

afterEach(() => {
  persistentStorageMock = createStorageMock();
  vi.resetModules();
  vi.resetAllMocks();
  restoreCrypto();
});

describe('auth', () => {
  it('godkender den delte adgangskode ved korrekt input', async () => {
    const { verifySharedPassword } = await import('../../auth/auth');
    await expect(verifySharedPassword(TEST_PASSWORD)).resolves.toBe(true);
  });

  it('godkender den delte adgangskode case-neutralt', async () => {
    const { verifySharedPassword } = await import('../../auth/auth');
    await expect(verifySharedPassword('TEST-PASSWORD')).resolves.toBe(true);
  });

  it('afviser en forkert delt adgangskode', async () => {
    const { verifySharedPassword } = await import('../../auth/auth');
    await expect(verifySharedPassword('forkert')).resolves.toBe(false);
  });

  it('persisterer og læser login-status', async () => {
    const { isAuthenticated, setAuthenticated } = await import('../../auth/auth');
    expect(isAuthenticated()).toBe(false);

    setAuthenticated();
    expect(isAuthenticated()).toBe(true);
  });

  it('kaster en deterministisk fejl når vedvarende storage mangler', async () => {
    persistentStorageMock = null;

    const { setAuthenticated } = await import('../../auth/auth');
    expect(() => setAuthenticated()).toThrow('Kunne ikke gemme login-status i browseren.');
  });

  it('kaster en deterministisk fejl når storage-skrivning fejler', async () => {
    persistentStorageMock = {
      ...createStorageMock(),
      setItem: () => {
        throw new Error('storage unavailable');
      },
    };

    const { setAuthenticated } = await import('../../auth/auth');
    expect(() => setAuthenticated()).toThrow('Kunne ikke gemme login-status i browseren.');
  });

  it('kaster en deterministisk fejl når storage ignorerer skrivningen', async () => {
    persistentStorageMock = {
      ...createStorageMock(),
      setItem: () => undefined,
    };

    const { setAuthenticated } = await import('../../auth/auth');
    expect(() => setAuthenticated()).toThrow('Kunne ikke gemme login-status i browseren.');
  });

  it('nægter adgang uden at kaste når storage-læsning fejler', async () => {
    persistentStorageMock = {
      ...createStorageMock(),
      getItem: () => {
        throw new Error('storage unavailable');
      },
    };

    const { isAuthenticated } = await import('../../auth/auth');
    expect(isAuthenticated()).toBe(false);
  });

  it('nægter adgang når vedvarende storage mangler', async () => {
    persistentStorageMock = null;

    const { isAuthenticated } = await import('../../auth/auth');
    expect(isAuthenticated()).toBe(false);
  });

  it('afviser verifikation når crypto.subtle ikke er tilgængelig', async () => {
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: {},
    });

    const { verifySharedPassword } = await import('../../auth/auth');
    await expect(verifySharedPassword(TEST_PASSWORD)).rejects.toThrow(
      'Denne browser understøtter ikke adgangskontrol.',
    );
  });
});
