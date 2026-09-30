// @vitest-environment jsdom
import {
  getPhysicalScreenShortestSide,
  getViewportShortestSide,
  isTouchLikeDevice,
  isTouchLikeDeviceWithShortestSideAtMost,
} from '../../utils/clientDevice';

const createMediaQueryList = (matches: boolean, media = ''): MediaQueryList => ({
  matches,
  media,
  onchange: null,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  addListener: vi.fn(),
  removeListener: vi.fn(),
  dispatchEvent: vi.fn(),
});

const configureDevice = ({
  maxTouchPoints = 0,
  coarsePointer = false,
  noHover = coarsePointer,
  screenWidth = 1024,
  screenHeight = 768,
  viewportWidth = 1024,
  viewportHeight = 768,
  visualViewport,
  matchMediaAvailable = true,
}: {
  maxTouchPoints?: number | null;
  coarsePointer?: boolean;
  noHover?: boolean;
  screenWidth?: number | null;
  screenHeight?: number | null;
  viewportWidth?: number | null;
  viewportHeight?: number | null;
  visualViewport?: { width?: number | null; height?: number | null };
  matchMediaAvailable?: boolean;
}): void => {
  Object.defineProperty(navigator, 'maxTouchPoints', {
    configurable: true,
    value: maxTouchPoints,
  });
  Object.defineProperty(window.screen, 'width', {
    configurable: true,
    value: screenWidth,
  });
  Object.defineProperty(window.screen, 'height', {
    configurable: true,
    value: screenHeight,
  });
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    value: viewportWidth,
  });
  Object.defineProperty(window, 'innerHeight', {
    configurable: true,
    value: viewportHeight,
  });
  Object.defineProperty(window, 'visualViewport', {
    configurable: true,
    value: visualViewport,
  });
  if (matchMediaAvailable) {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: vi.fn((query: string) => createMediaQueryList(
        query === '(pointer: coarse)' ? coarsePointer : query === '(hover: none)' ? noHover : false,
        query,
      )),
    });
  } else {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: undefined,
    });
  }
};

describe('clientDevice', () => {
  const originalMatchMedia = window.matchMedia;

  afterEach(() => {
    vi.unstubAllGlobals();
    window.matchMedia = originalMatchMedia;
  });

  it('returnerer neutrale værdier uden browserglobals', () => {
    vi.stubGlobal('window', undefined);
    expect(isTouchLikeDevice()).toBe(false);
    expect(getPhysicalScreenShortestSide()).toBeNull();
    expect(getViewportShortestSide()).toBeNull();

    vi.unstubAllGlobals();
    vi.stubGlobal('navigator', undefined);
    expect(isTouchLikeDevice()).toBe(false);
  });

  describe('isTouchLikeDevice', () => {
    it('genkender coarse pointer, no-hover og fallback uden matchMedia', () => {
      configureDevice({ maxTouchPoints: 1, coarsePointer: false, noHover: true });
      expect(isTouchLikeDevice()).toBe(true);

      configureDevice({ maxTouchPoints: 1, matchMediaAvailable: false });
      expect(isTouchLikeDevice()).toBe(true);

      configureDevice({ maxTouchPoints: 0, matchMediaAvailable: false });
      expect(isTouchLikeDevice()).toBe(false);

      configureDevice({ maxTouchPoints: null, coarsePointer: true });
      expect(isTouchLikeDevice()).toBe(false);
    });
  });

  describe('skærm- og viewportkortside', () => {
    it('bruger den eneste gyldige fysiske skærmside og failer lukket uden sider', () => {
      configureDevice({ screenWidth: null, screenHeight: 900 });
      expect(getPhysicalScreenShortestSide()).toBe(900);

      configureDevice({ screenWidth: 1440, screenHeight: null });
      expect(getPhysicalScreenShortestSide()).toBe(1440);

      configureDevice({ screenWidth: null, screenHeight: null });
      expect(getPhysicalScreenShortestSide()).toBeNull();
    });

    it('prioriterer visualViewport og falder tilbage til vinduets viewport', () => {
      configureDevice({
        viewportWidth: 1440,
        viewportHeight: 900,
        visualViewport: { width: 390, height: 844 },
      });
      expect(getViewportShortestSide()).toBe(390);

      configureDevice({
        viewportWidth: 1440,
        viewportHeight: 900,
        visualViewport: { width: undefined, height: 600 },
      });
      expect(getViewportShortestSide()).toBe(600);

      configureDevice({
        viewportWidth: 1440,
        viewportHeight: 900,
        visualViewport: { width: undefined, height: undefined },
      });
      expect(getViewportShortestSide()).toBe(900);

      configureDevice({
        viewportWidth: 1440,
        viewportHeight: null,
        visualViewport: { width: 600, height: null },
      });
      expect(getViewportShortestSide()).toBe(600);
    });
  });

  describe('isTouchLikeDeviceWithShortestSideAtMost', () => {
    it('fastholder touch-telefonklassifikation ved høj devicePixelRatio i landscape', () => {
      configureDevice({
        maxTouchPoints: 5,
        coarsePointer: true,
        screenWidth: 2556,
        screenHeight: 1179,
        viewportWidth: 844,
        viewportHeight: 390,
      });

      expect(isTouchLikeDeviceWithShortestSideAtMost(599)).toBe(true);
    });

    it('klassificerer ikke almindelig desktop som touch-telefon', () => {
      configureDevice({
        maxTouchPoints: 0,
        coarsePointer: false,
        screenWidth: 1440,
        screenHeight: 900,
        viewportWidth: 1440,
        viewportHeight: 900,
      });

      expect(isTouchLikeDeviceWithShortestSideAtMost(599)).toBe(false);
    });

    it('behandler manglende skærm- og viewportmål som unsupported', () => {
      configureDevice({
        maxTouchPoints: 5,
        coarsePointer: true,
        screenWidth: null,
        screenHeight: null,
        viewportWidth: null,
        viewportHeight: null,
        visualViewport: { width: undefined, height: undefined },
      });

      expect(isTouchLikeDeviceWithShortestSideAtMost(599)).toBe(true);
    });
  });
});
