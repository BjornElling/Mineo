// @vitest-environment jsdom
import { isTouchLikeDeviceWithShortestSideAtMost } from '../../utils/clientDevice';

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
  screenWidth = 1024,
  screenHeight = 768,
  viewportWidth = 1024,
  viewportHeight = 768,
}: {
  maxTouchPoints?: number;
  coarsePointer?: boolean;
  screenWidth?: number;
  screenHeight?: number;
  viewportWidth?: number;
  viewportHeight?: number;
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
  window.matchMedia = vi.fn((query: string) => createMediaQueryList(
    query === '(pointer: coarse)' || query === '(hover: none)' ? coarsePointer : false,
    query,
  ));
};

describe('clientDevice', () => {
  const originalMatchMedia = window.matchMedia;

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
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
  });
});
