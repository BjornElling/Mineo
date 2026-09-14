// @vitest-environment jsdom

vi.mock('../../inputCore/react/fieldAttentionBlink', () => ({
  blinkFieldAttention: vi.fn(),
}));

import { blinkFieldAttention } from '../../inputCore/react/fieldAttentionBlink';
import { scrollToSection } from '../../utils/scrollToSection';

/**
 * Direkte facitter for sektionens selector, retry-kontrakt og den valgfrie markering.
 * Den delte scroll-helper testes ikke igen her; native scroll og blink er de to relevante grænser.
 */
describe('scrollToSection', () => {
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
    globalThis.requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    }) as unknown as typeof requestAnimationFrame;
    vi.mocked(blinkFieldAttention).mockReset();
  });

  afterEach(() => {
    globalThis.requestAnimationFrame = originalRaf;
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: originalScrollIntoView,
    });
    vi.restoreAllMocks();
  });

  it('finder sektionen via data-section-id og scroller uden attention-markering', () => {
    const target = document.createElement('section');
    target.dataset.sectionId = 'aes';
    document.body.appendChild(target);

    scrollToSection('aes', { attention: false });

    expect(scrollIntoViewMock).toHaveBeenCalledWith({ behavior: 'smooth', block: 'nearest' });
    expect(blinkFieldAttention).not.toHaveBeenCalled();
  });

  it('markerer det fundne mål, når attention er slået til', () => {
    const target = document.createElement('section');
    target.dataset.sectionId = 'sfg';
    document.body.appendChild(target);

    scrollToSection('sfg', { attention: true });

    expect(blinkFieldAttention).toHaveBeenCalledTimes(1);
    expect(blinkFieldAttention).toHaveBeenCalledWith(target);
  });

  it('kalder success-callbacken efter et vellykket selector-opslag', () => {
    const target = document.createElement('section');
    target.dataset.sectionId = 'taf';
    document.body.appendChild(target);
    const onSuccess = vi.fn();

    scrollToSection('taf', { onSuccess });

    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it('kalder onFailure efter maxRetries med en konkret dansk failureMessage', () => {
    const onFailure = vi.fn();

    scrollToSection('manglende-sektion', { maxRetries: 3, onFailure });

    expect(scrollIntoViewMock).not.toHaveBeenCalled();
    expect(onFailure).toHaveBeenCalledWith(
      'scrollToSection fejlede efter 3 forsøg for section="manglende-sektion"'
    );
  });
});
