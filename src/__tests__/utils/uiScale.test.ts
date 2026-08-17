// @vitest-environment jsdom
import { createThemeBootstrapScript } from '../../settings/themeBootstrap';
import {
  CONTENT_SCALE_CSS_VARIABLE,
  CONTENT_UI_SCALE_POLICY,
  getCollapsedSideMenuIconLayout,
  getContentMainPaddingLeftForMenuScale,
  getContentScrollPaddingLeftForMenuScale,
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
    [1920, 1],
    [1536, 0.95],
    [1419, 0.9],
    [1366, 0.85],
    [1357, 0.85],
  ] as const)('vælger det største forsvarlige trin ved %d CSS-px', (width, expected) => {
    expect(resolveContentUiScale(width)).toBe(expected);
  });

  it.each([
    [1, 24, 50],
    [0.85, 18.545454545454543, 32.95454545454545],
    [0.78, 16, 25],
  ] as const)('lader indholdets venstregutter følge labelskalaen %s', (menuContentScale, scrollPadding, mainPadding) => {
    expect(getContentScrollPaddingLeftForMenuScale(menuContentScale)).toBeCloseTo(scrollPadding, 10);
    expect(getContentMainPaddingLeftForMenuScale(menuContentScale)).toBeCloseTo(mainPadding, 10);
  });

  it('bruger policyens fælles breddeberegning', () => {
    expect(requiredViewportWidthForScale(1)).toBe(
      CONTENT_UI_SCALE_POLICY.fixedLeftWidthPx
      + CONTENT_UI_SCALE_POLICY.fixedContentExtensionPx
      + CONTENT_UI_SCALE_POLICY.scrollbarReservePx
    );
    expect(requiredViewportWidthForScale(0.85)).toBe(1356.5);
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

  it('forsinker kun opadgående skift med hysterese', () => {
    expect(resolveContentUiScale(1490, 0.9)).toBe(0.9);
    expect(resolveContentUiScale(1498, 0.9)).toBe(0.95);
    expect(resolveContentUiScale(1410, 0.95)).toBe(0.85);
  });

  it.each([
    [1920, 1],
    [1536, 0.95],
    [1419, 0.9],
    [1366, 0.85],
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
