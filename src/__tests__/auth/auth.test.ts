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

let storageMock: StorageMock = createStorageMock();
const TEST_PASSWORD = 'test-password';

vi.mock('../../utils/safeLocalStorage', () => ({
  getSafeLocalStorage: () => storageMock,
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
  storageMock = createStorageMock();
  vi.resetModules();
  vi.resetAllMocks();
  restoreCrypto();
});

describe('auth', () => {
  it('verifies shared password when input is correct', async () => {
    const { verifySharedPassword } = await import('../../auth/auth');
    await expect(verifySharedPassword(TEST_PASSWORD)).resolves.toBe(true);
  });

  it('verifies shared password case-neutrally', async () => {
    const { verifySharedPassword } = await import('../../auth/auth');
    await expect(verifySharedPassword('TEST-PASSWORD')).resolves.toBe(true);
  });

  it('rejects shared password when input is incorrect', async () => {
    const { verifySharedPassword } = await import('../../auth/auth');
    await expect(verifySharedPassword('forkert')).resolves.toBe(false);
  });

  it('persists and reads authenticated state', async () => {
    const { isAuthenticated, setAuthenticated } = await import('../../auth/auth');
    expect(isAuthenticated()).toBe(false);

    setAuthenticated();
    expect(isAuthenticated()).toBe(true);
  });

  it('throws deterministic error when storage write fails', async () => {
    storageMock = {
      ...createStorageMock(),
      setItem: () => {
        throw new Error('storage unavailable');
      },
    };

    const { setAuthenticated } = await import('../../auth/auth');
    expect(() => setAuthenticated()).toThrow('Kunne ikke gemme login-status i browseren.');
  });

  it('fails verification when crypto.subtle is unavailable', async () => {
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
