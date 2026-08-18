// @vitest-environment jsdom
import { createThemeBootstrapScript } from '../../settings/themeBootstrap';
import {
  CONTENT_SCALE_CSS_VARIABLE,
  CONTENT_UI_SCALE_POLICY,
  MINIMUM_COVERED_VIEWPORT_WIDTH_PX,
  getCollapsedSideMenuIconLayout,
  getContentGutterCssForMenuScale,
  getContentGutterForMenuScale,
  getContentMainPaddingLeftForMenuScale,
  getExpandedSideMenuWidth,
  measureContentUiScaleRoot,
  requiredViewportWidthForScale,
  resolveContentUiScale,
} from '../../utils/uiScale';

describe('uiScale', () => {
  const originalInnerWidth = window.innerWidth;

  afterEach(() => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: originalInnerWidth,
    });
    document.documentElement.style.removeProperty(CONTENT_SCALE_CSS_VARIABLE);
  });

  it.each([
    [2560, 1],
    [1920, 1],
    [1568, 1],
    [1567, 0.99],
    [1536, 0.97],
    [1366, 0.84],
    // 1920×1200-skærmen ved 150 % zoom. Hele arbejdsfladen skal kunne være der uden vandret rul.
    [1280, 0.77],
    [1243, 0.75],
    [1000, 0.75],
  ] as const)('vælger den største skala der kan være i %d CSS-px', (width, expected) => {
    expect(resolveContentUiScale(width)).toBe(expected);
  });

  it.each([1920, 1568, 1536, 1440, 1366, 1300, 1280, 1244] as const)(
    'lader hele arbejdsfladen være i vinduet ved %d CSS-px',
    (width) => {
      const scale = resolveContentUiScale(width);

      expect(requiredViewportWidthForScale(scale)).toBeLessThanOrEqual(width);
      // Skalaen er også den STØRSTE der kan være der: et hundrededel mere ville kræve et bredere vindue.
      if (scale < CONTENT_UI_SCALE_POLICY.maximumScale) {
        expect(requiredViewportWidthForScale(scale + 0.01)).toBeGreaterThan(width);
      }
    },
  );

  it('er historieløs: samme bredde giver samme skala uanset retningen vinduet kom fra', () => {
    const widths = [1600, 1400, 1280, 1400, 1600];
    const scales = widths.map((width) => resolveContentUiScale(width));

    expect(scales[0]).toBe(scales[4]);
    expect(scales[1]).toBe(scales[3]);
  });

  it.each([
    [1, 24, 50],
    [0.85, 18.545454545454543, 32.95454545454545],
    [0.78, 16, 25],
  ] as const)('lader indholdets gutter og indrykning følge labelskalaen %s', (menuContentScale, gutter, mainPadding) => {
    expect(getContentGutterForMenuScale(menuContentScale)).toBeCloseTo(gutter, 10);
    expect(getContentMainPaddingLeftForMenuScale(menuContentScale)).toBeCloseTo(mainPadding, 10);
  });

  it('ganger den ydre gutter med arbejdsfladens skala i CSS', () => {
    expect(getContentGutterCssForMenuScale(1)).toBe(`calc(24px * var(${CONTENT_SCALE_CSS_VARIABLE}, 1))`);
    expect(getContentGutterCssForMenuScale(0.78)).toBe(`calc(16px * var(${CONTENT_SCALE_CSS_VARIABLE}, 1))`);
  });

  it('regner pladsen som sidemenu + skaleret arbejdsflade + scrollbar', () => {
    expect(CONTENT_UI_SCALE_POLICY.scaledWorkspaceWidthPx).toBe(24 + 50 + 1200 + 24);
    expect(requiredViewportWidthForScale(1)).toBe(
      CONTENT_UI_SCALE_POLICY.unscaledLeftWidthPx
      + CONTENT_UI_SCALE_POLICY.scaledWorkspaceWidthPx
      + CONTENT_UI_SCALE_POLICY.scrollbarReservePx
    );
    expect(MINIMUM_COVERED_VIEWPORT_WIDTH_PX).toBe(1243.5);
    expect(resolveContentUiScale(MINIMUM_COVERED_VIEWPORT_WIDTH_PX)).toBe(CONTENT_UI_SCALE_POLICY.minimumScale);
  });

  it.each([
    [1, 250],
    [0.95, 236.36363636363637],
    [0.9, 222.72727272727272],
    [0.85, 209.0909090909091],
    [0.78, 190],
    [0.6, 190],
  ] as const)('giver sidemenuen tekstluft ved lodret indholdsskala %s', (menuContentScale, expectedWidth) => {
    expect(getExpandedSideMenuWidth(menuContentScale)).toBeCloseTo(expectedWidth, 10);
  });

  it.each([
    [1, 44, 20, 34.5, 10.5, 0.5],
    [0.85, 37.4, 17, 34.5, 16.58823529411765, 6.588235294117645],
    [0.78, 34.32, 15.600000000000001, 34.5, 20.23076923076923, 10.230769230769226],
  ] as const)('forankrer kollapsede og udfoldede ikoner ved labelskala %s', (menuContentScale, buttonSize, iconSize, iconCenter, expandedPaddingLeft, expandedSquareButtonMarginLeft) => {
    const layout = getCollapsedSideMenuIconLayout(menuContentScale);
    expect(layout.buttonSizePx).toBeCloseTo(buttonSize, 10);
    expect(layout.iconSizePx).toBeCloseTo(iconSize, 10);
    expect(layout.iconCenterPx).toBeCloseTo(iconCenter, 10);
    expect(layout.expandedButtonPaddingLeftPx).toBeCloseTo(expandedPaddingLeft, 10);
    expect(layout.expandedSquareButtonMarginLeftPx).toBeCloseTo(expandedSquareButtonMarginLeft, 10);
  });

  it.each([
    [1920, 1],
    [1536, 0.97],
    [1366, 0.84],
    [1280, 0.77],
    [1000, 0.75],
  ] as const)('bootstrap-scriptet matcher runtime-policyen ved %d CSS-px', (width, expected) => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
    new Function(createThemeBootstrapScript())();

    expect(document.documentElement.style.getPropertyValue(CONTENT_SCALE_CSS_VARIABLE)).toBe(String(expected));
    expect(expected).toBe(resolveContentUiScale(width));
  });

  it('returnerer neutral skala for jsdom og ugyldig geometri', () => {
    const root = document.createElement('main');
    document.body.appendChild(root);

    expect(measureContentUiScaleRoot(root)).toBe(1);

    root.remove();
    expect(measureContentUiScaleRoot(null)).toBe(1);
  });
});
