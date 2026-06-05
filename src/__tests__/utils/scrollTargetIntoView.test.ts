// @vitest-environment jsdom
import { scrollTargetIntoView } from '../../utils/scrollTargetIntoView';

/**
 * Hjælper til at fingere et mål inde i en Mineo-scroll-container med kontrollerede mål.
 * jsdom har ingen layout, så vi stubber getBoundingClientRect og scroll-dimensioner.
 */
const setupContainerAndTarget = (opts: {
  containerRect: Partial<DOMRect>;
  targetRect: Partial<DOMRect>;
  scrollTop?: number;
  scrollHeight?: number;
  clientHeight?: number;
  scrollLeft?: number;
  scrollWidth?: number;
  clientWidth?: number;
}) => {
  const container = document.createElement('div');
  container.setAttribute('data-mineo-scroll-container', 'true');
  const target = document.createElement('input');
  container.appendChild(target);
  document.body.appendChild(container);

  const makeRect = (r: Partial<DOMRect>): DOMRect => ({
    top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0, x: 0, y: 0,
    toJSON: () => ({}),
    ...r,
  });

  container.getBoundingClientRect = () => makeRect(opts.containerRect);
  target.getBoundingClientRect = () => makeRect(opts.targetRect);

  Object.defineProperty(container, 'scrollTop', { configurable: true, writable: true, value: opts.scrollTop ?? 0 });
  Object.defineProperty(container, 'scrollLeft', { configurable: true, writable: true, value: opts.scrollLeft ?? 0 });
  Object.defineProperty(container, 'scrollHeight', { configurable: true, value: opts.scrollHeight ?? 2000 });
  Object.defineProperty(container, 'clientHeight', { configurable: true, value: opts.clientHeight ?? 600 });
  Object.defineProperty(container, 'scrollWidth', { configurable: true, value: opts.scrollWidth ?? 1000 });
  Object.defineProperty(container, 'clientWidth', { configurable: true, value: opts.clientWidth ?? 1000 });

  const scrollToMock = vi.fn();
  container.scrollTo = scrollToMock as unknown as typeof container.scrollTo;

  return { container, target, scrollToMock };
};

describe('scrollTargetIntoView', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('scroller IKKE når målet allerede er synligt i containerens vindue', () => {
    const { target, scrollToMock } = setupContainerAndTarget({
      // Container fylder 0..600; målet 100..132 er fuldt synligt.
      containerRect: { top: 0, bottom: 600, left: 0, right: 1000 },
      targetRect: { top: 100, bottom: 132, left: 10, right: 110, height: 32, width: 100 },
    });

    scrollTargetIntoView(target);

    expect(scrollToMock).not.toHaveBeenCalled();
  });

  it('centrerer målet lodret når det er under vinduet', () => {
    const { target, scrollToMock } = setupContainerAndTarget({
      // Container 0..600; målet ligger ved 1000..1032 (under vinduet).
      containerRect: { top: 0, bottom: 600, left: 0, right: 1000 },
      targetRect: { top: 1000, bottom: 1032, left: 10, right: 110, height: 32, width: 100 },
      scrollTop: 0,
      scrollHeight: 4000,
      clientHeight: 600,
    });

    scrollTargetIntoView(target);

    expect(scrollToMock).toHaveBeenCalledTimes(1);
    const arg = scrollToMock.mock.calls[0][0] as ScrollToOptions;
    // elementCenterY = 1000 - 0 + 16 = 1016; desiredTop = 0 + 1016 - 300 = 716.
    expect(arg.top).toBe(716);
    expect(arg.behavior).toBe('smooth');
  });

  it('centrerer målet lodret når det er over vinduet', () => {
    const { target, scrollToMock } = setupContainerAndTarget({
      containerRect: { top: 0, bottom: 600, left: 0, right: 1000 },
      // Målet er over vinduet (negativ top relativt til containeren).
      targetRect: { top: -200, bottom: -168, left: 10, right: 110, height: 32, width: 100 },
      scrollTop: 500,
      scrollHeight: 4000,
      clientHeight: 600,
    });

    scrollTargetIntoView(target);

    expect(scrollToMock).toHaveBeenCalledTimes(1);
    const arg = scrollToMock.mock.calls[0][0] as ScrollToOptions;
    // elementCenterY = -200 - 0 + 16 = -184; desiredTop = 500 + (-184) - 300 = 16.
    expect(arg.top).toBe(16);
  });

  it('force centrerer selv når målet allerede er synligt', () => {
    const { target, scrollToMock } = setupContainerAndTarget({
      containerRect: { top: 0, bottom: 600, left: 0, right: 1000 },
      // Målet er synligt (400..432 inden for 0..600), men ikke centreret.
      targetRect: { top: 400, bottom: 432, left: 10, right: 110, height: 32, width: 100 },
      scrollTop: 1000,
      scrollHeight: 4000,
      clientHeight: 600,
    });

    scrollTargetIntoView(target, { force: true });

    // force genberegner den centrerede position; da den afviger fra nuværende scrollTop, scrolles der.
    expect(scrollToMock).toHaveBeenCalledTimes(1);
    const arg = scrollToMock.mock.calls[0][0] as ScrollToOptions;
    // elementCenterY = 400 + 16 = 416; desiredTop = 1000 + 416 - 300 = 1116.
    expect(arg.top).toBe(1116);
  });

  it('force scroller IKKE når målet allerede er centreret', () => {
    const { target, scrollToMock } = setupContainerAndTarget({
      containerRect: { top: 0, bottom: 600, left: 0, right: 1000 },
      // Målet er allerede centreret (top 284, center 300 = clientHeight/2).
      targetRect: { top: 284, bottom: 316, left: 10, right: 110, height: 32, width: 100 },
      scrollTop: 1000,
      scrollHeight: 4000,
      clientHeight: 600,
    });

    scrollTargetIntoView(target, { force: true });

    // Centreret position == nuværende scrollTop → ingen scroll, selv med force.
    expect(scrollToMock).not.toHaveBeenCalled();
  });

  it('falder tilbage til native scrollIntoView når der ikke er en scroll-container', () => {
    const orphan = document.createElement('input');
    document.body.appendChild(orphan);
    const scrollIntoViewMock = vi.fn();
    orphan.scrollIntoView = scrollIntoViewMock as unknown as typeof orphan.scrollIntoView;

    const handled = scrollTargetIntoView(orphan);

    expect(handled).toBe(true);
    expect(scrollIntoViewMock).toHaveBeenCalledWith({ behavior: 'smooth', block: 'nearest' });
  });

  it('returnerer false for null-mål', () => {
    expect(scrollTargetIntoView(null)).toBe(false);
    expect(scrollTargetIntoView(undefined)).toBe(false);
  });
});
