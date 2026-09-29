// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';

import { CONTENT_SCALE_CSS_VARIABLE, resolveContentUiScale } from '../../utils/uiScale';
import { useContentUiScale } from '../../hooks/useContentUiScale';

type FrameCallback = (timestamp: number) => void;

const setInnerWidth = (value: number): void => {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value });
};

describe('useContentUiScale', () => {
  const originalInnerWidth = window.innerWidth;
  const originalRequestAnimationFrame = window.requestAnimationFrame;
  const originalCancelAnimationFrame = window.cancelAnimationFrame;

  afterEach(() => {
    setInnerWidth(originalInnerWidth);
    document.documentElement.style.removeProperty(CONTENT_SCALE_CSS_VARIABLE);
    Object.defineProperty(window, 'requestAnimationFrame', {
      configurable: true,
      writable: true,
      value: originalRequestAnimationFrame,
    });
    Object.defineProperty(window, 'cancelAnimationFrame', {
      configurable: true,
      writable: true,
      value: originalCancelAnimationFrame,
    });
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('anvender initial skala, coalescer resize og opdaterer CSS efter frame', () => {
    setInnerWidth(1920);
    const callbacks = new Map<number, FrameCallback>();
    let nextFrameId = 0;
    const requestAnimationFrame = vi.fn((callback: FrameCallback): number => {
      const frameId = ++nextFrameId;
      callbacks.set(frameId, callback);
      return frameId;
    });
    vi.stubGlobal('requestAnimationFrame', requestAnimationFrame);
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    Object.defineProperty(window, 'requestAnimationFrame', { configurable: true, value: requestAnimationFrame });
    Object.defineProperty(window, 'cancelAnimationFrame', { configurable: true, value: vi.fn() });

    const { result } = renderHook(() => useContentUiScale());

    expect(result.current).toBe(1);
    expect(document.documentElement.style.getPropertyValue(CONTENT_SCALE_CSS_VARIABLE)).toBe('1');

    setInnerWidth(1366);
    act(() => {
      window.dispatchEvent(new Event('resize'));
      window.dispatchEvent(new Event('resize'));
    });

    expect(requestAnimationFrame).toHaveBeenCalledOnce();
    expect(result.current).toBe(1);

    act(() => {
      callbacks.get(1)?.(0);
    });

    expect(result.current).toBe(resolveContentUiScale(1366));
    expect(document.documentElement.style.getPropertyValue(CONTENT_SCALE_CSS_VARIABLE)).toBe('0.86');

    setInnerWidth(1366);
    act(() => {
      window.dispatchEvent(new Event('resize'));
      callbacks.get(2)?.(0);
    });
    expect(requestAnimationFrame).toHaveBeenCalledTimes(2);
    expect(document.documentElement.style.getPropertyValue(CONTENT_SCALE_CSS_VARIABLE)).toBe('0.86');
  });

  it('annullerer et ventende frame ved unmount', () => {
    setInnerWidth(1920);
    let nextFrameId = 0;
    const cancelAnimationFrame = vi.fn();
    const requestAnimationFrame = vi.fn(() => ++nextFrameId);
    vi.stubGlobal('requestAnimationFrame', requestAnimationFrame);
    vi.stubGlobal('cancelAnimationFrame', cancelAnimationFrame);
    Object.defineProperty(window, 'requestAnimationFrame', { configurable: true, value: requestAnimationFrame });
    Object.defineProperty(window, 'cancelAnimationFrame', { configurable: true, value: cancelAnimationFrame });

    const { unmount } = renderHook(() => useContentUiScale());
    setInnerWidth(1280);
    act(() => {
      window.dispatchEvent(new Event('resize'));
    });

    unmount();
    expect(cancelAnimationFrame).toHaveBeenCalledWith(1);
  });

  it('kan afmonteres uden ventende frame', () => {
    setInnerWidth(1920);
    const { unmount } = renderHook(() => useContentUiScale());

    expect(() => unmount()).not.toThrow();
  });
});
