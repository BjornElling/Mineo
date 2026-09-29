// @vitest-environment jsdom

import {
  getInstalledPwaDisplayModeSnapshot,
  isRunningInsideInstalledPwa,
  PWA_STANDALONE_DISPLAY_MODE_QUERY,
  subscribeToInstalledPwaDisplayMode,
} from '../../utils/pwaDisplayMode';

type MatchMediaStub = {
  matches: boolean;
  addEventListener: (type: string, listener: () => void) => void;
  removeEventListener: (type: string, listener: () => void) => void;
};

const originalMatchMedia = Object.getOwnPropertyDescriptor(window, 'matchMedia');
const originalStandalone = Object.getOwnPropertyDescriptor(navigator, 'standalone');

const restoreProperty = (target: object, property: string, descriptor: PropertyDescriptor | undefined): void => {
  if (descriptor) {
    Object.defineProperty(target, property, descriptor);
  } else {
    Reflect.deleteProperty(target, property);
  }
};

const setMatchMedia = (value: MatchMediaStub | undefined): void => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: value === undefined ? undefined : () => value,
  });
};

const setNavigatorStandalone = (value: boolean | undefined): void => {
  if (value === undefined) {
    restoreProperty(navigator, 'standalone', originalStandalone);
    return;
  }
  Object.defineProperty(navigator, 'standalone', {
    configurable: true,
    value,
  });
};

describe('pwaDisplayMode', () => {
  afterEach(() => {
    restoreProperty(window, 'matchMedia', originalMatchMedia);
    restoreProperty(navigator, 'standalone', originalStandalone);
    vi.restoreAllMocks();
  });

  it('genkender den standardiserede standalone-media-query', () => {
    const mediaQuery: MatchMediaStub = {
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    setMatchMedia(mediaQuery);
    setNavigatorStandalone(false);

    expect(window.matchMedia?.(PWA_STANDALONE_DISPLAY_MODE_QUERY)).toBe(mediaQuery);
    expect(isRunningInsideInstalledPwa()).toBe(true);
  });

  it('genkender iOS standalone-signalet, når media-queryen ikke er aktiv', () => {
    setMatchMedia({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    setNavigatorStandalone(true);

    expect(isRunningInsideInstalledPwa()).toBe(true);
  });

  it('returnerer falsk uden aktive standalone-signaler', () => {
    setMatchMedia({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    setNavigatorStandalone(false);

    expect(isRunningInsideInstalledPwa()).toBe(false);
    expect(getInstalledPwaDisplayModeSnapshot()).toBe(false);
  });

  it('bruger iOS-signalet, når matchMedia ikke findes', () => {
    setMatchMedia(undefined);
    setNavigatorStandalone(true);

    expect(isRunningInsideInstalledPwa()).toBe(true);
  });

  it('abonnerer på ændringer og fjerner præcis den samme listener', () => {
    const mediaQuery: MatchMediaStub = {
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    setMatchMedia(mediaQuery);
    const onStoreChange = vi.fn();

    const unsubscribe = subscribeToInstalledPwaDisplayMode(onStoreChange);

    expect(mediaQuery.addEventListener).toHaveBeenCalledWith('change', onStoreChange);
    const registeredListener = vi.mocked(mediaQuery.addEventListener).mock.calls[0]?.[1];
    registeredListener?.();
    expect(onStoreChange).toHaveBeenCalledTimes(1);

    unsubscribe();
    expect(mediaQuery.removeEventListener).toHaveBeenCalledWith('change', onStoreChange);
  });

  it('giver en ufarlig no-op unsubscribe uden matchMedia', () => {
    setMatchMedia(undefined);
    const onStoreChange = vi.fn();

    const unsubscribe = subscribeToInstalledPwaDisplayMode(onStoreChange);

    expect(() => unsubscribe()).not.toThrow();
    expect(onStoreChange).not.toHaveBeenCalled();
  });
});
