// @vitest-environment jsdom
import { UI_STORAGE_KEYS } from '../../../config/storageManifest';

const dispatchVitePreloadError = (message: string): boolean => {
  const event = new Event('vite:preloadError', { cancelable: true }) as VitePreloadErrorEvent;
  Object.defineProperty(event, 'payload', { value: new Error(message) });
  return window.dispatchEvent(event);
};

describe('setupVitePreloadRecovery', () => {
  let reloadSpy: ReturnType<typeof vi.fn>;
  let resetRecovery: () => void;

  beforeEach(async () => {
    vi.resetModules();
    vi.stubEnv('PROD', true);
    sessionStorage.clear();
    reloadSpy = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { reload: reloadSpy },
    });

    const recovery = await import('../../../apps/shared/vitePreloadRecovery');
    resetRecovery = recovery.__resetVitePreloadRecoveryForTests;
    recovery.setupVitePreloadRecovery();
  });

  afterEach(() => {
    resetRecovery();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('forhindrer Vites kast og genindlæser efter et nyt fejlende asset', () => {
    const message = 'Failed to fetch dynamically imported module: https://mineo.dk/assets/eo-B4beMD54.js';

    expect(dispatchVitePreloadError(message)).toBe(false);
    expect(reloadSpy).toHaveBeenCalledOnce();
    expect(sessionStorage.getItem(UI_STORAGE_KEYS.vitePreloadRecovery)).toBe(message);
  });

  it('lader samme fejl nå normal fejlhåndtering efter recovery-forsøget', () => {
    const message = 'Failed to fetch dynamically imported module: https://mineo.dk/assets/eo-B4beMD54.js';
    sessionStorage.setItem(UI_STORAGE_KEYS.vitePreloadRecovery, message);

    expect(dispatchVitePreloadError(message)).toBe(true);
    expect(reloadSpy).not.toHaveBeenCalled();
  });

  it('genindlæser ikke uden en kvitteret recovery-markør', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('sessionStorage er utilgængelig');
    });

    expect(dispatchVitePreloadError('Failed to fetch dynamically imported module: https://mineo.dk/assets/eo-B4beMD54.js')).toBe(true);
    expect(reloadSpy).not.toHaveBeenCalled();
  });

  it('giver en senere deploy med et nyt asset ét selvstændigt recovery-forsøg', () => {
    sessionStorage.setItem(
      UI_STORAGE_KEYS.vitePreloadRecovery,
      'Failed to fetch dynamically imported module: https://mineo.dk/assets/eo-B4beMD54.js',
    );

    expect(dispatchVitePreloadError('Failed to fetch dynamically imported module: https://mineo.dk/assets/eo-C5cfNE65.js')).toBe(false);
    expect(reloadSpy).toHaveBeenCalledOnce();
  });
});
