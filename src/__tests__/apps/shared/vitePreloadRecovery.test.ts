// @vitest-environment jsdom
const dispatchVitePreloadError = (message: string): boolean => {
  const event = new Event('vite:preloadError', { cancelable: true }) as VitePreloadErrorEvent;
  Object.defineProperty(event, 'payload', { value: new Error(message) });
  return window.dispatchEvent(event);
};

describe('setupVitePreloadRecovery', () => {
  let reloadSpy: ReturnType<typeof vi.fn>;
  let resetRecovery: () => void;
  let isRecoveryPending: () => boolean;
  let reloadAfterRecovery: () => boolean;

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
    isRecoveryPending = recovery.isVitePreloadRecoveryPending;
    reloadAfterRecovery = recovery.reloadAfterVitePreloadRecovery;
    recovery.setupVitePreloadRecovery();
  });

  afterEach(() => {
    resetRecovery();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('forhindrer Vites kast og kræver en eksplicit sikker recovery', () => {
    const message = 'Failed to fetch dynamically imported module: https://mineo.dk/assets/eo-B4beMD54.js';

    expect(dispatchVitePreloadError(message)).toBe(false);
    expect(isRecoveryPending()).toBe(true);
    expect(reloadSpy).not.toHaveBeenCalled();
    expect(reloadAfterRecovery()).toBe(true);
    expect(reloadSpy).toHaveBeenCalledOnce();
  });

  it('beholder også samme fejl som en sikker recovery i stedet for at lade den blive systemfejl', () => {
    const message = 'Failed to fetch dynamically imported module: https://mineo.dk/assets/eo-B4beMD54.js';

    expect(dispatchVitePreloadError(message)).toBe(false);
    expect(isRecoveryPending()).toBe(true);
    expect(reloadSpy).not.toHaveBeenCalled();
  });

  it('ignorerer signaler uden en brugbar fejlpayload', () => {
    const event = new Event('vite:preloadError', { cancelable: true }) as VitePreloadErrorEvent;
    Object.defineProperty(event, 'payload', { value: new Error('') });

    expect(window.dispatchEvent(event)).toBe(true);
    expect(isRecoveryPending()).toBe(false);
  });

  it('samler flere lazy-fejl i én ventende recovery uden reload-løkke', () => {
    expect(dispatchVitePreloadError('Failed to fetch dynamically imported module: https://mineo.dk/assets/eo-B4beMD54.js')).toBe(false);
    expect(dispatchVitePreloadError('Failed to fetch dynamically imported module: https://mineo.dk/assets/eo-C5cfNE65.js')).toBe(false);
    expect(isRecoveryPending()).toBe(true);
    expect(reloadSpy).not.toHaveBeenCalled();
  });
});
