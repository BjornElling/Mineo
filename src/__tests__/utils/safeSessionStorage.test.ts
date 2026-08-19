// @vitest-environment jsdom
import {
  readOptionalSessionStorageValue,
  readSessionStorageValue,
  removeOptionalSessionStorageValue,
  removeSessionStorageValue,
  writeOptionalSessionStorageValue,
  writeSessionStorageValue,
} from '../../utils/safeSessionStorage';
import type { ManifestStorageKey } from '../../config/storageManifest';

/**
 * Denne suite tester storage-MEKANIKKEN (fejlhåndtering, fallbacks), ikke nøglens proveniens.
 * Syntetiske testnøgler brandes derfor eksplicit her. Produktionskode må ALDRIG gøre dette –
 * dér er hele pointen, at kun `storageManifest` kan producere en skrivbar nøgle.
 */
const testKey = (key: string): ManifestStorageKey => key as ManifestStorageKey;

/**
 * Skrivegrænsen håndhæves af TYPESYSTEMET, ikke ved runtime. Assertionen er derfor
 * `@ts-expect-error`-markørerne selv: `typecheck:test` fejler, hvis en af dem holder op med at være
 * en fejl – dvs. hvis brandingen bliver blødt op, så en vilkårlig streng igen kan skrives.
 * Funktionerne kaldes bevidst IKKE her; der er intet runtime-kast at fange.
 */
const _writeBoundaryIsCompilerEnforced = (): void => {
  // @ts-expect-error en genindført legacy-nøgle kan ikke skrives: den er ikke manifest-produceret
  writeSessionStorageValue('mineo_invalidDrafts', 'x');
  // @ts-expect-error gælder også den optional-variant, produktionskoden faktisk bruger
  writeOptionalSessionStorageValue('mineo_stamdata', 'x');
  // @ts-expect-error og enhver anden vilkårlig streng – også når den kommer via en variabel,
  // hvor en AST-regel principielt er blind
  writeOptionalSessionStorageValue(String('mineo_input'), 'x');
};
void _writeBoundaryIsCompilerEnforced;

describe('safeSessionStorage', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('reads and writes via strict helpers when storage is available', () => {
    writeSessionStorageValue(testKey('mineo_ui_test'), 'vaerdi');

    expect(readSessionStorageValue('mineo_ui_test')).toBe('vaerdi');

    removeSessionStorageValue('mineo_ui_test');

    expect(readSessionStorageValue('mineo_ui_test')).toBeNull();
  });

  it('returns false/null for optional helpers when sessionStorage write access fails', () => {
    const storageProto = Object.getPrototypeOf(window.sessionStorage) as Storage;
    const setItemSpy = vi.spyOn(storageProto, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const removeItemSpy = vi.spyOn(storageProto, 'removeItem').mockImplementation(() => {
      throw new Error('blocked');
    });

    expect(writeOptionalSessionStorageValue(testKey('mineo_ui_test'), 'vaerdi')).toBe(false);
    expect(readOptionalSessionStorageValue('mineo_ui_test')).toBeNull();
    expect(removeOptionalSessionStorageValue('mineo_ui_test')).toBe(false);

    setItemSpy.mockRestore();
    removeItemSpy.mockRestore();
  });

  it('rapporterer tavse storage-no-op som fejl', () => {
    sessionStorage.setItem('mineo_ui_test', 'eksisterende');
    const storageProto = Object.getPrototypeOf(window.sessionStorage) as Storage;
    const setItemSpy = vi.spyOn(storageProto, 'setItem').mockImplementation(() => undefined);
    const removeItemSpy = vi.spyOn(storageProto, 'removeItem').mockImplementation(() => undefined);

    expect(writeOptionalSessionStorageValue(testKey('mineo_ui_test'), 'vaerdi')).toBe(false);
    expect(removeOptionalSessionStorageValue('mineo_ui_test')).toBe(false);

    setItemSpy.mockRestore();
    removeItemSpy.mockRestore();
  });

  it('returns null for optional read helper when sessionStorage read access fails', () => {
    const storageProto = Object.getPrototypeOf(window.sessionStorage) as Storage;
    const getItemSpy = vi.spyOn(storageProto, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });

    expect(readOptionalSessionStorageValue('mineo_ui_test')).toBeNull();

    getItemSpy.mockRestore();
  });

  it('throws from strict read helper when sessionStorage read access fails', () => {
    const storageProto = Object.getPrototypeOf(window.sessionStorage) as Storage;
    const getItemSpy = vi.spyOn(storageProto, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });

    expect(() => readSessionStorageValue('mineo_ui_test')).toThrow('blocked');

    getItemSpy.mockRestore();
  });

  it('throws from strict helpers when sessionStorage write access fails', () => {
    const storageProto = Object.getPrototypeOf(window.sessionStorage) as Storage;
    const setItemSpy = vi.spyOn(storageProto, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });

    expect(() => writeSessionStorageValue(testKey('mineo_ui_test'), 'vaerdi')).toThrow('blocked');

    setItemSpy.mockRestore();
  });

  it('normaliserer quota-fejl fra strict write helper til dansk besked', () => {
    const storageProto = Object.getPrototypeOf(window.sessionStorage) as Storage;
    const setItemSpy = vi.spyOn(storageProto, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });

    expect(() => writeSessionStorageValue(testKey('mineo_ui_test'), 'vaerdi')).toThrow(
      'Browserens midlertidige lager er fyldt'
    );

    setItemSpy.mockRestore();
  });
});
