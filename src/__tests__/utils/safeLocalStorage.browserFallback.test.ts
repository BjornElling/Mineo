// @vitest-environment jsdom
import { getSafeLocalStorage } from '../../utils/safeLocalStorage';

const localStorageDescriptor = Object.getOwnPropertyDescriptor(window, 'localStorage');

const restoreLocalStorage = (): void => {
  if (localStorageDescriptor) {
    Object.defineProperty(window, 'localStorage', localStorageDescriptor);
  } else {
    Reflect.deleteProperty(window, 'localStorage');
  }
};

describe('getSafeLocalStorage – browser-fallback', () => {
  afterEach(() => {
    restoreLocalStorage();
    vi.unstubAllGlobals();
  });

  it('returnerer et fungerende in-memory storage når localStorage-getteren kaster', () => {
    // Simulér browsergrenen i jsdom-testen. Node-runtimegrenen må ikke skjule browserfallbacken.
    vi.stubGlobal('process', undefined);
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get: () => {
        throw new Error('localStorage er blokeret');
      },
    });

    const storage = getSafeLocalStorage();

    storage.setItem('browser-fallback', 'vaerdi');

    expect(storage.getItem('browser-fallback')).toBe('vaerdi');
    storage.removeItem('browser-fallback');
    expect(storage.getItem('browser-fallback')).toBeNull();
  });
});
