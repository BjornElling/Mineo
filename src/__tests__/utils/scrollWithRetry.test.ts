// @vitest-environment jsdom
import { scrollWithRetry } from '../../utils/scrollWithRetry';

/**
 * scrollWithRetry er det delte retry-lag for "spring til mål, når det dukker op i DOM'en".
 * Selve scroll-adfærden ejes af scrollTargetIntoView; her hævder vi kun retry-/delegerings-
 * kontrakten: vent til målet findes, deleger så scrollet med det angivne behavior, og kald
 * de rigtige callbacks. Uden for en Mineo-scroll-container falder helperen tilbage til native
 * scrollIntoView, hvilket gør delegeringen observerbar i jsdom.
 */
describe('scrollWithRetry', () => {
  const originalRaf = globalThis.requestAnimationFrame;
  const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
  let scrollIntoViewMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    document.body.innerHTML = '';
    scrollIntoViewMock = vi.fn();
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoViewMock,
    });
    globalThis.requestAnimationFrame = vi.fn((cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    });
  });

  afterEach(() => {
    globalThis.requestAnimationFrame = originalRaf;
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: originalScrollIntoView,
    });
    vi.restoreAllMocks();
  });

  it('venter til målet findes og delegerer derefter scrollet med det angivne behavior', () => {
    const target = document.createElement('div');
    document.body.appendChild(target);
    // Målet findes først på tredje forsøg.
    let attempts = 0;
    const findTarget = vi.fn(() => {
      attempts += 1;
      return attempts >= 3 ? target : null;
    });
    const onSuccess = vi.fn();
    const onFailure = vi.fn();

    scrollWithRetry({ maxRetries: 10, findTarget, behavior: 'auto', onSuccess, onFailure, failureMessage: 'fejl' });

    expect(findTarget).toHaveBeenCalledTimes(3);
    // Uden scroll-container delegeres til native scrollIntoView (block:'nearest' = kun hvis nødvendigt).
    expect(scrollIntoViewMock).toHaveBeenCalledWith({ behavior: 'auto', block: 'nearest' });
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onFailure).not.toHaveBeenCalled();
  });

  it('kalder onFailure når målet aldrig findes inden maxRetries', () => {
    const onSuccess = vi.fn();
    const onFailure = vi.fn();

    scrollWithRetry({
      maxRetries: 3,
      findTarget: () => null,
      behavior: 'smooth',
      onSuccess,
      onFailure,
      failureMessage: 'kunne ikke finde mål',
    });

    expect(scrollIntoViewMock).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
    expect(onFailure).toHaveBeenCalledWith('kunne ikke finde mål');
  });
});
