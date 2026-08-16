import React from 'react';
import {
  CONTENT_SCALE_CSS_VARIABLE,
  CONTENT_UI_SCALE_POLICY,
  resolveContentUiScale,
  type ContentUiScale,
} from '../utils/uiScale';

const readInlineScale = (root: HTMLElement): ContentUiScale | undefined => {
  const value = Number.parseFloat(root.style.getPropertyValue(CONTENT_SCALE_CSS_VARIABLE));
  return CONTENT_UI_SCALE_POLICY.scaleSteps.some((step) => step === value)
    ? value as ContentUiScale
    : undefined;
};

/** Holder den CSS-variablen ajour med browserens indre viewport uden at røre input-state. */
export const useContentUiScale = (): void => {
  const currentScaleRef = React.useRef<ContentUiScale | undefined>(undefined);

  React.useLayoutEffect(() => {
    const root = document.documentElement;
    currentScaleRef.current = readInlineScale(root);

    const applyScale = (): void => {
      const nextScale = resolveContentUiScale(window.innerWidth, currentScaleRef.current);
      root.style.setProperty(CONTENT_SCALE_CSS_VARIABLE, String(nextScale));
      currentScaleRef.current = nextScale;
    };

    applyScale();

    let frame: number | null = null;
    const handleResize = (): void => {
      if (frame !== null) return;
      frame = window.requestAnimationFrame(() => {
        frame = null;
        applyScale();
      });
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      if (frame !== null) window.cancelAnimationFrame(frame);
    };
  }, []);
};
