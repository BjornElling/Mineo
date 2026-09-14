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
  it('returnerer en streng', () => {
    expect(typeof createRowId('test')).toBe('string');
  });

  it('starter med prefix_', () => {
    expect(createRowId('myPrefix').startsWith('myPrefix_')).toBe(true);
  });

  it('to kald giver unikke IDs', () => {
    const id1 = createRowId('row');
    const id2 = createRowId('row');
    expect(id1).not.toBe(id2);
  });

  it('prefix er inkluderet i resultatet', () => {
    const id = createRowId('taf');
    expect(id).toContain('taf');
  });

  it('tom prefix giver id der starter med _', () => {
    const id = createRowId('');
    expect(id.startsWith('_')).toBe(true);
  });

  it('prefix med specielle tegn bevares', () => {
    const id = createRowId('svie-smerte');
    expect(id.startsWith('svie-smerte_')).toBe(true);
  });

  it('100 kald giver 100 unikke IDs', () => {
    const ids = new Set(Array.from({ length: 100 }, () => createRowId('r')));
    expect(ids.size).toBe(100);
  });

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
