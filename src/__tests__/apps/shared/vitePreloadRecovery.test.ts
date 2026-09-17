// @vitest-environment jsdom
const MODULE_FAILURE_MESSAGE =
  'Failed to fetch dynamically imported module: https://mineo.dk/assets/eo-B4beMD54.js';
const CSS_FAILURE_MESSAGE = 'Unable to preload CSS for https://mineo.dk/assets/eo-B4beMD54.css';

/** Returnerer `false`, når Vite skal UNDLADE at kaste (defaultPrevented), ellers `true`. */
const dispatchVitePreloadError = (error: Error): boolean => {
  const event = new Event('vite:preloadError', { cancelable: true }) as VitePreloadErrorEvent;
  Object.defineProperty(event, 'payload', { value: error });
  return window.dispatchEvent(event);
};

describe('setupVitePreloadRecovery', () => {
  let reloadSpy: ReturnType<typeof vi.fn>;
  let resetRecovery: () => void;
  let isRecoveryPending: () => boolean;
  let reloadAfterRecovery: () => boolean;
  let isLazyChunkFailure: (error: unknown) => boolean;

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
    ({ isLazyChunkFailure } = await import('../../../utils/lazyChunkFailure'));
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

  it('offentliggør en ventende recovery uden selv at genindlæse', () => {
    dispatchVitePreloadError(new Error(MODULE_FAILURE_MESSAGE));

    expect(isRecoveryPending()).toBe(true);
    expect(reloadSpy).not.toHaveBeenCalled();
    expect(reloadAfterRecovery()).toBe(true);
    expect(reloadSpy).toHaveBeenCalledOnce();
  });

  it('lader en fejlet MODULHENTNING blive kastet videre og markerer den', () => {
    // Undertrykkes den, resolver Vites hjælper `import()` med `undefined`, og kaldestedet rammer en
    // TypeError ved destructuring i stedet for en genkendelig manglende chunk.
    const failure = new Error(MODULE_FAILURE_MESSAGE);

    expect(dispatchVitePreloadError(failure)).toBe(true);
    expect(isLazyChunkFailure(failure)).toBe(true);
    expect(isRecoveryPending()).toBe(true);
  });

  it('undertrykker en fejlet CSS-preload, så modulet stadig kan hentes', () => {
    const failure = new Error(CSS_FAILURE_MESSAGE);

    expect(dispatchVitePreloadError(failure)).toBe(false);
    // Modulet hentes bagefter af Vites hjælper; fejlen er derfor ikke en manglende chunk.
    expect(isLazyChunkFailure(failure)).toBe(false);
    expect(isRecoveryPending()).toBe(true);
  });

  it('markerer ikke en fejl, der aldrig kom fra Vites lazy-load', () => {
    expect(isLazyChunkFailure(new Error(MODULE_FAILURE_MESSAGE))).toBe(false);
    expect(isLazyChunkFailure('Failed to fetch dynamically imported module')).toBe(false);
  });

  it('ignorerer signaler uden en brugbar fejlpayload', () => {
    const event = new Event('vite:preloadError', { cancelable: true }) as VitePreloadErrorEvent;
    Object.defineProperty(event, 'payload', { value: new Error('') });

    expect(window.dispatchEvent(event)).toBe(true);
    expect(isRecoveryPending()).toBe(false);
  });

  it('samler flere lazy-fejl i én ventende recovery uden reload-løkke', () => {
    dispatchVitePreloadError(new Error(MODULE_FAILURE_MESSAGE));
    dispatchVitePreloadError(new Error('Failed to fetch dynamically imported module: https://mineo.dk/assets/eo-C5cfNE65.js'));

    expect(isRecoveryPending()).toBe(true);
    expect(reloadSpy).not.toHaveBeenCalled();
  });
});
