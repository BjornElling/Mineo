import { createRowId } from '../../utils/rowId';

const originalCryptoDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');

const setGlobalCrypto = (value: unknown): void => {
  Object.defineProperty(globalThis, 'crypto', {
    configurable: true,
    value,
    writable: true,
  });
};

const restoreGlobalCrypto = (): void => {
  if (originalCryptoDescriptor) {
    Object.defineProperty(globalThis, 'crypto', originalCryptoDescriptor);
  } else {
    Reflect.deleteProperty(globalThis, 'crypto');
  }
};

afterEach(() => {
  restoreGlobalCrypto();
  vi.restoreAllMocks();
});

describe('createRowId', () => {
  it('bruger randomUUID når browserens crypto tilbyder den', () => {
    setGlobalCrypto({
      randomUUID: () => '00000000-0000-4000-8000-000000000000',
    });

    expect(createRowId('row')).toBe('row_00000000-0000-4000-8000-000000000000');
  });

  it('danner en UUID v4 fra getRandomValues når randomUUID mangler', () => {
    setGlobalCrypto({
      randomUUID: undefined,
      getRandomValues: (bytes: Uint8Array): Uint8Array => {
        bytes.fill(0xab);
        return bytes;
      },
    });

    expect(createRowId('row')).toBe('row_abababab-abab-4bab-abab-abababababab');
  });

  it('falder tilbage til tidsstempel og Math.random uden browser-crypto', () => {
    setGlobalCrypto(undefined);
    vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
    vi.spyOn(Math, 'random').mockReturnValue(0.5);

    expect(createRowId('row')).toBe('row_1700000000000_8');
  });
});
