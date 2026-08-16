// @vitest-environment jsdom
import { createThemeBootstrapScript } from '../../settings/themeBootstrap';
import {
  CONTENT_SCALE_CSS_VARIABLE,
  CONTENT_UI_SCALE_POLICY,
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

  it('bruger policyens fælles breddeberegning', () => {
    expect(requiredViewportWidthForScale(1)).toBe(
      CONTENT_UI_SCALE_POLICY.fixedLeftWidthPx
      + CONTENT_UI_SCALE_POLICY.fixedContentExtensionPx
      + CONTENT_UI_SCALE_POLICY.scrollbarReservePx
    );
    expect(requiredViewportWidthForScale(0.85)).toBe(1356.5);
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
