// @vitest-environment jsdom
import { scrollToEoRow } from '../../utils/scrollToEoRow';

describe('scrollToEoRow', () => {
  const originalRaf = globalThis.requestAnimationFrame;
  const originalMatchMedia = window.matchMedia;
  const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
  let scrollIntoViewMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    document.body.innerHTML = '';
    scrollIntoViewMock = vi.fn();
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoViewMock,
    });
    window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as unknown as typeof window.matchMedia;
    globalThis.requestAnimationFrame = vi.fn((cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    });
  });

  afterEach(() => {
    globalThis.requestAnimationFrame = originalRaf;
    window.matchMedia = originalMatchMedia;
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: originalScrollIntoView,
    });
    vi.restoreAllMocks();
  });

  // Uden for en Mineo-scroll-container (som i disse jsdom-tests) falder scrollTargetIntoView
  // tilbage til native scrollIntoView med block:'nearest' — dvs. "scroll kun hvis nødvendigt".
  it('scrolls to matching row id for suffix-based række-id', () => {
    document.body.innerHTML = '<div data-mineo-row-id="row-1"></div>';

    scrollToEoRow('sviesmerte.periode.row-1.fra');

    expect(scrollIntoViewMock).toHaveBeenCalledWith({ behavior: 'smooth', block: 'nearest' });
  });

  it('supports loenindkomst row ids without trailing suffix', () => {
    document.body.innerHTML = '<div data-mineo-row-id="af-1"></div>';

    scrollToEoRow('loenindkomst.af-1');

    expect(scrollIntoViewMock).toHaveBeenCalledWith({ behavior: 'smooth', block: 'nearest' });
  });

  it('uses non-animated scroll when reduced motion is preferred', () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as unknown as typeof window.matchMedia;
    document.body.innerHTML = '<div data-mineo-row-id="row-rm"></div>';

    scrollToEoRow('taf.periode.row-rm');

    expect(scrollIntoViewMock).toHaveBeenCalledWith({ behavior: 'auto', block: 'nearest' });
  });

  it('calls onFailure when row cannot be found within retry budget', () => {
    const onFailure = vi.fn();

    scrollToEoRow('taf.periode.missing-row', { maxRetries: 3, onFailure });

    expect(onFailure).toHaveBeenCalledTimes(1);
    expect(onFailure.mock.calls[0][0]).toContain('missing-row');
  });
});
