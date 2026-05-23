// @vitest-environment jsdom
import {
  readOptionalSessionStorageValue,
  readSessionStorageValue,
  removeOptionalSessionStorageValue,
  removeSessionStorageValue,
  writeOptionalSessionStorageValue,
  writeSessionStorageValue,
} from '../../utils/safeSessionStorage';

describe('safeSessionStorage', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('reads and writes via strict helpers when storage is available', () => {
    writeSessionStorageValue('mineo_ui_test', 'vaerdi');

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

    expect(writeOptionalSessionStorageValue('mineo_ui_test', 'vaerdi')).toBe(false);
    expect(readOptionalSessionStorageValue('mineo_ui_test')).toBeNull();
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

    expect(() => writeSessionStorageValue('mineo_ui_test', 'vaerdi')).toThrow('blocked');

    setItemSpy.mockRestore();
  });

  it('normaliserer quota-fejl fra strict write helper til dansk besked', () => {
    const storageProto = Object.getPrototypeOf(window.sessionStorage) as Storage;
    const setItemSpy = vi.spyOn(storageProto, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });

    expect(() => writeSessionStorageValue('mineo_ui_test', 'vaerdi')).toThrow(
      'Browserens midlertidige lager er fyldt'
    );

    setItemSpy.mockRestore();
  });
});
