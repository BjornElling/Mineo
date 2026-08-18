import React from 'react';
import { CONTENT_SCALE_CSS_VARIABLE, resolveContentUiScale } from '../utils/uiScale';

/** Holder CSS-variablen ajour med browserens indre viewport uden at røre input-state. */
export const useContentUiScale = (): void => {
  React.useLayoutEffect(() => {
    const root = document.documentElement;
    // Skalaen er en ren funktion af bredden, så en uændret bredde ikke skal skrive i style-attributten.
    let appliedScale: number | null = null;

    const applyScale = (): void => {
      const nextScale = resolveContentUiScale(window.innerWidth);
      if (nextScale === appliedScale) return;
      root.style.setProperty(CONTENT_SCALE_CSS_VARIABLE, String(nextScale));
      appliedScale = nextScale;
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
